import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/require-admin';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { isDemoMode } from '@/lib/data-mode';
import { convertRequestSchema } from '@/lib/validation';
import { getCityBySlug } from '@/lib/cities';
import { getCategoryBySlug } from '@/lib/categories';
import {
  MOCK_ADMIN_POOLS,
  addDemoPool,
  getDemoRequests,
  updateDemoRequest,
} from '@/lib/mock-data';
import { AdminPool, PoolCategory } from '@/types';
import { slugify } from '@/lib/format';

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

const LEGACY_CATEGORY_MAP: Record<string, PoolCategory> = {
  'ev-scooters': 'EV_SCOOTERS',
  'cars': 'CARS',
  'rooftop-solar': 'ROOFTOP_SOLAR',
  'laptops': 'LAPTOPS',
  'smart-tvs': 'SMART_TVS',
  'tractors-commercial': 'TRACTORS_COMMERCIAL',
};

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const { requestId } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const parsed = convertRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid conversion payload.',
            issues: parsed.error.issues,
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const val = parsed.data;

    // 1. Verify Request exists & check Idempotency (prevent duplicate conversions on retries)
    if (isDemoMode()) {
      const existingReq = getDemoRequests().find((r) => r.id === requestId);
      if (!existingReq) {
        return NextResponse.json(
          { success: false, error: { code: 'REQUEST_NOT_FOUND', message: 'Demand request not found.' } },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      if (existingReq.resultingPoolId || existingReq.conversionStatus === 'CONVERTED') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'ALREADY_CONVERTED',
              message: `This request has already been approved and converted into pool ID "${existingReq.resultingPoolId}".`,
            },
          },
          { status: 409, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    } else {
      const supabase = getAdminSupabase();
      if (supabase) {
        const { data: reqRow, error: reqErr } = await supabase
          .from('pool_requests')
          .select('*')
          .eq('id', requestId)
          .maybeSingle();

        if (reqErr || !reqRow) {
          return NextResponse.json(
            { success: false, error: { code: 'REQUEST_NOT_FOUND', message: 'Demand request not found.' } },
            { status: 404, headers: { 'Cache-Control': 'no-store' } }
          );
        }

        if (reqRow.resulting_pool_id || reqRow.conversion_status === 'CONVERTED') {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'ALREADY_CONVERTED',
                message: `This request has already been approved and converted into pool ID "${reqRow.resulting_pool_id}".`,
              },
            },
            { status: 409, headers: { 'Cache-Control': 'no-store' } }
          );
        }
      }
    }

    // 2. Validate City: must be an active, operational city
    const city = await getCityBySlug(val.citySlug);
    if (!city || !city.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INACTIVE_CITY',
            message: `City "${val.citySlug}" is not currently operational. Please activate or configure vendor coverage for this city before launching an operational pool.`,
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 3. Validate Category: must exist
    const categoryObj = await getCategoryBySlug(val.categorySlug);
    if (!categoryObj || !categoryObj.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CATEGORY',
            message: `Category "${val.categorySlug}" does not exist or is inactive.`,
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 4. Form pool slug & parameters
    const poolSlug = val.productSlug ? slugify(val.productSlug) : slugify(val.productName);
    const deadline = new Date(Date.now() + val.durationDays * 24 * 60 * 60 * 1000).toISOString();
    const mappedCategory: PoolCategory =
      LEGACY_CATEGORY_MAP[val.categorySlug] || 'EV_SCOOTERS';

    // 5. Create the Operational Pool
    let createdPoolId = '';
    if (isDemoMode()) {
      // Check duplicate (city_slug, slug)
      const duplicate = MOCK_ADMIN_POOLS.find(
        (p) => p.citySlug.toLowerCase() === city.slug.toLowerCase() && p.slug === poolSlug
      );
      if (duplicate) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'DUPLICATE_POOL',
              message: `A pool for "${poolSlug}" in "${city.name}" already exists.`,
            },
          },
          { status: 409, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      createdPoolId = `pool-${city.slug}-${poolSlug}-${Date.now().toString(36)}`;
      const newAdminPool: AdminPool = {
        id: createdPoolId,
        slug: poolSlug,
        name: val.productName,
        shortDescription: val.shortDescription || `Exclusive group-buying deal for ${val.productName} in ${city.name}.`,
        longDescription: val.longDescription || `Community pool launched from verified buyer interest in ${city.name}. Final terms confirmed with authorized local dealers.`,
        category: mappedCategory,
        categorySlug: val.categorySlug,
        city: city.name,
        citySlug: city.slug,
        productBrand: val.productBrand,
        productModel: val.productModel,
        imageUrl: null,
        marketPrice: val.marketPrice || null,
        groupPrice: val.groupPrice || null,
        targetBuyers: val.targetBuyers,
        currentBuyers: 0,
        deadline,
        status: 'ACTIVE',
        priceIsVerified: Boolean(val.dealerName),
        priceVerifiedAt: val.dealerName ? new Date().toISOString() : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dealerName: val.dealerName || null,
        tokenAmount: null,
        tokenPaymentUrl: null,
        dealerOfferUrl: null,
        dealerTerms: null,
      };

      addDemoPool(newAdminPool);

      // Link request to resulting pool
      updateDemoRequest(requestId, {
        status: 'APPROVED',
        conversionStatus: 'CONVERTED',
        resultingPoolId: createdPoolId,
      });
    } else {
      const supabase = getAdminSupabase();
      if (!supabase) {
        return NextResponse.json(
          { success: false, error: { code: 'SERVER_ERROR', message: 'Database client unavailable.' } },
          { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      // Check composite duplicate
      const { data: existingPool } = await supabase
        .from('pools')
        .select('id')
        .eq('city_slug', city.slug)
        .eq('slug', poolSlug)
        .maybeSingle();

      if (existingPool) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'DUPLICATE_POOL',
              message: `A pool for "${poolSlug}" in "${city.name}" already exists.`,
            },
          },
          { status: 409, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('pools')
        .insert({
          slug: poolSlug,
          name: val.productName,
          short_description: val.shortDescription || `Exclusive group-buying deal for ${val.productName} in ${city.name}.`,
          long_description: val.longDescription || `Community pool launched from verified buyer interest in ${city.name}.`,
          category: mappedCategory,
          city: city.name,
          city_slug: city.slug,
          product_brand: val.productBrand,
          product_model: val.productModel,
          market_price: val.marketPrice || null,
          group_price: val.groupPrice || null,
          target_buyers: val.targetBuyers,
          current_buyers: 0,
          deadline,
          status: 'ACTIVE',
          price_is_verified: Boolean(val.dealerName),
          dealer_name: val.dealerName || null,
        })
        .select()
        .single();

      if (insertErr || !inserted) {
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: insertErr?.message || 'Failed to create pool.' } },
          { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      createdPoolId = inserted.id;

      // Link request to resulting pool
      await supabase
        .from('pool_requests')
        .update({
          status: 'APPROVED',
          conversion_status: 'CONVERTED',
          resulting_pool_id: createdPoolId,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);
    }

    // 6. Revalidate affected routes
    revalidatePath('/');
    revalidatePath(`/city/${city.slug}`);
    revalidatePath(`/category/${val.categorySlug}`);
    revalidatePath(`/deals/${city.slug}/${poolSlug}`);

    return NextResponse.json(
      {
        success: true,
        data: {
          requestId,
          poolId: createdPoolId,
          poolSlug,
          citySlug: city.slug,
          dealUrl: `/deals/${city.slug}/${poolSlug}`,
        },
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const error = err as { message?: string };
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message || 'Conversion failed.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
