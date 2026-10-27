import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/require-admin';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { isDemoMode } from '@/lib/data-mode';
import { MOCK_ADMIN_POOLS, updateDemoPool, deleteDemoPool } from '@/lib/mock-data';
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

const updatePoolSchema = z.object({
  name: z.string().trim().min(3).max(180).optional(),
  shortDescription: z.string().trim().max(300).optional(),
  longDescription: z.string().trim().max(10000).optional(),
  category: poolCategoryEnum.optional(),
  city: z.string().trim().min(2).max(80).optional(),
  productBrand: z.string().trim().max(100).optional(),
  productModel: z.string().trim().max(150).optional(),
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

    // Live Supabase update
    const supabase = getAdminSupabase();

    // First fetch existing pool to check conditions
    const { data: existing, error: fetchError } = await supabase
      .from('pools')
      .select('*')
      .eq('id', poolId)
      .maybeSingle();

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: { code: 'POOL_NOT_FOUND', message: 'Pool not found.' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (updates.status === 'UNLOCKED') {
      const nextPriceVerified = updates.priceIsVerified ?? existing.price_is_verified;
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

    const dbPayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) dbPayload.name = updates.name;
    if (updates.shortDescription !== undefined) dbPayload.short_description = updates.shortDescription;
    if (updates.longDescription !== undefined) dbPayload.long_description = updates.longDescription;
    if (updates.category !== undefined) dbPayload.category = updates.category;
    if (updates.city !== undefined) {
      dbPayload.city = updates.city;
      dbPayload.city_slug = slugify(updates.city);
    }
    if (updates.productBrand !== undefined) dbPayload.product_brand = updates.productBrand;
    if (updates.productModel !== undefined) dbPayload.product_model = updates.productModel;
    if (updates.imageUrl !== undefined) dbPayload.image_url = updates.imageUrl;
    if (updates.marketPrice !== undefined) dbPayload.market_price = updates.marketPrice;
    if (updates.groupPrice !== undefined) dbPayload.group_price = updates.groupPrice;
    if (updates.targetBuyers !== undefined) dbPayload.target_buyers = updates.targetBuyers;
    if (updates.deadline !== undefined) dbPayload.deadline = updates.deadline;
    if (updates.status !== undefined) dbPayload.status = updates.status;
    if (updates.closureReason !== undefined) dbPayload.closure_reason = updates.closureReason;
    if (updates.closedAt !== undefined) dbPayload.closed_at = updates.closedAt;
    if (updates.offerValidUntil !== undefined) dbPayload.offer_valid_until = updates.offerValidUntil;
    if (updates.isArchived !== undefined) dbPayload.is_archived = updates.isArchived;
    if (updates.deletedAt !== undefined) dbPayload.deleted_at = updates.deletedAt;
    if (updates.priceIsVerified !== undefined) {
      dbPayload.price_is_verified = updates.priceIsVerified;
      if (updates.priceIsVerified && !existing.price_verified_at) {
        dbPayload.price_verified_at = new Date().toISOString();
      }
    }
    if (updates.dealerName !== undefined) dbPayload.dealer_name = updates.dealerName;
    if (updates.tokenAmount !== undefined) dbPayload.token_amount = updates.tokenAmount;
    if (updates.tokenPaymentUrl !== undefined) dbPayload.token_payment_url = updates.tokenPaymentUrl;
    if (updates.dealerOfferUrl !== undefined) dbPayload.dealer_offer_url = updates.dealerOfferUrl;
    if (updates.dealerTerms !== undefined) dbPayload.dealer_terms = updates.dealerTerms;
    if (updates.isPublished !== undefined) dbPayload.is_published = updates.isPublished;
    if (updates.marketPriceType !== undefined) dbPayload.market_price_type = updates.marketPriceType;
    if (updates.groupPriceType !== undefined) dbPayload.group_price_type = updates.groupPriceType;
    if (updates.savingsDisplayApproved !== undefined) dbPayload.savings_display_approved = updates.savingsDisplayApproved;
    if (updates.quoteSource !== undefined) dbPayload.quote_source = updates.quoteSource;
    if (updates.quoteDate !== undefined) dbPayload.quote_date = updates.quoteDate;
    if (updates.quoteValidUntil !== undefined) dbPayload.quote_valid_until = updates.quoteValidUntil;
    if (updates.quoteScope !== undefined) dbPayload.quote_scope = updates.quoteScope;
    if (updates.quotePrivateNotes !== undefined) dbPayload.quote_private_notes = updates.quotePrivateNotes;
    if (updates.connectionStatus !== undefined) dbPayload.connection_status = updates.connectionStatus;
    if (updates.paymentConfigState !== undefined) dbPayload.payment_config_state = updates.paymentConfigState;
    if (updates.connectionNotes !== undefined) dbPayload.connection_notes = updates.connectionNotes;
    if (updates.targetReachedAcknowledgedAt !== undefined) dbPayload.target_reached_acknowledged_at = updates.targetReachedAcknowledgedAt;

    const { data: updated, error: updateError } = await supabase
      .from('pools')
      .update(dbPayload)
      .eq('id', poolId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: updateError.message } },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const resultPool: AdminPool = {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      shortDescription: updated.short_description || '',
      longDescription: updated.long_description || '',
      category: updated.category,
      city: updated.city,
      citySlug: updated.city_slug,
      productBrand: updated.product_brand || '',
      productModel: updated.product_model || '',
      imageUrl: updated.image_url,
      marketPrice: updated.market_price !== null ? Number(updated.market_price) : null,
      groupPrice: updated.group_price !== null ? Number(updated.group_price) : null,
      targetBuyers: Number(updated.target_buyers),
      currentBuyers: Number(updated.current_buyers),
      deadline: updated.deadline,
      status: updated.status,
      closureReason: (updated.closure_reason as PoolClosureReason) || null,
      closedAt: updated.closed_at || null,
      offerValidUntil: updated.offer_valid_until || null,
      isArchived: Boolean(updated.is_archived),
      deletedAt: updated.deleted_at || null,
      priceIsVerified: Boolean(updated.price_is_verified),
      priceVerifiedAt: updated.price_verified_at,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
      dealerName: updated.dealer_name,
      tokenAmount: updated.token_amount !== null ? Number(updated.token_amount) : null,
      tokenPaymentUrl: updated.token_payment_url,
      dealerOfferUrl: updated.dealer_offer_url,
      dealerTerms: updated.dealer_terms,
      isPublished: updated.is_published !== false,
      marketPriceType: (updated.market_price_type || 'INDICATIVE_ESTIMATE') as AdminPool['marketPriceType'],
      groupPriceType: (updated.group_price_type || 'INDICATIVE_ESTIMATE') as AdminPool['groupPriceType'],
      savingsDisplayApproved: Boolean(updated.savings_display_approved),
      quoteSource: updated.quote_source || null,
      quoteDate: updated.quote_date || null,
      quoteValidUntil: updated.quote_valid_until || null,
      quoteScope: updated.quote_scope || null,
      quotePrivateNotes: updated.quote_private_notes || null,
      connectionStatus: (updated.connection_status || 'NOT_ELIGIBLE') as AdminPool['connectionStatus'],
      paymentConfigState: (updated.payment_config_state || 'DISABLED') as AdminPool['paymentConfigState'],
      connectionNotes: updated.connection_notes || null,
      targetReachedAcknowledgedAt: updated.target_reached_acknowledged_at || null,
    };

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

    // Live Supabase Delete / Soft-Delete
    const supabase = getAdminSupabase();

    // Verify leads count
    const { count: leadCount, error: countErr } = await supabase
      .from('pool_leads')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', poolId);

    if (countErr) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: countErr.message } },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Check price history dependencies
    const { count: priceCount } = await supabase
      .from('price_history')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', poolId);

    // Check request dependencies
    const { count: requestCount } = await supabase
      .from('pool_requests')
      .select('*', { count: 'exact', head: true })
      .eq('resulting_pool_id', poolId);

    if (hardDelete) {
      const hasDependencies = (leadCount ?? 0) > 0 || (priceCount ?? 0) > 0 || (requestCount ?? 0) > 0;
      if (hasDependencies) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CANNOT_HARD_DELETE',
              message: `Cannot hard delete pool with dependencies (${leadCount ?? 0} leads, ${priceCount ?? 0} price entries, ${requestCount ?? 0} proposal requests). Soft-delete / archive instead.`,
            },
          },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const { error: delErr } = await supabase.from('pools').delete().eq('id', poolId);
      if (delErr) {
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: delErr.message } },
          { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
      }

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
    const { data: updated, error: softErr } = await supabase
      .from('pools')
      .update({
        deleted_at: now,
        is_published: false,
        status: 'CLOSED',
        closure_reason: 'MANUAL_CLOSE',
        closed_at: now,
        updated_at: now,
      })
      .eq('id', poolId)
      .select()
      .single();

    if (softErr) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: softErr.message } },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    await recordAdminAudit({
      action: 'POOL_SOFT_DELETED',
      targetType: 'POOL',
      targetId: poolId,
      changesSummary: `Soft-deleted / closed pool ${poolId}.`,
    });

    return NextResponse.json(
      { success: true, data: { action: 'soft_deleted', pool: updated } },
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
