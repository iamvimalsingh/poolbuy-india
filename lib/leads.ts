import { PoolLead, AdminLeadFilters, LeadStatus } from '@/types';
import { isDemoMode } from './data-mode';
import { getDemoLeads, DEMO_LEADS } from './mock-data';
import { requireD1Database } from './d1/db';

interface LeadsQueryResult {
  leads: PoolLead[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface D1RawLeadRow {
  id: string;
  pool_id: string;
  buyer_number: number;
  full_name: string;
  whatsapp_number: string;
  city: string;
  buying_timeline: string;
  has_existing_quote: number;
  existing_quote_amount: number | null;
  extra_message: string;
  status: string;
  consent_at: string;
  privacy_notice_version: string;
  created_at: string;
  connection_opt_in?: number;
  vendor_share_consent?: number;
  locality?: string | null;
  pin_code?: string | null;
  pincode?: string | null;
  existing_quote?: string | null;
  admin_notes?: string | null;
  do_not_contact?: number;
  contact_preference?: string | null;
  selected_kit_offer_id?: string | null;
  pool_slug?: string | null;
  pool_name?: string | null;
  pool_category?: string | null;
  quote_response?: string | null;
  quote_response_notes?: string | null;
  quote_response_recorded_at?: string | null;
  fee_status?: string | null;
  fee_rule_version?: string | null;
  fee_approved_basis?: number | null;
  fee_calculated_amount?: number | null;
  fee_disclosed_amount?: number | null;
  fee_disclosed_at?: string | null;
  payment_reference?: string | null;
  payment_reported_at?: string | null;
  payment_verified_by?: string | null;
  payment_verified_at?: string | null;
  payment_waiver_reason?: string | null;
  member_connection_status?: string | null;
  connection_date?: string | null;
  connection_method?: string | null;
  exclusion_reason?: string | null;
  excluded_at?: string | null;
  last_contact_at?: string | null;
  last_contact_status?: string | null;
  last_contact_note?: string | null;
}

function mapRawRowToLead(row: D1RawLeadRow): PoolLead {
  return {
    id: row.id,
    poolId: row.pool_id,
    poolSlug: row.pool_slug || 'unknown-pool',
    poolName: row.pool_name || 'Pool',
    poolCategory: (row.pool_category || 'EV_SCOOTERS') as PoolLead['poolCategory'],
    fullName: row.full_name,
    whatsappNumber: row.whatsapp_number,
    city: row.city,
    buyingTimeline: row.buying_timeline as PoolLead['buyingTimeline'],
    hasExistingQuote: Boolean(row.has_existing_quote),
    existingQuoteAmount:
      row.existing_quote_amount !== null ? Number(row.existing_quote_amount) : null,
    extraMessage: row.extra_message || '',
    status: row.status as PoolLead['status'],
    consentAt: row.consent_at,
    privacyNoticeVersion: row.privacy_notice_version,
    createdAt: row.created_at,
    buyerNumber: Number(row.buyer_number),
    connectionOptIn: Boolean(row.connection_opt_in),
    vendorShareConsent: Boolean(row.vendor_share_consent),
    locality: row.locality || null,
    pinCode: row.pincode || row.pin_code || null,
    pincode: row.pincode || row.pin_code || null,
    existingQuote: row.existing_quote || null,
    existing_quote: row.existing_quote || null,
    adminNotes: row.admin_notes || null,
    doNotContact: Boolean(row.do_not_contact),
    contactPreference: row.contact_preference || 'WHATSAPP',
    selectedKitOfferId: row.selected_kit_offer_id || null,
    quoteResponse: (row.quote_response as PoolLead['quoteResponse']) || undefined,
    quoteResponseNotes: row.quote_response_notes || undefined,
    quoteResponseRecordedAt: row.quote_response_recorded_at || undefined,
    feeStatus: (row.fee_status as PoolLead['feeStatus']) || undefined,
    feeRuleVersion: row.fee_rule_version || undefined,
    feeApprovedBasis: row.fee_approved_basis !== null ? Number(row.fee_approved_basis) : undefined,
    feeCalculatedAmount: row.fee_calculated_amount !== null ? Number(row.fee_calculated_amount) : undefined,
    feeDisclosedAmount: row.fee_disclosed_amount !== null ? Number(row.fee_disclosed_amount) : undefined,
    feeDisclosedAt: row.fee_disclosed_at || undefined,
    paymentReference: row.payment_reference || undefined,
    paymentReportedAt: row.payment_reported_at || undefined,
    paymentVerifiedBy: row.payment_verified_by || undefined,
    paymentVerifiedAt: row.payment_verified_at || undefined,
    paymentWaiverReason: row.payment_waiver_reason || undefined,
    connectionStatus: (row.member_connection_status as PoolLead['connectionStatus']) || undefined,
    connectionDate: row.connection_date || undefined,
    connectionMethod: row.connection_method || undefined,
    exclusionReason: row.exclusion_reason || undefined,
    excludedAt: row.excluded_at || undefined,
    lastContactAt: row.last_contact_at || undefined,
    lastContactStatus: (row.last_contact_status as PoolLead['lastContactStatus']) || undefined,
    lastContactNote: row.last_contact_note || undefined,
  };
}

/**
 * Loads filtered and paginated leads for the authenticated admin dashboard.
 */
export async function getAdminLeads(filters: AdminLeadFilters): Promise<LeadsQueryResult> {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 20));

  if (isDemoMode()) {
    let filtered = getDemoLeads();

    if (filters.poolId) {
      filtered = filtered.filter((l) => l.poolId === filters.poolId);
    }
    if (filters.city) {
      filtered = filtered.filter((l) => l.city.toLowerCase() === filters.city!.toLowerCase());
    }
    if (filters.buyingTimeline) {
      filtered = filtered.filter((l) => l.buyingTimeline === filters.buyingTimeline);
    }
    if (filters.hasExistingQuote !== undefined) {
      filtered = filtered.filter((l) => l.hasExistingQuote === filters.hasExistingQuote);
    }
    if (filters.status) {
      filtered = filtered.filter((l) => l.status === filters.status);
    }
    if (filters.search?.trim()) {
      const s = filters.search.toLowerCase().trim();
      filtered = filtered.filter(
        (l) =>
          l.fullName.toLowerCase().includes(s) ||
          l.whatsappNumber.includes(s) ||
          l.extraMessage.toLowerCase().includes(s) ||
          (l.pincode && l.pincode.includes(s)) ||
          (l.pinCode && l.pinCode.includes(s)) ||
          (l.existingQuote && l.existingQuote.toLowerCase().includes(s))
      );
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

    return {
      leads: paginated,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  const db = await requireD1Database();

  const whereClauses: string[] = ['1=1'];
  const params: unknown[] = [];

  if (filters.poolId) {
    whereClauses.push('l.pool_id = ?');
    params.push(filters.poolId);
  }
  if (filters.city) {
    whereClauses.push('LOWER(l.city) = LOWER(?)');
    params.push(filters.city);
  }
  if (filters.buyingTimeline) {
    whereClauses.push('l.buying_timeline = ?');
    params.push(filters.buyingTimeline);
  }
  if (filters.hasExistingQuote !== undefined) {
    whereClauses.push('l.has_existing_quote = ?');
    params.push(filters.hasExistingQuote ? 1 : 0);
  }
  if (filters.status) {
    whereClauses.push('l.status = ?');
    params.push(filters.status);
  }
  if (filters.search?.trim()) {
    const s = `%${filters.search.trim()}%`;
    whereClauses.push('(l.full_name LIKE ? OR l.whatsapp_number LIKE ? OR l.extra_message LIKE ? OR l.pincode LIKE ? OR l.pin_code LIKE ? OR l.existing_quote LIKE ?)');
    params.push(s, s, s, s, s, s);
  }

  const whereSql = whereClauses.join(' AND ');

  // Count total matching
  const countRow = await db
    .prepare(`SELECT COUNT(*) as total FROM pool_leads l WHERE ${whereSql}`)
    .bind(...params)
    .first<{ total: number }>();

  const total = Number(countRow?.total || 0);
  const totalPages = Math.ceil(total / pageSize) || 1;
  const offset = (page - 1) * pageSize;

  const dataSql = `
    SELECT
      l.*,
      p.slug as pool_slug,
      p.name as pool_name,
      p.category as pool_category
    FROM pool_leads l
    LEFT JOIN pools p ON l.pool_id = p.id
    WHERE ${whereSql}
    ORDER BY l.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const queryParams = [...params, pageSize, offset];
  const { results } = await db.prepare(dataSql).bind(...queryParams).all<D1RawLeadRow>();

  const leads = (results || []).map(mapRawRowToLead);

  return {
    leads,
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Loads all matching leads (up to 5,000) for CSV export
 */
export async function getLeadsForExport(
  filters: Omit<AdminLeadFilters, 'page' | 'pageSize'>
): Promise<PoolLead[]> {
  if (isDemoMode()) {
    let filtered = getDemoLeads();
    if (filters.poolId) filtered = filtered.filter((l) => l.poolId === filters.poolId);
    if (filters.city) filtered = filtered.filter((l) => l.city.toLowerCase() === filters.city!.toLowerCase());
    if (filters.buyingTimeline) filtered = filtered.filter((l) => l.buyingTimeline === filters.buyingTimeline);
    if (filters.hasExistingQuote !== undefined) filtered = filtered.filter((l) => l.hasExistingQuote === filters.hasExistingQuote);
    if (filters.status) filtered = filtered.filter((l) => l.status === filters.status);
    if (filters.search?.trim()) {
      const s = filters.search.toLowerCase().trim();
      filtered = filtered.filter(
        (l) =>
          l.fullName.toLowerCase().includes(s) ||
          l.whatsappNumber.includes(s) ||
          l.extraMessage.toLowerCase().includes(s)
      );
    }
    return filtered.slice(0, 5000);
  }

  const db = await requireD1Database();

  const whereClauses: string[] = ['1=1'];
  const params: unknown[] = [];

  if (filters.poolId) {
    whereClauses.push('l.pool_id = ?');
    params.push(filters.poolId);
  }
  if (filters.city) {
    whereClauses.push('LOWER(l.city) = LOWER(?)');
    params.push(filters.city);
  }
  if (filters.buyingTimeline) {
    whereClauses.push('l.buying_timeline = ?');
    params.push(filters.buyingTimeline);
  }
  if (filters.hasExistingQuote !== undefined) {
    whereClauses.push('l.has_existing_quote = ?');
    params.push(filters.hasExistingQuote ? 1 : 0);
  }
  if (filters.status) {
    whereClauses.push('l.status = ?');
    params.push(filters.status);
  }
  if (filters.search?.trim()) {
    const s = `%${filters.search.trim()}%`;
    whereClauses.push('(l.full_name LIKE ? OR l.whatsapp_number LIKE ? OR l.extra_message LIKE ?)');
    params.push(s, s, s);
  }

  const sql = `
    SELECT
      l.*,
      p.slug as pool_slug,
      p.name as pool_name,
      p.category as pool_category
    FROM pool_leads l
    LEFT JOIN pools p ON l.pool_id = p.id
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY l.created_at DESC
    LIMIT 5000
  `;

  const { results } = await db.prepare(sql).bind(...params).all<D1RawLeadRow>();
  return (results || []).map(mapRawRowToLead);
}

/**
 * Updates a lead status (e.g. NEW -> CONTACTED -> QUALIFIED -> CONVERTED -> DO_NOT_CONTACT)
 * When status is set to DO_NOT_CONTACT, do_not_contact is atomically set to 1.
 */
export async function updateLeadStatus(leadId: string, status: LeadStatus): Promise<void> {
  const isDoNotContact = status === 'DO_NOT_CONTACT';
  if (isDemoMode()) {
    const lead = DEMO_LEADS.find((l) => l.id === leadId);
    if (lead) {
      lead.status = status;
      if (isDoNotContact) {
        lead.doNotContact = true;
      }
    }
    return;
  }

  const db = await requireD1Database();
  const now = new Date().toISOString();

  if (isDoNotContact) {
    await db
      .prepare('UPDATE pool_leads SET status = ?, do_not_contact = 1, updated_at = ? WHERE id = ?')
      .bind(status, now, leadId)
      .run();
  } else {
    await db
      .prepare('UPDATE pool_leads SET status = ?, updated_at = ? WHERE id = ?')
      .bind(status, now, leadId)
      .run();
  }
}
