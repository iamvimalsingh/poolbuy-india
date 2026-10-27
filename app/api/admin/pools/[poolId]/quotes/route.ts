import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { isDemoMode } from '@/lib/data-mode';
import { getDemoQuotations, addDemoQuotation } from '@/lib/mock-data';
import { requireD1Database } from '@/lib/d1/db';
import { createQuoteSchema } from '@/lib/validation';
import { recordAdminAudit } from '@/lib/audit';
import { PoolQuotation } from '@/types';

type RouteContext = {
  params: Promise<{ poolId: string }>;
};

interface D1QuoteRow {
  id: string;
  pool_id: string;
  price_type: string;
  vendor_name: string;
  vendor_contact_ref: string | null;
  quoted_amount: number;
  currency: string;
  quote_date: string;
  valid_until: string;
  scope: string;
  inclusions: string;
  exclusions: string;
  delivery_terms: string | null;
  quantity_condition: string | null;
  status: string;
  is_current_published: number;
  verified_by_admin: string | null;
  verified_at: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

function parseJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapRowToQuote(row: D1QuoteRow): PoolQuotation {
  return {
    id: row.id,
    poolId: row.pool_id,
    priceType: row.price_type as PoolQuotation['priceType'],
    vendorName: row.vendor_name,
    vendorContactRef: row.vendor_contact_ref || undefined,
    quotedAmount: Number(row.quoted_amount),
    currency: row.currency || 'INR',
    quoteDate: row.quote_date,
    validUntil: row.valid_until,
    scope: row.scope,
    inclusions: parseJsonArray(row.inclusions),
    exclusions: parseJsonArray(row.exclusions),
    deliveryTerms: row.delivery_terms || undefined,
    quantityCondition: row.quantity_condition || undefined,
    status: row.status as PoolQuotation['status'],
    isCurrentPublished: Boolean(row.is_current_published),
    verifiedByAdmin: row.verified_by_admin || undefined,
    verifiedAt: row.verified_at || undefined,
    internalNotes: row.internal_notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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

    const db = await requireD1Database();
    const { results } = await db
      .prepare('SELECT * FROM pool_quotations WHERE pool_id = ? ORDER BY created_at DESC')
      .bind(poolId)
      .all<D1QuoteRow>();

    const quotes = (results || []).map(mapRowToQuote);

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
    const quoteId = `quote-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

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

    const db = await requireD1Database();

    await db
      .prepare(
        `INSERT INTO pool_quotations (
          id, pool_id, price_type, vendor_name, vendor_contact_ref,
          quoted_amount, currency, quote_date, valid_until, scope,
          inclusions, exclusions, delivery_terms, quantity_condition,
          status, is_current_published, verified_by_admin, verified_at,
          internal_notes, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, 0, 'admin_session', ?,
          ?, ?, ?
        )`
      )
      .bind(
        quoteId,
        poolId,
        input.priceType,
        input.vendorName,
        input.vendorContactRef || null,
        input.quotedAmount,
        input.currency || 'INR',
        input.quoteDate,
        input.validUntil,
        input.scope,
        JSON.stringify(input.inclusions || []),
        JSON.stringify(input.exclusions || []),
        input.deliveryTerms || null,
        input.quantityCondition || null,
        input.status,
        now,
        input.internalNotes || null,
        now,
        now
      )
      .run();

    const createdRow = await db
      .prepare('SELECT * FROM pool_quotations WHERE id = ?')
      .bind(quoteId)
      .first<D1QuoteRow>();

    if (!createdRow) {
      throw new Error('Failed to retrieve newly created quote from D1');
    }

    const data = mapRowToQuote(createdRow);

    await recordAdminAudit({
      action: 'QUOTATION_RECORDED',
      targetType: 'QUOTE',
      targetId: data.id,
      changesSummary: `Recorded ${input.priceType} quote of ₹${input.quotedAmount.toLocaleString('en-IN')} from "${input.vendorName}" for pool ${poolId}.`,
      details: data as unknown as Record<string, unknown>,
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
