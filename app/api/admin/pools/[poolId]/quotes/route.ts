import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { isDemoMode } from '@/lib/data-mode';
import { getDemoQuotations, addDemoQuotation } from '@/lib/mock-data';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { createQuoteSchema } from '@/lib/validation';
import { recordAdminAudit } from '@/lib/audit';
import { PoolQuotation } from '@/types';

type RouteContext = {
  params: Promise<{ poolId: string }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request);
  if (authError) return authError;

  try {
    const { poolId } = await context.params;

    if (isDemoMode()) {
      const quotes = getDemoQuotations(poolId);
      return NextResponse.json(
        { success: true, data: quotes },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from('pool_quotations')
      .select('*')
      .eq('pool_id', poolId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const quotes: PoolQuotation[] = (data || []).map((row) => ({
      id: row.id,
      poolId: row.pool_id,
      priceType: row.price_type,
      vendorName: row.vendor_name,
      vendorContactRef: row.vendor_contact_ref,
      quotedAmount: Number(row.quoted_amount),
      currency: row.currency || 'INR',
      quoteDate: row.quote_date,
      validUntil: row.valid_until,
      scope: row.scope,
      inclusions: Array.isArray(row.inclusions) ? row.inclusions : [],
      exclusions: Array.isArray(row.exclusions) ? row.exclusions : [],
      deliveryTerms: row.delivery_terms,
      quantityCondition: row.quantity_condition,
      status: row.status,
      isCurrentPublished: Boolean(row.is_current_published),
      verifiedByAdmin: row.verified_by_admin,
      verifiedAt: row.verified_at,
      internalNotes: row.internal_notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json(
      { success: true, data: quotes },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error fetching quotations.';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const { poolId } = await context.params;
    const json = await request.json();
    const parsed = createQuoteSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: parsed.error.issues[0]?.message || 'Invalid quotation parameters.',
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const input = parsed.data;
    const now = new Date().toISOString();

    if (isDemoMode()) {
      const quote = addDemoQuotation(poolId, {
        priceType: input.priceType,
        vendorName: input.vendorName,
        vendorContactRef: input.vendorContactRef || null,
        quotedAmount: input.quotedAmount,
        currency: input.currency || 'INR',
        quoteDate: input.quoteDate,
        validUntil: input.validUntil,
        scope: input.scope,
        inclusions: input.inclusions,
        exclusions: input.exclusions,
        deliveryTerms: input.deliveryTerms || null,
        quantityCondition: input.quantityCondition || null,
        status: input.status,
        isCurrentPublished: false,
        verifiedByAdmin: 'admin_session',
        verifiedAt: now,
        internalNotes: input.internalNotes || null,
      });

      await recordAdminAudit({
        action: 'QUOTATION_RECORDED',
        targetType: 'QUOTE',
        targetId: quote.id,
        changesSummary: `Recorded ${input.priceType} quote of ₹${input.quotedAmount.toLocaleString('en-IN')} from "${input.vendorName}" for pool ${poolId}.`,
        details: quote as unknown as Record<string, unknown>,
      });

      return NextResponse.json(
        { success: true, data: quote },
        { status: 201, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from('pool_quotations')
      .insert({
        pool_id: poolId,
        price_type: input.priceType,
        vendor_name: input.vendorName,
        vendor_contact_ref: input.vendorContactRef,
        quoted_amount: input.quotedAmount,
        currency: input.currency || 'INR',
        quote_date: input.quoteDate,
        valid_until: input.validUntil,
        scope: input.scope,
        inclusions: input.inclusions,
        exclusions: input.exclusions,
        delivery_terms: input.deliveryTerms,
        quantity_condition: input.quantityCondition,
        status: input.status,
        is_current_published: false,
        verified_by_admin: 'admin_session',
        verified_at: now,
        internal_notes: input.internalNotes,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    await recordAdminAudit({
      action: 'QUOTATION_RECORDED',
      targetType: 'QUOTE',
      targetId: data.id,
      changesSummary: `Recorded ${input.priceType} quote of ₹${input.quotedAmount.toLocaleString('en-IN')} from "${input.vendorName}" for pool ${poolId}.`,
      details: data,
    });

    return NextResponse.json(
      { success: true, data },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error creating quotation.';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
