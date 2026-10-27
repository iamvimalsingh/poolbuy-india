import { BlogPost } from '@/types';
import { BlogPostSchemaInput } from './validation';
import { isDemoMode } from './data-mode';
import {
  getDemoBlogPosts,
  addDemoBlogPost,
  updateDemoBlogPost,
  deleteDemoBlogPost,
} from './mock-data';
import { getPublicSupabase } from './supabase/public';
import { getAdminSupabase } from './supabase/admin';

interface SupabaseBlogPostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  topic: string;
  tags: string[];
  cover_image_url: string | null;
  cover_image_alt: string | null;
  meta_title: string | null;
  meta_description: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  published_at: string | null;
  created_at: string;
  updated_at: string;
  sources: string[] | null;
  editorial_notes: string | null;
}

function mapRowToBlogPost(row: SupabaseBlogPostRow): BlogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    author: row.author,
    topic: row.topic,
    tags: Array.isArray(row.tags) ? row.tags : [],
    coverImageUrl: row.cover_image_url,
    coverImageAlt: row.cover_image_alt,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    status: row.status,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sources: Array.isArray(row.sources) ? row.sources : undefined,
    editorialNotes: row.editorial_notes,
  };
}

export { calculateReadingTime, safeRenderMarkdown } from './blog-render';

/**
 * Returns all published blog posts for public directory, sitemap, and RSS.
 */
export async function getPublishedBlogPosts(): Promise<BlogPost[]> {
  if (isDemoMode()) {
    const posts = getDemoBlogPosts();
    return posts
      .filter((p) => p.status === 'PUBLISHED')
      .sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime());
  }

  const supabase = getPublicSupabase();
  if (!supabase) {
    const posts = getDemoBlogPosts();
    return posts.filter((p) => p.status === 'PUBLISHED');
  }

  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('status', 'PUBLISHED')
    .order('published_at', { ascending: false });

  if (error) {
    console.warn('Error fetching published blog posts from Supabase, falling back to mock:', error.message);
    return getDemoBlogPosts().filter((p) => p.status === 'PUBLISHED');
  }

  return (data || []).map((row) => mapRowToBlogPost(row as SupabaseBlogPostRow));
}

/**
 * Looks up a single blog post by its unique slug.
 */
export async function getBlogPostBySlug(
  slug: string,
  options?: { allowDraft?: boolean }
): Promise<BlogPost | null> {
  const normalizedSlug = slug.toLowerCase().trim();

  if (isDemoMode()) {
    const post = getDemoBlogPosts().find((p) => p.slug === normalizedSlug);
    if (!post) return null;
    if (post.status !== 'PUBLISHED' && !options?.allowDraft) {
      return null;
    }
    return post;
  }

  const supabase = options?.allowDraft ? getAdminSupabase() : getPublicSupabase();
  if (!supabase) {
    const post = getDemoBlogPosts().find((p) => p.slug === normalizedSlug);
    return post || null;
  }

  let query = supabase.from('blog_posts').select('*').eq('slug', normalizedSlug);
  if (!options?.allowDraft) {
    query = query.eq('status', 'PUBLISHED');
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;

  return mapRowToBlogPost(data as SupabaseBlogPostRow);
}

/**
 * Returns all blog posts (including Drafts and Archived) for the Admin CMS.
 */
export async function getAllBlogPosts(): Promise<BlogPost[]> {
  if (isDemoMode()) {
    return getDemoBlogPosts();
  }

  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Error fetching all blog posts from Supabase, falling back to mock:', error.message);
    return getDemoBlogPosts();
  }

  return (data || []).map((row) => mapRowToBlogPost(row as SupabaseBlogPostRow));
}

/**
 * Creates a new blog post in draft or published status (Admin only).
 */
export async function createBlogPost(input: BlogPostSchemaInput): Promise<BlogPost> {
  const now = new Date().toISOString();
  const isPublished = input.status === 'PUBLISHED';

  if (isDemoMode()) {
    const newPost: BlogPost = {
      id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt,
      content: input.content,
      author: input.author,
      topic: input.topic,
      tags: input.tags || [],
      coverImageUrl: input.coverImageUrl || null,
      coverImageAlt: input.coverImageAlt || null,
      metaTitle: input.metaTitle || null,
      metaDescription: input.metaDescription || null,
      status: input.status,
      publishedAt: isPublished ? now : null,
      createdAt: now,
      updatedAt: now,
      sources: input.sources || [],
      editorialNotes: input.editorialNotes || null,
    };
    addDemoBlogPost(newPost);
    return newPost;
  }

  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt,
      content: input.content,
      author: input.author,
      topic: input.topic,
      tags: input.tags || [],
      cover_image_url: input.coverImageUrl || null,
      cover_image_alt: input.coverImageAlt || null,
      meta_title: input.metaTitle || null,
      meta_description: input.metaDescription || null,
      status: input.status,
      published_at: isPublished ? now : null,
      sources: input.sources || [],
      editorial_notes: input.editorialNotes || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create blog post: ${error.message}`);
  }

  return mapRowToBlogPost(data as SupabaseBlogPostRow);
}

/**
 * Updates an existing blog post (Admin only).
 */
export async function updateBlogPost(
  id: string,
  updates: Partial<BlogPost>
): Promise<BlogPost | null> {
  const now = new Date().toISOString();

  if (isDemoMode()) {
    const payload = {
      ...updates,
      ...(updates.status === 'PUBLISHED' && { publishedAt: now }),
    };
    return updateDemoBlogPost(id, payload);
  }

  const supabase = getAdminSupabase();
  const dbPayload: Record<string, unknown> = {
    updated_at: now,
  };

  if (updates.title !== undefined) dbPayload.title = updates.title;
  if (updates.slug !== undefined) dbPayload.slug = updates.slug;
  if (updates.excerpt !== undefined) dbPayload.excerpt = updates.excerpt;
  if (updates.content !== undefined) dbPayload.content = updates.content;
  if (updates.author !== undefined) dbPayload.author = updates.author;
  if (updates.topic !== undefined) dbPayload.topic = updates.topic;
  if (updates.tags !== undefined) dbPayload.tags = updates.tags;
  if (updates.coverImageUrl !== undefined) dbPayload.cover_image_url = updates.coverImageUrl;
  if (updates.coverImageAlt !== undefined) dbPayload.cover_image_alt = updates.coverImageAlt;
  if (updates.metaTitle !== undefined) dbPayload.meta_title = updates.metaTitle;
  if (updates.metaDescription !== undefined) dbPayload.meta_description = updates.metaDescription;
  if (updates.status !== undefined) {
    dbPayload.status = updates.status;
    if (updates.status === 'PUBLISHED') {
      dbPayload.published_at = now;
    }
  }
  if (updates.sources !== undefined) dbPayload.sources = updates.sources;
  if (updates.editorialNotes !== undefined) dbPayload.editorial_notes = updates.editorialNotes;

  const { data, error } = await supabase
    .from('blog_posts')
    .update(dbPayload)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) return null;
  return mapRowToBlogPost(data as SupabaseBlogPostRow);
}

/**
 * Deletes a blog post (Admin only).
 */
export async function deleteBlogPost(id: string): Promise<boolean> {
  if (isDemoMode()) {
    return deleteDemoBlogPost(id);
  }

  const supabase = getAdminSupabase();
  const { error } = await supabase.from('blog_posts').delete().eq('id', id);
  return !error;
}
