import { City } from '@/types';
import { isDemoMode } from './data-mode';
import {
  getDemoCities,
  addDemoCity,
  updateDemoCity as updateMockCity,
  deleteDemoCity,
  MOCK_POOLS,
  getDemoRequests,
} from './mock-data';
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
 * Looks up a single city by its ID.
 */
export async function getCityById(id: string): Promise<City | null> {
  if (isDemoMode()) {
    const found = getDemoCities().find((c) => c.id === id || c.slug === id);
    return found || null;
  }

  try {
    const db = await getD1Database();
    if (db) {
      const row = await db
        .prepare('SELECT * FROM cities WHERE id = ?')
        .bind(id)
        .first<D1CityRow>();

      if (row) return mapRowToCity(row);
    }
  } catch (error: unknown) {
    console.error('Error looking up city by id in D1:', error);
  }

  return null;
}

/**
 * Checks whether a city already exists in the given state by normalized name.
 */
export async function getCityByNameAndState(name: string, state: string): Promise<City | null> {
  const normName = name.trim().toLowerCase();
  const normState = state.trim().toLowerCase();

  if (isDemoMode()) {
    const found = getDemoCities().find(
      (c) => c.name.trim().toLowerCase() === normName && c.state.trim().toLowerCase() === normState
    );
    return found || null;
  }

  const db = await getD1Database();
  if (!db) return null;

  try {
    const row = await db
      .prepare('SELECT * FROM cities WHERE LOWER(TRIM(name)) = ? AND LOWER(TRIM(state)) = ?')
      .bind(normName, normState)
      .first<D1CityRow>();

    if (!row) return null;
    return mapRowToCity(row);
  } catch (error: unknown) {
    console.error('Error checking city by name and state in D1:', error);
    return null;
  }
}

/**
 * Creates a new city in the authoritative directory (Admin only).
 * Validates unique slug and duplicate city name within state.
 */
export async function createCity(input: {
  name: string;
  state: string;
  slug?: string;
  isActive?: boolean;
}): Promise<City> {
  const trimmedName = input.name.trim();
  const trimmedState = input.state.trim();
  const citySlug = input.slug ? slugify(input.slug) : slugify(trimmedName);
  const now = new Date().toISOString();
  const id = `city-${citySlug}-${Date.now().toString(36)}`;
  const isActive = input.isActive ?? true;

  // Duplicate checks
  const existingInState = await getCityByNameAndState(trimmedName, trimmedState);
  if (existingInState) {
    throw new Error(`DUPLICATE_CITY_IN_STATE: A city with name "${trimmedName}" in state "${trimmedState}" already exists.`);
  }

  const existingSlug = await getCityBySlug(citySlug);
  if (existingSlug && existingSlug.id.startsWith('city-')) {
    throw new Error(`DUPLICATE_CITY_SLUG: A city with slug "${citySlug}" already exists.`);
  }

  if (isDemoMode()) {
    const newCity: City = {
      id,
      name: trimmedName,
      slug: citySlug,
      state: trimmedState,
      isActive,
      createdAt: now,
      updatedAt: now,
    };
    addDemoCity(newCity);
    return newCity;
  }

  const db = await requireD1Database();
  await db
    .prepare(
      'INSERT INTO cities (id, name, slug, state, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(id, trimmedName, citySlug, trimmedState, isActive ? 1 : 0, now, now)
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
  updates: Partial<Pick<City, 'name' | 'state' | 'slug' | 'isActive'>>
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
  if (updates.slug !== undefined) {
    setClauses.push('slug = ?');
    values.push(slugify(updates.slug));
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

export interface CityDependencies {
  poolsCount: number;
  poolCitiesCount: number;
  requestsCount: number;
  totalDependencies: number;
}

/**
 * Checks database dependencies for a city before deletion.
 */
export async function getCityDependencies(
  cityId: string,
  slug: string,
  name: string
): Promise<CityDependencies> {
  if (isDemoMode()) {
    const poolsCount = MOCK_POOLS.filter(
      (p) => p.citySlug === slug || p.city.toLowerCase() === name.toLowerCase()
    ).length;
    const requestsCount = getDemoRequests().filter(
      (r) => r.city.toLowerCase() === name.toLowerCase() || (r.cityText && r.cityText.toLowerCase() === name.toLowerCase())
    ).length;
    return {
      poolsCount,
      poolCitiesCount: 0,
      requestsCount,
      totalDependencies: poolsCount + requestsCount,
    };
  }

  const db = await requireD1Database();
  try {
    const [poolsRow, poolCitiesRow, requestsRow] = await Promise.all([
      db
        .prepare('SELECT COUNT(*) as c FROM pools WHERE city_slug = ? OR city = ?')
        .bind(slug, name)
        .first<{ c: number }>(),
      db
        .prepare('SELECT COUNT(*) as c FROM pool_cities WHERE city_code = ?')
        .bind(slug)
        .first<{ c: number }>(),
      db
        .prepare('SELECT COUNT(*) as c FROM pool_requests WHERE LOWER(city) = ? OR LOWER(city_text) = ? OR city = ?')
        .bind(name.toLowerCase(), name.toLowerCase(), slug)
        .first<{ c: number }>(),
    ]);

    const poolsCount = Number(poolsRow?.c || 0);
    const poolCitiesCount = Number(poolCitiesRow?.c || 0);
    const requestsCount = Number(requestsRow?.c || 0);

    return {
      poolsCount,
      poolCitiesCount,
      requestsCount,
      totalDependencies: poolsCount + poolCitiesCount + requestsCount,
    };
  } catch (err: unknown) {
    console.error('Error checking city dependencies:', err);
    throw err;
  }
}

export class CityDeletionBlockedError extends Error {
  code = 'CITY_HAS_DEPENDENCIES';
  dependencies: CityDependencies;

  constructor(cityName: string, dependencies: CityDependencies) {
    super(
      `Cannot delete city "${cityName}": referenced by ${dependencies.poolsCount} pool(s), ${dependencies.poolCitiesCount} pool city mapping(s), and ${dependencies.requestsCount} request(s). Deactivate the city instead.`
    );
    this.name = 'CityDeletionBlockedError';
    this.dependencies = dependencies;
  }
}

/**
 * Safely deletes a city if no dependent pools, pool_cities, or requests exist.
 * Blocks unsafe deletion and suggests deactivation if dependencies exist.
 */
export async function deleteCity(
  cityId: string
): Promise<{ success: boolean; deletedCity: City }> {
  const city = (await getCityById(cityId)) || (await getCityBySlug(cityId));
  if (!city) {
    throw new Error('City not found');
  }

  const dependencies = await getCityDependencies(city.id, city.slug, city.name);
  if (dependencies.totalDependencies > 0) {
    throw new CityDeletionBlockedError(city.name, dependencies);
  }

  if (isDemoMode()) {
    const deleted = deleteDemoCity(city.id);
    if (!deleted) {
      throw new Error('Failed to delete city from demo store');
    }
    return { success: true, deletedCity: city };
  }

  const db = await requireD1Database();
  await db
    .prepare('DELETE FROM cities WHERE id = ?')
    .bind(city.id)
    .run();

  // Verify deletion persistence
  const check = await db
    .prepare('SELECT id FROM cities WHERE id = ?')
    .bind(city.id)
    .first<{ id: string }>();

  if (check) {
    throw new Error('Database mutation failed: city still exists after DELETE');
  }

  return { success: true, deletedCity: city };
}
