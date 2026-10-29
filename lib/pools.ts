import { PublicPool, JoinPoolInput, JoinPoolResult, PoolFilters } from '@/types';
import { isDemoMode } from './data-mode';
import { MOCK_POOLS, MOCK_ADMIN_POOLS, getDemoLeads } from './mock-data';
import { getD1Database, requireD1Database } from './d1/db';
import { CATEGORY_SLUG_MAP } from './constants';


interface D1KitOfferRow {
  id: string;
  pool_id: string;
  name: string;
  sku: string;
  brand: string;
  model: string;
  inclusions: string | null;
  exclusions: string | null;
  warranty: string;
  market_price: number;
  group_price: number;
  subsidy_estimate: number | null;
  subsidy_disclaimer: string | null;
  target_buyers: number;
  current_buyers: number;
  is_available: number;
  sort_order: number;
}

function mapRowToKitOffer(row: D1KitOfferRow) {
  let inclusions: string[] = [];
  let exclusions: string[] = [];
  try {
    if (row.inclusions) inclusions = JSON.parse(row.inclusions);
  } catch {}
  try {
    if (row.exclusions) exclusions = JSON.parse(row.exclusions);
  } catch {}

  return {
    id: row.id,
    poolId: row.pool_id,
    name: row.name,
    sku: row.sku,
    brand: row.brand,
    model: row.model,
    inclusions,
    exclusions,
    warranty: row.warranty,
    marketPrice: Number(row.market_price),
    groupPrice: Number(row.group_price),
    subsidyEstimate: row.subsidy_estimate !== null ? Number(row.subsidy_estimate) : null,
    subsidyDisclaimer: row.subsidy_disclaimer,
    targetBuyers: Number(row.target_buyers),
    currentBuyers: Number(row.current_buyers),
    isAvailable: Boolean(row.is_available),
    sortOrder: Number(row.sort_order),
  };
}

interface D1PoolRow {
  category_slug?: string | null;
  product_title?: string | null;
  variant_name?: string | null;
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
  quote_valid_until?: string | null;
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
  max_waitlist_size?: number | null;
  created_at: string;
  updated_at: string;
}

function mapRowToPublicPool(row: D1PoolRow): PublicPool {
  const quoteExpiry = row.quote_valid_until || row.offer_valid_until;
  const isQuoteExpired = quoteExpiry ? new Date(quoteExpiry).getTime() < Date.now() : false;
  const priceIsVerified = Boolean(row.price_is_verified) && !isQuoteExpired;
  const groupPriceType = isQuoteExpired && row.group_price_type === 'VENDOR_QUOTED'
    ? 'INDICATIVE_ESTIMATE'
    : ((row.group_price_type || 'INDICATIVE_ESTIMATE') as PublicPool['groupPriceType']);

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
    priceIsVerified,
    priceVerifiedAt: isQuoteExpired ? null : row.price_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isPublished: Boolean(row.is_published),
    marketPriceType: (row.market_price_type || 'INDICATIVE_ESTIMATE') as PublicPool['marketPriceType'],
    groupPriceType,
    targetReachedAt: row.target_reached_at || null,
    connectionStatus: (row.connection_status || 'NOT_ELIGIBLE') as PublicPool['connectionStatus'],
    savingsDisplayApproved: Boolean(row.savings_display_approved),
    sourceRequestId: row.source_request_id || null,
    maxWaitlistSize: row.max_waitlist_size !== null && row.max_waitlist_size !== undefined ? Number(row.max_waitlist_size) : undefined,
    categorySlug: row.category_slug || undefined,
    productTitle: row.product_title || row.name,
    variantName: row.variant_name || undefined,
    quoteValidUntil: quoteExpiry || null,
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
export async function getPublicPools(filters?: PoolFilters | string): Promise<PublicPool[]> {
  const resolvedFilters: PoolFilters | undefined = typeof filters === 'string' ? { citySlug: filters } : filters;

  if (isDemoMode()) {
    const now = getNowMs();
    let result = MOCK_POOLS.filter((p) => {
      if (p.deletedAt || p.isArchived || p.isPublished === false) return false;
      if (p.status === 'CLOSED' || p.status === 'DRAFT') return false;
      if (new Date(p.deadline).getTime() <= now) return false;
      return true;
    });

    if (resolvedFilters?.citySlug && resolvedFilters.citySlug !== 'all') {
      result = result.filter((p) => p.citySlug === resolvedFilters.citySlug || (p.cityLabels && p.cityLabels.some((c: string) => c.toLowerCase() === resolvedFilters.citySlug?.toLowerCase())));
    }

    if (resolvedFilters?.categorySlug && resolvedFilters?.categorySlug !== 'all') {
      const catSlug = resolvedFilters?.categorySlug;
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
    "status NOT IN ('CLOSED', 'DRAFT')",
    'is_published = 1',
    'is_archived = 0',
    'deleted_at IS NULL',
    'deadline > ?',
  ];
  const params: unknown[] = [nowIso];

  if (resolvedFilters?.citySlug && resolvedFilters.citySlug !== 'all') {
    whereClauses.push('(city_slug = ? OR id IN (SELECT pool_id FROM pool_cities WHERE city_code = ? AND is_enabled = 1))');
    params.push(resolvedFilters.citySlug, resolvedFilters.citySlug);
  }

  if (resolvedFilters?.categorySlug && resolvedFilters.categorySlug !== 'all') {
    const catSlug = resolvedFilters.categorySlug;
    if (catSlug === 'home-power-backup') {
      whereClauses.push("((category_slug = 'home-power-backup') OR (category = 'ROOFTOP_SOLAR' AND (slug LIKE '%power-backup%' OR slug LIKE '%inverter%' OR name LIKE '%Inverter%')))");
    } else if (catSlug === 'water-softeners' || catSlug === 'water-softener') {
      whereClauses.push("((category_slug IN ('water-softeners', 'water-softener')) OR (category = 'ROOFTOP_SOLAR' AND (slug LIKE '%water-softener%' OR slug LIKE '%softener%' OR name LIKE '%Softener%')))");
    } else if (catSlug === 'rooftop-solar') {
      whereClauses.push("((category_slug = 'rooftop-solar') OR (category = 'ROOFTOP_SOLAR' AND slug NOT LIKE '%power-backup%' AND slug NOT LIKE '%inverter%' AND slug NOT LIKE '%softener%'))");
    } else {
      const mapped = CATEGORY_SLUG_MAP[catSlug];
      if (Array.isArray(mapped)) {
        const placeholders = mapped.map(() => '?').join(', ');
        whereClauses.push(`(category_slug = ? OR category IN (${placeholders}))`);
        params.push(catSlug, ...mapped);
      } else if (mapped) {
        whereClauses.push('(category_slug = ? OR category = ?)');
        params.push(catSlug, mapped);
      } else {
        whereClauses.push('(category_slug = ? OR category = ?)');
        params.push(catSlug, catSlug);
      }
    }
  }

  const sql = `SELECT * FROM pools WHERE ${whereClauses.join(' AND ')} ORDER BY created_at DESC`;

  try {
    const { results } = await db.prepare(sql).bind(...params).all<D1PoolRow>();
    const pools = (results || []).map(mapRowToPublicPool);
    if (pools.length > 0) {
      try {
        for (const pool of pools) {
          try {
            const { results: cityRows } = await db
              .prepare('SELECT city_name FROM pool_cities WHERE pool_id = ? AND is_enabled = 1 ORDER BY city_name ASC')
              .bind(pool.id)
              .all<{ city_name: string }>();
            if (cityRows && cityRows.length > 0) {
              pool.cityLabels = cityRows.map((r) => r.city_name);
            } else {
              pool.cityLabels = [pool.city];
            }
          } catch {}

          try {
            const leadCountRow = await db
              .prepare("SELECT COUNT(*) as c FROM pool_leads WHERE pool_id = ? AND (member_connection_status IS NULL OR member_connection_status != 'EXCLUDED')")
              .bind(pool.id)
              .first<{ c: number }>();
            if (leadCountRow) {
              pool.currentBuyers = Number(leadCountRow.c);
              pool.remainingBuyers = Math.max(0, pool.targetBuyers - pool.currentBuyers);
            }
            const wlCountRow = await db
              .prepare("SELECT COUNT(*) as c FROM pool_waitlist WHERE pool_id = ? AND status = 'WAITING'")
              .bind(pool.id)
              .first<{ c: number }>();
            if (wlCountRow) {
              pool.waitlistCount = Number(wlCountRow.c);
            }
          } catch {}
        }

        const poolIds = pools.map((p) => p.id);
        const placeholders = poolIds.map(() => '?').join(', ');
        const { results: kitRows } = await db
          .prepare(
            `SELECT * FROM pool_kit_offers WHERE pool_id IN (${placeholders}) AND is_available = 1 ORDER BY sort_order ASC, name ASC`
          )
          .bind(...poolIds)
          .all<D1KitOfferRow>();
        if (kitRows && kitRows.length > 0) {
          const kitsByPool: Record<string, ReturnType<typeof mapRowToKitOffer>[]> = {};
          for (const row of kitRows) {
            if (!kitsByPool[row.pool_id]) kitsByPool[row.pool_id] = [];
            kitsByPool[row.pool_id].push(mapRowToKitOffer(row));
          }
          for (const pool of pools) {
            if (kitsByPool[pool.id]) {
              pool.kitOffers = kitsByPool[pool.id];
            }
          }
        }
      } catch {}
    }
    return pools;
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
    const pool = mapRowToPublicPool(row);
    try {
      const leadCountRow = await db
        .prepare("SELECT COUNT(*) as c FROM pool_leads WHERE pool_id = ? AND (member_connection_status IS NULL OR member_connection_status != 'EXCLUDED')")
        .bind(pool.id)
        .first<{ c: number }>();
      if (leadCountRow) {
        pool.currentBuyers = Number(leadCountRow.c);
      }
      pool.remainingBuyers = Math.max(0, pool.targetBuyers - pool.currentBuyers);

      const wlCountRow = await db
        .prepare("SELECT COUNT(*) as c FROM pool_waitlist WHERE pool_id = ? AND status = 'WAITING'")
        .bind(pool.id)
        .first<{ c: number }>();
      if (wlCountRow) {
        pool.waitlistCount = Number(wlCountRow.c);
      }
    } catch {}

    try {
      const { results: kitRows } = await db
        .prepare('SELECT * FROM pool_kit_offers WHERE pool_id = ? AND is_available = 1 ORDER BY sort_order ASC, name ASC')
        .bind(pool.id)
        .all<D1KitOfferRow>();
      if (kitRows && kitRows.length > 0) {
        pool.kitOffers = kitRows.map(mapRowToKitOffer);
      }
    } catch {}
    return pool;
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
    const pool = mapRowToPublicPool(row);
    try {
      const { results: kitRows } = await db
        .prepare('SELECT * FROM pool_kit_offers WHERE pool_id = ? AND is_available = 1 ORDER BY sort_order ASC, name ASC')
        .bind(pool.id)
        .all<D1KitOfferRow>();
      if (kitRows && kitRows.length > 0) {
        pool.kitOffers = kitRows.map(mapRowToKitOffer);
      }
    } catch {}
    return pool;
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

  

    // 2. Check existing membership idempotently
  const existingLead = await db
    .prepare("SELECT id, buyer_number, member_connection_status FROM pool_leads WHERE pool_id = ? AND whatsapp_number = ? AND (member_connection_status IS NULL OR member_connection_status != 'EXCLUDED')")
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

  const existingWaitlist = await db
    .prepare("SELECT id, sequence_number FROM pool_waitlist WHERE pool_id = ? AND whatsapp_number = ? AND status = 'WAITING'")
    .bind(poolId, input.whatsappNumber)
    .first<{ id: string; sequence_number: number }>();

  if (existingWaitlist) {
    return {
      leadId: existingWaitlist.id,
      buyerNumber: 0,
      currentBuyers: Number(pool.current_buyers),
      targetBuyers: Number(pool.target_buyers),
      remainingBuyers: 0,
      alreadyJoined: true,
      poolStatus: pool.status as PublicPool['status'],
    };
  }

  // 2b. City mismatch validation: Canonical target pool city must not be silently overridden
  const targetCityName = pool.city || 'India';
  const targetCitySlug = pool.city_slug || '';
  const userCity = (input.userCity || input.city || '').trim();
  const isCityMismatch =
    Boolean(userCity) &&
    userCity.toLowerCase() !== targetCityName.toLowerCase() &&
    userCity.toLowerCase() !== targetCitySlug.toLowerCase() &&
    userCity.toLowerCase() !== 'india' &&
    userCity.toLowerCase() !== 'all';

  if (isCityMismatch && !input.confirmCityMismatch) {
    const error = new Error(`You are joining the ${targetCityName} pool, not the ${userCity} pool.`);
    Object.assign(error, {
      code: 'CITY_MISMATCH',
      targetCity: targetCityName,
      userCity,
    });
    throw error;
  }

  // 2c. Cross-city duplicate detection in same category
  if (!input.confirmCrossCity && pool.category_slug) {
    const crossCityLead = await db
      .prepare(
        `SELECT p.id, p.name, p.city
         FROM pool_leads pl
         JOIN pools p ON pl.pool_id = p.id
         WHERE pl.whatsapp_number = ?
           AND p.category_slug = ?
           AND p.id != ?
           AND (pl.member_connection_status IS NULL OR pl.member_connection_status != 'EXCLUDED')
         LIMIT 1`
      )
      .bind(input.whatsappNumber, pool.category_slug, poolId)
      .first<{ id: string; name: string; city: string }>();

    if (crossCityLead) {
      const error = new Error(
        `You already have an active registration for ${pool.category_slug} in ${crossCityLead.city}. Are you sure you want to register a separate interest in ${targetCityName}?`
      );
      Object.assign(error, {
        code: 'CROSS_CITY_DUPLICATE_NOTICE',
        existingCity: crossCityLead.city,
        targetCity: targetCityName,
        existingStatus: 'CONFIRMED',
      });
      throw error;
    }

    const crossCityWl = await db
      .prepare(
        `SELECT p.id, p.name, p.city
         FROM pool_waitlist pw
         JOIN pools p ON pw.pool_id = p.id
         WHERE pw.whatsapp_number = ?
           AND p.category_slug = ?
           AND p.id != ?
           AND pw.status = 'WAITING'
         LIMIT 1`
      )
      .bind(input.whatsappNumber, pool.category_slug, poolId)
      .first<{ id: string; name: string; city: string }>();

    if (crossCityWl) {
      const error = new Error(
        `You are currently on the waitlist for ${pool.category_slug} in ${crossCityWl.city}. Are you sure you want to register a separate interest in ${targetCityName}?`
      );
      Object.assign(error, {
        code: 'CROSS_CITY_DUPLICATE_NOTICE',
        existingCity: crossCityWl.city,
        targetCity: targetCityName,
        existingStatus: 'WAITLISTED',
      });
      throw error;
    }
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

  // 4b. Resolve kit offer name if selected
  let selectedKitName: string | null = null;
  if (input.selectedKitOfferId) {
    try {
      const kitRow = await db
        .prepare('SELECT name FROM pool_kit_offers WHERE id = ? AND pool_id = ?')
        .bind(input.selectedKitOfferId, poolId)
        .first<{ name: string }>();
      if (kitRow) selectedKitName = kitRow.name;
    } catch {}
  }

  // 5. Insert new lead with transactional rollback protection
  try {
    await db
      .prepare(
        `INSERT INTO pool_leads (
          id, pool_id, buyer_number, full_name, whatsapp_number, city,
          buying_timeline, has_existing_quote, existing_quote_amount,
          existing_quote, extra_message, consent_at, privacy_notice_version,
          selected_kit_offer_id, selected_kit_name, selected_variant_id, selected_variant_name,
          connection_opt_in, connection_preference, group_privacy_acknowledged,
          vendor_share_consent, locality, pin_code, pincode, status, fee_status,
          member_connection_status, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, '2026-10-V4',
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, 'NEW', 'NOT_REQUESTED',
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
        input.existing_quote?.trim() || null,
        input.extraMessage?.trim() || '',
        now,
        input.selectedKitOfferId || null,
        selectedKitName,
        input.selectedKitOfferId || null,
        selectedKitName,
        input.connectionOptIn ? 1 : 0,
        input.connectionPreference || 'WHATSAPP_GROUP',
        input.groupPrivacyAcknowledged ? 1 : 0,
        input.vendorShareConsent ? 1 : 0,
        input.locality?.trim() || null,
        input.pincode?.trim() || input.pinCode?.trim() || null,
        input.pincode?.trim() || input.pinCode?.trim() || null,
        now,
        now
      )
      .run();
  } catch (insertErr) {
    // Rollback count increment to maintain transactional consistency
    await db
      .prepare('UPDATE pools SET current_buyers = MAX(0, current_buyers - 1), updated_at = ? WHERE id = ?')
      .bind(now, poolId)
      .run();
    throw insertErr;
  }

  // Increment kit offer counter if selected
  if (input.selectedKitOfferId) {
    try {
      await db
        .prepare('UPDATE pool_kit_offers SET current_buyers = current_buyers + 1, updated_at = ? WHERE id = ?')
        .bind(now, input.selectedKitOfferId)
        .run();
    } catch {}
  }

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
/**
 * Canonical calculation of active confirmed members for a pool.
 * Definition: Members in pool_leads whose connection status is not 'EXCLUDED'.
 */
export async function getCanonicalMemberCount(poolId: string): Promise<number> {
  if (isDemoMode()) {
    const leads = getDemoLeads().filter((l) => l.poolId === poolId && l.connectionStatus !== 'EXCLUDED');
    return leads.length;
  }

  const db = await requireD1Database();
  const row = await db
    .prepare("SELECT COUNT(*) as c FROM pool_leads WHERE pool_id = ? AND (member_connection_status IS NULL OR member_connection_status != 'EXCLUDED')")
    .bind(poolId)
    .first<{ c: number }>();

  return Number(row?.c || 0);
}

/**
 * Reconciles the stored current_buyers counter on a pool against the canonical membership records.
 */
export async function reconcilePoolBuyerCount(
  poolId: string
): Promise<{ poolId: string; previousCount: number; canonicalCount: number }> {
  const canonicalCount = await getCanonicalMemberCount(poolId);
  const now = new Date().toISOString();

  if (isDemoMode()) {
    const adminPool = MOCK_ADMIN_POOLS.find((p) => p.id === poolId);
    const pubPool = MOCK_POOLS.find((p) => p.id === poolId);
    const previousCount = adminPool?.currentBuyers || 0;
    if (adminPool) adminPool.currentBuyers = canonicalCount;
    if (pubPool) pubPool.currentBuyers = canonicalCount;
    return { poolId, previousCount, canonicalCount };
  }

  const db = await requireD1Database();
  const poolRow = await db
    .prepare('SELECT current_buyers FROM pools WHERE id = ?')
    .bind(poolId)
    .first<{ current_buyers: number }>();

  const previousCount = Number(poolRow?.current_buyers || 0);
  if (previousCount !== canonicalCount) {
    await db
      .prepare('UPDATE pools SET current_buyers = ?, updated_at = ? WHERE id = ?')
      .bind(canonicalCount, now, poolId)
      .run();
  }

  return { poolId, previousCount, canonicalCount };
}
