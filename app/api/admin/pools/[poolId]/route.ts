import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/require-admin';
import { isDemoMode } from '@/lib/data-mode';
import { MOCK_ADMIN_POOLS, updateDemoPool, deleteDemoPool } from '@/lib/mock-data';
import { requireD1Database } from '@/lib/d1/db';
import { AdminPool, PoolClosureReason } from '@/types';
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

type RouteContext = {
  params: Promise<{ poolId: string }>;
};

interface D1AdminPoolRow {
  id: string;
  campaign_id?: string | null;
  slug: string;
  name: string;
  product_title?: string | null;
  variant_name?: string | null;
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
    campaignId: row.campaign_id || null,
    slug: row.slug,
    name: row.name,
    productTitle: row.product_title || undefined,
    variantName: row.variant_name || undefined,
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
    closureReason: (row.closure_reason as PoolClosureReason) || null,
    closedAt: row.closed_at || null,
    offerValidUntil: row.offer_valid_until || null,
    isArchived: Boolean(row.is_archived),
    deletedAt: row.deleted_at || null,
    targetReachedAt: row.target_reached_at || null,
  };
}

const updatePoolSchema = z.object({
  name: z.string().trim().min(3).max(180).optional(),
  shortDescription: z.string().trim().max(300).optional(),
  longDescription: z.string().trim().max(10000).optional(),
  category: poolCategoryEnum.optional(),
  city: z.string().trim().min(2).max(80).optional(),
  productBrand: z.string().trim().max(100).optional(),
  productModel: z.string().trim().max(150).optional(),
  variantName: z.string().trim().max(100).nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  marketPrice: z.number().min(0).nullable().optional(),
  groupPrice: z.number().min(0).nullable().optional(),
  targetBuyers: z.number().min(2).max(10000).optional(),
  deadline: z.string().datetime().optional(),
  status: poolStatusEnum.optional(),
  closureReason: z
    .enum([
      'TARGET_ACHIEVED',
      'AUTO_POOL_EXPIRED',
      'OFFER_EXPIRED',
      'ADMIN_EXPIRED',
      'SUPPLIER_WITHDRAWN',
      'MANUAL_CLOSE',
    ])
    .nullable()
    .optional(),
  closedAt: z.string().nullable().optional(),
  offerValidUntil: z.string().nullable().optional(),
  isArchived: z.boolean().optional(),
  deletedAt: z.string().nullable().optional(),
  priceIsVerified: z.boolean().optional(),
  dealerName: z.string().trim().max(180).nullable().optional(),
  tokenAmount: z.number().min(499).max(999).nullable().optional(),
  tokenPaymentUrl: z.string().nullable().optional(),
  dealerOfferUrl: z.string().nullable().optional(),
  dealerTerms: z.string().trim().max(5000).nullable().optional(),
  isPublished: z.boolean().optional(),
  marketPriceType: marketPriceTypeEnum.optional(),
  groupPriceType: groupPriceTypeEnum.optional(),
  savingsDisplayApproved: z.boolean().optional(),
  quoteSource: z.string().trim().max(180).nullable().optional(),
  quoteDate: z.string().nullable().optional(),
  quoteValidUntil: z.string().nullable().optional(),
  quoteScope: z.string().trim().max(1000).nullable().optional(),
  quotePrivateNotes: z.string().trim().max(5000).nullable().optional(),
  connectionStatus: connectionStatusEnum.optional(),
  paymentConfigState: paymentConfigStateEnum.optional(),
  connectionNotes: z.string().trim().max(5000).nullable().optional(),
  targetReachedAcknowledgedAt: z.string().nullable().optional(),
});

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request);
  if (authError) return authError;

  try {
    const { poolId } = await context.params;

    if (isDemoMode()) {
      const pool = MOCK_ADMIN_POOLS.find((p) => p.id === poolId);
      if (!pool) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Pool not found.' } },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return NextResponse.json(
        { success: true, data: pool },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const db = await requireD1Database();
    const row = await db
      .prepare('SELECT * FROM pools WHERE id = ?')
      .bind(poolId)
      .first<D1AdminPoolRow>();

    if (!row) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Pool not found.' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      { success: true, data: mapRowToAdminPool(row) },
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

export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const { poolId } = await context.params;
    const json = await request.json();
    const parsed = updatePoolSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: parsed.error.issues[0]?.message || 'Invalid update parameters.',
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const updates = parsed.data;

    // Validate payment URL if updated
    if (updates.tokenPaymentUrl && !isValidHttpsUrl(updates.tokenPaymentUrl)) {
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
      const pool = MOCK_ADMIN_POOLS.find((p) => p.id === poolId);
      if (!pool) {
        return NextResponse.json(
          { success: false, error: { code: 'POOL_NOT_FOUND', message: 'Pool not found.' } },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      // Check unlocking requirements if status transition to UNLOCKED is requested
      if (updates.status === 'UNLOCKED') {
        const nextPriceVerified = updates.priceIsVerified ?? pool.priceIsVerified;
        const nextDealerName = updates.dealerName ?? pool.dealerName;
        const nextDealerTerms = updates.dealerTerms ?? pool.dealerTerms;
        const nextTokenUrl = updates.tokenPaymentUrl ?? pool.tokenPaymentUrl;
        const nextTokenAmount = updates.tokenAmount ?? pool.tokenAmount;

        const missingRequirements: string[] = [];
        if (pool.currentBuyers < pool.targetBuyers) {
          missingRequirements.push(`Target not met (${pool.currentBuyers}/${pool.targetBuyers} joined)`);
        }
        if (!nextPriceVerified) {
          missingRequirements.push('Price is not marked verified');
        }
        if (!nextDealerName?.trim()) {
          missingRequirements.push('Dealer showroom name is required');
        }
        if (!nextDealerTerms?.trim()) {
          missingRequirements.push('Dealer commercial terms are required');
        }
        if (!nextTokenUrl || !isValidHttpsUrl(nextTokenUrl)) {
          missingRequirements.push('Valid HTTPS token payment URL is required');
        }
        if (!nextTokenAmount || nextTokenAmount < 499 || nextTokenAmount > 999) {
          missingRequirements.push('Token amount must be between ₹499 and ₹999');
        }

        if (missingRequirements.length > 0) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'UNLOCK_CONDITIONS_NOT_MET',
                message: `Cannot unlock pool. Missing requirements: ${missingRequirements.join('; ')}.`,
              },
            },
            { status: 400, headers: { 'Cache-Control': 'no-store' } }
          );
        }
      }

      const demoUpdates = {
        ...updates,
        ...(updates.city !== undefined ? { citySlug: slugify(updates.city) } : {}),
      };
      const updated = updateDemoPool(poolId, demoUpdates) || pool;

      try {
        revalidatePath('/');
        revalidatePath(`/city/${pool.citySlug}`);
        if (updated.citySlug !== pool.citySlug) {
          revalidatePath(`/city/${updated.citySlug}`);
        }
        revalidatePath(`/category/${pool.category.toLowerCase().replace(/_/g, '-')}`);
        revalidatePath(`/deals/${pool.citySlug}/${pool.slug}`);
        if (updated.citySlug !== pool.citySlug) {
          revalidatePath(`/deals/${updated.citySlug}/${updated.slug}`);
        }
      } catch (revalErr) {
        console.warn('Revalidation notice:', revalErr);
      }

      return NextResponse.json(
        { success: true, data: updated },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Live D1 update
    const db = await requireD1Database();

    const existing = await db
      .prepare('SELECT * FROM pools WHERE id = ?')
      .bind(poolId)
      .first<D1AdminPoolRow>();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'POOL_NOT_FOUND', message: 'Pool not found.' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (updates.status === 'UNLOCKED') {
      const nextPriceVerified = updates.priceIsVerified ?? Boolean(existing.price_is_verified);
      const nextDealerName = updates.dealerName ?? existing.dealer_name;
      const nextDealerTerms = updates.dealerTerms ?? existing.dealer_terms;
      const nextTokenUrl = updates.tokenPaymentUrl ?? existing.token_payment_url;
      const nextTokenAmount = updates.tokenAmount ?? existing.token_amount;

      const missingRequirements: string[] = [];
      if (existing.current_buyers < existing.target_buyers) {
        missingRequirements.push(
          `Target not reached (${existing.current_buyers}/${existing.target_buyers} joined)`
        );
      }
      if (!nextPriceVerified) {
        missingRequirements.push('Verified price flag is required');
      }
      if (!nextDealerName?.trim()) {
        missingRequirements.push('Verified dealer name is required');
      }
      if (!nextDealerTerms?.trim()) {
        missingRequirements.push('Verified dealer terms are required');
      }
      if (!nextTokenUrl || !isValidHttpsUrl(nextTokenUrl)) {
        missingRequirements.push('Valid HTTPS token payment link is required');
      }
      if (!nextTokenAmount || nextTokenAmount < 499 || nextTokenAmount > 999) {
        missingRequirements.push('Token amount must be ₹499–₹999');
      }

      if (missingRequirements.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'UNLOCK_CONDITIONS_NOT_MET',
              message: `Cannot unlock pool: ${missingRequirements.join('; ')}.`,
            },
          },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }

    const now = new Date().toISOString();
    const setClauses: string[] = ['updated_at = ?'];
    const values: unknown[] = [now];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }
    if (updates.shortDescription !== undefined) {
      setClauses.push('short_description = ?');
      values.push(updates.shortDescription);
    }
    if (updates.longDescription !== undefined) {
      setClauses.push('long_description = ?');
      values.push(updates.longDescription);
    }
    if (updates.category !== undefined) {
      setClauses.push('category = ?');
      values.push(updates.category);
    }
    if (updates.city !== undefined) {
      setClauses.push('city = ?');
      values.push(updates.city);
      setClauses.push('city_slug = ?');
      values.push(slugify(updates.city));
    }
    if (updates.productBrand !== undefined) {
      setClauses.push('product_brand = ?');
      values.push(updates.productBrand);
    }
    if (updates.productModel !== undefined) {
      setClauses.push('product_model = ?');
      values.push(updates.productModel);
    }
    if (updates.variantName !== undefined) {
      setClauses.push('variant_name = ?');
      values.push(updates.variantName ? updates.variantName.trim() : null);
    }
    if (updates.imageUrl !== undefined) {
      setClauses.push('image_url = ?');
      values.push(updates.imageUrl);
    }
    if (updates.marketPrice !== undefined) {
      setClauses.push('market_price = ?');
      values.push(updates.marketPrice);
    }
    if (updates.groupPrice !== undefined) {
      setClauses.push('group_price = ?');
      values.push(updates.groupPrice);
    }
    if (updates.targetBuyers !== undefined) {
      setClauses.push('target_buyers = ?');
      values.push(updates.targetBuyers);
    }
    if (updates.deadline !== undefined) {
      setClauses.push('deadline = ?');
      values.push(updates.deadline);
    }
    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      values.push(updates.status);
    }
    if (updates.closureReason !== undefined) {
      setClauses.push('closure_reason = ?');
      values.push(updates.closureReason);
    }
    if (updates.closedAt !== undefined) {
      setClauses.push('closed_at = ?');
      values.push(updates.closedAt);
    }
    if (updates.offerValidUntil !== undefined) {
      setClauses.push('offer_valid_until = ?');
      values.push(updates.offerValidUntil);
    }
    if (updates.isArchived !== undefined) {
      setClauses.push('is_archived = ?');
      values.push(updates.isArchived ? 1 : 0);
    }
    if (updates.deletedAt !== undefined) {
      setClauses.push('deleted_at = ?');
      values.push(updates.deletedAt);
    }
    if (updates.priceIsVerified !== undefined) {
      setClauses.push('price_is_verified = ?');
      values.push(updates.priceIsVerified ? 1 : 0);
      if (updates.priceIsVerified && !existing.price_verified_at) {
        setClauses.push('price_verified_at = ?');
        values.push(now);
      }
    }
    if (updates.dealerName !== undefined) {
      setClauses.push('dealer_name = ?');
      values.push(updates.dealerName);
    }
    if (updates.tokenAmount !== undefined) {
      setClauses.push('token_amount = ?');
      values.push(updates.tokenAmount);
    }
    if (updates.tokenPaymentUrl !== undefined) {
      setClauses.push('token_payment_url = ?');
      values.push(updates.tokenPaymentUrl);
    }
    if (updates.dealerOfferUrl !== undefined) {
      setClauses.push('dealer_offer_url = ?');
      values.push(updates.dealerOfferUrl);
    }
    if (updates.dealerTerms !== undefined) {
      setClauses.push('dealer_terms = ?');
      values.push(updates.dealerTerms);
    }
    if (updates.isPublished !== undefined) {
      setClauses.push('is_published = ?');
      values.push(updates.isPublished ? 1 : 0);
    }
    if (updates.marketPriceType !== undefined) {
      setClauses.push('market_price_type = ?');
      values.push(updates.marketPriceType);
    }
    if (updates.groupPriceType !== undefined) {
      setClauses.push('group_price_type = ?');
      values.push(updates.groupPriceType);
    }
    if (updates.savingsDisplayApproved !== undefined) {
      setClauses.push('savings_display_approved = ?');
      values.push(updates.savingsDisplayApproved ? 1 : 0);
    }
    if (updates.quoteSource !== undefined) {
      setClauses.push('quote_source = ?');
      values.push(updates.quoteSource);
    }
    if (updates.quoteDate !== undefined) {
      setClauses.push('quote_date = ?');
      values.push(updates.quoteDate);
    }
    if (updates.quoteValidUntil !== undefined) {
      setClauses.push('quote_valid_until = ?');
      values.push(updates.quoteValidUntil);
    }
    if (updates.quoteScope !== undefined) {
      setClauses.push('quote_scope = ?');
      values.push(updates.quoteScope);
    }
    if (updates.quotePrivateNotes !== undefined) {
      setClauses.push('quote_private_notes = ?');
      values.push(updates.quotePrivateNotes);
    }
    if (updates.connectionStatus !== undefined) {
      setClauses.push('connection_status = ?');
      values.push(updates.connectionStatus);
    }
    if (updates.paymentConfigState !== undefined) {
      setClauses.push('payment_config_state = ?');
      values.push(updates.paymentConfigState);
    }
    if (updates.connectionNotes !== undefined) {
      setClauses.push('connection_notes = ?');
      values.push(updates.connectionNotes);
    }
    if (updates.targetReachedAcknowledgedAt !== undefined) {
      setClauses.push('target_reached_acknowledged_at = ?');
      values.push(updates.targetReachedAcknowledgedAt);
    }

    values.push(poolId);

    await db
      .prepare(`UPDATE pools SET ${setClauses.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const updatedRow = await db
      .prepare('SELECT * FROM pools WHERE id = ?')
      .bind(poolId)
      .first<D1AdminPoolRow>();

    if (!updatedRow) {
      throw new Error('Failed to retrieve updated pool from D1');
    }

    const resultPool = mapRowToAdminPool(updatedRow);

    await recordAdminAudit({
      action: 'POOL_UPDATED',
      targetType: 'POOL',
      targetId: poolId,
      changesSummary: `Updated pool "${resultPool.name}".`,
      details: updates,
    });

    try {
      revalidatePath('/');
      revalidatePath(`/city/${resultPool.citySlug}`);
      revalidatePath(`/category/${resultPool.category.toLowerCase().replace(/_/g, '-')}`);
      revalidatePath(`/deals/${resultPool.citySlug}/${resultPool.slug}`);
    } catch (revalErr) {
      console.warn('Revalidation notice:', revalErr);
    }

    return NextResponse.json(
      { success: true, data: resultPool },
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

export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const { poolId } = await context.params;
    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get('hard') === 'true';

    if (isDemoMode()) {
      try {
        const result = deleteDemoPool(poolId, { hardDelete });
        await recordAdminAudit({
          action: hardDelete ? 'POOL_HARD_DELETED' : 'POOL_SOFT_DELETED',
          targetType: 'POOL',
          targetId: poolId,
          changesSummary: hardDelete
            ? `Hard-deleted pool ${poolId} (no lead or request dependencies).`
            : `Soft-deleted / closed pool ${poolId}.`,
        });
        return NextResponse.json(
          { success: true, data: result },
          { headers: { 'Cache-Control': 'no-store' } }
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Delete operation failed.';
        if (message.includes('CANNOT_HARD_DELETE')) {
          return NextResponse.json(
            { success: false, error: { code: 'CANNOT_HARD_DELETE', message } },
            { status: 400, headers: { 'Cache-Control': 'no-store' } }
          );
        }
        return NextResponse.json(
          { success: false, error: { code: 'POOL_NOT_FOUND', message } },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }

    // Live D1 Delete / Soft-Delete
    const db = await requireD1Database();

    // Check leads dependency count
    const leadCountRow = await db
      .prepare('SELECT COUNT(*) as c FROM pool_leads WHERE pool_id = ?')
      .bind(poolId)
      .first<{ c: number }>();
    const leadCount = Number(leadCountRow?.c || 0);

    // Check waitlist dependency count
    const waitlistCountRow = await db
      .prepare('SELECT COUNT(*) as c FROM pool_waitlist WHERE pool_id = ?')
      .bind(poolId)
      .first<{ c: number }>();
    const waitlistCount = Number(waitlistCountRow?.c || 0);

    // Check request dependency count
    const requestCountRow = await db
      .prepare('SELECT COUNT(*) as c FROM pool_requests WHERE resulting_pool_id = ?')
      .bind(poolId)
      .first<{ c: number }>();
    const requestCount = Number(requestCountRow?.c || 0);

    if (hardDelete) {
      const hasDependencies = leadCount > 0 || waitlistCount > 0 || requestCount > 0;
      if (hasDependencies) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CANNOT_HARD_DELETE',
              message: `Cannot hard delete pool with dependencies (${leadCount} leads, ${waitlistCount} waitlist, ${requestCount} proposal requests). Soft-delete / archive instead.`,
            },
          },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      await db.prepare('DELETE FROM pools WHERE id = ?').bind(poolId).run();

      await recordAdminAudit({
        action: 'POOL_HARD_DELETED',
        targetType: 'POOL',
        targetId: poolId,
        changesSummary: `Hard-deleted pool ${poolId}.`,
      });

      return NextResponse.json(
        { success: true, data: { action: 'hard_deleted' } },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Default: Soft Delete
    const now = new Date().toISOString();
    await db
      .prepare(
        `UPDATE pools
            SET deleted_at = ?,
                is_published = 0,
                status = 'CLOSED',
                closure_reason = 'MANUAL_CLOSE',
                closed_at = ?,
                updated_at = ?
          WHERE id = ?`
      )
      .bind(now, now, now, poolId)
      .run();

    const updatedRow = await db
      .prepare('SELECT * FROM pools WHERE id = ?')
      .bind(poolId)
      .first<D1AdminPoolRow>();

    await recordAdminAudit({
      action: 'POOL_SOFT_DELETED',
      targetType: 'POOL',
      targetId: poolId,
      changesSummary: `Soft-deleted / closed pool ${poolId}.`,
    });

    return NextResponse.json(
      { success: true, data: { action: 'soft_deleted', pool: updatedRow ? mapRowToAdminPool(updatedRow) : null } },
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

export const PUT = PATCH;
