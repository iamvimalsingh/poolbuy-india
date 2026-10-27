import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { isDemoMode } from '@/lib/data-mode';
import { updateDemoLead, getDemoLeads } from '@/lib/mock-data';
import { getAdminSupabase } from '@/lib/supabase/admin';
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

    // Prepare enriched updates
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

    // Live Supabase
    const supabase = getAdminSupabase();
    const dbPayload: Record<string, unknown> = {};

    if (enrichedUpdates.adminNotes !== undefined) dbPayload.admin_notes = enrichedUpdates.adminNotes;
    if (enrichedUpdates.doNotContact !== undefined) dbPayload.do_not_contact = enrichedUpdates.doNotContact;
    if (enrichedUpdates.quoteResponse) {
      dbPayload.quote_response = enrichedUpdates.quoteResponse;
      dbPayload.quote_response_recorded_at = enrichedUpdates.quoteResponseRecordedAt;
    }
    if (enrichedUpdates.quoteResponseNotes !== undefined) dbPayload.quote_response_notes = enrichedUpdates.quoteResponseNotes;
    if (enrichedUpdates.feeStatus) {
      dbPayload.fee_status = enrichedUpdates.feeStatus;
      dbPayload.fee_rule_version = enrichedUpdates.feeRuleVersion;
    }
    if (enrichedUpdates.feeApprovedBasis !== undefined) {
      dbPayload.fee_approved_basis = enrichedUpdates.feeApprovedBasis;
      dbPayload.fee_calculated_amount = enrichedUpdates.feeCalculatedAmount;
    }
    if (enrichedUpdates.feeDisclosedAmount !== undefined) {
      dbPayload.fee_disclosed_amount = enrichedUpdates.feeDisclosedAmount;
      dbPayload.fee_disclosed_at = enrichedUpdates.feeDisclosedAt;
    }
    if (enrichedUpdates.paymentReference !== undefined) {
      dbPayload.payment_reference = enrichedUpdates.paymentReference;
      dbPayload.payment_reported_at = enrichedUpdates.paymentReportedAt;
    }
    if (enrichedUpdates.feeStatus === 'PAID_VERIFIED') {
      dbPayload.payment_verified_by = enrichedUpdates.paymentVerifiedBy;
      dbPayload.payment_verified_at = enrichedUpdates.paymentVerifiedAt;
    }
    if (enrichedUpdates.paymentWaiverReason !== undefined) dbPayload.payment_waiver_reason = enrichedUpdates.paymentWaiverReason;
    if (enrichedUpdates.connectionStatus) dbPayload.member_connection_status = enrichedUpdates.connectionStatus;
    if (enrichedUpdates.connectionStatus === 'CONNECTED') {
      dbPayload.connection_date = enrichedUpdates.connectionDate;
      dbPayload.connection_method = enrichedUpdates.connectionMethod;
    }
    if (enrichedUpdates.connectionStatus === 'EXCLUDED') {
      dbPayload.exclusion_reason = enrichedUpdates.exclusionReason;
      dbPayload.excluded_at = enrichedUpdates.excludedAt;
    }

    const { data, error } = await supabase
      .from('pool_leads')
      .update(dbPayload)
      .eq('id', leadId)
      .eq('pool_id', poolId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    await recordAdminAudit({
      action: 'MEMBER_DECISION_UPDATED',
      targetType: 'LEAD',
      targetId: leadId,
      changesSummary: `Updated member #${data.buyer_number} (${data.full_name}) in pool ${poolId}.`,
      details: dbPayload,
    });

    return NextResponse.json(
      { success: true, data },
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
