import { PoolRequestSchemaInput } from './validation';
import { isDemoMode } from './data-mode';
import { PoolCategory, PoolRequest } from '@/types';
import { addDemoRequest, getDemoRequests, getDemoCategories } from './mock-data';
import { requireD1Database } from './d1/db';
import { normalizePhone } from './format';

interface D1PoolRequestRow {
  id: string;
  product_name: string;
  category: string | null;
  category_slug?: string | null;
  category_name: string | null;
  brand_preference: string | null;
  model_preference: string | null;
  city: string;
  city_text?: string | null;
  state: string | null;
  state_text?: string | null;
  locality: string | null;
  pin_code: string | null;
  requirements_summary: string | null;
  target_buyers_requested: number | null;
  requested_deadline: string | null;
  contact_consent: number;
  join_pool_consent?: number;
  consent_at: string;
  request_type: string | null;
  full_name: string | null;
  whatsapp_number: string | null;
  extra_message: string;
  status: string;
  admin_notes: string;
  resulting_pool_id: string | null;
  conversion_status: string;
  is_archived?: number;
  archived_at?: string | null;
  created_at: string;
  reviewed_at: string | null;
  updated_at: string;
}

function mapRowToPoolRequest(row: D1PoolRequestRow): PoolRequest {
  return {
    id: row.id,
    productName: row.product_name,
    category: (row.category_slug || row.category as PoolCategory) || null,
    categorySlug: row.category_slug || row.category || null,
    categoryName: row.category_name,
    brandPreference: row.brand_preference,
    modelPreference: row.model_preference,
    city: row.city_text || row.city,
    cityText: row.city_text || row.city,
    state: row.state_text || row.state,
    stateText: row.state_text || row.state,
    locality: row.locality,
    pinCode: row.pin_code,
    requirementsSummary: row.requirements_summary,
    targetBuyersRequested: Number(row.target_buyers_requested ?? 10),
    requestedDeadline: row.requested_deadline,
    contactConsent: Boolean(row.contact_consent),
    joinPoolConsent: Boolean(row.join_pool_consent),
    consentAt: row.consent_at,
    requestType: (row.request_type as PoolRequest['requestType']) || 'GROUP_PROPOSAL',
    fullName: row.full_name,
    whatsappNumber: row.whatsapp_number,
    extraMessage: row.extra_message || '',
    status: (row.status as PoolRequest['status']) || 'REQUESTED',
    adminNotes: row.admin_notes || '',
    resultingPoolId: row.resulting_pool_id,
    conversionStatus: (row.conversion_status as PoolRequest['conversionStatus']) || 'PENDING',
    isArchived: Boolean(row.is_archived),
    archivedAt: row.archived_at || null,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

/**
 * Submits a demand discovery pool request via D1 or demo store.
 */
export async function executePoolRequest(
  input: PoolRequestSchemaInput
): Promise<{ id: string; isDemo: boolean; isDuplicate?: boolean; existingRequestId?: string }> {
  const now = new Date().toISOString();
  const id = `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const resolvedProductName = (input.productName || input.requestedTitle || '').trim();
  const resolvedCity = (input.city || input.cityText || 'India').trim();
  const resolvedState = input.state || input.stateText || null;
  const resolvedFullName = input.fullName || input.name || null;
  const rawPhone = input.whatsappNumber || input.phone || null;
  const normalizedPhone = rawPhone ? normalizePhone(rawPhone) : null;
  const resolvedPhone = normalizedPhone || rawPhone;
  const resolvedNotes = input.extraMessage || input.notes || '';
  const joinConsent = Boolean(input.joinPoolConsent);
  const normalizedCity = resolvedCity.toLowerCase();
  const normalizedProduct = resolvedProductName.toLowerCase();
  const normalizedModel = input.modelPreference ? input.modelPreference.trim().toLowerCase() : '';

  // 1. Validate Category if specified (prevent deactivated categories for new requests)
  const reqCatSlug = input.categorySlug || input.category;
  if (reqCatSlug) {
    if (isDemoMode()) {
      const cat = getDemoCategories().find((c) => c.slug === reqCatSlug || c.id === reqCatSlug);
      if (cat && !cat.isActive) {
        throw new Error('CATEGORY_INACTIVE');
      }
    } else {
      const db = await requireD1Database();
      const catRow = await db
        .prepare('SELECT id, is_active FROM categories WHERE slug = ? OR id = ?')
        .bind(reqCatSlug, reqCatSlug)
        .first<{ id: string; is_active: number }>();
      if (catRow && Number(catRow.is_active) === 0) {
        throw new Error('CATEGORY_INACTIVE');
      }
    }
  }

  // 2. Demo Mode Execution
  if (isDemoMode()) {
    // Check for active duplicate in demo store
    if (normalizedPhone) {
      const existingDemo = getDemoRequests().find((r) => {
        const rPhone = r.whatsappNumber ? normalizePhone(r.whatsappNumber) : null;
        const rCity = r.city.trim().toLowerCase();
        const rProd = r.productName.trim().toLowerCase();
        const rModel = r.modelPreference ? r.modelPreference.trim().toLowerCase() : '';
        const isActive = !r.isArchived && ['REQUESTED', 'REVIEWING', 'APPROVED'].includes(r.status);
        return rPhone === normalizedPhone && rCity === normalizedCity && rProd === normalizedProduct && rModel === normalizedModel && isActive;
      });

      if (existingDemo) {
        return {
          id: existingDemo.id,
          isDemo: true,
          isDuplicate: true,
          existingRequestId: existingDemo.id,
        };
      }
    }

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
      joinPoolConsent: joinConsent,
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

  // 3. Live D1 Database Execution
  const db = await requireD1Database();

  // Check for active duplicate request in D1
  if (normalizedPhone) {
    const existingRows = await db
      .prepare(
        `SELECT id, status, model_preference
         FROM pool_requests
         WHERE whatsapp_number = ?
           AND LOWER(TRIM(city)) = ?
           AND LOWER(TRIM(product_name)) = ?
           AND is_archived = 0
           AND status IN ('REQUESTED', 'REVIEWING', 'APPROVED')`
      )
      .bind(normalizedPhone, normalizedCity, normalizedProduct)
      .all<{ id: string; status: string; model_preference: string | null }>();

    const duplicate = (existingRows.results || []).find((row) => {
      const existingModel = row.model_preference ? row.model_preference.trim().toLowerCase() : '';
      return existingModel === normalizedModel;
    });

    if (duplicate) {
      return {
        id: duplicate.id,
        isDemo: false,
        isDuplicate: true,
        existingRequestId: duplicate.id,
      };
    }
  }

  await db
    .prepare(
      `INSERT INTO pool_requests (
        id, product_name, category, category_name, brand_preference, model_preference,
        city, state, locality, pin_code, requirements_summary, target_buyers_requested,
        requested_deadline, contact_consent, join_pool_consent, consent_at, request_type, full_name,
        whatsapp_number, extra_message, status, admin_notes, resulting_pool_id,
        conversion_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REQUESTED', '', NULL, 'PENDING', ?, ?)`
    )
    .bind(
      id,
      resolvedProductName,
      input.categorySlug || input.category || null,
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
      joinConsent ? 1 : 0,
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
