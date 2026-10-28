import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/require-admin';
import { requireD1Database } from '@/lib/d1/db';
import { isDemoMode } from '@/lib/data-mode';
import { convertRequestSchema } from '@/lib/validation';
import {
  addDemoPool,
  getDemoRequests,
  updateDemoRequest,
} from '@/lib/mock-data';
import { AdminPool, PoolCategory } from '@/types';
import { slugify } from '@/lib/format';
import { recordAdminAudit } from '@/lib/audit';
import { LAUNCH_CITIES } from '@/lib/constants';

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

function resolveCityName(slug: string): string {
  const found = LAUNCH_CITIES.find((c) => c.slug.toLowerCase() === slug.toLowerCase());
  if (found) return found.name;
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

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
    const finalTitle = (val.title || val.productName || val.poolTitle || '').trim();
    if (!finalTitle) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Pool title is required.' } },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Resolve city visibility labels (at least 1 required to publish)
    let selectedCitySlugs: string[] = [];
    if (val.citySlugs && val.citySlugs.length > 0) {
      selectedCitySlugs = val.citySlugs.map((s) => s.trim().toLowerCase());
    } else if (val.citySlug) {
      selectedCitySlugs = [val.citySlug.trim().toLowerCase()];
    } else {
      selectedCitySlugs = ['delhi', 'mumbai', 'pune'];
    }

    const isPublished = val.isPublished !== false;
    const categorySlug = val.categorySlug?.trim() || null;
    const internalCategoryId = val.internalCategoryId?.trim() || null;
    const mappedCategory: PoolCategory = categorySlug ? (LEGACY_CATEGORY_MAP[categorySlug] || 'ROOFTOP_SOLAR') : 'ROOFTOP_SOLAR';

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

      const poolSlug = slugify(finalTitle) + '-' + requestId.slice(-6);
      const createdPoolId = `pool-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const primaryCityName = resolveCityName(selectedCitySlugs[0]);
      const now = new Date().toISOString();
      const deadline = new Date(Date.now() + val.durationDays * 24 * 60 * 60 * 1000).toISOString();

      const newAdminPool: AdminPool = {
        id: createdPoolId,
        slug: poolSlug,
        name: finalTitle,
        shortDescription: val.shortDescription || `Community pool launched from verified buyer interest.`,
        longDescription: val.longDescription || `Community group deal aggregated from user demand across India.`,
        category: mappedCategory,
        categorySlug: categorySlug || 'rooftop-solar',
        city: primaryCityName,
        citySlug: selectedCitySlugs[0],
        productBrand: val.productBrand || 'Standardized Brand',
        productModel: val.productModel || 'Standardized Model',
        imageUrl: null,
        marketPrice: val.marketPrice || null,
        groupPrice: val.groupPrice || null,
        targetBuyers: 10,
        currentBuyers: 0,
        deadline,
        status: 'ACTIVE',
        isPublished,
        sourceRequestId: requestId,
        connectionStatus: 'NOT_ELIGIBLE',
        paymentConfigState: 'DISABLED',
        marketPriceType: 'INDICATIVE_ESTIMATE',
        groupPriceType: 'INDICATIVE_ESTIMATE',
        savingsDisplayApproved: false,
        priceIsVerified: Boolean(val.dealerName),
        priceVerifiedAt: val.dealerName ? now : null,
        createdAt: now,
        updatedAt: now,
        dealerName: val.dealerName || null,
        tokenAmount: null,
        tokenPaymentUrl: null,
        dealerOfferUrl: null,
        dealerTerms: null,
      };

      addDemoPool(newAdminPool);

      updateDemoRequest(requestId, {
        status: 'APPROVED',
        conversionStatus: 'CONVERTED',
        resultingPoolId: createdPoolId,
      });

      await recordAdminAudit({
        action: 'POOL_CONVERTED',
        targetType: 'POOL',
        targetId: createdPoolId,
        changesSummary: `Converted request ${requestId} into shared pool "${finalTitle}" across cities: ${selectedCitySlugs.join(', ')}.`,
        details: { requestId, poolId: createdPoolId, name: finalTitle, citySlugs: selectedCitySlugs },
      });

      return NextResponse.json(
        {
          success: true,
          data: {
            requestId,
            poolId: createdPoolId,
            poolSlug,
            citySlugs: selectedCitySlugs,
            isPublished,
            dealUrl: `/deals/${selectedCitySlugs[0]}/${poolSlug}`,
          },
        },
        { status: 201, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Live D1 Execution
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

    const poolSlug = slugify(finalTitle) + '-' + requestId.slice(-6);
    const createdPoolId = `pool-${crypto.randomUUID()}`;
    const primaryCitySlug = selectedCitySlugs[0];
    const primaryCityName = resolveCityName(primaryCitySlug);
    const now = new Date().toISOString();
    const deadline = new Date(Date.now() + (val.durationDays || 14) * 24 * 60 * 60 * 1000).toISOString();

    // Prepare atomic statements batch
    const statements = [
      // 1. Insert single Pool Master
      db.prepare(
        `INSERT INTO pools (
          id, slug, name, short_description, long_description,
          category, category_slug, internal_category_id,
          city, city_slug,
          product_brand, product_model, image_url,
          market_price, group_price, target_buyers, current_buyers,
          deadline, status, is_published, source_request_id,
          connection_status, payment_config_state,
          market_price_type, group_price_type, savings_display_approved,
          price_is_verified, price_verified_at, dealer_name,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, NULL,
          ?, ?, 10, 0,
          ?, 'ACTIVE', ?, ?,
          'NOT_ELIGIBLE', 'DISABLED',
          'INDICATIVE_ESTIMATE', 'INDICATIVE_ESTIMATE', 0,
          ?, ?, ?,
          ?, ?
        )`
      ).bind(
        createdPoolId,
        poolSlug,
        finalTitle,
        val.shortDescription || `Community pool launched from verified buyer interest.`,
        val.longDescription || `Community group deal aggregated from user demand across India.`,
        mappedCategory,
        categorySlug || 'rooftop-solar',
        internalCategoryId,
        primaryCityName,
        primaryCitySlug,
        val.productBrand || 'Standardized Brand',
        val.productModel || 'Standardized Model',
        val.marketPrice || null,
        val.groupPrice || null,
        deadline,
        isPublished ? 1 : 0,
        requestId,
        val.dealerName ? 1 : 0,
        val.dealerName ? now : null,
        val.dealerName || null,
        now,
        now
      ),
      // 2. Update Request Status atomically
      db.prepare(
        `UPDATE pool_requests
         SET status = 'APPROVED',
             conversion_status = 'CONVERTED',
             resulting_pool_id = ?,
             reviewed_at = ?,
             updated_at = ?
         WHERE id = ?`
      ).bind(createdPoolId, now, now, requestId),
    ];

    // 3. Insert city visibility mappings into pool_cities
    for (const cityCode of selectedCitySlugs) {
      const cityName = resolveCityName(cityCode);
      const mappingId = `pc-${createdPoolId}-${cityCode}`;
      statements.push(
        db.prepare(
          `INSERT OR IGNORE INTO pool_cities (
            id, pool_id, city_code, city_name, is_enabled, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 1, ?, ?)`
        ).bind(mappingId, createdPoolId, cityCode, cityName, now, now)
      );
    }

    // Execute atomic batch
    await db.batch(statements);

    await recordAdminAudit({
      action: 'POOL_CONVERTED',
      targetType: 'POOL',
      targetId: createdPoolId,
      changesSummary: `Converted request ${requestId} into shared pool "${finalTitle}" with visibility in: ${selectedCitySlugs.join(', ')}.`,
      details: { requestId, poolId: createdPoolId, name: finalTitle, citySlugs: selectedCitySlugs },
    });

    try {
      revalidatePath('/');
      for (const c of selectedCitySlugs) {
        revalidatePath(`/city/${c}`);
      }
    } catch {}

    return NextResponse.json(
      {
        success: true,
        data: {
          requestId,
          poolId: createdPoolId,
          poolSlug,
          citySlugs: selectedCitySlugs,
          isPublished,
          dealUrl: `/deals/${primaryCitySlug}/${poolSlug}`,
        },
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error('Request conversion error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message || 'Conversion failed.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
