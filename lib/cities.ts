import { City } from '@/types';
import { isDemoMode } from './data-mode';
import { getDemoCities, addDemoCity, updateDemoCity } from './mock-data';
import { getPublicSupabase } from './supabase/public';
import { getAdminSupabase } from './supabase/admin';
import { slugify } from './format';

interface SupabaseCityRow {
  id: string;
  name: string;
  slug: string;
  state: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function mapRowToCity(row: SupabaseCityRow): City {
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

  const supabase = getPublicSupabase();
  if (!supabase) {
    const cities = getDemoCities();
    return cities.filter((c) => c.isActive);
  }

  const { data, error } = await supabase
    .from('cities')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.warn('Error fetching cities from Supabase, falling back to mock cities:', error.message);
    const cities = getDemoCities();
    return cities.filter((c) => c.isActive);
  }

  return (data || []).map((row) => mapRowToCity(row as SupabaseCityRow));
}

/**
 * Returns all cities (including inactive) for administrative management.
 */
export async function getAllCities(): Promise<City[]> {
  if (isDemoMode()) {
    return getDemoCities();
  }

  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from('cities')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.warn('Error fetching all cities from Supabase, falling back to mock cities:', error.message);
    return getDemoCities();
  }

  return (data || []).map((row) => mapRowToCity(row as SupabaseCityRow));
}

/**
 * Looks up a single city by its unique slug.
 */
export async function getCityBySlug(slug: string): Promise<City | null> {
  const normalizedSlug = slug.toLowerCase().trim();

  if (isDemoMode()) {
    const found = getDemoCities().find((c) => c.slug === normalizedSlug);
    return found || null;
  }

  const supabase = getPublicSupabase();
  if (!supabase) {
    const found = getDemoCities().find((c) => c.slug === normalizedSlug);
    return found || null;
  }

  const { data, error } = await supabase
    .from('cities')
    .select('*')
    .eq('slug', normalizedSlug)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapRowToCity(data as SupabaseCityRow);
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

  if (isDemoMode()) {
    const newCity: City = {
      id: `city-demo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmedName,
      slug: citySlug,
      state: trimmedState,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addDemoCity(newCity);
    return newCity;
  }

  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from('cities')
    .insert({
      name: trimmedName,
      slug: citySlug,
      state: trimmedState,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create city: ${error.message}`);
  }

  return mapRowToCity(data as SupabaseCityRow);
}

/**
 * Updates a city (e.g. toggling active status) (Admin only).
 */
export async function updateCity(
  cityId: string,
  updates: Partial<Pick<City, 'name' | 'state' | 'isActive'>>
): Promise<City | null> {
  if (isDemoMode()) {
    return updateDemoCity(cityId, updates);
  }

  const supabase = getAdminSupabase();
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.state !== undefined) payload.state = updates.state.trim();
  if (updates.isActive !== undefined) payload.is_active = updates.isActive;

  const { data, error } = await supabase
    .from('cities')
    .update(payload)
    .eq('id', cityId)
    .select()
    .single();

  if (error || !data) {
    return null;
  }

  return mapRowToCity(data as SupabaseCityRow);
}
