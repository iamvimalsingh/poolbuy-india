import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/require-admin';
import { requireD1Database } from '@/lib/d1/db';
import { isDemoMode } from '@/lib/data-mode';
import { convertRequestSchema } from '@/lib/validation';
import {
  addDemoPool,
  addDemoLead,
  getDemoRequests,
  updateDemoRequest,
} from '@/lib/mock-data';
import { AdminPool, PoolCategory, PoolLead } from '@/types';
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
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
        { success: false, error: { code: 'INVALID_JSON', message: 'Body must be valid JSON.' } },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const parsed = convertRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: parsed.error.issues[0]?.message || 'Invalid conversion input.',
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const val = parsed.data;
    const isPublished = val.isPublished !== undefined ? val.isPublished : true;
    const internalCategoryId = val.internalCategoryId?.trim() || null;

    // 1. In Demo Mode
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
            data: {
              poolId: existingReq.resultingPoolId,
              requestId,
            },
          },
          { status: 409, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const finalTitle = (val.title || val.productName || val.poolTitle || existingReq.productName || 'Standardized Product').trim();
      const resolvedReqCity = (existingReq.cityText || existingReq.city || '').trim();
      let primaryCitySlug: string;
      if (val.citySlug) {
        primaryCitySlug = val.citySlug.trim().toLowerCase();
      } else if (val.citySlugs && val.citySlugs.length > 0) {
        primaryCitySlug = val.citySlugs[0].trim().toLowerCase();
      } else if (resolvedReqCity) {
        primaryCitySlug = slugify(resolvedReqCity);
      } else {
        primaryCitySlug = 'delhi';
      }

      const selectedCitySlugs: string[] = val.citySlugs && val.citySlugs.length > 0
        ? Array.from(new Set([primaryCitySlug, ...val.citySlugs.map((s) => s.trim().toLowerCase())]))
        : [primaryCitySlug];

      const resolvedCategorySlug = val.categorySlug?.trim() || existingReq.categorySlug || (existingReq.category ? String(existingReq.category).toLowerCase().replace(/_/g, '-') : 'rooftop-solar');
      const mappedCategory: PoolCategory = LEGACY_CATEGORY_MAP[resolvedCategorySlug] || (resolvedCategorySlug as PoolCategory);

      const resolvedBrand = val.productBrand && val.productBrand !== 'Standardized Brand'
        ? val.productBrand.trim()
        : (existingReq.brandPreference || val.productBrand || 'Standardized Brand');

      const resolvedModel = val.productModel && val.productModel !== 'Standardized Model'
        ? val.productModel.trim()
        : (existingReq.modelPreference || val.productModel || 'Standardized Model');

      const variantName = existingReq.modelPreference || (val.productModel !== 'Standardized Model' ? val.productModel : undefined);
      const targetBuyers = Number(val.targetBuyers && val.targetBuyers > 0 ? val.targetBuyers : (existingReq.targetBuyersRequested || 10));

      const poolSlug = slugify(finalTitle) + '-' + requestId.slice(-6);
      const createdPoolId = `pool-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const primaryCityName = resolveCityName(primaryCitySlug);
      const now = new Date().toISOString();
      const deadline = new Date(Date.now() + (val.durationDays || 14) * 24 * 60 * 60 * 1000).toISOString();

      // Check explicit membership consent for requester
      const hasJoinConsent = Boolean(existingReq.joinPoolConsent);
      const reqPhone = existingReq.whatsappNumber ? String(existingReq.whatsappNumber).trim() : null;
      const reqName = existingReq.fullName ? String(existingReq.fullName).trim() : null;
      const shouldCreateFirstMember = hasJoinConsent && reqPhone && reqName;

      const newAdminPool: AdminPool = {
        id: createdPoolId,
        slug: poolSlug,
        name: finalTitle,
        productTitle: finalTitle,
        variantName,
        shortDescription: val.shortDescription || `Community pool launched from verified buyer interest.`,
        longDescription: val.longDescription || `Community group deal aggregated from user demand across India.`,
        category: mappedCategory,
        categorySlug: resolvedCategorySlug,
        city: primaryCityName,
        citySlug: primaryCitySlug,
        productBrand: resolvedBrand,
        productModel: resolvedModel,
        imageUrl: null,
        marketPrice: val.marketPrice || null,
        groupPrice: val.groupPrice || null,
        targetBuyers,
        currentBuyers: shouldCreateFirstMember ? 1 : 0,
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

      if (shouldCreateFirstMember) {
        const firstLead: PoolLead = {
          id: `lead-${Date.now()}`,
          poolId: createdPoolId,
          poolSlug,
          poolName: finalTitle,
          poolCategory: mappedCategory,
          fullName: reqName!,
          whatsappNumber: reqPhone!,
          city: primaryCityName,
          buyingTimeline: 'THIS_MONTH',
          hasExistingQuote: false,
          existingQuoteAmount: null,
          extraMessage: existingReq.extraMessage || '',
          status: 'NEW',
          consentAt: now,
          privacyNoticeVersion: '2026-10-V4',
          createdAt: now,
          buyerNumber: 1,
        };
        addDemoLead(firstLead);
      }

      updateDemoRequest(requestId, {
        status: 'APPROVED',
        conversionStatus: 'CONVERTED',
        resultingPoolId: createdPoolId,
      });

      await recordAdminAudit({
        action: 'POOL_CONVERTED',
        targetType: 'POOL',
        targetId: createdPoolId,
        changesSummary: `Converted request ${requestId} into official pool "${finalTitle}" for ${primaryCityName}. First member created: ${Boolean(shouldCreateFirstMember)}.`,
        details: { requestId, poolId: createdPoolId, name: finalTitle, citySlug: primaryCitySlug, firstMemberCreated: Boolean(shouldCreateFirstMember) },
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
            firstMemberCreated: Boolean(shouldCreateFirstMember),
          },
        },
        { status: 201, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 2. Live D1 Execution
    const db = await requireD1Database();
    const reqRow = await db
      .prepare('SELECT * FROM pool_requests WHERE id = ?')
      .bind(requestId)
      .first<Record<string, unknown>>();

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
          data: {
            poolId: reqRow.resulting_pool_id,
            requestId,
          },
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const finalTitle = String(val.title || val.productName || val.poolTitle || reqRow.product_name || 'Standardized Product').trim();
    const resolvedReqCity = String(reqRow.city_text || reqRow.city || '').trim();

    let primaryCitySlug: string;
    if (val.citySlug) {
      primaryCitySlug = val.citySlug.trim().toLowerCase();
    } else if (val.citySlugs && val.citySlugs.length > 0) {
      primaryCitySlug = val.citySlugs[0].trim().toLowerCase();
    } else if (resolvedReqCity) {
      primaryCitySlug = slugify(resolvedReqCity);
    } else {
      primaryCitySlug = 'delhi';
    }

    const selectedCitySlugs: string[] = val.citySlugs && val.citySlugs.length > 0
      ? Array.from(new Set([primaryCitySlug, ...val.citySlugs.map((s) => s.trim().toLowerCase())]))
      : [primaryCitySlug];

    const primaryCityName = resolveCityName(primaryCitySlug);

    const resolvedCategorySlug = val.categorySlug?.trim() ||
      (reqRow.category_slug ? String(reqRow.category_slug).trim() : null) ||
      (reqRow.category ? String(reqRow.category).trim() : 'rooftop-solar');

    const mappedCategory: PoolCategory = LEGACY_CATEGORY_MAP[resolvedCategorySlug] || (resolvedCategorySlug as PoolCategory);

    const resolvedBrand = val.productBrand && val.productBrand !== 'Standardized Brand'
      ? val.productBrand.trim()
      : (reqRow.brand_preference ? String(reqRow.brand_preference).trim() : val.productBrand || 'Standardized Brand');

    const resolvedModel = val.productModel && val.productModel !== 'Standardized Model'
      ? val.productModel.trim()
      : (reqRow.model_preference ? String(reqRow.model_preference).trim() : val.productModel || 'Standardized Model');

    const variantName = reqRow.model_preference
      ? String(reqRow.model_preference).trim()
      : (val.productModel !== 'Standardized Model' ? val.productModel : null);

    const targetBuyers = Number(val.targetBuyers && val.targetBuyers > 0 ? val.targetBuyers : (reqRow.target_buyers_requested || 10));

    const poolSlug = slugify(finalTitle) + '-' + requestId.slice(-6);
    const createdPoolId = `pool-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const deadline = new Date(Date.now() + (val.durationDays || 14) * 24 * 60 * 60 * 1000).toISOString();

    // Check explicit membership consent for initial confirmed membership
    const hasJoinConsent = Boolean(reqRow.join_pool_consent);
    const reqPhone = reqRow.whatsapp_number ? String(reqRow.whatsapp_number).trim() : null;
    const reqName = reqRow.full_name ? String(reqRow.full_name).trim() : null;
    const shouldCreateFirstMember = hasJoinConsent && reqPhone && reqName;
    const initialBuyers = shouldCreateFirstMember ? 1 : 0;

    // Prepare atomic statements batch
    const statements = [
      // 1. Insert Pool Master
      db.prepare(
        `INSERT INTO pools (
          id, slug, name, product_title, variant_name, short_description, long_description,
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
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, NULL,
          ?, ?, ?, ?,
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
        finalTitle,
        variantName,
        val.shortDescription || `Community pool launched from verified buyer interest.`,
        val.longDescription || `Community group deal aggregated from user demand across India.`,
        mappedCategory,
        resolvedCategorySlug,
        internalCategoryId,
        primaryCityName,
        primaryCitySlug,
        resolvedBrand,
        resolvedModel,
        val.marketPrice || null,
        val.groupPrice || null,
        targetBuyers,
        initialBuyers,
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

    // 3. Initial membership creation if explicit consent is established
    if (shouldCreateFirstMember) {
      const leadId = `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      statements.push(
        db.prepare(
          `INSERT INTO pool_leads (
            id, pool_id, buyer_number, full_name, whatsapp_number, city,
            buying_timeline, has_existing_quote, existing_quote_amount,
            extra_message, consent_at, privacy_notice_version,
            status, fee_status, member_connection_status, created_at, updated_at
          ) VALUES (
            ?, ?, 1, ?, ?, ?,
            'THIS_MONTH', 0, NULL,
            ?, ?, '2026-10-V4',
            'NEW', 'NOT_REQUESTED', 'NOT_READY', ?, ?
          )`
        ).bind(
          leadId,
          createdPoolId,
          reqName,
          reqPhone,
          primaryCityName,
          String(reqRow.extra_message || ''),
          now,
          now,
          now
        )
      );
    }

    // 4. Insert city visibility mappings into pool_cities
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
      changesSummary: `Converted request ${requestId} into official pool "${finalTitle}" in ${primaryCityName}. First member created: ${Boolean(shouldCreateFirstMember)}.`,
      details: { requestId, poolId: createdPoolId, name: finalTitle, citySlug: primaryCitySlug, firstMemberCreated: Boolean(shouldCreateFirstMember) },
    });

    try {
      revalidatePath('/');
      for (const c of selectedCitySlugs) {
        revalidatePath(`/city/${c}`);
      }
    } catch { }

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
          firstMemberCreated: Boolean(shouldCreateFirstMember),
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
