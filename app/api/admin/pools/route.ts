import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/require-admin';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { isDemoMode } from '@/lib/data-mode';
import { MOCK_ADMIN_POOLS, addDemoPool } from '@/lib/mock-data';
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
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from('pools')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const adminPools: AdminPool[] = (data || []).map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      shortDescription: row.short_description || '',
      longDescription: row.long_description || '',
      category: row.category,
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
      status: row.status,
      priceIsVerified: Boolean(row.price_is_verified),
      priceVerifiedAt: row.price_verified_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      dealerName: row.dealer_name,
      tokenAmount: row.token_amount !== null ? Number(row.token_amount) : null,
      tokenPaymentUrl: row.token_payment_url,
      dealerOfferUrl: row.dealer_offer_url,
      dealerTerms: row.dealer_terms,
      isPublished: row.is_published !== false,
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
    }));

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

    // Validate payment URL if supplied
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
        priceVerifiedAt: val.priceIsVerified ? new Date().toISOString() : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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

    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from('pools')
      .insert({
        slug: finalSlug,
        name: val.name,
        short_description: val.shortDescription,
        long_description: val.longDescription,
        category: val.category,
        city: val.city,
        city_slug: finalCitySlug,
        product_brand: val.productBrand,
        product_model: val.productModel,
        image_url: val.imageUrl || null,
        market_price: val.marketPrice || null,
        group_price: val.groupPrice || null,
        target_buyers: val.targetBuyers,
        current_buyers: 0,
        deadline: val.deadline,
        status: val.status,
        price_is_verified: val.priceIsVerified,
        price_verified_at: val.priceIsVerified ? new Date().toISOString() : null,
        dealer_name: val.dealerName || null,
        token_amount: val.tokenAmount || null,
        token_payment_url: val.tokenPaymentUrl || null,
        dealer_offer_url: val.dealerOfferUrl || null,
        dealer_terms: val.dealerTerms || null,
        is_published: val.isPublished,
        market_price_type: val.marketPriceType,
        group_price_type: val.groupPriceType,
        savings_display_approved: val.savingsDisplayApproved,
        quote_source: val.quoteSource || null,
        quote_date: val.quoteDate || null,
        quote_valid_until: val.quoteValidUntil || null,
        quote_scope: val.quoteScope || null,
        quote_private_notes: val.quotePrivateNotes || null,
        connection_status: val.connectionStatus,
        payment_config_state: val.paymentConfigState,
        connection_notes: val.connectionNotes || null,
        source_request_id: val.sourceRequestId || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
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
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const created: AdminPool = {
      id: data.id,
      slug: data.slug,
      name: data.name,
      shortDescription: data.short_description || '',
      longDescription: data.long_description || '',
      category: data.category,
      city: data.city,
      citySlug: data.city_slug,
      productBrand: data.product_brand || '',
      productModel: data.product_model || '',
      imageUrl: data.image_url,
      marketPrice: data.market_price !== null ? Number(data.market_price) : null,
      groupPrice: data.group_price !== null ? Number(data.group_price) : null,
      targetBuyers: Number(data.target_buyers),
      currentBuyers: Number(data.current_buyers),
      deadline: data.deadline,
      status: data.status,
      priceIsVerified: Boolean(data.price_is_verified),
      priceVerifiedAt: data.price_verified_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      dealerName: data.dealer_name,
      tokenAmount: data.token_amount !== null ? Number(data.token_amount) : null,
      tokenPaymentUrl: data.token_payment_url,
      dealerOfferUrl: data.dealer_offer_url,
      dealerTerms: data.dealer_terms,
      isPublished: data.is_published !== false,
      marketPriceType: (data.market_price_type || 'INDICATIVE_ESTIMATE') as AdminPool['marketPriceType'],
      groupPriceType: (data.group_price_type || 'INDICATIVE_ESTIMATE') as AdminPool['groupPriceType'],
      savingsDisplayApproved: Boolean(data.savings_display_approved),
      quoteSource: data.quote_source || null,
      quoteDate: data.quote_date || null,
      quoteValidUntil: data.quote_valid_until || null,
      quoteScope: data.quote_scope || null,
      quotePrivateNotes: data.quote_private_notes || null,
      connectionStatus: (data.connection_status || 'NOT_ELIGIBLE') as AdminPool['connectionStatus'],
      paymentConfigState: (data.payment_config_state || 'DISABLED') as AdminPool['paymentConfigState'],
      connectionNotes: data.connection_notes || null,
      sourceRequestId: data.source_request_id || null,
    };

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
