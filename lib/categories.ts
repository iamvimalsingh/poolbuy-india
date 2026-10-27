import { Category } from '@/types';
import { isDemoMode } from './data-mode';
import {
  getDemoCategories,
  addDemoCategory,
  updateDemoCategory as updateMockCategory,
} from './mock-data';
import { getPublicSupabase } from './supabase/public';
import { getAdminSupabase } from './supabase/admin';

/**
 * Returns all active, operational categories for public discovery, navigation, and form dropdowns.
 */
export async function getOperationalCategories(): Promise<Category[]> {
  if (isDemoMode()) {
    return getDemoCategories()
      .filter((c) => c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const supabase = getPublicSupabase();
  if (!supabase) {
    return getDemoCategories()
      .filter((c) => c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error || !data) {
    console.error('Error fetching operational categories from Supabase:', error?.message);
    return getDemoCategories()
      .filter((c) => c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  return data.map((row) => ({
    id: row.id,
    slug: row.slug,
    label: row.label,
    description: row.description || '',
    isActive: row.is_active,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Returns all categories (active and inactive) for admin management.
 */
export async function getAllCategories(): Promise<Category[]> {
  if (isDemoMode()) {
    return getDemoCategories().sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const supabase = getAdminSupabase();
  if (!supabase) {
    return getDemoCategories().sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error || !data) {
    console.error('Error fetching all categories from Supabase:', error?.message);
    return getDemoCategories().sort((a, b) => a.sortOrder - b.sortOrder);
  }

  return data.map((row) => ({
    id: row.id,
    slug: row.slug,
    label: row.label,
    description: row.description || '',
    isActive: row.is_active,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Looks up a category by slug.
 */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  if (isDemoMode()) {
    const found = getDemoCategories().find((c) => c.slug === slug);
    return found || null;
  }

  const supabase = getPublicSupabase();
  if (!supabase) {
    const found = getDemoCategories().find((c) => c.slug === slug);
    return found || null;
  }

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) {
    const found = getDemoCategories().find((c) => c.slug === slug);
    return found || null;
  }

  return {
    id: data.id,
    slug: data.slug,
    label: data.label,
    description: data.description || '',
    isActive: data.is_active,
    sortOrder: data.sort_order ?? 0,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Creates a new category in Supabase or demo store.
 */
export async function createCategory(input: {
  label: string;
  slug: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
}): Promise<Category> {
  const newCategory: Category = {
    id: `cat-${input.slug}-${Date.now().toString(36)}`,
    slug: input.slug,
    label: input.label,
    description: input.description || '',
    isActive: input.isActive ?? true,
    sortOrder: input.sortOrder ?? 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (isDemoMode()) {
    addDemoCategory(newCategory);
    return newCategory;
  }

  const supabase = getAdminSupabase();
  if (!supabase) {
    addDemoCategory(newCategory);
    return newCategory;
  }

  const { data, error } = await supabase
    .from('categories')
    .insert({
      label: input.label,
      slug: input.slug,
      description: input.description || '',
      is_active: input.isActive ?? true,
      sort_order: input.sortOrder ?? 0,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('Error creating category in Supabase:', error?.message);
    throw new Error(error?.message || 'Failed to create category');
  }

  return {
    id: data.id,
    slug: data.slug,
    label: data.label,
    description: data.description || '',
    isActive: data.is_active,
    sortOrder: data.sort_order ?? 0,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Updates a category in Supabase or demo store.
 */
export async function updateCategory(
  categoryId: string,
  updates: Partial<Category>
): Promise<Category | null> {
  if (isDemoMode()) {
    return updateMockCategory(categoryId, updates);
  }

  const supabase = getAdminSupabase();
  if (!supabase) {
    return updateMockCategory(categoryId, updates);
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.label !== undefined) updatePayload.label = updates.label;
  if (updates.slug !== undefined) updatePayload.slug = updates.slug;
  if (updates.description !== undefined) updatePayload.description = updates.description;
  if (updates.isActive !== undefined) updatePayload.is_active = updates.isActive;
  if (updates.sortOrder !== undefined) updatePayload.sort_order = updates.sortOrder;

  const { data, error } = await supabase
    .from('categories')
    .update(updatePayload)
    .eq('id', categoryId)
    .select()
    .single();

  if (error || !data) {
    console.error('Error updating category in Supabase:', error?.message);
    return updateMockCategory(categoryId, updates);
  }

  return {
    id: data.id,
    slug: data.slug,
    label: data.label,
    description: data.description || '',
    isActive: data.is_active,
    sortOrder: data.sort_order ?? 0,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
