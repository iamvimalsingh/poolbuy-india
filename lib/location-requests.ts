import { LocationRequest } from '@/types';
import { isDemoMode } from './data-mode';
import {
  getDemoLocationRequests,
  addDemoLocationRequest,
  updateDemoLocationRequest,
} from './mock-data';
import { requireD1Database } from './d1/db';
import { createCity, getCityByNameAndState, getCityBySlug, updateCity } from './cities';
import { slugify } from './format';

interface D1LocationRequestRow {
  id: string;
  city_name: string;
  state_name: string;
  status: string;
  requested_by_phone: string | null;
  pool_request_id: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapRowToLocationRequest(row: D1LocationRequestRow): LocationRequest {
  return {
    id: row.id,
    cityName: row.city_name,
    stateName: row.state_name,
    status: (row.status as LocationRequest['status']) || 'PENDING',
    requestedByPhone: row.requested_by_phone,
    poolRequestId: row.pool_request_id,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Records a user-submitted location request if the city is not currently configured.
 * Deduplicates obvious duplicate pending requests for the same city and state.
 */
export async function recordLocationRequest(input: {
  cityName: string;
  stateName: string;
  requestedByPhone?: string | null;
  poolRequestId?: string | null;
}): Promise<LocationRequest> {
  const normCity = input.cityName.trim();
  const normState = input.stateName.trim();
  const now = new Date().toISOString();
  const id = `locreq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  if (isDemoMode()) {
    const existing = getDemoLocationRequests().find(
      (r) =>
        r.cityName.toLowerCase() === normCity.toLowerCase() &&
        r.stateName.toLowerCase() === normState.toLowerCase() &&
        r.status === 'PENDING'
    );
    if (existing) return existing;

    const newReq: LocationRequest = {
      id,
      cityName: normCity,
      stateName: normState,
      status: 'PENDING',
      requestedByPhone: input.requestedByPhone || null,
      poolRequestId: input.poolRequestId || null,
      adminNotes: null,
      createdAt: now,
      updatedAt: now,
    };
    addDemoLocationRequest(newReq);
    return newReq;
  }

  const db = await requireD1Database();

  // Check duplicate pending request
  const existing = await db
    .prepare(
      'SELECT * FROM location_requests WHERE LOWER(TRIM(city_name)) = LOWER(TRIM(?)) AND LOWER(TRIM(state_name)) = LOWER(TRIM(?)) AND status = ?'
    )
    .bind(normCity, normState, 'PENDING')
    .first<D1LocationRequestRow>();

  if (existing) {
    return mapRowToLocationRequest(existing);
  }

  await db
    .prepare(
      'INSERT INTO location_requests (id, city_name, state_name, status, requested_by_phone, pool_request_id, admin_notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      id,
      normCity,
      normState,
      'PENDING',
      input.requestedByPhone || null,
      input.poolRequestId || null,
      null,
      now,
      now
    )
    .run();

  const created = await db
    .prepare('SELECT * FROM location_requests WHERE id = ?')
    .bind(id)
    .first<D1LocationRequestRow>();

  if (!created) {
    throw new Error('Failed to retrieve newly created location request from D1');
  }

  return mapRowToLocationRequest(created);
}

/**
 * Returns all user-submitted location requests for administrative review.
 */
export async function getAllLocationRequests(status?: string): Promise<LocationRequest[]> {
  if (isDemoMode()) {
    const reqs = getDemoLocationRequests();
    if (status) return reqs.filter((r) => r.status === status);
    return reqs;
  }

  const db = await requireD1Database();
  try {
    let query = 'SELECT * FROM location_requests';
    const params: unknown[] = [];
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    query += ' ORDER BY created_at DESC';

    const { results } = await db.prepare(query).bind(...params).all<D1LocationRequestRow>();
    return (results || []).map(mapRowToLocationRequest);
  } catch (error: unknown) {
    console.error('Error fetching location requests from D1:', error);
    return [];
  }
}

/**
 * Approves a location request, creating or activating the city in the authoritative directory.
 */
export async function approveLocationRequest(
  requestId: string,
  adminNotes?: string
): Promise<{ request: LocationRequest; cityId: string }> {
  const now = new Date().toISOString();

  let req: LocationRequest | null = null;
  if (isDemoMode()) {
    req = getDemoLocationRequests().find((r) => r.id === requestId) || null;
  } else {
    const db = await requireD1Database();
    const row = await db
      .prepare('SELECT * FROM location_requests WHERE id = ?')
      .bind(requestId)
      .first<D1LocationRequestRow>();
    if (row) req = mapRowToLocationRequest(row);
  }

  if (!req) {
    throw new Error('Location request not found');
  }

  // 1. Check if city already exists in directory
  const existingInState = await getCityByNameAndState(req.cityName, req.stateName);
  let resolvedCityId = '';

  if (existingInState) {
    resolvedCityId = existingInState.id;
    if (!existingInState.isActive) {
      await updateCity(existingInState.id, { isActive: true });
    }
  } else {
    // Generate slug, ensuring uniqueness
    let targetSlug = slugify(req.cityName);
    const slugMatch = await getCityBySlug(targetSlug);
    if (slugMatch && slugMatch.id.startsWith('city-')) {
      targetSlug = `${targetSlug}-${slugify(req.stateName)}`;
    }

    const createdCity = await createCity({
      name: req.cityName,
      state: req.stateName,
      slug: targetSlug,
      isActive: true,
    });
    resolvedCityId = createdCity.id;
  }

  // 2. Mark request APPROVED
  if (isDemoMode()) {
    const updated = updateDemoLocationRequest(requestId, {
      status: 'APPROVED',
      adminNotes: adminNotes || req.adminNotes,
    });
    return { request: updated!, cityId: resolvedCityId };
  }

  const db = await requireD1Database();
  await db
    .prepare('UPDATE location_requests SET status = ?, admin_notes = ?, updated_at = ? WHERE id = ?')
    .bind('APPROVED', adminNotes || req.adminNotes || null, now, requestId)
    .run();

  const updatedRow = await db
    .prepare('SELECT * FROM location_requests WHERE id = ?')
    .bind(requestId)
    .first<D1LocationRequestRow>();

  return { request: mapRowToLocationRequest(updatedRow!), cityId: resolvedCityId };
}

/**
 * Rejects a location request with operator notes.
 */
export async function rejectLocationRequest(
  requestId: string,
  adminNotes?: string
): Promise<LocationRequest> {
  const now = new Date().toISOString();

  if (isDemoMode()) {
    const updated = updateDemoLocationRequest(requestId, {
      status: 'REJECTED',
      adminNotes: adminNotes || undefined,
    });
    if (!updated) throw new Error('Location request not found');
    return updated;
  }

  const db = await requireD1Database();
  await db
    .prepare('UPDATE location_requests SET status = ?, admin_notes = ?, updated_at = ? WHERE id = ?')
    .bind('REJECTED', adminNotes || null, now, requestId)
    .run();

  const row = await db
    .prepare('SELECT * FROM location_requests WHERE id = ?')
    .bind(requestId)
    .first<D1LocationRequestRow>();

  if (!row) throw new Error('Location request not found');
  return mapRowToLocationRequest(row);
}

