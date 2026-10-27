import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/require-admin';
import { getAllCategories, createCategory, getCategoryBySlug } from '@/lib/categories';
import { categorySchema } from '@/lib/validation';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = await requireAdminSession(request);
  if (authError) return authError;

  try {
    const categories = await getAllCategories();
    return NextResponse.json(
      { success: true, data: categories },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch categories';
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_JSON', message: 'Request body must be JSON' } },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Validation failed',
          issues: parsed.error.issues,
        },
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const { label, slug, description, isActive, sortOrder } = parsed.data;

  // Check if category slug already exists
  const existingCategory = await getCategoryBySlug(slug);
  if (existingCategory) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DUPLICATE_CATEGORY_SLUG',
          message: `A category with slug "${slug}" already exists.`,
        },
      },
      { status: 409, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const newCategory = await createCategory({
      label,
      slug,
      description,
      isActive,
      sortOrder,
    });

    revalidatePath('/');
    revalidatePath(`/category/${newCategory.slug}`);

    return NextResponse.json(
      { success: true, data: newCategory },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create category';
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
