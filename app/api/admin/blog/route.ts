import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/require-admin';
import { blogPostSchema } from '@/lib/validation';
import { getAllBlogPosts, createBlogPost } from '@/lib/blog';

export async function GET(request: NextRequest) {
  const authError = await requireAdminSession(request);
  if (authError) return authError;

  try {
    const posts = await getAllBlogPosts();
    return NextResponse.json(
      { success: true, data: posts },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err.message || 'Error loading blog posts.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const body = await request.json();
    const parseResult = blogPostSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: parseResult.error.issues[0]?.message || 'Invalid blog post payload.',
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const post = await createBlogPost(parseResult.data);

    try {
      revalidatePath('/blog');
      revalidatePath(`/blog/${post.slug}`);
      revalidatePath('/sitemap.xml');
      revalidatePath('/feed.xml');
    } catch (revalErr) {
      console.warn('Revalidation notice:', revalErr);
    }

    return NextResponse.json(
      { success: true, data: post },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json(
      { success: false, error: { code: 'CREATE_ERROR', message: err.message || 'Failed to create blog post.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
