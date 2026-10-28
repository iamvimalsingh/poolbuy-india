import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { updateQuoteSchema } from '@/lib/validation';
import { updatePoolQuotation } from '@/lib/quotes';
import { recordAdminAudit } from '@/lib/audit';

type RouteContext = {
  params: Promise<{ poolId: string; quoteId: string }>;
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const { poolId, quoteId } = await context.params;
    const json = await request.json();
    const parsed = updateQuoteSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: parsed.error.issues[0]?.message || 'Invalid quotation update parameters.',
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const updates = parsed.data;

    try {
      const updated = await updatePoolQuotation(poolId, quoteId, updates);
      if (!updated) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Quotation not found.' } },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      await recordAdminAudit({
        action: updates.isCurrentPublished ? 'QUOTATION_PUBLISHED' : 'QUOTATION_UPDATED',
        targetType: 'QUOTE',
        targetId: quoteId,
        changesSummary: updates.isCurrentPublished
          ? `Published quote from "${updated.vendorName}" (₹${updated.quotedAmount.toLocaleString('en-IN')}) for pool ${poolId}.`
          : `Updated quote ${quoteId} from "${updated.vendorName}".`,
        details: updates as Record<string, unknown>,
      });

      return NextResponse.json(
        { success: true, data: updated },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    } catch (quoteErr: unknown) {
      const msg = quoteErr instanceof Error ? quoteErr.message : 'Error updating quotation.';
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_QUOTE_STATE', message: msg } },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error updating quotation.';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
