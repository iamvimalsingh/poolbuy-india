import { Category } from '@/types';
import { isDemoMode } from './data-mode';
import {
  getDemoCategories,
  addDemoCategory,
  updateDemoCategory as updateMockCategory,
} from './mock-data';
import { getD1Database, requireD1Database } from './d1/db';

interface D1CategoryRow {
  id: string;
  slug: string;
  label: string;
  description: string;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function mapRowToCategory(row: D1CategoryRow): Category {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    description: row.description || '',
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Returns all active, operational categories for public discovery, navigation, and form dropdowns.
 */
export async function getOperationalCategories(): Promise<Category[]> {
  if (isDemoMode()) {
    return getDemoCategories()
      .filter((c) => c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const db = await getD1Database();
  if (!db) {
    console.error('getOperationalCategories: D1 database unavailable');
    return [];
  }

  try {
    const { results } = await db
      .prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC')
      .all<D1CategoryRow>();

    return (results || []).map(mapRowToCategory);
  } catch (error: unknown) {
    console.error('Error fetching operational categories from D1:', error);
    return [];
  }
}

/**
 * Returns all categories (active and inactive) for admin management.
 */
export async function getAllCategories(): Promise<Category[]> {
  if (isDemoMode()) {
    return getDemoCategories().sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const db = await requireD1Database();
  try {
    const { results } = await db
      .prepare('SELECT * FROM categories ORDER BY sort_order ASC')
      .all<D1CategoryRow>();

    return (results || []).map(mapRowToCategory);
  } catch (error: unknown) {
    console.error('Error fetching all categories from D1:', error);
    throw error;
  }
}

/**
 * Looks up a category by slug.
 */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  if (isDemoMode()) {
    const found = getDemoCategories().find((c) => c.slug === slug);
    return found || null;
  }

  const db = await getD1Database();
  if (!db) return null;

  try {
    const row = await db
      .prepare('SELECT * FROM categories WHERE slug = ?')
      .bind(slug)
      .first<D1CategoryRow>();

    if (!row) return null;
    return mapRowToCategory(row);
  } catch (error: unknown) {
    console.error('Error looking up category by slug in D1:', error);
    return null;
  }
}

/**
 * Creates a new category in D1 or demo store.
 */
export async function createCategory(input: {
  label: string;
  slug: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
}): Promise<Category> {
  const now = new Date().toISOString();
  const id = `cat-${input.slug}-${Date.now().toString(36)}`;

  if (isDemoMode()) {
    const newCategory: Category = {
      id,
      slug: input.slug,
      label: input.label,
      description: input.description || '',
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    addDemoCategory(newCategory);
    return newCategory;
  }

  const db = await requireD1Database();
  await db
    .prepare(
      'INSERT INTO categories (id, slug, label, description, is_active, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      id,
      input.slug,
      input.label,
      input.description || '',
      input.isActive ?? true ? 1 : 0,
      input.sortOrder ?? 0,
      now,
      now
    )
    .run();

  const created = await db
    .prepare('SELECT * FROM categories WHERE id = ?')
    .bind(id)
    .first<D1CategoryRow>();

  if (!created) {
    throw new Error('Failed to retrieve newly created category from D1');
  }

  return mapRowToCategory(created);
}

/**
 * Updates a category in D1 or demo store.
 */
export async function updateCategory(
  categoryId: string,
  updates: Partial<Category>
): Promise<Category | null> {
  if (isDemoMode()) {
    return updateMockCategory(categoryId, updates);
  }

  const db = await requireD1Database();
  const now = new Date().toISOString();

  const setClauses: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (updates.label !== undefined) {
    setClauses.push('label = ?');
    values.push(updates.label);
  }
  if (updates.slug !== undefined) {
    setClauses.push('slug = ?');
    values.push(updates.slug);
  }
  if (updates.description !== undefined) {
    setClauses.push('description = ?');
    values.push(updates.description);
  }
  if (updates.isActive !== undefined) {
    setClauses.push('is_active = ?');
    values.push(updates.isActive ? 1 : 0);
  }
  if (updates.sortOrder !== undefined) {
    setClauses.push('sort_order = ?');
    values.push(updates.sortOrder);
  }

  values.push(categoryId);

  await db
    .prepare(`UPDATE categories SET ${setClauses.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  const row = await db
    .prepare('SELECT * FROM categories WHERE id = ?')
    .bind(categoryId)
    .first<D1CategoryRow>();

  if (!row) return null;
  return mapRowToCategory(row);
}
