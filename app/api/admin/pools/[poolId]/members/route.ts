import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { isDemoMode } from '@/lib/data-mode';
import { getDemoLeads } from '@/lib/mock-data';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { PoolLead } from '@/types';

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

      // Sort by buyerNumber ascending
      leads.sort((a, b) => a.buyerNumber - b.buyerNumber);

      const total = leads.length;
      const totalPages = Math.ceil(total / pageSize) || 1;
      const offset = (page - 1) * pageSize;
      const paginated = leads.slice(offset, offset + pageSize);

      return NextResponse.json(
        {
          success: true,
          data: {
            members: paginated,
            total,
            page,
            pageSize,
            totalPages,
          },
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Live Supabase
    const supabase = getAdminSupabase();
    let query = supabase
      .from('pool_leads')
      .select('*', { count: 'exact' })
      .eq('pool_id', poolId)
      .order('buyer_number', { ascending: true });

    if (quoteResponse) query = query.eq('quote_response', quoteResponse);
    if (feeStatus) query = query.eq('fee_status', feeStatus);
    if (connectionStatus) query = query.eq('member_connection_status', connectionStatus);
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,whatsapp_number.ilike.%${search}%,admin_notes.ilike.%${search}%`);
    }

    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;
    if (error) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const members: PoolLead[] = (data || []).map((row) => ({
      id: row.id,
      poolId: row.pool_id,
      poolSlug: row.pool_slug || '',
      poolName: row.pool_name || '',
      poolCategory: row.pool_category,
      fullName: row.full_name,
      whatsappNumber: row.whatsapp_number,
      city: row.city,
      buyingTimeline: row.buying_timeline,
      hasExistingQuote: Boolean(row.has_existing_quote),
      existingQuoteAmount: row.existing_quote_amount !== null ? Number(row.existing_quote_amount) : null,
      extraMessage: row.extra_message || '',
      selectedKitOfferId: row.selected_kit_offer_id,
      selectedKitName: row.selected_kit_name,
      status: row.status,
      consentAt: row.consent_at,
      privacyNoticeVersion: row.privacy_notice_version,
      createdAt: row.created_at,
      buyerNumber: Number(row.buyer_number),
      locality: row.locality,
      pinCode: row.pin_code,
      adminNotes: row.admin_notes,
      doNotContact: Boolean(row.do_not_contact),
      quoteResponse: row.quote_response,
      quoteResponseNotes: row.quote_response_notes,
      quoteResponseRecordedAt: row.quote_response_recorded_at,
      feeStatus: row.fee_status,
      feeRuleVersion: row.fee_rule_version,
      feeApprovedBasis: row.fee_approved_basis !== null ? Number(row.fee_approved_basis) : null,
      feeCalculatedAmount: row.fee_calculated_amount !== null ? Number(row.fee_calculated_amount) : null,
      feeDisclosedAmount: row.fee_disclosed_amount !== null ? Number(row.fee_disclosed_amount) : null,
      feeDisclosedAt: row.fee_disclosed_at,
      paymentReference: row.payment_reference,
      paymentReportedAt: row.payment_reported_at,
      paymentVerifiedBy: row.payment_verified_by,
      paymentVerifiedAt: row.payment_verified_at,
      paymentWaiverReason: row.payment_waiver_reason,
      connectionStatus: row.member_connection_status,
      connectionDate: row.connection_date,
      connectionMethod: row.connection_method,
      exclusionReason: row.exclusion_reason,
      excludedAt: row.excluded_at,
      lastContactAt: row.last_contact_at,
      lastContactStatus: row.last_contact_status,
      lastContactNote: row.last_contact_note,
    }));

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize) || 1;

    return NextResponse.json(
      {
        success: true,
        data: {
          members,
          total,
          page,
          pageSize,
          totalPages,
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
