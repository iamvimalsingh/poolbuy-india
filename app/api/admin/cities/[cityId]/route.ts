import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/require-admin';
import { updateCity } from '@/lib/cities';
import { z } from 'zod';

const updateCitySchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  state: z.string().trim().min(2).max(80).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ cityId: string }> }
): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  const { cityId } = await params;
  if (!cityId) {
    return NextResponse.json(
      { success: false, error: { code: 'MISSING_PARAM', message: 'City ID is required' } },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_JSON', message: 'Request body must be JSON' } },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const parsed = updateCitySchema.safeParse(body);
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
    const updated = await updateCity(cityId, parsed.data);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: { code: 'CITY_NOT_FOUND', message: 'City not found' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    revalidatePath('/');
    revalidatePath(`/city/${updated.slug}`);

    return NextResponse.json(
      { success: true, data: updated },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update city';
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
