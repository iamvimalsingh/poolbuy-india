import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { isDemoMode } from '@/lib/data-mode';
import { updateDemoQuotation, getDemoQuotations } from '@/lib/mock-data';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { updateQuoteSchema } from '@/lib/validation';
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

    if (isDemoMode()) {
      const existing = getDemoQuotations(poolId).find((q) => q.id === quoteId);
      if (!existing) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Quotation not found.' } },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const updated = updateDemoQuotation(quoteId, updates);

      await recordAdminAudit({
        action: updates.isCurrentPublished ? 'QUOTATION_PUBLISHED' : 'QUOTATION_UPDATED',
        targetType: 'QUOTE',
        targetId: quoteId,
        changesSummary: updates.isCurrentPublished
          ? `Published quote from "${existing.vendorName}" (₹${existing.quotedAmount.toLocaleString('en-IN')}) for pool ${poolId}.`
          : `Updated quote ${quoteId} from "${existing.vendorName}".`,
        details: updates as Record<string, unknown>,
      });

      return NextResponse.json(
        { success: true, data: updated },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Live Supabase
    const supabase = getAdminSupabase();
    const now = new Date().toISOString();

    if (updates.isCurrentPublished) {
      // Unpublish existing quotes for this pool
      await supabase
        .from('pool_quotations')
        .update({ is_current_published: false, updated_at: now })
        .eq('pool_id', poolId);
    }

    const dbPayload: Record<string, unknown> = {
      updated_at: now,
      ...(updates.quotedAmount !== undefined && { quoted_amount: updates.quotedAmount }),
      ...(updates.validUntil !== undefined && { valid_until: updates.validUntil }),
      ...(updates.scope !== undefined && { scope: updates.scope }),
      ...(updates.inclusions !== undefined && { inclusions: updates.inclusions }),
      ...(updates.exclusions !== undefined && { exclusions: updates.exclusions }),
      ...(updates.deliveryTerms !== undefined && { delivery_terms: updates.deliveryTerms }),
      ...(updates.quantityCondition !== undefined && { quantity_condition: updates.quantityCondition }),
      ...(updates.status !== undefined && { status: updates.status }),
      ...(updates.isCurrentPublished !== undefined && { is_current_published: updates.isCurrentPublished }),
      ...(updates.internalNotes !== undefined && { internal_notes: updates.internalNotes }),
    };

    const { data: quoteRow, error } = await supabase
      .from('pool_quotations')
      .update(dbPayload)
      .eq('id', quoteId)
      .eq('pool_id', poolId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (updates.isCurrentPublished) {
      // Sync pool groupPrice
      await supabase
        .from('pools')
        .update({
          group_price: quoteRow.quoted_amount,
          group_price_type: quoteRow.price_type === 'VENDOR_QUOTED' ? 'VENDOR_QUOTED' : 'INDICATIVE_ESTIMATE',
          dealer_name: quoteRow.vendor_name,
          updated_at: now,
        })
        .eq('id', poolId);
    }

    await recordAdminAudit({
      action: updates.isCurrentPublished ? 'QUOTATION_PUBLISHED' : 'QUOTATION_UPDATED',
      targetType: 'QUOTE',
      targetId: quoteId,
      changesSummary: updates.isCurrentPublished
        ? `Published quote from "${quoteRow.vendor_name}" (₹${Number(quoteRow.quoted_amount).toLocaleString('en-IN')}) for pool ${poolId}.`
        : `Updated quote ${quoteId} from "${quoteRow.vendor_name}".`,
      details: dbPayload,
    });

    return NextResponse.json(
      { success: true, data: quoteRow },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error updating quotation.';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
