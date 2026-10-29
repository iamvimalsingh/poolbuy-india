import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/require-admin';
import {
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
  getCategoryDependencies,
  CategoryDeletionBlockedError,
} from '@/lib/categories';
import { z } from 'zod';

const updateCategorySchema = z.object({
  label: z.string().trim().min(2).max(80).optional(),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

type RouteContext = {
  params: Promise<{ categoryId: string }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request);
  if (authError) return authError;

  const { categoryId } = await context.params;
  const category = (await getCategoryById(categoryId)) || (await getCategoryBySlug(categoryId));

  if (!category) {
    return NextResponse.json(
      { success: false, error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found' } },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const dependencies = await getCategoryDependencies(category.id, category.slug);
    return NextResponse.json(
      {
        success: true,
        data: {
          category,
          dependencies,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to inspect category dependencies';
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  const { categoryId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_JSON', message: 'Request body must be JSON' } },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const parsed = updateCategorySchema.safeParse(body);
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

  try {
    const updated = await updateCategory(categoryId, parsed.data);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    revalidatePath('/');
    revalidatePath(`/category/${updated.slug}`);

    return NextResponse.json(
      { success: true, data: updated },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update category';
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  const { categoryId } = await context.params;

  try {
    const result = await deleteCategory(categoryId);

    revalidatePath('/');
    revalidatePath(`/category/${result.deletedCategory.slug}`);

    return NextResponse.json(
      {
        success: true,
        data: {
          deletedId: result.deletedCategory.id,
          label: result.deletedCategory.label,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    if (err instanceof CategoryDeletionBlockedError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: err.code,
            message: err.message,
            dependencies: err.dependencies,
          },
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const message = err instanceof Error ? err.message : 'Failed to delete category';
    const status = message === 'Category not found' ? 404 : 500;
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message } },
      { status, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
