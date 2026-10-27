import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/require-admin';
import { getAllCities, createCity, getCityBySlug } from '@/lib/cities';
import { slugify } from '@/lib/format';
import { z } from 'zod';

const createCitySchema = z.object({
  name: z.string().trim().min(2, 'City name must be at least 2 characters').max(80),
  state: z.string().trim().min(2, 'State must be at least 2 characters').max(80),
  slug: z.string().trim().optional(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = await requireAdminSession(request);
  if (authError) return authError;

  try {
    const cities = await getAllCities();
    return NextResponse.json(
      { success: true, data: cities },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch cities';
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

  const parsed = createCitySchema.safeParse(body);
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

  const { name, state, slug: customSlug } = parsed.data;
  const normalizedSlug = customSlug ? slugify(customSlug) : slugify(name);

  // Check if city slug already exists
  const existingCity = await getCityBySlug(normalizedSlug);
  if (existingCity) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DUPLICATE_CITY_SLUG',
          message: `A city with slug "${normalizedSlug}" already exists.`,
        },
      },
      { status: 409, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const newCity = await createCity({
      name,
      state,
      slug: normalizedSlug,
    });

    revalidatePath('/');
    revalidatePath(`/city/${newCity.slug}`);

    return NextResponse.json(
      { success: true, data: newCity },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create city';
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
