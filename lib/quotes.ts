import { PoolQuotation, QuoteStatus } from '@/types';
import { isDemoMode } from './data-mode';
import { getDemoQuotations, addDemoQuotation, updateDemoQuotation, getDemoLeads, MOCK_ADMIN_POOLS, MOCK_POOLS } from './mock-data';
import { requireD1Database } from './d1/db';

export interface CreateQuoteInput {
  priceType?: 'ESTIMATED' | 'VENDOR_QUOTED';
  vendorName: string;
  vendorContactRef?: string | null;
  quotedAmount: number;
  currency?: string;
  quoteDate: string;
  validUntil: string;
  scope: string;
  inclusions?: string[];
  exclusions?: string[];
  deliveryTerms?: string | null;
  quantityCondition?: string | null;
  status?: QuoteStatus;
  internalNotes?: string | null;
}

export interface UpdateQuoteInput {
  quotedAmount?: number;
  validUntil?: string;
  scope?: string;
  inclusions?: string[];
  exclusions?: string[];
  deliveryTerms?: string | null;
  quantityCondition?: string | null;
  status?: QuoteStatus;
  isCurrentPublished?: boolean;
  internalNotes?: string | null;
}

export interface MemberDecisionSummary {
  totalMembers: number;
  interestedCount: number;
  declinedCount: number;
  awaitingCount: number;
  needsInfoCount: number;
  noResponseCount: number;
  connectedCount: number;
  excludedCount: number;
  optedOutCount: number;
}

interface D1QuoteRow {
  id: string;
  pool_id: string;
  price_type: string;
  vendor_name: string;
  vendor_contact_ref: string | null;
  quoted_amount: number;
  currency: string;
  quote_date: string;
  valid_until: string;
  scope: string;
  inclusions: string;
  exclusions: string;
  delivery_terms: string | null;
  quantity_condition: string | null;
  status: string;
  is_current_published: number;
  verified_by_admin: string | null;
  verified_at: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

function parseJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function mapD1RowToQuote(row: D1QuoteRow): PoolQuotation {
  return {
    id: row.id,
    poolId: row.pool_id,
    priceType: row.price_type as PoolQuotation['priceType'],
    vendorName: row.vendor_name,
    vendorContactRef: row.vendor_contact_ref || undefined,
    quotedAmount: Number(row.quoted_amount),
    currency: row.currency || 'INR',
    quoteDate: row.quote_date,
    validUntil: row.valid_until,
    scope: row.scope,
    inclusions: parseJsonArray(row.inclusions),
    exclusions: parseJsonArray(row.exclusions),
    deliveryTerms: row.delivery_terms || undefined,
    quantityCondition: row.quantity_condition || undefined,
    status: row.status as PoolQuotation['status'],
    isCurrentPublished: Boolean(row.is_current_published),
    verifiedByAdmin: row.verified_by_admin || undefined,
    verifiedAt: row.verified_at || undefined,
    internalNotes: row.internal_notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Checks whether a quotation is actively published and not expired
 */
export function isQuoteValid(quote: PoolQuotation | null | undefined): boolean {
  if (!quote) return false;
  if (quote.status !== 'PUBLISHED' || !quote.isCurrentPublished) return false;
  try {
    const validUntilMs = new Date(quote.validUntil).getTime();
    if (isNaN(validUntilMs)) return false;
    return validUntilMs >= Date.now();
  } catch {
    return false;
  }
}

/**
 * Retrieves all quotations for a specific pool
 */
export async function getPoolQuotations(poolId: string): Promise<PoolQuotation[]> {
  if (isDemoMode()) {
    return getDemoQuotations(poolId);
  }

  const db = await requireD1Database();
  const { results } = await db
    .prepare('SELECT * FROM pool_quotations WHERE pool_id = ? ORDER BY created_at DESC')
    .bind(poolId)
    .all<D1QuoteRow>();

  return (results || []).map(mapD1RowToQuote);
}

/**
 * Retrieves the currently published and valid quotation for a pool, if any
 */
export async function getPublishedPoolQuotation(poolId: string): Promise<PoolQuotation | null> {
  const quotes = await getPoolQuotations(poolId);
  const published = quotes.find((q) => q.isCurrentPublished && q.status === 'PUBLISHED');
  if (!published) return null;
  if (!isQuoteValid(published)) return null;
  return published;
}

/**
 * Records a new supplier quotation for a pool
 */
export async function createPoolQuotation(
  poolId: string,
  input: CreateQuoteInput,
  adminIdentifier = 'admin_session'
): Promise<PoolQuotation> {
  const now = new Date().toISOString();
  const quoteId = `quote-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  if (isDemoMode()) {
    return addDemoQuotation(poolId, {
      priceType: input.priceType || 'VENDOR_QUOTED',
      vendorName: input.vendorName,
      vendorContactRef: input.vendorContactRef || null,
      quotedAmount: input.quotedAmount,
      currency: input.currency || 'INR',
      quoteDate: input.quoteDate,
      validUntil: input.validUntil,
      scope: input.scope,
      inclusions: input.inclusions || [],
      exclusions: input.exclusions || [],
      deliveryTerms: input.deliveryTerms || null,
      quantityCondition: input.quantityCondition || null,
      status: input.status || 'RECEIVED',
      isCurrentPublished: false,
      verifiedByAdmin: adminIdentifier,
      verifiedAt: now,
      internalNotes: input.internalNotes || null,
    });
  }

  const db = await requireD1Database();

  await db
    .prepare(
      `INSERT INTO pool_quotations (
        id, pool_id, price_type, vendor_name, vendor_contact_ref,
        quoted_amount, currency, quote_date, valid_until, scope,
        inclusions, exclusions, delivery_terms, quantity_condition,
        status, is_current_published, verified_by_admin, verified_at,
        internal_notes, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, 0, ?, ?,
        ?, ?, ?
      )`
    )
    .bind(
      quoteId,
      poolId,
      input.priceType || 'VENDOR_QUOTED',
      input.vendorName,
      input.vendorContactRef || null,
      input.quotedAmount,
      input.currency || 'INR',
      input.quoteDate,
      input.validUntil,
      input.scope,
      JSON.stringify(input.inclusions || []),
      JSON.stringify(input.exclusions || []),
      input.deliveryTerms || null,
      input.quantityCondition || null,
      input.status || 'RECEIVED',
      adminIdentifier,
      now,
      input.internalNotes || null,
      now,
      now
    )
    .run();

  const createdRow = await db
    .prepare('SELECT * FROM pool_quotations WHERE id = ?')
    .bind(quoteId)
    .first<D1QuoteRow>();

  if (!createdRow) {
    throw new Error('Failed to retrieve newly created quote from D1');
  }

  return mapD1RowToQuote(createdRow);
}

/**
 * Updates a supplier quotation and synchronizes pool verification indicators
 */
export async function updatePoolQuotation(
  poolId: string,
  quoteId: string,
  updates: UpdateQuoteInput
): Promise<PoolQuotation | null> {
  const now = new Date().toISOString();

  // If publishing, ensure the quote's validUntil date is not already expired
  if (updates.isCurrentPublished) {
    if (updates.validUntil && new Date(updates.validUntil).getTime() < Date.now()) {
      throw new Error('Cannot publish an expired quotation. Please update the validity date.');
    }
  }

  if (isDemoMode()) {
    const existing = getDemoQuotations(poolId).find((q) => q.id === quoteId);
    if (!existing) return null;

    if (updates.isCurrentPublished && new Date(updates.validUntil || existing.validUntil).getTime() < Date.now()) {
      throw new Error('Cannot publish an expired quotation. Please update the validity date.');
    }

    const updated = updateDemoQuotation(quoteId, updates);

    // If unpublishing or marked expired/withdrawn, ensure pool priceIsVerified is cleared
    if (existing.isCurrentPublished && (updates.isCurrentPublished === false || updates.status === 'EXPIRED' || updates.status === 'WITHDRAWN')) {
      const adminPool = MOCK_ADMIN_POOLS.find((p) => p.id === poolId);
      const pubPool = MOCK_POOLS.find((p) => p.id === poolId);
      if (adminPool) {
        adminPool.priceIsVerified = false;
        adminPool.priceVerifiedAt = null;
        adminPool.groupPriceType = 'INDICATIVE_ESTIMATE';
        adminPool.dealerName = null;
      }
      if (pubPool) {
        pubPool.priceIsVerified = false;
        pubPool.priceVerifiedAt = null;
        pubPool.groupPriceType = 'INDICATIVE_ESTIMATE';
      }
    }

    return updated;
  }

  const db = await requireD1Database();

  const existing = await db
    .prepare('SELECT * FROM pool_quotations WHERE id = ? AND pool_id = ?')
    .bind(quoteId, poolId)
    .first<D1QuoteRow>();

  if (!existing) return null;

  const effectiveValidUntil = updates.validUntil || existing.valid_until;
  if (updates.isCurrentPublished && new Date(effectiveValidUntil).getTime() < Date.now()) {
    throw new Error('Cannot publish an expired quotation. Please update the validity date.');
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
  } else if (Boolean(existing.is_current_published) && (updates.isCurrentPublished === false || updates.status === 'EXPIRED' || updates.status === 'WITHDRAWN')) {
    // Clearing current verified quote
    await db
      .prepare(`
        UPDATE pools
        SET price_is_verified = 0,
            price_verified_at = NULL,
            group_price_type = 'INDICATIVE_ESTIMATE',
            dealer_name = NULL,
            updated_at = ?
        WHERE id = ?
      `)
      .bind(now, poolId)
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
    .first<D1QuoteRow>();

  return updatedRow ? mapD1RowToQuote(updatedRow) : null;
}

/**
 * Derives exact member quote response and connection metrics from persisted records
 */
export async function getPoolMemberDecisionSummary(poolId: string): Promise<MemberDecisionSummary> {
  if (isDemoMode()) {
    const leads = getDemoLeads().filter((l) => l.poolId === poolId);
    return {
      totalMembers: leads.length,
      interestedCount: leads.filter((l) => l.quoteResponse === 'INTERESTED').length,
      declinedCount: leads.filter((l) => l.quoteResponse === 'DECLINED').length,
      awaitingCount: leads.filter((l) => l.quoteResponse === 'AWAITING_RESPONSE' || l.quoteResponse === 'NOT_SENT' || !l.quoteResponse).length,
      needsInfoCount: leads.filter((l) => l.quoteResponse === 'NEEDS_INFORMATION').length,
      noResponseCount: leads.filter((l) => l.quoteResponse === 'NO_RESPONSE').length,
      connectedCount: leads.filter((l) => l.connectionStatus === 'CONNECTED').length,
      excludedCount: leads.filter((l) => l.connectionStatus === 'EXCLUDED').length,
      optedOutCount: leads.filter((l) => l.doNotContact || l.connectionStatus === 'OPTED_OUT' || l.status === 'DO_NOT_CONTACT').length,
    };
  }

  const db = await requireD1Database();

  const row = await db
    .prepare(
      `SELECT
        COUNT(*) as total_members,
        SUM(CASE WHEN quote_response = 'INTERESTED' THEN 1 ELSE 0 END) as interested_count,
        SUM(CASE WHEN quote_response = 'DECLINED' THEN 1 ELSE 0 END) as declined_count,
        SUM(CASE WHEN quote_response IN ('AWAITING_RESPONSE', 'NOT_SENT') OR quote_response IS NULL THEN 1 ELSE 0 END) as awaiting_count,
        SUM(CASE WHEN quote_response = 'NEEDS_INFORMATION' THEN 1 ELSE 0 END) as needs_info_count,
        SUM(CASE WHEN quote_response = 'NO_RESPONSE' THEN 1 ELSE 0 END) as no_response_count,
        SUM(CASE WHEN member_connection_status = 'CONNECTED' THEN 1 ELSE 0 END) as connected_count,
        SUM(CASE WHEN member_connection_status = 'EXCLUDED' THEN 1 ELSE 0 END) as excluded_count,
        SUM(CASE WHEN do_not_contact = 1 OR member_connection_status = 'OPTED_OUT' OR status = 'DO_NOT_CONTACT' THEN 1 ELSE 0 END) as opted_out_count
       FROM pool_leads
       WHERE pool_id = ?`
    )
    .bind(poolId)
    .first<Record<string, number | null>>();

  return {
    totalMembers: Number(row?.total_members || 0),
    interestedCount: Number(row?.interested_count || 0),
    declinedCount: Number(row?.declined_count || 0),
    awaitingCount: Number(row?.awaiting_count || 0),
    needsInfoCount: Number(row?.needs_info_count || 0),
    noResponseCount: Number(row?.no_response_count || 0),
    connectedCount: Number(row?.connected_count || 0),
    excludedCount: Number(row?.excluded_count || 0),
    optedOutCount: Number(row?.opted_out_count || 0),
  };
}
