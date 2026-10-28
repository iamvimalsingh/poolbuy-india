import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { isDemoMode } from '@/lib/data-mode';
import { getDemoLeads } from '@/lib/mock-data';
import { requireD1Database } from '@/lib/d1/db';
import { PoolLead } from '@/types';
import { getPoolMemberDecisionSummary } from '@/lib/quotes';

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
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
    const quoteResponse = searchParams.get('quoteResponse');
    const feeStatus = searchParams.get('feeStatus');
    const connectionStatus = searchParams.get('connectionStatus');
    const search = searchParams.get('search')?.trim().toLowerCase();

    if (isDemoMode()) {
      let leads = getDemoLeads().filter((l) => l.poolId === poolId);

      if (quoteResponse) {
        leads = leads.filter((l) => l.quoteResponse === quoteResponse);
      }
      if (feeStatus) {
        leads = leads.filter((l) => l.feeStatus === feeStatus);
      }
      if (connectionStatus) {
        leads = leads.filter((l) => l.connectionStatus === connectionStatus);
      }
      if (search) {
        leads = leads.filter(
          (l) =>
            l.fullName.toLowerCase().includes(search) ||
            l.whatsappNumber.includes(search) ||
            (l.adminNotes && l.adminNotes.toLowerCase().includes(search))
        );
      }

      leads.sort((a, b) => a.buyerNumber - b.buyerNumber);

      const total = leads.length;
      const totalPages = Math.ceil(total / pageSize) || 1;
      const offset = (page - 1) * pageSize;
      const paginated = leads.slice(offset, offset + pageSize);

      const summary = await getPoolMemberDecisionSummary(poolId);

      return NextResponse.json(
        {
          success: true,
          data: {
            members: paginated,
            total,
            page,
            pageSize,
            totalPages,
            summary,
          },
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Live D1 execution
    const db = await requireD1Database();

    const whereClauses: string[] = ['pool_id = ?'];
    const params: unknown[] = [poolId];

    if (quoteResponse) {
      whereClauses.push('quote_response = ?');
      params.push(quoteResponse);
    }
    if (feeStatus) {
      whereClauses.push('fee_status = ?');
      params.push(feeStatus);
    }
    if (connectionStatus) {
      whereClauses.push('member_connection_status = ?');
      params.push(connectionStatus);
    }
    if (search) {
      const s = `%${search}%`;
      whereClauses.push('(LOWER(full_name) LIKE ? OR whatsapp_number LIKE ? OR LOWER(admin_notes) LIKE ?)');
      params.push(s, s, s);
    }

    const whereSql = whereClauses.join(' AND ');

    const countRow = await db
      .prepare(`SELECT COUNT(*) as total FROM pool_leads WHERE ${whereSql}`)
      .bind(...params)
      .first<{ total: number }>();

    const total = Number(countRow?.total || 0);
    const totalPages = Math.ceil(total / pageSize) || 1;
    const offset = (page - 1) * pageSize;

    const dataSql = `
      SELECT * FROM pool_leads
      WHERE ${whereSql}
      ORDER BY buyer_number ASC
      LIMIT ? OFFSET ?
    `;

    const { results } = await db
      .prepare(dataSql)
      .bind(...params, pageSize, offset)
      .all<Record<string, unknown>>();

    const members: PoolLead[] = (results || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      poolId: String(row.pool_id),
      poolSlug: '',
      poolName: '',
      poolCategory: 'EV_SCOOTERS',
      fullName: String(row.full_name),
      whatsappNumber: String(row.whatsapp_number),
      city: String(row.city),
      buyingTimeline: row.buying_timeline as PoolLead['buyingTimeline'],
      hasExistingQuote: Boolean(row.has_existing_quote),
      existingQuoteAmount: row.existing_quote_amount !== null ? Number(row.existing_quote_amount) : null,
      extraMessage: String(row.extra_message || ''),
      selectedKitOfferId: (row.selected_kit_offer_id as string) || null,
      selectedKitName: (row.selected_kit_name as string) || null,
      status: row.status as PoolLead['status'],
      consentAt: String(row.consent_at),
      privacyNoticeVersion: String(row.privacy_notice_version),
      createdAt: String(row.created_at),
      buyerNumber: Number(row.buyer_number),
      locality: (row.locality as string) || null,
      pinCode: (row.pin_code as string) || null,
      adminNotes: (row.admin_notes as string) || null,
      doNotContact: Boolean(row.do_not_contact),
      quoteResponse: (row.quote_response as PoolLead['quoteResponse']) || undefined,
      quoteResponseNotes: (row.quote_response_notes as string) || undefined,
      quoteResponseRecordedAt: (row.quote_response_recorded_at as string) || undefined,
      feeStatus: (row.fee_status as PoolLead['feeStatus']) || undefined,
      feeRuleVersion: (row.fee_rule_version as string) || undefined,
      feeApprovedBasis: row.fee_approved_basis !== null && row.fee_approved_basis !== undefined ? Number(row.fee_approved_basis) : null,
      feeCalculatedAmount: row.fee_calculated_amount !== null && row.fee_calculated_amount !== undefined ? Number(row.fee_calculated_amount) : null,
      feeDisclosedAmount: row.fee_disclosed_amount !== null && row.fee_disclosed_amount !== undefined ? Number(row.fee_disclosed_amount) : null,
      feeDisclosedAt: (row.fee_disclosed_at as string) || undefined,
      paymentReference: (row.payment_reference as string) || undefined,
      paymentReportedAt: (row.payment_reported_at as string) || undefined,
      paymentVerifiedBy: (row.payment_verified_by as string) || undefined,
      paymentVerifiedAt: (row.payment_verified_at as string) || undefined,
      paymentWaiverReason: (row.payment_waiver_reason as string) || undefined,
      connectionStatus: (row.member_connection_status as PoolLead['connectionStatus']) || undefined,
      connectionDate: (row.connection_date as string) || undefined,
      connectionMethod: (row.connection_method as string) || undefined,
      exclusionReason: (row.exclusion_reason as string) || undefined,
      excludedAt: (row.excluded_at as string) || undefined,
      lastContactAt: (row.last_contact_at as string) || undefined,
      lastContactStatus: (row.last_contact_status as PoolLead['lastContactStatus']) || undefined,
      lastContactNote: (row.last_contact_note as string) || undefined,
    }));

    const summary = await getPoolMemberDecisionSummary(poolId);

    return NextResponse.json(
      {
        success: true,
        data: {
          members,
          total,
          page,
          pageSize,
          totalPages,
          summary,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error fetching group members.';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
