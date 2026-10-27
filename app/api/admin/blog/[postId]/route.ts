import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/require-admin';
import { updateBlogPost, deleteBlogPost, getAllBlogPosts } from '@/lib/blog';
import { z } from 'zod';

type RouteContext = {
  params: Promise<{ postId: string }>;
};

const updateBlogSchema = z.object({
  title: z.string().trim().min(5).max(200).optional(),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  excerpt: z.string().trim().min(10).max(500).optional(),
  content: z.string().trim().min(20).optional(),
  author: z.string().trim().min(2).max(100).optional(),
  topic: z.string().trim().min(2).max(60).optional(),
  tags: z.array(z.string().trim()).optional(),
  coverImageUrl: z.string().trim().url().nullable().optional(),
  coverImageAlt: z.string().trim().max(200).nullable().optional(),
  metaTitle: z.string().trim().max(120).nullable().optional(),
  metaDescription: z.string().trim().max(250).nullable().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  sources: z.array(z.string().trim()).optional(),
  editorialNotes: z.string().trim().max(1000).nullable().optional(),
});

export async function GET(request: NextRequest, context: RouteContext) {
  const authError = await requireAdminSession(request);
  if (authError) return authError;

  const { postId } = await context.params;
  const allPosts = await getAllBlogPosts();
  const post = allPosts.find((p) => p.id === postId || p.slug === postId);

  if (!post) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Blog post not found.' } },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: post });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const { postId } = await context.params;
    const body = await request.json();
    const parseResult = updateBlogSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: parseResult.error.issues[0]?.message || 'Invalid update parameters.',
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const updated = await updateBlogPost(postId, parseResult.data);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Blog post not found.' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    try {
      revalidatePath('/blog');
      revalidatePath(`/blog/${updated.slug}`);
      revalidatePath('/sitemap.xml');
      revalidatePath('/feed.xml');
    } catch (revalErr) {
      console.warn('Revalidation notice:', revalErr);
    }

    return NextResponse.json(
      { success: true, data: updated },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json(
      { success: false, error: { code: 'UPDATE_ERROR', message: err.message || 'Update failed.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const { postId } = await context.params;
    const deleted = await deleteBlogPost(postId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Blog post not found.' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    try {
      revalidatePath('/blog');
      revalidatePath('/sitemap.xml');
      revalidatePath('/feed.xml');
    } catch (revalErr) {
      console.warn('Revalidation notice:', revalErr);
    }

    return NextResponse.json(
      { success: true, data: { action: 'deleted', id: postId } },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json(
      { success: false, error: { code: 'DELETE_ERROR', message: err.message || 'Delete failed.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
