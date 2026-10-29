import { Category } from '@/types';
import { isDemoMode } from './data-mode';
import {
  getDemoCategories,
  addDemoCategory,
  updateDemoCategory as updateMockCategory,
  deleteDemoCategory,
  MOCK_POOLS,
  getDemoRequests,
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
 * Looks up a category by id.
 */
export async function getCategoryById(id: string): Promise<Category | null> {
  if (isDemoMode()) {
    const found = getDemoCategories().find((c) => c.id === id || c.slug === id);
    return found || null;
  }

  const db = await getD1Database();
  if (!db) return null;

  try {
    const row = await db
      .prepare('SELECT * FROM categories WHERE id = ?')
      .bind(id)
      .first<D1CategoryRow>();

    if (!row) return null;
    return mapRowToCategory(row);
  } catch (error: unknown) {
    console.error('Error looking up category by id in D1:', error);
    return null;
  }
}

/**
 * Creates a new category in D1 or demo store.
 */
export async function createCategory(input: {
  label?: string;
  name?: string;
  slug: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
}): Promise<Category> {
  const now = new Date().toISOString();
  const label = input.label || input.name || input.slug;
  const id = `cat-${input.slug}-${Date.now().toString(36)}`;

  if (isDemoMode()) {
    const newCategory: Category = {
      id,
      slug: input.slug,
      label,
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
      label,
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

export interface CategoryDependencies {
  poolsCount: number;
  requestsCount: number;
  totalDependencies: number;
}

/**
 * Checks database dependencies for a category before deletion.
 */
export async function getCategoryDependencies(
  categoryId: string,
  slug: string
): Promise<CategoryDependencies> {
  if (isDemoMode()) {
    const poolsCount = MOCK_POOLS.filter(
      (p) => p.category === slug || (p as unknown as { categorySlug?: string }).categorySlug === slug
    ).length;
    const requestsCount = getDemoRequests().filter(
      (r) => r.category === slug || r.categorySlug === slug
    ).length;
    return {
      poolsCount,
      requestsCount,
      totalDependencies: poolsCount + requestsCount,
    };
  }

  const db = await requireD1Database();
  try {
    const poolsRow = await db
      .prepare(
        'SELECT COUNT(*) as c FROM pools WHERE category = ? OR category_slug = ? OR internal_category_id = ?'
      )
      .bind(slug, slug, categoryId)
      .first<{ c: number }>();

    const requestsRow = await db
      .prepare(
        'SELECT COUNT(*) as c FROM pool_requests WHERE category = ? OR category = ?'
      )
      .bind(slug, categoryId)
      .first<{ c: number }>();

    const poolsCount = Number(poolsRow?.c || 0);
    const requestsCount = Number(requestsRow?.c || 0);

    return {
      poolsCount,
      requestsCount,
      totalDependencies: poolsCount + requestsCount,
    };
  } catch (err: unknown) {
    console.error('Error checking category dependencies:', err);
    throw err;
  }
}

export class CategoryDeletionBlockedError extends Error {
  code = 'CATEGORY_HAS_DEPENDENCIES';
  dependencies: CategoryDependencies;

  constructor(categoryLabel: string, dependencies: CategoryDependencies) {
    super(
      `Cannot delete category "${categoryLabel}": referenced by ${dependencies.poolsCount} pool(s) and ${dependencies.requestsCount} request(s). Deactivate the category instead.`
    );
    this.name = 'CategoryDeletionBlockedError';
    this.dependencies = dependencies;
  }
}

/**
 * Safely deletes a category after verifying that no dependent records exist.
 * Blocks unsafe cascading hard deletion if dependent pools or requests exist.
 */
export async function deleteCategory(
  categoryId: string
): Promise<{ success: boolean; deletedCategory: Category }> {
  const category = (await getCategoryById(categoryId)) || (await getCategoryBySlug(categoryId));
  if (!category) {
    throw new Error('Category not found');
  }

  const dependencies = await getCategoryDependencies(category.id, category.slug);
  if (dependencies.totalDependencies > 0) {
    throw new CategoryDeletionBlockedError(category.label, dependencies);
  }

  if (isDemoMode()) {
    const deleted = deleteDemoCategory(category.id);
    if (!deleted) {
      throw new Error('Failed to delete category from demo store');
    }
    return { success: true, deletedCategory: category };
  }

  const db = await requireD1Database();
  await db
    .prepare('DELETE FROM categories WHERE id = ?')
    .bind(category.id)
    .run();

  // Verify deletion persistence
  const check = await db
    .prepare('SELECT id FROM categories WHERE id = ?')
    .bind(category.id)
    .first<{ id: string }>();

  if (check) {
    throw new Error('Database mutation failed: category still exists after DELETE');
  }

  return { success: true, deletedCategory: category };
}
