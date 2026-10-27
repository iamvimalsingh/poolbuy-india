import 'server-only';
import { PoolLead, AdminLeadFilters, LeadStatus } from '@/types';
import { getAdminSupabase } from './supabase/admin';
import { isDemoMode } from './data-mode';

interface LeadsQueryResult {
  leads: PoolLead[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface RawLeadRow {
  id: string;
  pool_id: string;
  buyer_number: number;
  full_name: string;
  whatsapp_number: string;
  city: string;
  buying_timeline: string;
  has_existing_quote: boolean;
  existing_quote_amount: number | string | null;
  extra_message: string;
  status: string;
  consent_at: string;
  privacy_notice_version: string;
  created_at: string;
  connection_opt_in?: boolean;
  vendor_share_consent?: boolean;
  locality?: string | null;
  pin_code?: string | null;
  admin_notes?: string | null;
  do_not_contact?: boolean;
  contact_preference?: string | null;
  selected_kit_offer_id?: string | null;
  pools?: {
    slug: string;
    name: string;
    category: string;
  } | null;
}

function mapRawRowToLead(row: RawLeadRow): PoolLead {
  return {
    id: row.id,
    poolId: row.pool_id,
    poolSlug: row.pools?.slug || 'unknown-pool',
    poolName: row.pools?.name || 'Pool',
    poolCategory: (row.pools?.category || 'EV_SCOOTERS') as PoolLead['poolCategory'],
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
    pinCode: row.pin_code || null,
    adminNotes: row.admin_notes || null,
    doNotContact: Boolean(row.do_not_contact),
    contactPreference: row.contact_preference || 'WHATSAPP',
    selectedKitOfferId: row.selected_kit_offer_id || null,
  };
}

/**
 * Loads filtered and paginated leads for the authenticated admin dashboard.
 */
import { getDemoLeads, DEMO_LEADS } from './mock-data';

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
          l.extraMessage.toLowerCase().includes(s)
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

  const supabase = getAdminSupabase();

  let query = supabase
    .from('pool_leads')
    .select(
      `
      id,
      pool_id,
      buyer_number,
      full_name,
      whatsapp_number,
      city,
      buying_timeline,
      has_existing_quote,
      existing_quote_amount,
      extra_message,
      status,
      consent_at,
      privacy_notice_version,
      created_at,
      pools (
        slug,
        name,
        category
      )
    `,
      { count: 'exact' }
    );

  if (filters.poolId) {
    query = query.eq('pool_id', filters.poolId);
  }
  if (filters.city) {
    query = query.eq('city', filters.city);
  }
  if (filters.buyingTimeline) {
    query = query.eq('buying_timeline', filters.buyingTimeline);
  }
  if (filters.hasExistingQuote !== undefined) {
    query = query.eq('has_existing_quote', filters.hasExistingQuote);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.search?.trim()) {
    const s = filters.search.trim();
    query = query.or(`full_name.ilike.%${s}%,whatsapp_number.ilike.%${s}%,extra_message.ilike.%${s}%`);
  }

  const fromIndex = (page - 1) * pageSize;
  const toIndex = fromIndex + pageSize - 1;

  query = query.order('created_at', { ascending: false }).range(fromIndex, toIndex);

  const { data, count, error } = await query;

  if (error) {
    console.error('Error fetching admin leads:', error.message);
    throw new Error(`Failed to query leads: ${error.message}`);
  }

  const total = count || 0;
  const leads = (data || []).map((r) => mapRawRowToLead(r as unknown as RawLeadRow));

  return {
    leads,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
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

  const supabase = getAdminSupabase();

  let query = supabase
    .from('pool_leads')
    .select(
      `
      id,
      pool_id,
      buyer_number,
      full_name,
      whatsapp_number,
      city,
      buying_timeline,
      has_existing_quote,
      existing_quote_amount,
      extra_message,
      status,
      consent_at,
      privacy_notice_version,
      created_at,
      pools (
        slug,
        name,
        category
      )
    `
    )
    .order('created_at', { ascending: false })
    .limit(5000);

  if (filters.poolId) query = query.eq('pool_id', filters.poolId);
  if (filters.city) query = query.eq('city', filters.city);
  if (filters.buyingTimeline) query = query.eq('buying_timeline', filters.buyingTimeline);
  if (filters.hasExistingQuote !== undefined) query = query.eq('has_existing_quote', filters.hasExistingQuote);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.search?.trim()) {
    const s = filters.search.trim();
    query = query.or(`full_name.ilike.%${s}%,whatsapp_number.ilike.%${s}%,extra_message.ilike.%${s}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching leads for export:', error.message);
    throw new Error(`Export query failed: ${error.message}`);
  }

  return (data || []).map((r) => mapRawRowToLead(r as unknown as RawLeadRow));
}

/**
 * Updates a lead status (e.g. NEW -> CONTACTED -> QUALIFIED -> CONVERTED -> DO_NOT_CONTACT)
 */
export async function updateLeadStatus(leadId: string, status: LeadStatus): Promise<void> {
  if (isDemoMode()) {
    const lead = DEMO_LEADS.find((l) => l.id === leadId);
    if (lead) {
      lead.status = status;
    }
    return;
  }

  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from('pool_leads')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', leadId);

  if (error) {
    console.error('Error updating lead status:', error.message);
    throw new Error(`Failed to update lead: ${error.message}`);
  }
}
