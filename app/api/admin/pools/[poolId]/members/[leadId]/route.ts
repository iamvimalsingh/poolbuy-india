import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { isDemoMode } from '@/lib/data-mode';
import { updateDemoLead, getDemoLeads } from '@/lib/mock-data';
import { requireD1Database } from '@/lib/d1/db';
import { updateMemberDecisionSchema } from '@/lib/validation';
import { recordAdminAudit } from '@/lib/audit';
import { calculateSuggestedConnectionFee, CURRENT_FEE_RULE_VERSION } from '@/lib/fee';
import { PoolLead } from '@/types';

type RouteContext = {
  params: Promise<{ poolId: string; leadId: string }>;
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const { poolId, leadId } = await context.params;
    const json = await request.json();
    const parsed = updateMemberDecisionSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: parsed.error.issues[0]?.message || 'Invalid member decision input.',
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const updates = parsed.data;
    const now = new Date().toISOString();

    const enrichedUpdates: Partial<PoolLead> = {
      ...(updates.adminNotes !== undefined && { adminNotes: updates.adminNotes }),
      ...(updates.doNotContact !== undefined && { doNotContact: updates.doNotContact }),
      ...(updates.quoteResponse && {
        quoteResponse: updates.quoteResponse,
        quoteResponseRecordedAt: now,
      }),
      ...(updates.quoteResponseNotes !== undefined && { quoteResponseNotes: updates.quoteResponseNotes }),
      ...(updates.feeStatus && {
        feeStatus: updates.feeStatus,
        feeRuleVersion: CURRENT_FEE_RULE_VERSION,
      }),
      ...(updates.feeApprovedBasis !== undefined && updates.feeApprovedBasis !== null && {
        feeApprovedBasis: updates.feeApprovedBasis,
        feeCalculatedAmount: calculateSuggestedConnectionFee(updates.feeApprovedBasis),
      }),
      ...(updates.feeDisclosedAmount !== undefined && {
        feeDisclosedAmount: updates.feeDisclosedAmount,
        feeDisclosedAt: now,
      }),
      ...(updates.paymentReference !== undefined && {
        paymentReference: updates.paymentReference,
        paymentReportedAt: now,
      }),
      ...(updates.feeStatus === 'PAID_VERIFIED' && {
        paymentVerifiedBy: 'admin_session',
        paymentVerifiedAt: now,
      }),
      ...(updates.paymentWaiverReason !== undefined && { paymentWaiverReason: updates.paymentWaiverReason }),
      ...(updates.connectionStatus && {
        connectionStatus: updates.connectionStatus,
      }),
      ...(updates.connectionStatus === 'CONNECTED' && {
        connectionDate: now,
        connectionMethod: updates.connectionMethod || 'WHATSAPP_GROUP_INVITE',
      }),
      ...(updates.connectionStatus === 'EXCLUDED' && {
        exclusionReason: updates.exclusionReason || 'Excluded by operator.',
        excludedAt: now,
      }),
    };

    if (isDemoMode()) {
      const existing = getDemoLeads().find((l) => l.id === leadId && l.poolId === poolId);
      if (!existing) {
        return NextResponse.json(
          { success: false, error: { code: 'MEMBER_NOT_FOUND', message: 'Member not found in pool.' } },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const updated = updateDemoLead(leadId, enrichedUpdates);

      await recordAdminAudit({
        action: 'MEMBER_DECISION_UPDATED',
        targetType: 'LEAD',
        targetId: leadId,
        changesSummary: `Updated member #${existing.buyerNumber} (${existing.fullName}) in pool ${poolId}.`,
        details: enrichedUpdates as Record<string, unknown>,
      });

      return NextResponse.json(
        { success: true, data: updated },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Live D1 execution
    const db = await requireD1Database();

    const existing = await db
      .prepare('SELECT buyer_number, full_name, member_connection_status, selected_kit_offer_id, selected_variant_id FROM pool_leads WHERE id = ? AND pool_id = ?')
      .bind(leadId, poolId)
      .first<{ buyer_number: number; full_name: string; member_connection_status?: string | null; selected_kit_offer_id?: string | null; selected_variant_id?: string | null }>();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'MEMBER_NOT_FOUND', message: 'Member not found in pool.' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const setClauses: string[] = ['updated_at = ?'];
    const values: unknown[] = [now];

    if (enrichedUpdates.adminNotes !== undefined) {
      setClauses.push('admin_notes = ?');
      values.push(enrichedUpdates.adminNotes);
    }
    if (enrichedUpdates.doNotContact !== undefined) {
      setClauses.push('do_not_contact = ?');
      values.push(enrichedUpdates.doNotContact ? 1 : 0);
    }
    if (enrichedUpdates.quoteResponse) {
      setClauses.push('quote_response = ?', 'quote_response_recorded_at = ?');
      values.push(enrichedUpdates.quoteResponse, enrichedUpdates.quoteResponseRecordedAt);
    }
    if (enrichedUpdates.quoteResponseNotes !== undefined) {
      setClauses.push('quote_response_notes = ?');
      values.push(enrichedUpdates.quoteResponseNotes);
    }
    if (enrichedUpdates.feeStatus) {
      setClauses.push('fee_status = ?', 'fee_rule_version = ?');
      values.push(enrichedUpdates.feeStatus, enrichedUpdates.feeRuleVersion);
    }
    if (enrichedUpdates.feeApprovedBasis !== undefined) {
      setClauses.push('fee_approved_basis = ?', 'fee_calculated_amount = ?');
      values.push(enrichedUpdates.feeApprovedBasis, enrichedUpdates.feeCalculatedAmount);
    }
    if (enrichedUpdates.feeDisclosedAmount !== undefined) {
      setClauses.push('fee_disclosed_amount = ?', 'fee_disclosed_at = ?');
      values.push(enrichedUpdates.feeDisclosedAmount, enrichedUpdates.feeDisclosedAt);
    }
    if (enrichedUpdates.paymentReference !== undefined) {
      setClauses.push('payment_reference = ?', 'payment_reported_at = ?');
      values.push(enrichedUpdates.paymentReference, enrichedUpdates.paymentReportedAt);
    }
    if (enrichedUpdates.feeStatus === 'PAID_VERIFIED') {
      setClauses.push('payment_verified_by = ?', 'payment_verified_at = ?');
      values.push(enrichedUpdates.paymentVerifiedBy, enrichedUpdates.paymentVerifiedAt);
    }
    if (enrichedUpdates.paymentWaiverReason !== undefined) {
      setClauses.push('payment_waiver_reason = ?');
      values.push(enrichedUpdates.paymentWaiverReason);
    }
    if (enrichedUpdates.connectionStatus) {
      setClauses.push('member_connection_status = ?');
      values.push(enrichedUpdates.connectionStatus);
    }
    if (enrichedUpdates.connectionStatus === 'CONNECTED') {
      setClauses.push('connection_date = ?', 'connection_method = ?');
      values.push(enrichedUpdates.connectionDate, enrichedUpdates.connectionMethod);
    }
    if (enrichedUpdates.connectionStatus === 'EXCLUDED') {
      setClauses.push('exclusion_reason = ?', 'excluded_at = ?');
      values.push(enrichedUpdates.exclusionReason, enrichedUpdates.excludedAt);
    }

    values.push(leadId, poolId);

    await db
      .prepare(`UPDATE pool_leads SET ${setClauses.join(', ')} WHERE id = ? AND pool_id = ?`)
      .bind(...values)
      .run();

    if (enrichedUpdates.connectionStatus === 'EXCLUDED' && existing.member_connection_status !== 'EXCLUDED') {
      await db
        .prepare('UPDATE pools SET current_buyers = MAX(0, current_buyers - 1), updated_at = ? WHERE id = ?')
        .bind(now, poolId)
        .run();

      const kitId = existing.selected_kit_offer_id || existing.selected_variant_id;
      if (kitId) {
        try {
          await db
            .prepare('UPDATE pool_kit_offers SET current_buyers = MAX(0, current_buyers - 1), updated_at = ? WHERE id = ?')
            .bind(now, kitId)
            .run();
        } catch {}
      }
    }

    const updatedRow = await db
      .prepare('SELECT * FROM pool_leads WHERE id = ? AND pool_id = ?')
      .bind(leadId, poolId)
      .first();

    await recordAdminAudit({
      action: 'MEMBER_DECISION_UPDATED',
      targetType: 'LEAD',
      targetId: leadId,
      changesSummary: `Updated member #${existing.buyer_number} (${existing.full_name}) in pool ${poolId}.`,
      details: enrichedUpdates as Record<string, unknown>,
    });

    return NextResponse.json(
      { success: true, data: updatedRow },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error updating member decision.';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
