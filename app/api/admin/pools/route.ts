import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/require-admin';
import { isDemoMode } from '@/lib/data-mode';
import { MOCK_ADMIN_POOLS, addDemoPool } from '@/lib/mock-data';
import { requireD1Database } from '@/lib/d1/db';
import { AdminPool } from '@/types';
import { z } from 'zod';
import {
  poolCategoryEnum,
  poolStatusEnum,
  isValidHttpsUrl,
  marketPriceTypeEnum,
  groupPriceTypeEnum,
  connectionStatusEnum,
  paymentConfigStateEnum,
} from '@/lib/validation';
import { slugify } from '@/lib/format';
import { recordAdminAudit } from '@/lib/audit';

interface D1AdminPoolRow {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  long_description: string;
  category: string;
  city: string;
  city_slug: string;
  product_brand: string;
  product_model: string;
  image_url: string | null;
  market_price: number | null;
  group_price: number | null;
  target_buyers: number;
  current_buyers: number;
  deadline: string;
  status: string;
  closure_reason?: string | null;
  closed_at?: string | null;
  offer_valid_until?: string | null;
  is_archived?: number;
  deleted_at?: string | null;
  price_is_verified: number;
  price_verified_at: string | null;
  dealer_name?: string | null;
  token_amount?: number | null;
  token_payment_url?: string | null;
  dealer_offer_url?: string | null;
  dealer_terms?: string | null;
  is_published: number;
  market_price_type: string;
  group_price_type: string;
  savings_display_approved: number;
  quote_source?: string | null;
  quote_date?: string | null;
  quote_valid_until?: string | null;
  quote_scope?: string | null;
  quote_private_notes?: string | null;
  connection_status: string;
  payment_config_state: string;
  connection_notes?: string | null;
  target_reached_at?: string | null;
  target_reached_acknowledged_at?: string | null;
  source_request_id?: string | null;
  created_at: string;
  updated_at: string;
}

function mapRowToAdminPool(row: D1AdminPoolRow): AdminPool {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.short_description || '',
    longDescription: row.long_description || '',
    category: row.category as AdminPool['category'],
    city: row.city,
    citySlug: row.city_slug,
    productBrand: row.product_brand || '',
    productModel: row.product_model || '',
    imageUrl: row.image_url,
    marketPrice: row.market_price !== null ? Number(row.market_price) : null,
    groupPrice: row.group_price !== null ? Number(row.group_price) : null,
    targetBuyers: Number(row.target_buyers),
    currentBuyers: Number(row.current_buyers),
    deadline: row.deadline,
    status: row.status as AdminPool['status'],
    priceIsVerified: Boolean(row.price_is_verified),
    priceVerifiedAt: row.price_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dealerName: row.dealer_name || null,
    tokenAmount: row.token_amount !== null && row.token_amount !== undefined ? Number(row.token_amount) : null,
    tokenPaymentUrl: row.token_payment_url || null,
    dealerOfferUrl: row.dealer_offer_url || null,
    dealerTerms: row.dealer_terms || null,
    isPublished: Boolean(row.is_published),
    marketPriceType: (row.market_price_type || 'INDICATIVE_ESTIMATE') as AdminPool['marketPriceType'],
    groupPriceType: (row.group_price_type || 'INDICATIVE_ESTIMATE') as AdminPool['groupPriceType'],
    savingsDisplayApproved: Boolean(row.savings_display_approved),
    quoteSource: row.quote_source || null,
    quoteDate: row.quote_date || null,
    quoteValidUntil: row.quote_valid_until || null,
    quoteScope: row.quote_scope || null,
    quotePrivateNotes: row.quote_private_notes || null,
    connectionStatus: (row.connection_status || 'NOT_ELIGIBLE') as AdminPool['connectionStatus'],
    paymentConfigState: (row.payment_config_state || 'DISABLED') as AdminPool['paymentConfigState'],
    connectionNotes: row.connection_notes || null,
    targetReachedAcknowledgedAt: row.target_reached_acknowledged_at || null,
    closureReason: (row.closure_reason as AdminPool['closureReason']) || null,
    closedAt: row.closed_at || null,
    offerValidUntil: row.offer_valid_until || null,
    isArchived: Boolean(row.is_archived),
    deletedAt: row.deleted_at || null,
    targetReachedAt: row.target_reached_at || null,
  };
}

const createPoolSchema = z.object({
  name: z.string().trim().min(3).max(180),
  slug: z.string().trim().optional(),
  shortDescription: z.string().trim().max(300).default(''),
  longDescription: z.string().trim().max(10000).default(''),
  category: poolCategoryEnum,
  city: z.string().trim().min(2).max(80),
  citySlug: z.string().trim().optional(),
  productBrand: z.string().trim().max(100).default(''),
  productModel: z.string().trim().max(150).default(''),
  imageUrl: z.string().nullable().optional(),
  marketPrice: z.number().min(0).nullable().optional(),
  groupPrice: z.number().min(0).nullable().optional(),
  targetBuyers: z.number().min(2).max(10000).default(10),
  deadline: z.string().datetime(),
  status: poolStatusEnum.default('ACTIVE'),
  priceIsVerified: z.boolean().default(false),
  dealerName: z.string().trim().max(180).nullable().optional(),
  tokenAmount: z.number().min(499).max(999).nullable().optional(),
  tokenPaymentUrl: z.string().nullable().optional(),
  dealerOfferUrl: z.string().nullable().optional(),
  dealerTerms: z.string().trim().max(5000).nullable().optional(),
  isPublished: z.boolean().default(true),
  marketPriceType: marketPriceTypeEnum.default('INDICATIVE_ESTIMATE'),
  groupPriceType: groupPriceTypeEnum.default('INDICATIVE_ESTIMATE'),
  savingsDisplayApproved: z.boolean().default(false),
  quoteSource: z.string().trim().max(180).nullable().optional(),
  quoteDate: z.string().nullable().optional(),
  quoteValidUntil: z.string().nullable().optional(),
  quoteScope: z.string().trim().max(1000).nullable().optional(),
  quotePrivateNotes: z.string().trim().max(5000).nullable().optional(),
  connectionStatus: connectionStatusEnum.default('NOT_ELIGIBLE'),
  paymentConfigState: paymentConfigStateEnum.default('DISABLED'),
  connectionNotes: z.string().trim().max(5000).nullable().optional(),
  sourceRequestId: z.string().nullable().optional(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = await requireAdminSession(request);
  if (authError) return authError;

  if (isDemoMode()) {
    return NextResponse.json(
      { success: true, data: MOCK_ADMIN_POOLS },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const db = await requireD1Database();
    const { results } = await db
      .prepare('SELECT * FROM pools WHERE deleted_at IS NULL ORDER BY created_at DESC')
      .all<D1AdminPoolRow>();

    const adminPools = (results || []).map(mapRowToAdminPool);

    return NextResponse.json(
      { success: true, data: adminPools },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: e.message || 'Server error.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const json = await request.json();
    const parsed = createPoolSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: parsed.error.issues[0]?.message || 'Invalid pool data.',
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const val = parsed.data;
    const finalSlug = val.slug ? slugify(val.slug) : slugify(val.name);
    const finalCitySlug = val.citySlug ? slugify(val.citySlug) : slugify(val.city);
    const now = new Date().toISOString();

    if (val.tokenPaymentUrl && !isValidHttpsUrl(val.tokenPaymentUrl)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_URL',
            message: 'Token payment URL must use secure HTTPS protocol.',
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (isDemoMode()) {
      const duplicateInCity = MOCK_ADMIN_POOLS.find(
        (p) => p.citySlug.toLowerCase() === finalCitySlug.toLowerCase() && p.slug === finalSlug
      );
      if (duplicateInCity) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'DUPLICATE_SLUG',
              message: `A pool with slug "${finalSlug}" already exists in ${val.city}.`,
            },
          },
          { status: 409, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const demoPool: AdminPool = {
        id: `demo-${Date.now()}`,
        slug: finalSlug,
        name: val.name,
        shortDescription: val.shortDescription,
        longDescription: val.longDescription,
        category: val.category,
        city: val.city,
        citySlug: finalCitySlug,
        productBrand: val.productBrand,
        productModel: val.productModel,
        imageUrl: val.imageUrl || null,
        marketPrice: val.marketPrice || null,
        groupPrice: val.groupPrice || null,
        targetBuyers: val.targetBuyers,
        currentBuyers: 0,
        deadline: val.deadline,
        status: val.status,
        priceIsVerified: val.priceIsVerified,
        priceVerifiedAt: val.priceIsVerified ? now : null,
        createdAt: now,
        updatedAt: now,
        dealerName: val.dealerName || null,
        tokenAmount: val.tokenAmount || null,
        tokenPaymentUrl: val.tokenPaymentUrl || null,
        dealerOfferUrl: val.dealerOfferUrl || null,
        dealerTerms: val.dealerTerms || null,
        isPublished: val.isPublished,
        marketPriceType: val.marketPriceType,
        groupPriceType: val.groupPriceType,
        savingsDisplayApproved: val.savingsDisplayApproved,
        quoteSource: val.quoteSource || null,
        quoteDate: val.quoteDate || null,
        quoteValidUntil: val.quoteValidUntil || null,
        quoteScope: val.quoteScope || null,
        quotePrivateNotes: val.quotePrivateNotes || null,
        connectionStatus: val.connectionStatus,
        paymentConfigState: val.paymentConfigState,
        connectionNotes: val.connectionNotes || null,
        sourceRequestId: val.sourceRequestId || null,
      };

      addDemoPool(demoPool);

      await recordAdminAudit({
        action: 'POOL_CREATED',
        targetType: 'POOL',
        targetId: demoPool.id,
        changesSummary: `Created pool "${demoPool.name}" in ${demoPool.city}. Published: ${demoPool.isPublished}.`,
        details: { poolId: demoPool.id, name: demoPool.name, city: demoPool.city },
      });

      try {
        revalidatePath('/');
        revalidatePath(`/city/${demoPool.citySlug}`);
        revalidatePath(`/category/${demoPool.category.toLowerCase().replace(/_/g, '-')}`);
        revalidatePath(`/deals/${demoPool.citySlug}/${demoPool.slug}`);
      } catch (revalErr) {
        console.warn('Revalidation notice:', revalErr);
      }

      return NextResponse.json(
        { success: true, data: demoPool },
        { status: 201, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Live D1 execution
    const db = await requireD1Database();

    // Check duplicate slug in same city
    const existing = await db
      .prepare('SELECT id FROM pools WHERE city_slug = ? AND slug = ? AND deleted_at IS NULL')
      .bind(finalCitySlug, finalSlug)
      .first<{ id: string }>();

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DUPLICATE_SLUG',
            message: `A pool with slug "${finalSlug}" already exists in ${val.city}.`,
          },
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const poolId = `pool-${finalCitySlug}-${finalSlug}-${Date.now().toString(36)}`;
    const priceVerifiedAt = val.priceIsVerified ? now : null;

    await db
      .prepare(
        `INSERT INTO pools (
          id, slug, name, short_description, long_description, category,
          city, city_slug, product_brand, product_model, image_url,
          market_price, group_price, target_buyers, current_buyers,
          deadline, status, price_is_verified, price_verified_at,
          dealer_name, token_amount, token_payment_url, dealer_offer_url,
          dealer_terms, is_published, market_price_type, group_price_type,
          savings_display_approved, quote_source, quote_date, quote_valid_until,
          quote_scope, quote_private_notes, connection_status,
          payment_config_state, connection_notes, source_request_id,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, 0,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?
        )`
      )
      .bind(
        poolId,
        finalSlug,
        val.name,
        val.shortDescription,
        val.longDescription,
        val.category,
        val.city,
        finalCitySlug,
        val.productBrand,
        val.productModel,
        val.imageUrl || null,
        val.marketPrice || null,
        val.groupPrice || null,
        val.targetBuyers,
        val.deadline,
        val.status,
        val.priceIsVerified ? 1 : 0,
        priceVerifiedAt,
        val.dealerName || null,
        val.tokenAmount || null,
        val.tokenPaymentUrl || null,
        val.dealerOfferUrl || null,
        val.dealerTerms || null,
        val.isPublished ? 1 : 0,
        val.marketPriceType,
        val.groupPriceType,
        val.savingsDisplayApproved ? 1 : 0,
        val.quoteSource || null,
        val.quoteDate || null,
        val.quoteValidUntil || null,
        val.quoteScope || null,
        val.quotePrivateNotes || null,
        val.connectionStatus,
        val.paymentConfigState,
        val.connectionNotes || null,
        val.sourceRequestId || null,
        now,
        now
      )
      .run();

    const createdRow = await db
      .prepare('SELECT * FROM pools WHERE id = ?')
      .bind(poolId)
      .first<D1AdminPoolRow>();

    if (!createdRow) {
      throw new Error('Failed to retrieve newly created pool from D1');
    }

    const created = mapRowToAdminPool(createdRow);

    await recordAdminAudit({
      action: 'POOL_CREATED',
      targetType: 'POOL',
      targetId: created.id,
      changesSummary: `Created pool "${created.name}" in ${created.city}. Published: ${created.isPublished}.`,
      details: { poolId: created.id, name: created.name, city: created.city },
    });

    try {
      revalidatePath('/');
      revalidatePath(`/city/${created.citySlug}`);
      revalidatePath(`/category/${created.category.toLowerCase().replace(/_/g, '-')}`);
      revalidatePath(`/deals/${created.citySlug}/${created.slug}`);
    } catch (revalErr) {
      console.warn('Revalidation notice:', revalErr);
    }

    return NextResponse.json(
      { success: true, data: created },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: e.message || 'Server error.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
