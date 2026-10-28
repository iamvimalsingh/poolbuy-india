import { City } from '@/types';
import { isDemoMode } from './data-mode';
import { getDemoCities, addDemoCity, updateDemoCity as updateMockCity } from './mock-data';
import { getD1Database, requireD1Database } from './d1/db';
import { slugify } from './format';
import { INDIA_LOCATION_DIRECTORY } from './location-directory';

interface D1CityRow {
  id: string;
  name: string;
  slug: string;
  state: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function mapRowToCity(row: D1CityRow): City {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    state: row.state,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Returns all active operational cities for public browsing, filters, and sitemap.
 */
export async function getOperationalCities(): Promise<City[]> {
  if (isDemoMode()) {
    const cities = getDemoCities();
    return cities.filter((c) => c.isActive);
  }

  const db = await getD1Database();
  if (!db) {
    console.warn('getOperationalCities: D1 database unavailable, using fallback');
    return getDemoCities().filter((c) => c.isActive);
  }

  try {
    const { results } = await db
      .prepare('SELECT * FROM cities WHERE is_active = 1 ORDER BY name ASC')
      .all<D1CityRow>();

    const mapped = (results || []).map(mapRowToCity);
    if (mapped.length > 0) return mapped;
    return getDemoCities().filter((c) => c.isActive);
  } catch (error: unknown) {
    console.error('Error fetching operational cities from D1:', error);
    return getDemoCities().filter((c) => c.isActive);
  }
}

/**
 * Returns all cities (including inactive) for administrative management.
 */
export async function getAllCities(): Promise<City[]> {
  if (isDemoMode()) {
    return getDemoCities();
  }

  const db = await requireD1Database();
  try {
    const { results } = await db
      .prepare('SELECT * FROM cities ORDER BY name ASC')
      .all<D1CityRow>();

    return (results || []).map(mapRowToCity);
  } catch (error: unknown) {
    console.error('Error fetching all cities from D1:', error);
    throw error;
  }
}

/**
 * Looks up a single city by its unique slug.
 * Checks D1 first, then authoritative national location directory, then demo fallback.
 */
export async function getCityBySlug(slug: string): Promise<City | null> {
  const normalizedSlug = slug.toLowerCase().trim();

  // 1. If in demo mode, check demo cities first
  if (isDemoMode()) {
    const found = getDemoCities().find((c) => c.slug === normalizedSlug);
    if (found) return found;
  }

  // 2. Check D1 database (if available)
  try {
    const db = await getD1Database();
    if (db) {
      const row = await db
        .prepare('SELECT * FROM cities WHERE slug = ?')
        .bind(normalizedSlug)
        .first<D1CityRow>();

      if (row) return mapRowToCity(row);
    }
  } catch (error: unknown) {
    console.error('Error looking up city by slug in D1:', error);
  }

  // 3. Fall back to authoritative INDIA_LOCATION_DIRECTORY (28 states & 8 UTs)
  for (const state of INDIA_LOCATION_DIRECTORY) {
    const match = state.cities.find((c) => c.slug === normalizedSlug);
    if (match) {
      return {
        id: `dir-${match.slug}`,
        name: match.name,
        slug: match.slug,
        state: state.name,
        placeType: match.placeType,
        isActive: true,
        isSelectable: true,
        availabilityState: match.availabilityState,
        createdAt: '2026-10-28T00:00:00Z',
        updatedAt: '2026-10-28T00:00:00Z',
      };
    }
  }

  // 4. Also check demo cities as last resort before returning null
  const fallback = getDemoCities().find((c) => c.slug === normalizedSlug);
  return fallback || null;
}

/**
 * Creates a new city in the authoritative directory (Admin only).
 */
export async function createCity(input: {
  name: string;
  state: string;
  slug?: string;
}): Promise<City> {
  const trimmedName = input.name.trim();
  const trimmedState = input.state.trim();
  const citySlug = input.slug ? slugify(input.slug) : slugify(trimmedName);
  const now = new Date().toISOString();
  const id = `city-${citySlug}-${Date.now()}`;

  if (isDemoMode()) {
    const newCity: City = {
      id,
      name: trimmedName,
      slug: citySlug,
      state: trimmedState,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    addDemoCity(newCity);
    return newCity;
  }

  const db = await requireD1Database();
  await db
    .prepare(
      'INSERT INTO cities (id, name, slug, state, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)'
    )
    .bind(id, trimmedName, citySlug, trimmedState, now, now)
    .run();

  const created = await db
    .prepare('SELECT * FROM cities WHERE id = ?')
    .bind(id)
    .first<D1CityRow>();

  if (!created) {
    throw new Error('Failed to retrieve newly created city from D1');
  }

  return mapRowToCity(created);
}

/**
 * Updates a city (e.g. toggling active status) (Admin only).
 */
export async function updateCity(
  cityId: string,
  updates: Partial<Pick<City, 'name' | 'state' | 'isActive'>>
): Promise<City | null> {
  if (isDemoMode()) {
    return updateMockCity(cityId, updates);
  }

  const db = await requireD1Database();
  const now = new Date().toISOString();

  const setClauses: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name.trim());
  }
  if (updates.state !== undefined) {
    setClauses.push('state = ?');
    values.push(updates.state.trim());
  }
  if (updates.isActive !== undefined) {
    setClauses.push('is_active = ?');
    values.push(updates.isActive ? 1 : 0);
  }

  values.push(cityId);

  const query = `UPDATE cities SET ${setClauses.join(', ')} WHERE id = ?`;
  await db.prepare(query).bind(...values).run();

  const row = await db
    .prepare('SELECT * FROM cities WHERE id = ?')
    .bind(cityId)
    .first<D1CityRow>();

  if (!row) return null;
  return mapRowToCity(row);
}
