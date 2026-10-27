import { BlogPost } from '@/types';
import { BlogPostSchemaInput } from './validation';
import { isDemoMode } from './data-mode';
import {
  getDemoBlogPosts,
  addDemoBlogPost,
  updateDemoBlogPost,
  deleteDemoBlogPost,
} from './mock-data';
import { getD1Database, requireD1Database } from './d1/db';

interface D1BlogPostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  topic: string;
  tags: string;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  meta_title: string | null;
  meta_description: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  published_at: string | null;
  sources: string | null;
  editorial_notes: string | null;
  created_at: string;
  updated_at: string;
}

function parseJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapRowToBlogPost(row: D1BlogPostRow): BlogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    author: row.author,
    topic: row.topic,
    tags: parseJsonArray(row.tags),
    coverImageUrl: row.cover_image_url,
    coverImageAlt: row.cover_image_alt,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    status: row.status,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sources: parseJsonArray(row.sources),
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
      .sort(
        (a, b) =>
          new Date(b.publishedAt || b.createdAt).getTime() -
          new Date(a.publishedAt || a.createdAt).getTime()
      );
  }

  const db = await getD1Database();
  if (!db) {
    console.error('getPublishedBlogPosts: D1 database unavailable');
    return [];
  }

  try {
    const { results } = await db
      .prepare(
        "SELECT * FROM blog_posts WHERE status = 'PUBLISHED' ORDER BY published_at DESC"
      )
      .all<D1BlogPostRow>();

    return (results || []).map(mapRowToBlogPost);
  } catch (error: unknown) {
    console.error('Error fetching published blog posts from D1:', error);
    return [];
  }
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
    if (post.status !== 'PUBLISHED' && !options?.allowDraft) return null;
    return post;
  }

  const db = await getD1Database();
  if (!db) return null;

  try {
    const row = await db
      .prepare('SELECT * FROM blog_posts WHERE slug = ?')
      .bind(normalizedSlug)
      .first<D1BlogPostRow>();

    if (!row) return null;
    if (row.status !== 'PUBLISHED' && !options?.allowDraft) return null;

    return mapRowToBlogPost(row);
  } catch (error: unknown) {
    console.error('Error looking up blog post by slug in D1:', error);
    return null;
  }
}

/**
 * Returns all blog posts (including Drafts and Archived) for the Admin CMS.
 */
export async function getAllBlogPosts(): Promise<BlogPost[]> {
  if (isDemoMode()) {
    return getDemoBlogPosts();
  }

  const db = await requireD1Database();
  const { results } = await db
    .prepare('SELECT * FROM blog_posts ORDER BY created_at DESC')
    .all<D1BlogPostRow>();

  return (results || []).map(mapRowToBlogPost);
}

/**
 * Creates a new blog post in draft or published status (Admin only).
 */
export async function createBlogPost(input: BlogPostSchemaInput): Promise<BlogPost> {
  const now = new Date().toISOString();
  const isPublished = input.status === 'PUBLISHED';
  const id = `post-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const publishedAt = isPublished ? now : null;

  if (isDemoMode()) {
    const newPost: BlogPost = {
      id,
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
      publishedAt,
      createdAt: now,
      updatedAt: now,
      sources: input.sources || [],
      editorialNotes: input.editorialNotes || null,
    };
    addDemoBlogPost(newPost);
    return newPost;
  }

  const db = await requireD1Database();
  await db
    .prepare(
      `INSERT INTO blog_posts (
        id, slug, title, excerpt, content, author, topic, tags,
        cover_image_url, cover_image_alt, meta_title, meta_description,
        status, published_at, sources, editorial_notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.slug,
      input.title,
      input.excerpt,
      input.content,
      input.author,
      input.topic,
      JSON.stringify(input.tags || []),
      input.coverImageUrl || null,
      input.coverImageAlt || null,
      input.metaTitle || null,
      input.metaDescription || null,
      input.status,
      publishedAt,
      JSON.stringify(input.sources || []),
      input.editorialNotes || null,
      now,
      now
    )
    .run();

  const created = await db
    .prepare('SELECT * FROM blog_posts WHERE id = ?')
    .bind(id)
    .first<D1BlogPostRow>();

  if (!created) {
    throw new Error('Failed to retrieve newly created blog post from D1');
  }

  return mapRowToBlogPost(created);
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

  const db = await requireD1Database();
  const setClauses: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (updates.title !== undefined) {
    setClauses.push('title = ?');
    values.push(updates.title);
  }
  if (updates.slug !== undefined) {
    setClauses.push('slug = ?');
    values.push(updates.slug);
  }
  if (updates.excerpt !== undefined) {
    setClauses.push('excerpt = ?');
    values.push(updates.excerpt);
  }
  if (updates.content !== undefined) {
    setClauses.push('content = ?');
    values.push(updates.content);
  }
  if (updates.author !== undefined) {
    setClauses.push('author = ?');
    values.push(updates.author);
  }
  if (updates.topic !== undefined) {
    setClauses.push('topic = ?');
    values.push(updates.topic);
  }
  if (updates.tags !== undefined) {
    setClauses.push('tags = ?');
    values.push(JSON.stringify(updates.tags));
  }
  if (updates.coverImageUrl !== undefined) {
    setClauses.push('cover_image_url = ?');
    values.push(updates.coverImageUrl);
  }
  if (updates.coverImageAlt !== undefined) {
    setClauses.push('cover_image_alt = ?');
    values.push(updates.coverImageAlt);
  }
  if (updates.metaTitle !== undefined) {
    setClauses.push('meta_title = ?');
    values.push(updates.metaTitle);
  }
  if (updates.metaDescription !== undefined) {
    setClauses.push('meta_description = ?');
    values.push(updates.metaDescription);
  }
  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    values.push(updates.status);
    if (updates.status === 'PUBLISHED') {
      setClauses.push('published_at = ?');
      values.push(now);
    }
  }
  if (updates.sources !== undefined) {
    setClauses.push('sources = ?');
    values.push(JSON.stringify(updates.sources));
  }
  if (updates.editorialNotes !== undefined) {
    setClauses.push('editorial_notes = ?');
    values.push(updates.editorialNotes);
  }

  values.push(id);

  await db
    .prepare(`UPDATE blog_posts SET ${setClauses.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  const row = await db
    .prepare('SELECT * FROM blog_posts WHERE id = ?')
    .bind(id)
    .first<D1BlogPostRow>();

  if (!row) return null;
  return mapRowToBlogPost(row);
}

/**
 * Deletes a blog post (Admin only).
 */
export async function deleteBlogPost(id: string): Promise<boolean> {
  if (isDemoMode()) {
    return deleteDemoBlogPost(id);
  }

  const db = await requireD1Database();
  const res = await db.prepare('DELETE FROM blog_posts WHERE id = ?').bind(id).run();
  return Boolean(res.success);
}
