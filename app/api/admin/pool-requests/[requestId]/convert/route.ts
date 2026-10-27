import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/require-admin';
import { requireD1Database } from '@/lib/d1/db';
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
import { recordAdminAudit } from '@/lib/audit';

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
      const db = await requireD1Database();
      const reqRow = await db
        .prepare('SELECT id, resulting_pool_id, conversion_status FROM pool_requests WHERE id = ?')
        .bind(requestId)
        .first<{ id: string; resulting_pool_id: string | null; conversion_status: string }>();

      if (!reqRow) {
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
        isPublished: false, // Converts to draft group; publish is a separate action
        sourceRequestId: requestId,
        connectionStatus: 'NOT_ELIGIBLE',
        paymentConfigState: 'DISABLED',
        marketPriceType: 'INDICATIVE_ESTIMATE',
        groupPriceType: 'INDICATIVE_ESTIMATE',
        savingsDisplayApproved: false,
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

      await recordAdminAudit({
        action: 'POOL_CONVERTED',
        targetType: 'POOL',
        targetId: createdPoolId,
        changesSummary: `Converted request ${requestId} into pool "${newAdminPool.name}".`,
        details: { requestId, poolId: createdPoolId, name: newAdminPool.name },
      });
    } else {
      const db = await requireD1Database();

      // Check composite duplicate
      const existingPool = await db
        .prepare('SELECT id FROM pools WHERE city_slug = ? AND slug = ?')
        .bind(city.slug, poolSlug)
        .first<{ id: string }>();

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

      createdPoolId = `pool-${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      await db.batch([
        db.prepare(
          `INSERT INTO pools (
            id, slug, name, short_description, long_description,
            category, category_slug, city, city_slug,
            product_brand, product_model, image_url,
            market_price, group_price, target_buyers, current_buyers,
            deadline, status, is_published, source_request_id,
            connection_status, payment_config_state,
            market_price_type, group_price_type, savings_display_approved,
            price_is_verified, price_verified_at, dealer_name,
            created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, NULL,
            ?, ?, ?, 0,
            ?, 'ACTIVE', 0, ?,
            'NOT_ELIGIBLE', 'DISABLED',
            'INDICATIVE_ESTIMATE', 'INDICATIVE_ESTIMATE', 0,
            ?, ?, ?,
            ?, ?
          )`
        ).bind(
          createdPoolId,
          poolSlug,
          val.productName,
          val.shortDescription || `Exclusive group-buying deal for ${val.productName} in ${city.name}.`,
          val.longDescription || `Community pool launched from verified buyer interest in ${city.name}.`,
          mappedCategory,
          val.categorySlug,
          city.name,
          city.slug,
          val.productBrand || null,
          val.productModel || null,
          val.marketPrice || null,
          val.groupPrice || null,
          val.targetBuyers,
          deadline,
          requestId,
          val.dealerName ? 1 : 0,
          val.dealerName ? now : null,
          val.dealerName || null,
          now,
          now
        ),
        db.prepare(
          `UPDATE pool_requests
           SET status = 'APPROVED',
               conversion_status = 'CONVERTED',
               resulting_pool_id = ?,
               reviewed_at = ?,
               updated_at = ?
           WHERE id = ?`
        ).bind(createdPoolId, now, now, requestId),
      ]);

      await recordAdminAudit({
        action: 'POOL_CONVERTED',
        targetType: 'POOL',
        targetId: createdPoolId,
        changesSummary: `Converted request ${requestId} into pool "${val.productName}".`,
        details: { requestId, poolId: createdPoolId, name: val.productName },
      });
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
