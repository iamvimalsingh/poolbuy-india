import { PublicPool, JoinPoolInput, JoinPoolResult, PoolFilters } from '@/types';
import { isDemoMode } from './data-mode';
import { MOCK_POOLS } from './mock-data';
import { getD1Database, requireD1Database } from './d1/db';
import { CATEGORY_SLUG_MAP } from './constants';

interface D1PoolRow {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  long_description: string;
  category: string;
  city: string;
  city_slug: string;
  product_brand: string;
  product_model: string;
  image_url: string | null;
  market_price: number | null;
  group_price: number | null;
  target_buyers: number;
  current_buyers: number;
  deadline: string;
  status: string;
  closure_reason?: string | null;
  closed_at?: string | null;
  offer_valid_until?: string | null;
  is_archived?: number;
  deleted_at?: string | null;
  price_is_verified: number;
  price_verified_at: string | null;
  dealer_name?: string | null;
  token_amount?: number | null;
  token_payment_url?: string | null;
  dealer_offer_url?: string | null;
  dealer_terms?: string | null;
  is_published: number;
  market_price_type: string;
  group_price_type: string;
  savings_display_approved: number;
  target_reached_at: string | null;
  target_reached_acknowledged_at?: string | null;
  connection_status: string;
  payment_config_state?: string;
  source_request_id: string | null;
  created_at: string;
  updated_at: string;
}

function mapRowToPublicPool(row: D1PoolRow): PublicPool {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.short_description || '',
    longDescription: row.long_description || '',
    category: row.category as PublicPool['category'],
    city: row.city,
    citySlug: row.city_slug,
    productBrand: row.product_brand || '',
    productModel: row.product_model || '',
    imageUrl: row.image_url,
    marketPrice: row.market_price !== null ? Number(row.market_price) : null,
    groupPrice: row.group_price !== null ? Number(row.group_price) : null,
    targetBuyers: Number(row.target_buyers),
    currentBuyers: Number(row.current_buyers),
    deadline: row.deadline,
    status: row.status as PublicPool['status'],
    priceIsVerified: Boolean(row.price_is_verified),
    priceVerifiedAt: row.price_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isPublished: Boolean(row.is_published),
    marketPriceType: (row.market_price_type || 'INDICATIVE_ESTIMATE') as PublicPool['marketPriceType'],
    groupPriceType: (row.group_price_type || 'INDICATIVE_ESTIMATE') as PublicPool['groupPriceType'],
    targetReachedAt: row.target_reached_at || null,
    connectionStatus: (row.connection_status || 'NOT_ELIGIBLE') as PublicPool['connectionStatus'],
    savingsDisplayApproved: Boolean(row.savings_display_approved),
    sourceRequestId: row.source_request_id || null,
  };
}

// Prerender-safe reference timestamp for build phase
const STABLE_BUILD_MS = 1792929600000;
const STABLE_BUILD_ISO = '2026-10-26T12:00:00.000Z';

function getNowMs(): number {
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return STABLE_BUILD_MS;
  }
  try {
    return Date.now();
  } catch {
    return STABLE_BUILD_MS;
  }
}

function getNowIso(): string {
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return STABLE_BUILD_ISO;
  }
  try {
    return new Date().toISOString();
  } catch {
    return STABLE_BUILD_ISO;
  }
}

/**
 * Loads public pools matching optional city/category filters.
 */
export async function getPublicPools(filters?: PoolFilters): Promise<PublicPool[]> {
  if (isDemoMode()) {
    const now = getNowMs();
    let result = MOCK_POOLS.filter((p) => {
      if (p.deletedAt || p.isArchived || p.isPublished === false) return false;
      if (p.status === 'CLOSED') return false;
      if (new Date(p.deadline).getTime() <= now) return false;
      return true;
    });

    if (filters?.citySlug && filters.citySlug !== 'all') {
      result = result.filter((p) => p.citySlug === filters.citySlug);
    }

    if (filters?.categorySlug && filters.categorySlug !== 'all') {
      const catSlug = filters.categorySlug;
      if (catSlug === 'home-power-backup') {
        result = result.filter(
          (p) =>
            p.categorySlug === 'home-power-backup' ||
            p.slug.includes('power-backup') ||
            p.slug.includes('inverter') ||
            p.name.toLowerCase().includes('inverter') ||
            p.name.toLowerCase().includes('power-backup')
        );
      } else if (catSlug === 'water-softeners' || catSlug === 'water-softener') {
        result = result.filter(
          (p) =>
            p.categorySlug === 'water-softeners' ||
            p.slug.includes('water-softener') ||
            p.slug.includes('softener') ||
            p.name.toLowerCase().includes('softener')
        );
      } else if (catSlug === 'rooftop-solar') {
        result = result.filter(
          (p) =>
            (p.category === 'ROOFTOP_SOLAR' || p.categorySlug === 'rooftop-solar') &&
            !p.slug.includes('power-backup') &&
            !p.slug.includes('inverter') &&
            !p.slug.includes('water-softener') &&
            !p.slug.includes('softener')
        );
      } else {
        const mapped = CATEGORY_SLUG_MAP[catSlug];
        if (Array.isArray(mapped)) {
          result = result.filter((p) => mapped.includes(p.category));
        } else if (mapped) {
          result = result.filter((p) => p.category === mapped || p.categorySlug === catSlug);
        } else {
          result = result.filter((p) => p.categorySlug === catSlug);
        }
      }
    }
    return result;
  }

  const db = await getD1Database();
  if (!db) {
    console.error('getPublicPools: D1 database unavailable');
    return [];
  }

  const nowIso = getNowIso();
  const whereClauses: string[] = [
    "status != 'CLOSED'",
    'is_published = 1',
    'is_archived = 0',
    'deleted_at IS NULL',
    'deadline > ?',
  ];
  const params: unknown[] = [nowIso];

  if (filters?.citySlug && filters.citySlug !== 'all') {
    whereClauses.push('city_slug = ?');
    params.push(filters.citySlug);
  }

  if (filters?.categorySlug && filters.categorySlug !== 'all') {
    const catSlug = filters.categorySlug;
    if (catSlug === 'home-power-backup') {
      whereClauses.push("(category = 'ROOFTOP_SOLAR' AND (slug LIKE '%power-backup%' OR slug LIKE '%inverter%' OR name LIKE '%Inverter%'))");
    } else if (catSlug === 'water-softeners' || catSlug === 'water-softener') {
      whereClauses.push("(category = 'ROOFTOP_SOLAR' AND (slug LIKE '%water-softener%' OR slug LIKE '%softener%' OR name LIKE '%Softener%'))");
    } else if (catSlug === 'rooftop-solar') {
      whereClauses.push("(category = 'ROOFTOP_SOLAR' AND slug NOT LIKE '%power-backup%' AND slug NOT LIKE '%inverter%' AND slug NOT LIKE '%softener%')");
    } else {
      const mapped = CATEGORY_SLUG_MAP[catSlug];
      if (Array.isArray(mapped)) {
        const placeholders = mapped.map(() => '?').join(', ');
        whereClauses.push(`category IN (${placeholders})`);
        params.push(...mapped);
      } else if (mapped) {
        whereClauses.push('category = ?');
        params.push(mapped);
      } else {
        whereClauses.push('slug = ?');
        params.push(catSlug);
      }
    }
  }

  const sql = `SELECT * FROM pools WHERE ${whereClauses.join(' AND ')} ORDER BY created_at DESC`;

  try {
    const { results } = await db.prepare(sql).bind(...params).all<D1PoolRow>();
    return (results || []).map(mapRowToPublicPool);
  } catch (error: unknown) {
    console.error('Error fetching public pools from D1:', error);
    return [];
  }
}

/**
 * Loads a single public pool by citySlug and poolSlug
 */
export async function getPublicPoolBySlug(
  citySlug: string,
  poolSlug: string
): Promise<PublicPool | null> {
  if (isDemoMode()) {
    const found = MOCK_POOLS.find(
      (p) =>
        p.citySlug === citySlug &&
        p.slug === poolSlug &&
        !p.deletedAt &&
        !p.isArchived &&
        p.isPublished !== false
    );
    return found || null;
  }

  const db = await getD1Database();
  if (!db) return null;

  try {
    const row = await db
      .prepare(
        'SELECT * FROM pools WHERE city_slug = ? AND slug = ? AND is_published = 1 AND is_archived = 0 AND deleted_at IS NULL'
      )
      .bind(citySlug, poolSlug)
      .first<D1PoolRow>();

    if (!row) return null;
    return mapRowToPublicPool(row);
  } catch (error: unknown) {
    console.error('Error fetching pool by slug from D1:', error);
    return null;
  }
}

/**
 * Loads a single public pool by id
 */
export async function getPublicPoolById(id: string): Promise<PublicPool | null> {
  if (isDemoMode()) {
    const found = MOCK_POOLS.find(
      (p) => p.id === id && !p.deletedAt && !p.isArchived && p.isPublished !== false
    );
    return found || null;
  }

  const db = await getD1Database();
  if (!db) return null;

  try {
    const row = await db
      .prepare(
        'SELECT * FROM pools WHERE id = ? AND deleted_at IS NULL'
      )
      .bind(id)
      .first<D1PoolRow>();

    if (!row) return null;
    return mapRowToPublicPool(row);
  } catch (error: unknown) {
    console.error('Error fetching pool by id from D1:', error);
    return null;
  }
}

/**
 * Server-side join pool transaction with atomic concurrency-safe capacity enforcement.
 */
export async function executeJoinPool(
  poolId: string,
  input: JoinPoolInput
): Promise<JoinPoolResult> {
  const db = await requireD1Database();
  const now = new Date().toISOString();

  // 1. Check pool status & existence
  const pool = await db
    .prepare('SELECT * FROM pools WHERE id = ? AND deleted_at IS NULL')
    .bind(poolId)
    .first<D1PoolRow>();

  if (!pool) {
    throw new Error('POOL_NOT_FOUND');
  }

  if (pool.status !== 'ACTIVE' || new Date(pool.deadline).getTime() <= Date.now()) {
    throw new Error('POOL_NOT_OPEN');
  }

  if (input.city && input.city.trim().toLowerCase() !== pool.city.trim().toLowerCase()) {
    throw new Error('CITY_MUST_MATCH_POOL');
  }

  // 2. Check existing membership idempotently
  const existingLead = await db
    .prepare('SELECT * FROM pool_leads WHERE pool_id = ? AND whatsapp_number = ?')
    .bind(poolId, input.whatsappNumber)
    .first<{
      id: string;
      buyer_number: number;
    }>();

  if (existingLead) {
    return {
      leadId: existingLead.id,
      buyerNumber: Number(existingLead.buyer_number),
      currentBuyers: Number(pool.current_buyers),
      targetBuyers: Number(pool.target_buyers),
      remainingBuyers: Math.max(0, Number(pool.target_buyers) - Number(pool.current_buyers)),
      alreadyJoined: true,
      poolStatus: pool.status as PublicPool['status'],
    };
  }

  // 3. Atomically attempt to claim a spot below target capacity.
  // This statement succeeds only if current_buyers < target_buyers under concurrent executions.
  const incrementRes = await db
    .prepare(
      `UPDATE pools
          SET current_buyers = current_buyers + 1,
              updated_at = ?
        WHERE id = ?
          AND current_buyers < target_buyers
          AND status = 'ACTIVE'
          AND deadline > ?`
    )
    .bind(now, poolId, now)
    .run();

  if (incrementRes.meta.changes === 0) {
    // Either target is reached or pool expired concurrently
    const refreshedPool = await db
      .prepare('SELECT current_buyers, target_buyers, status, deadline FROM pools WHERE id = ?')
      .bind(poolId)
      .first<{
        current_buyers: number;
        target_buyers: number;
        status: string;
        deadline: string;
      }>();

    if (refreshedPool && refreshedPool.current_buyers >= refreshedPool.target_buyers) {
      // Record target reached milestone
      await db
        .prepare(
          "UPDATE pools SET target_reached_at = COALESCE(target_reached_at, ?), connection_status = 'ADMIN_REVIEW_PENDING', updated_at = ? WHERE id = ?"
        )
        .bind(now, now, poolId)
        .run();
      throw new Error('TARGET_REACHED');
    }

    throw new Error('POOL_NOT_OPEN');
  }

  // 4. Retrieve the new current buyer count
  const updatedPool = await db
    .prepare('SELECT current_buyers, target_buyers, status FROM pools WHERE id = ?')
    .bind(poolId)
    .first<{
      current_buyers: number;
      target_buyers: number;
      status: string;
    }>();

  const newBuyerNumber = updatedPool?.current_buyers || (pool.current_buyers + 1);
  const targetBuyers = updatedPool?.target_buyers || pool.target_buyers;
  const leadId = `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // 5. Insert new lead
  await db
    .prepare(
      `INSERT INTO pool_leads (
        id, pool_id, buyer_number, full_name, whatsapp_number, city,
        buying_timeline, has_existing_quote, existing_quote_amount,
        extra_message, consent_at, privacy_notice_version,
        selected_kit_offer_id, selected_kit_name, connection_opt_in,
        vendor_share_consent, locality, pin_code, status, fee_status,
        member_connection_status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, '2026-10-V3',
        ?, ?, ?,
        ?, ?, ?, 'NEW', 'NOT_REQUESTED',
        'NOT_READY', ?, ?
      )`
    )
    .bind(
      leadId,
      poolId,
      newBuyerNumber,
      input.fullName.trim(),
      input.whatsappNumber,
      pool.city,
      input.buyingTimeline || 'THIS_MONTH',
      input.hasExistingQuote ? 1 : 0,
      input.existingQuoteAmount || null,
      input.extraMessage?.trim() || '',
      now,
      input.selectedKitOfferId || null,
      null,
      input.connectionOptIn ? 1 : 0,
      input.vendorShareConsent ? 1 : 0,
      input.locality?.trim() || null,
      input.pinCode?.trim() || null,
      now,
      now
    )
    .run();

  // 6. Check if target was hit with this join
  if (newBuyerNumber >= targetBuyers) {
    await db
      .prepare(
        "UPDATE pools SET target_reached_at = COALESCE(target_reached_at, ?), connection_status = 'ADMIN_REVIEW_PENDING', updated_at = ? WHERE id = ?"
      )
      .bind(now, now, poolId)
      .run();
  }

  return {
    leadId,
    buyerNumber: newBuyerNumber,
    currentBuyers: newBuyerNumber,
    targetBuyers,
    remainingBuyers: Math.max(0, targetBuyers - newBuyerNumber),
    alreadyJoined: false,
    poolStatus: (updatedPool?.status || pool.status) as PublicPool['status'],
  };
}
