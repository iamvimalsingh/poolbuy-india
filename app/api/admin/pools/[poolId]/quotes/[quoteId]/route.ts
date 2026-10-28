import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { isDemoMode } from '@/lib/data-mode';
import { updateDemoQuotation, getDemoQuotations } from '@/lib/mock-data';
import { requireD1Database } from '@/lib/d1/db';
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

    // Live D1 execution
    const db = await requireD1Database();
    const now = new Date().toISOString();

    const existing = await db
      .prepare('SELECT * FROM pool_quotations WHERE id = ? AND pool_id = ?')
      .bind(quoteId, poolId)
      .first<{ vendor_name: string; quoted_amount: number }>();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Quotation not found.' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (updates.isCurrentPublished) {
      // Unpublish all other quotes for this pool
      await db
        .prepare('UPDATE pool_quotations SET is_current_published = 0, updated_at = ? WHERE pool_id = ?')
        .bind(now, poolId)
        .run();

      const effectivePrice = updates.quotedAmount !== undefined ? updates.quotedAmount : existing.quoted_amount;
      const effectiveVendor = existing.vendor_name;

      // Atomically synchronize pool pricing fields
      await db
        .prepare(`
          UPDATE pools
          SET group_price = ?,
              group_price_type = 'VENDOR_QUOTED',
              price_is_verified = 1,
              price_verified_at = ?,
              dealer_name = ?,
              updated_at = ?
          WHERE id = ?
        `)
        .bind(effectivePrice, now, effectiveVendor, now, poolId)
        .run();
    }

    const setClauses: string[] = ['updated_at = ?'];
    const values: unknown[] = [now];

    if (updates.quotedAmount !== undefined) {
      setClauses.push('quoted_amount = ?');
      values.push(updates.quotedAmount);
    }
    if (updates.validUntil !== undefined) {
      setClauses.push('valid_until = ?');
      values.push(updates.validUntil);
    }
    if (updates.scope !== undefined) {
      setClauses.push('scope = ?');
      values.push(updates.scope);
    }
    if (updates.inclusions !== undefined) {
      setClauses.push('inclusions = ?');
      values.push(JSON.stringify(updates.inclusions));
    }
    if (updates.exclusions !== undefined) {
      setClauses.push('exclusions = ?');
      values.push(JSON.stringify(updates.exclusions));
    }
    if (updates.deliveryTerms !== undefined) {
      setClauses.push('delivery_terms = ?');
      values.push(updates.deliveryTerms);
    }
    if (updates.quantityCondition !== undefined) {
      setClauses.push('quantity_condition = ?');
      values.push(updates.quantityCondition);
    }
    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      values.push(updates.status);
    }
    if (updates.isCurrentPublished !== undefined) {
      setClauses.push('is_current_published = ?');
      values.push(updates.isCurrentPublished ? 1 : 0);
    }
    if (updates.internalNotes !== undefined) {
      setClauses.push('internal_notes = ?');
      values.push(updates.internalNotes);
    }

    values.push(quoteId, poolId);

    await db
      .prepare(`UPDATE pool_quotations SET ${setClauses.join(', ')} WHERE id = ? AND pool_id = ?`)
      .bind(...values)
      .run();

    const updatedRow = await db
      .prepare('SELECT * FROM pool_quotations WHERE id = ? AND pool_id = ?')
      .bind(quoteId, poolId)
      .first();

    await recordAdminAudit({
      action: updates.isCurrentPublished ? 'QUOTATION_PUBLISHED' : 'QUOTATION_UPDATED',
      targetType: 'QUOTE',
      targetId: quoteId,
      changesSummary: updates.isCurrentPublished
        ? `Published quote from "${existing.vendor_name}" (₹${existing.quoted_amount.toLocaleString('en-IN')}) for pool ${poolId}.`
        : `Updated quote ${quoteId} from "${existing.vendor_name}".`,
      details: updates as Record<string, unknown>,
    });

    return NextResponse.json(
      { success: true, data: updatedRow },
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
