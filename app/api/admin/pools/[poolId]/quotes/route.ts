import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { getPoolQuotations, createPoolQuotation } from '@/lib/quotes';
import { createQuoteSchema } from '@/lib/validation';
import { recordAdminAudit } from '@/lib/audit';

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
    const quotes = await getPoolQuotations(poolId);

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
    const quote = await createPoolQuotation(poolId, input, 'admin_session');

    await recordAdminAudit({
      action: 'QUOTATION_RECORDED',
      targetType: 'QUOTE',
      targetId: quote.id,
      changesSummary: `Recorded ${quote.priceType} quote of ₹${quote.quotedAmount.toLocaleString('en-IN')} from "${quote.vendorName}" for pool ${poolId}.`,
      details: quote as unknown as Record<string, unknown>,
    });

    return NextResponse.json(
      { success: true, data: quote },
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
