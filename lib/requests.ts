import { PoolRequestSchemaInput } from './validation';
import { isDemoMode } from './data-mode';
import { PoolCategory, PoolRequest } from '@/types';
import { addDemoRequest, getDemoRequests } from './mock-data';
import { requireD1Database } from './d1/db';

interface D1PoolRequestRow {
  id: string;
  product_name: string;
  category: string | null;
  category_name: string | null;
  brand_preference: string | null;
  model_preference: string | null;
  city: string;
  state: string | null;
  locality: string | null;
  pin_code: string | null;
  requirements_summary: string | null;
  target_buyers_requested: number | null;
  requested_deadline: string | null;
  contact_consent: number;
  consent_at: string;
  request_type: string | null;
  full_name: string | null;
  whatsapp_number: string | null;
  extra_message: string;
  status: string;
  admin_notes: string;
  resulting_pool_id: string | null;
  conversion_status: string;
  created_at: string;
  reviewed_at: string | null;
  updated_at: string;
}

function mapRowToPoolRequest(row: D1PoolRequestRow): PoolRequest {
  return {
    id: row.id,
    productName: row.product_name,
    category: (row.category as PoolCategory) || null,
    categoryName: row.category_name,
    brandPreference: row.brand_preference,
    modelPreference: row.model_preference,
    city: row.city,
    state: row.state,
    locality: row.locality,
    pinCode: row.pin_code,
    requirementsSummary: row.requirements_summary,
    targetBuyersRequested: Number(row.target_buyers_requested ?? 10),
    requestedDeadline: row.requested_deadline,
    contactConsent: Boolean(row.contact_consent),
    consentAt: row.consent_at,
    requestType: (row.request_type as PoolRequest['requestType']) || 'GROUP_PROPOSAL',
    fullName: row.full_name,
    whatsappNumber: row.whatsapp_number,
    extraMessage: row.extra_message || '',
    status: (row.status as PoolRequest['status']) || 'REQUESTED',
    adminNotes: row.admin_notes || '',
    resultingPoolId: row.resulting_pool_id,
    conversionStatus: (row.conversion_status as PoolRequest['conversionStatus']) || 'PENDING',
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

/**
 * Submits a demand discovery pool request via D1 or demo store.
 */
export async function executePoolRequest(
  input: PoolRequestSchemaInput
): Promise<{ id: string; isDemo: boolean }> {
  const now = new Date().toISOString();
  const id = `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const resolvedProductName = input.productName || input.requestedTitle || '';
  const resolvedCity = input.city || input.cityText || 'India';
  const resolvedState = input.state || input.stateText || null;
  const resolvedFullName = input.fullName || input.name || null;
  const resolvedPhone = input.whatsappNumber || input.phone || null;
  const resolvedNotes = input.extraMessage || input.notes || '';

  if (isDemoMode()) {
    const newRequest: PoolRequest = {
      id,
      productName: resolvedProductName,
      category: (input.category as PoolCategory) || null,
      categoryName: input.categoryName || null,
      brandPreference: input.brandPreference || null,
      modelPreference: input.modelPreference || null,
      city: resolvedCity,
      state: resolvedState,
      locality: input.locality || null,
      pinCode: input.pinCode || null,
      requirementsSummary: input.requirementsSummary || null,
      targetBuyersRequested: input.targetBuyersRequested || 10,
      requestedDeadline: input.requestedDeadline || null,
      contactConsent: input.contactConsent ?? true,
      consentAt: now,
      requestType: input.requestType || 'GROUP_PROPOSAL',
      fullName: resolvedFullName,
      whatsappNumber: resolvedPhone,
      extraMessage: resolvedNotes,
      status: 'REQUESTED',
      adminNotes: '',
      resultingPoolId: null,
      conversionStatus: 'PENDING',
      createdAt: now,
      reviewedAt: null,
    };

    addDemoRequest(newRequest);
    return { id, isDemo: true };
  }

  const db = await requireD1Database();

  await db
    .prepare(
      `INSERT INTO pool_requests (
        id, product_name, category, category_name, brand_preference, model_preference,
        city, state, locality, pin_code, requirements_summary, target_buyers_requested,
        requested_deadline, contact_consent, consent_at, request_type, full_name,
        whatsapp_number, extra_message, status, admin_notes, resulting_pool_id,
        conversion_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REQUESTED', '', NULL, 'PENDING', ?, ?)`
    )
    .bind(
      id,
      resolvedProductName,
      input.category || null,
      input.categoryName || null,
      input.brandPreference || null,
      input.modelPreference || null,
      resolvedCity,
      resolvedState,
      input.locality || null,
      input.pinCode || null,
      input.requirementsSummary || null,
      input.targetBuyersRequested || 10,
      input.requestedDeadline || null,
      input.contactConsent ?? true ? 1 : 0,
      now,
      input.requestType || 'GROUP_PROPOSAL',
      resolvedFullName,
      resolvedPhone,
      resolvedNotes,
      now,
      now
    )
    .run();

  return { id, isDemo: false };
}

/**
 * Loads all pool requests for admin console.
 */
export async function getAllPoolRequests(): Promise<PoolRequest[]> {
  if (isDemoMode()) {
    return getDemoRequests();
  }

  const db = await requireD1Database();
  const { results } = await db
    .prepare('SELECT * FROM pool_requests ORDER BY created_at DESC')
    .all<D1PoolRequestRow>();

  return (results || []).map(mapRowToPoolRequest);
}

/**
 * Loads single pool request by ID.
 */
export async function getPoolRequestById(requestId: string): Promise<PoolRequest | null> {
  if (isDemoMode()) {
    const found = getDemoRequests().find((r) => r.id === requestId);
    return found || null;
  }

  const db = await requireD1Database();
  const row = await db
    .prepare('SELECT * FROM pool_requests WHERE id = ?')
    .bind(requestId)
    .first<D1PoolRequestRow>();

  if (!row) return null;
  return mapRowToPoolRequest(row);
}
