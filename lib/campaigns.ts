import { Campaign, CampaignStatus, AdminPool, PoolStatus } from '@/types';
import { isDemoMode } from './data-mode';
import {
  getDemoCampaigns,
  getDemoCampaignById,
  getDemoCampaignBySlug,
  addDemoCampaign,
  updateDemoCampaign,
  deleteDemoCampaign,
  MOCK_ADMIN_POOLS,
  addDemoPool,
  updateDemoPool,
  deleteDemoPool,
  DEMO_LEADS,
} from './mock-data';
import { requireD1Database } from './d1/db';
import { slugify } from './format';
import { getCategoryBySlug } from './categories';
import { getCityBySlug } from './cities';
import { LAUNCH_CITIES } from './constants';

interface D1CampaignRow {
  id: string;
  slug: string;
  title: string;
  category_slug: string;
  category_name: string;
  brand: string;
  model: string;
  variant_name: string;
  short_description: string;
  long_description: string;
  image_url: string | null;
  default_market_price: number | null;
  default_group_price: number | null;
  default_target_buyers: number;
  default_max_waitlist_size: number;
  status: string;
  is_published: number;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

interface D1AdminPoolRow {
  id: string;
  campaign_id?: string | null;
  slug: string;
  name: string;
  short_description: string;
  long_description: string;
  category: string;
  category_slug?: string | null;
  product_title?: string | null;
  variant_name?: string | null;
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
  quote_source?: string | null;
  quote_date?: string | null;
  quote_valid_until?: string | null;
  quote_scope?: string | null;
  quote_private_notes?: string | null;
  connection_status: string;
  payment_config_state: string;
  connection_notes?: string | null;
  target_reached_at?: string | null;
  target_reached_acknowledged_at?: string | null;
  source_request_id?: string | null;
  max_waitlist_size?: number | null;
  created_at: string;
  updated_at: string;
}

function mapRowToCampaign(row: D1CampaignRow): Campaign {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    categorySlug: row.category_slug,
    categoryName: row.category_name,
    brand: row.brand || '',
    model: row.model || '',
    variantName: row.variant_name || '',
    shortDescription: row.short_description || '',
    longDescription: row.long_description || '',
    imageUrl: row.image_url,
    defaultMarketPrice: row.default_market_price !== null ? Number(row.default_market_price) : null,
    defaultGroupPrice: row.default_group_price !== null ? Number(row.default_group_price) : null,
    defaultTargetBuyers: Number(row.default_target_buyers || 10),
    defaultMaxWaitlistSize: Number(row.default_max_waitlist_size || 50),
    status: row.status as CampaignStatus,
    isPublished: Boolean(row.is_published),
    isArchived: Boolean(row.is_archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToAdminPool(row: D1AdminPoolRow): AdminPool {
  return {
    id: row.id,
    campaignId: row.campaign_id || null,
    slug: row.slug,
    name: row.name,
    productTitle: row.product_title || row.name,
    variantName: row.variant_name || undefined,
    shortDescription: row.short_description || '',
    longDescription: row.long_description || '',
    category: row.category as AdminPool['category'],
    categorySlug: row.category_slug || undefined,
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
    status: row.status as AdminPool['status'],
    priceIsVerified: Boolean(row.price_is_verified),
    priceVerifiedAt: row.price_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dealerName: row.dealer_name || null,
    tokenAmount: row.token_amount !== null && row.token_amount !== undefined ? Number(row.token_amount) : null,
    tokenPaymentUrl: row.token_payment_url || null,
    dealerOfferUrl: row.dealer_offer_url || null,
    dealerTerms: row.dealer_terms || null,
    isPublished: Boolean(row.is_published),
    marketPriceType: (row.market_price_type || 'INDICATIVE_ESTIMATE') as AdminPool['marketPriceType'],
    groupPriceType: (row.group_price_type || 'INDICATIVE_ESTIMATE') as AdminPool['groupPriceType'],
    savingsDisplayApproved: Boolean(row.savings_display_approved),
    quoteSource: row.quote_source || null,
    quoteDate: row.quote_date || null,
    quoteValidUntil: row.quote_valid_until || null,
    quoteScope: row.quote_scope || null,
    quotePrivateNotes: row.quote_private_notes || null,
    connectionStatus: (row.connection_status || 'NOT_ELIGIBLE') as AdminPool['connectionStatus'],
    paymentConfigState: (row.payment_config_state || 'DISABLED') as AdminPool['paymentConfigState'],
    connectionNotes: row.connection_notes || null,
    targetReachedAcknowledgedAt: row.target_reached_acknowledged_at || null,
    closureReason: (row.closure_reason as AdminPool['closureReason']) || null,
    closedAt: row.closed_at || null,
    offerValidUntil: row.offer_valid_until || null,
    isArchived: Boolean(row.is_archived),
    deletedAt: row.deleted_at || null,
    targetReachedAt: row.target_reached_at || null,
    maxWaitlistSize: row.max_waitlist_size !== null && row.max_waitlist_size !== undefined ? Number(row.max_waitlist_size) : undefined,
    sourceRequestId: row.source_request_id || null,
  };
}

export class DuplicateCampaignSlugError extends Error {
  code = 'DUPLICATE_CAMPAIGN_SLUG';
  constructor(slug: string) {
    super(`A campaign with slug "${slug}" already exists.`);
    this.name = 'DuplicateCampaignSlugError';
  }
}

export class CampaignDeletionBlockedError extends Error {
  code = 'CAMPAIGN_HAS_DEPENDENCIES';
  dependencies: { poolsCount: number; leadsCount: number; requestsCount: number; quotationsCount: number };

  constructor(
    title: string,
    dependencies: { poolsCount: number; leadsCount: number; requestsCount: number; quotationsCount: number }
  ) {
    super(
      `Cannot hard delete campaign "${title}": referenced by ${dependencies.leadsCount} lead(s), ${dependencies.requestsCount} proposal(s), and ${dependencies.quotationsCount} quote(s) across ${dependencies.poolsCount} city pool(s). Archive the campaign instead.`
    );
    this.name = 'CampaignDeletionBlockedError';
    this.dependencies = dependencies;
  }
}

export class PoolDeletionBlockedError extends Error {
  code = 'POOL_HAS_DEPENDENCIES';
  dependencies: { leadsCount: number; requestsCount: number; waitlistCount: number; quotationsCount: number };

  constructor(
    poolName: string,
    dependencies: { leadsCount: number; requestsCount: number; waitlistCount: number; quotationsCount: number }
  ) {
    super(
      `Cannot hard delete pool "${poolName}": referenced by ${dependencies.leadsCount} lead(s), ${dependencies.waitlistCount} waitlist member(s), and ${dependencies.quotationsCount} quote(s). Deactivate / archive the pool instead.`
    );
    this.name = 'PoolDeletionBlockedError';
    this.dependencies = dependencies;
  }
}

export interface CampaignCityInput {
  cityName: string;
  citySlug: string;
  targetBuyers?: number;
  deadline?: string;
}

export interface CreateCampaignInput {
  title: string;
  slug?: string;
  categorySlug: string;
  categoryName?: string;
  brand?: string;
  model?: string;
  variantName?: string;
  shortDescription?: string;
  longDescription?: string;
  imageUrl?: string | null;
  defaultMarketPrice?: number | null;
  defaultGroupPrice?: number | null;
  defaultTargetBuyers?: number;
  defaultMaxWaitlistSize?: number;
  status?: CampaignStatus;
  isPublished?: boolean;
  cities: CampaignCityInput[];
  defaultDeadline?: string;
}

/**
 * Loads all campaigns with optional search/filtering.
 */
export async function getAllCampaigns(filters?: {
  search?: string;
  categorySlug?: string;
  status?: string;
  citySlug?: string;
}): Promise<Campaign[]> {
  if (isDemoMode()) {
    let campaigns = getDemoCampaigns();

    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      campaigns = campaigns.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.brand.toLowerCase().includes(q) ||
          c.model.toLowerCase().includes(q) ||
          c.categoryName.toLowerCase().includes(q)
      );
    }
    if (filters?.categorySlug && filters.categorySlug !== 'all') {
      campaigns = campaigns.filter((c) => c.categorySlug === filters.categorySlug);
    }
    if (filters?.status && filters.status !== 'all') {
      campaigns = campaigns.filter((c) => c.status === filters.status);
    }

    // Attach city pools
    return campaigns.map((camp) => {
      let pools = MOCK_ADMIN_POOLS.filter(
        (p) => p.campaignId === camp.id || p.slug === camp.slug
      );
      if (filters?.citySlug && filters.citySlug !== 'all') {
        pools = pools.filter((p) => p.citySlug === filters.citySlug);
      }
      const citiesCount = pools.length;
      const totalBuyers = pools.reduce((sum, p) => sum + p.currentBuyers, 0);
      return {
        ...camp,
        cityPools: pools,
        citiesCount,
        totalBuyers,
      };
    });
  }

  const db = await requireD1Database();
  const whereClauses: string[] = ['is_archived = 0'];
  const params: unknown[] = [];

  if (filters?.search) {
    const q = `%${filters.search.toLowerCase().trim()}%`;
    whereClauses.push(
      '(LOWER(title) LIKE ? OR LOWER(brand) LIKE ? OR LOWER(model) LIKE ? OR LOWER(category_name) LIKE ?)'
    );
    params.push(q, q, q, q);
  }
  if (filters?.categorySlug && filters.categorySlug !== 'all') {
    whereClauses.push('category_slug = ?');
    params.push(filters.categorySlug);
  }
  if (filters?.status && filters.status !== 'all') {
    whereClauses.push('status = ?');
    params.push(filters.status);
  }

  const sql = `SELECT * FROM campaigns WHERE ${whereClauses.join(' AND ')} ORDER BY created_at DESC`;
  const { results: campaignRows } = await db.prepare(sql).bind(...params).all<D1CampaignRow>();

  const campaigns = (campaignRows || []).map(mapRowToCampaign);

  // Load child pools for each campaign
  if (campaigns.length > 0) {
    const campaignIds = campaigns.map((c) => c.id);
    const placeholders = campaignIds.map(() => '?').join(', ');

    let poolSql = `SELECT * FROM pools WHERE (campaign_id IN (${placeholders}) OR slug IN (${campaignIds.map(() => '?').join(', ')})) AND deleted_at IS NULL`;
    const poolParams = [...campaignIds, ...campaigns.map((c) => c.slug)];

    if (filters?.citySlug && filters.citySlug !== 'all') {
      poolSql += ' AND city_slug = ?';
      poolParams.push(filters.citySlug);
    }

    const { results: poolRows } = await db
      .prepare(poolSql)
      .bind(...poolParams)
      .all<D1AdminPoolRow>();

    const pools = (poolRows || []).map(mapRowToAdminPool);

    for (const campaign of campaigns) {
      const childPools = pools.filter(
        (p) => p.campaignId === campaign.id || p.slug === campaign.slug
      );
      campaign.cityPools = childPools;
      campaign.citiesCount = childPools.length;
      campaign.totalBuyers = childPools.reduce((sum, p) => sum + p.currentBuyers, 0);
    }
  }

  return campaigns;
}

/**
 * Loads a campaign by ID with its associated city pools and live statistics.
 */
export async function getCampaignById(id: string): Promise<Campaign | null> {
  if (isDemoMode()) {
    const camp = getDemoCampaignById(id);
    if (!camp) return null;
    const pools = MOCK_ADMIN_POOLS.filter(
      (p) => p.campaignId === camp.id || p.slug === camp.slug
    );
    return {
      ...camp,
      cityPools: pools,
      citiesCount: pools.length,
      totalBuyers: pools.reduce((sum, p) => sum + p.currentBuyers, 0),
    };
  }

  const db = await requireD1Database();
  const row = await db
    .prepare('SELECT * FROM campaigns WHERE id = ? OR slug = ?')
    .bind(id, id)
    .first<D1CampaignRow>();

  if (!row) return null;
  const campaign = mapRowToCampaign(row);

  const { results: poolRows } = await db
    .prepare('SELECT * FROM pools WHERE (campaign_id = ? OR slug = ?) AND deleted_at IS NULL ORDER BY city ASC')
    .bind(campaign.id, campaign.slug)
    .all<D1AdminPoolRow>();

  const pools = (poolRows || []).map(mapRowToAdminPool);

  // Reconcile real-time member counts and waitlist counts for child pools
  for (const pool of pools) {
    try {
      const [leadsRow, waitlistRow] = await Promise.all([
        db
          .prepare("SELECT COUNT(*) as c FROM pool_leads WHERE pool_id = ? AND (member_connection_status IS NULL OR member_connection_status != 'EXCLUDED')")
          .bind(pool.id)
          .first<{ c: number }>(),
        db
          .prepare("SELECT COUNT(*) as c FROM pool_waitlist WHERE pool_id = ? AND status = 'WAITING'")
          .bind(pool.id)
          .first<{ c: number }>(),
      ]);
      if (leadsRow) {
        pool.currentBuyers = Number(leadsRow.c || 0);
        pool.remainingBuyers = Math.max(0, pool.targetBuyers - pool.currentBuyers);
      }
      if (waitlistRow) {
        pool.waitlistCount = Number(waitlistRow.c || 0);
      }
    } catch {}
  }

  campaign.cityPools = pools;
  campaign.citiesCount = pools.length;
  campaign.totalBuyers = pools.reduce((sum, p) => sum + p.currentBuyers, 0);

  return campaign;
}

/**
 * Creates one shared campaign and N independent city pools (Section 3).
 * Enforces idempotency and partial-failure recovery.
 */
export async function createCampaign(input: CreateCampaignInput): Promise<{
  campaign: Campaign;
  pools: AdminPool[];
  alreadyExisted?: boolean;
}> {
  const trimmedTitle = input.title.trim();
  const campaignSlug = slugify(input.slug || trimmedTitle);

  // Validate active category
  const category = await getCategoryBySlug(input.categorySlug);
  if (!category) {
    throw new Error(`CATEGORY_NOT_FOUND: Category "${input.categorySlug}" does not exist.`);
  }
  if (!category.isActive) {
    throw new Error(`CATEGORY_INACTIVE: Category "${category.label}" is deactivated.`);
  }

  if (!input.cities || input.cities.length === 0) {
    throw new Error('NO_CITIES_SELECTED: At least one operational city must be selected.');
  }

  // Validate each city
  const validatedCities: { name: string; slug: string; targetBuyers: number; deadline: string }[] = [];
  const defaultDeadline = input.defaultDeadline || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  for (const cityInput of input.cities) {
    const citySlug = slugify(cityInput.citySlug || cityInput.cityName);
    const configuredCity = await getCityBySlug(citySlug);
    if (!configuredCity) {
      throw new Error(`CITY_NOT_FOUND: City "${cityInput.cityName}" is not in configured cities directory.`);
    }
    if (!configuredCity.isActive) {
      throw new Error(`CITY_INACTIVE: City "${configuredCity.name}" is deactivated.`);
    }
    validatedCities.push({
      name: configuredCity.name,
      slug: configuredCity.slug,
      targetBuyers: cityInput.targetBuyers || input.defaultTargetBuyers || 10,
      deadline: cityInput.deadline || defaultDeadline,
    });
  }

  const now = new Date().toISOString();
  const categoryName = input.categoryName || category.label;
  const status: CampaignStatus = input.status || 'ACTIVE';
  const isPublished = input.isPublished ?? true;

  if (isDemoMode()) {
    // Check if campaign already exists
    const existing = getDemoCampaignBySlug(campaignSlug);
    if (existing) {
      // Idempotent recovery
      const existingPools = MOCK_ADMIN_POOLS.filter(
        (p) => p.campaignId === existing.id || p.slug === existing.slug
      );
      return {
        campaign: existing,
        pools: existingPools,
        alreadyExisted: true,
      };
    }

    const campaignId = `camp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newCampaign: Campaign = {
      id: campaignId,
      slug: campaignSlug,
      title: trimmedTitle,
      categorySlug: category.slug,
      categoryName,
      brand: input.brand?.trim() || '',
      model: input.model?.trim() || '',
      variantName: input.variantName?.trim() || '',
      shortDescription: input.shortDescription?.trim() || '',
      longDescription: input.longDescription?.trim() || '',
      imageUrl: input.imageUrl || null,
      defaultMarketPrice: input.defaultMarketPrice || null,
      defaultGroupPrice: input.defaultGroupPrice || null,
      defaultTargetBuyers: input.defaultTargetBuyers || 10,
      defaultMaxWaitlistSize: input.defaultMaxWaitlistSize || 50,
      status,
      isPublished,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };

    addDemoCampaign(newCampaign);

    const createdPools: AdminPool[] = [];
    for (const city of validatedCities) {
      // Pool slug scoped by city if identical or keep campaign slug with city identity
      const poolSlug = campaignSlug;
      const poolId = `pool-${campaignSlug}-${city.slug}`;

      const demoPool: AdminPool = {
        id: poolId,
        campaignId,
        slug: poolSlug,
        name: `${trimmedTitle} (${city.name})`,
        productTitle: trimmedTitle,
        variantName: input.variantName?.trim() || undefined,
        category: category.slug as AdminPool['category'],
        categorySlug: category.slug,
        city: city.name,
        citySlug: city.slug,
        productBrand: input.brand?.trim() || '',
        productModel: input.model?.trim() || '',
        shortDescription: input.shortDescription?.trim() || '',
        longDescription: input.longDescription?.trim() || '',
        imageUrl: input.imageUrl || null,
        marketPrice: input.defaultMarketPrice || null,
        groupPrice: input.defaultGroupPrice || null,
        targetBuyers: city.targetBuyers,
        currentBuyers: 0,
        deadline: city.deadline,
        status: status === 'DRAFT' ? 'DRAFT' : 'ACTIVE',
        isPublished,
        priceIsVerified: false,
        priceVerifiedAt: null,
        dealerName: null,
        tokenAmount: null,
        tokenPaymentUrl: null,
        dealerOfferUrl: null,
        dealerTerms: null,
        marketPriceType: 'INDICATIVE_ESTIMATE',
        groupPriceType: 'INDICATIVE_ESTIMATE',
        savingsDisplayApproved: false,
        connectionStatus: 'NOT_ELIGIBLE',
        paymentConfigState: 'DISABLED',
        maxWaitlistSize: input.defaultMaxWaitlistSize || 50,
        createdAt: now,
        updatedAt: now,
      };

      addDemoPool(demoPool);
      createdPools.push(demoPool);
    }

    newCampaign.cityPools = createdPools;
    newCampaign.citiesCount = createdPools.length;
    newCampaign.totalBuyers = 0;

    return {
      campaign: newCampaign,
      pools: createdPools,
      alreadyExisted: false,
    };
  }

  // D1 Database Execution
  const db = await requireD1Database();

  // Check if campaign already exists
  const existingRow = await db
    .prepare('SELECT * FROM campaigns WHERE slug = ?')
    .bind(campaignSlug)
    .first<D1CampaignRow>();

  if (existingRow) {
    const existingCampaign = mapRowToCampaign(existingRow);
    const { results: existingPoolRows } = await db
      .prepare('SELECT * FROM pools WHERE campaign_id = ? AND deleted_at IS NULL')
      .bind(existingCampaign.id)
      .all<D1AdminPoolRow>();

    const existingPools = (existingPoolRows || []).map(mapRowToAdminPool);
    return {
      campaign: existingCampaign,
      pools: existingPools,
      alreadyExisted: true,
    };
  }

  const campaignId = `camp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  // Insert Campaign
  await db
    .prepare(
      `INSERT INTO campaigns (
        id, slug, title, category_slug, category_name, brand, model, variant_name,
        short_description, long_description, image_url, default_market_price,
        default_group_price, default_target_buyers, default_max_waitlist_size,
        status, is_published, is_archived, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    )
    .bind(
      campaignId,
      campaignSlug,
      trimmedTitle,
      category.slug,
      categoryName,
      input.brand?.trim() || '',
      input.model?.trim() || '',
      input.variantName?.trim() || '',
      input.shortDescription?.trim() || '',
      input.longDescription?.trim() || '',
      input.imageUrl || null,
      input.defaultMarketPrice !== undefined ? input.defaultMarketPrice : null,
      input.defaultGroupPrice !== undefined ? input.defaultGroupPrice : null,
      input.defaultTargetBuyers || 10,
      input.defaultMaxWaitlistSize || 50,
      status,
      isPublished ? 1 : 0,
      now,
      now
    )
    .run();

  const createdPools: AdminPool[] = [];

  // Create independent city pool per selected city
  for (const city of validatedCities) {
    const poolId = `pool-${campaignSlug}-${city.slug}`;
    const poolSlug = campaignSlug;
    const poolName = `${trimmedTitle} (${city.name})`;
    const poolStatus = status === 'DRAFT' ? 'DRAFT' : 'ACTIVE';

    // Insert Pool
    await db
      .prepare(
        `INSERT INTO pools (
          id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
          city, city_slug, product_brand, product_model, short_description, long_description,
          image_url, market_price, group_price, target_buyers, current_buyers, deadline,
          status, is_published, price_is_verified, market_price_type, group_price_type,
          connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, 0, ?,
          ?, ?, 0, 'INDICATIVE_ESTIMATE', 'INDICATIVE_ESTIMATE',
          'NOT_ELIGIBLE', 'DISABLED', ?, ?, ?
        )`
      )
      .bind(
        poolId,
        campaignId,
        poolSlug,
        poolName,
        trimmedTitle,
        input.variantName?.trim() || null,
        category.slug,
        category.slug,
        city.name,
        city.slug,
        input.brand?.trim() || '',
        input.model?.trim() || '',
        input.shortDescription?.trim() || '',
        input.longDescription?.trim() || '',
        input.imageUrl || null,
        input.defaultMarketPrice !== undefined ? input.defaultMarketPrice : null,
        input.defaultGroupPrice !== undefined ? input.defaultGroupPrice : null,
        city.targetBuyers,
        city.deadline,
        poolStatus,
        isPublished ? 1 : 0,
        input.defaultMaxWaitlistSize || 50,
        now,
        now
      )
      .run();

    // Insert pool_cities mapping for backward compatibility
    try {
      await db
        .prepare(
          'INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)'
        )
        .bind(`pc-${poolId}-${city.slug}`, poolId, city.slug, city.name, now, now)
        .run();
    } catch {}

    const poolRow = await db
      .prepare('SELECT * FROM pools WHERE id = ?')
      .bind(poolId)
      .first<D1AdminPoolRow>();

    if (poolRow) {
      createdPools.push(mapRowToAdminPool(poolRow));
    }
  }

  const campaignRow = await db
    .prepare('SELECT * FROM campaigns WHERE id = ?')
    .bind(campaignId)
    .first<D1CampaignRow>();

  if (!campaignRow) {
    throw new Error('Failed to retrieve newly created campaign from D1');
  }

  const createdCampaign = mapRowToCampaign(campaignRow);
  createdCampaign.cityPools = createdPools;
  createdCampaign.citiesCount = createdPools.length;
  createdCampaign.totalBuyers = 0;

  return {
    campaign: createdCampaign,
    pools: createdPools,
    alreadyExisted: false,
  };
}

/**
 * Adds an additional configured city pool to an existing campaign.
 */
export async function addCityToCampaign(
  campaignId: string,
  cityInput: CampaignCityInput
): Promise<AdminPool> {
  const citySlug = slugify(cityInput.citySlug || cityInput.cityName);
  const city = await getCityBySlug(citySlug);
  if (!city) {
    throw new Error(`CITY_NOT_FOUND: City "${cityInput.cityName}" is not configured.`);
  }
  if (!city.isActive) {
    throw new Error(`CITY_INACTIVE: City "${city.name}" is deactivated.`);
  }

  if (isDemoMode()) {
    const campaign = getDemoCampaignById(campaignId);
    if (!campaign) {
      throw new Error('CAMPAIGN_NOT_FOUND');
    }

    const existingPool = MOCK_ADMIN_POOLS.find(
      (p) =>
        (p.campaignId === campaign.id || p.slug === campaign.slug) &&
        p.citySlug.toLowerCase() === city.slug.toLowerCase() &&
        !p.deletedAt
    );
    if (existingPool) {
      return existingPool;
    }

    const now = new Date().toISOString();
    const poolId = `pool-${campaign.slug}-${city.slug}`;
    const deadline = cityInput.deadline || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const pool: AdminPool = {
      id: poolId,
      campaignId: campaign.id,
      slug: campaign.slug,
      name: `${campaign.title} (${city.name})`,
      productTitle: campaign.title,
      variantName: campaign.variantName || undefined,
      category: campaign.categorySlug as AdminPool['category'],
      categorySlug: campaign.categorySlug,
      city: city.name,
      citySlug: city.slug,
      productBrand: campaign.brand,
      productModel: campaign.model,
      shortDescription: campaign.shortDescription,
      longDescription: campaign.longDescription,
      imageUrl: campaign.imageUrl || null,
      marketPrice: campaign.defaultMarketPrice || null,
      groupPrice: campaign.defaultGroupPrice || null,
      targetBuyers: cityInput.targetBuyers || campaign.defaultTargetBuyers || 10,
      currentBuyers: 0,
      deadline,
      status: campaign.status === 'DRAFT' ? 'DRAFT' : 'ACTIVE',
      isPublished: campaign.isPublished,
      priceIsVerified: false,
      priceVerifiedAt: null,
      dealerName: null,
      tokenAmount: null,
      tokenPaymentUrl: null,
      dealerOfferUrl: null,
      dealerTerms: null,
      marketPriceType: 'INDICATIVE_ESTIMATE',
      groupPriceType: 'INDICATIVE_ESTIMATE',
      savingsDisplayApproved: false,
      connectionStatus: 'NOT_ELIGIBLE',
      paymentConfigState: 'DISABLED',
      maxWaitlistSize: campaign.defaultMaxWaitlistSize || 50,
      createdAt: now,
      updatedAt: now,
    };

    addDemoPool(pool);
    return pool;
  }

  const db = await requireD1Database();
  const campaignRow = await db
    .prepare('SELECT * FROM campaigns WHERE id = ?')
    .bind(campaignId)
    .first<D1CampaignRow>();

  if (!campaignRow) {
    throw new Error('CAMPAIGN_NOT_FOUND');
  }

  const campaign = mapRowToCampaign(campaignRow);

  // Check if city pool already exists
  const existingPoolRow = await db
    .prepare('SELECT * FROM pools WHERE campaign_id = ? AND city_slug = ? AND deleted_at IS NULL')
    .bind(campaign.id, city.slug)
    .first<D1AdminPoolRow>();

  if (existingPoolRow) {
    return mapRowToAdminPool(existingPoolRow);
  }

  const now = new Date().toISOString();
  const poolId = `pool-${campaign.slug}-${city.slug}`;
  const deadline = cityInput.deadline || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const targetBuyers = cityInput.targetBuyers || campaign.defaultTargetBuyers || 10;
  const poolStatus = campaign.status === 'DRAFT' ? 'DRAFT' : 'ACTIVE';

  await db
    .prepare(
      `INSERT INTO pools (
        id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
        city, city_slug, product_brand, product_model, short_description, long_description,
        image_url, market_price, group_price, target_buyers, current_buyers, deadline,
        status, is_published, price_is_verified, market_price_type, group_price_type,
        connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, 0, ?,
        ?, ?, 0, 'INDICATIVE_ESTIMATE', 'INDICATIVE_ESTIMATE',
        'NOT_ELIGIBLE', 'DISABLED', ?, ?, ?
      )`
    )
    .bind(
      poolId,
      campaign.id,
      campaign.slug,
      `${campaign.title} (${city.name})`,
      campaign.title,
      campaign.variantName || null,
      campaign.categorySlug,
      campaign.categorySlug,
      city.name,
      city.slug,
      campaign.brand,
      campaign.model,
      campaign.shortDescription,
      campaign.longDescription,
      campaign.imageUrl || null,
      campaign.defaultMarketPrice,
      campaign.defaultGroupPrice,
      targetBuyers,
      deadline,
      poolStatus,
      campaign.isPublished ? 1 : 0,
      campaign.defaultMaxWaitlistSize || 50,
      now,
      now
    )
    .run();

  try {
    await db
      .prepare(
        'INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)'
      )
      .bind(`pc-${poolId}-${city.slug}`, poolId, city.slug, city.name, now, now)
      .run();
  } catch {}

  const row = await db.prepare('SELECT * FROM pools WHERE id = ?').bind(poolId).first<D1AdminPoolRow>();
  if (!row) throw new Error('Failed to retrieve newly added city pool from D1');

  return mapRowToAdminPool(row);
}

/**
 * Updates shared campaign product details.
 * Does NOT overwrite city-specific capacities or city-specific statuses.
 */
export async function updateCampaign(
  campaignId: string,
  updates: Partial<Campaign>
): Promise<Campaign | null> {
  if (isDemoMode()) {
    const updated = updateDemoCampaign(campaignId, updates);
    if (!updated) return null;

    // Synchronize shared product metadata & pricing to child pools
    if (
      updates.title !== undefined ||
      updates.brand !== undefined ||
      updates.model !== undefined ||
    updates.variantName !== undefined ||
      updates.variantName !== undefined ||
      updates.shortDescription !== undefined ||
      updates.longDescription !== undefined ||
      updates.imageUrl !== undefined ||
      updates.defaultMarketPrice !== undefined ||
      updates.defaultGroupPrice !== undefined
    ) {
      const childPools = MOCK_ADMIN_POOLS.filter(
        (p) => p.campaignId === updated.id || p.slug === updated.slug
      );
      for (const pool of childPools) {
        // Only update groupPrice if pool does not have an active verified quotation
        const shouldUpdateGroupPrice =
          updates.defaultGroupPrice !== undefined &&
          !pool.priceIsVerified &&
          pool.groupPriceType !== 'VENDOR_QUOTED';

        updateDemoPool(pool.id, {
          ...(updates.title !== undefined && { productTitle: updates.title, name: `${updates.title} (${pool.city})` }),
          ...(updates.brand !== undefined && { productBrand: updates.brand }),
          ...(updates.model !== undefined && { productModel: updates.model }),
          ...(updates.variantName !== undefined && { variantName: updates.variantName }),
          ...(updates.shortDescription !== undefined && { shortDescription: updates.shortDescription }),
          ...(updates.longDescription !== undefined && { longDescription: updates.longDescription }),
          ...(updates.imageUrl !== undefined && { imageUrl: updates.imageUrl }),
          ...(updates.defaultMarketPrice !== undefined && { marketPrice: updates.defaultMarketPrice }),
          ...(shouldUpdateGroupPrice && { groupPrice: updates.defaultGroupPrice }),
        });
      }
    }
    return updated;
  }

  const db = await requireD1Database();
  const now = new Date().toISOString();

  const setClauses: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (updates.title !== undefined) {
    setClauses.push('title = ?');
    values.push(updates.title.trim());
  }
  if (updates.brand !== undefined) {
    setClauses.push('brand = ?');
    values.push(updates.brand.trim());
  }
  if (updates.model !== undefined) {
    setClauses.push('model = ?');
    values.push(updates.model.trim());
  }
  if (updates.variantName !== undefined) {
    setClauses.push('variant_name = ?');
    values.push(updates.variantName.trim());
  }
  if (updates.shortDescription !== undefined) {
    setClauses.push('short_description = ?');
    values.push(updates.shortDescription.trim());
  }
  if (updates.longDescription !== undefined) {
    setClauses.push('long_description = ?');
    values.push(updates.longDescription.trim());
  }
  if (updates.imageUrl !== undefined) {
    setClauses.push('image_url = ?');
    values.push(updates.imageUrl);
  }
  if (updates.defaultMarketPrice !== undefined) {
    setClauses.push('default_market_price = ?');
    values.push(updates.defaultMarketPrice);
  }
  if (updates.defaultGroupPrice !== undefined) {
    setClauses.push('default_group_price = ?');
    values.push(updates.defaultGroupPrice);
  }
  if (updates.defaultTargetBuyers !== undefined) {
    setClauses.push('default_target_buyers = ?');
    values.push(updates.defaultTargetBuyers);
  }
  if (updates.defaultMaxWaitlistSize !== undefined) {
    setClauses.push('default_max_waitlist_size = ?');
    values.push(updates.defaultMaxWaitlistSize);
  }
  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    values.push(updates.status);
  }
  if (updates.isPublished !== undefined) {
    setClauses.push('is_published = ?');
    values.push(updates.isPublished ? 1 : 0);
  }

  values.push(campaignId, campaignId);
  await db
    .prepare(`UPDATE campaigns SET ${setClauses.join(', ')} WHERE id = ? OR slug = ?`)
    .bind(...values)
    .run();

  // Synchronize product specs to child pools without overwriting city target_buyers or city statuses
  if (
    updates.title !== undefined ||
    updates.brand !== undefined ||
    updates.model !== undefined ||
    updates.variantName !== undefined ||
    updates.shortDescription !== undefined ||
    updates.longDescription !== undefined ||
    updates.imageUrl !== undefined
  ) {
    const poolSets: string[] = ['updated_at = ?'];
    const poolVals: unknown[] = [now];
    if (updates.title !== undefined) {
      poolSets.push('product_title = ?');
      poolVals.push(updates.title.trim());
    }
    if (updates.brand !== undefined) {
      poolSets.push('product_brand = ?');
      poolVals.push(updates.brand.trim());
    }
    if (updates.model !== undefined) {
      poolSets.push('product_model = ?');
      poolVals.push(updates.model.trim());
    }
    if (updates.variantName !== undefined) {
      poolSets.push('variant_name = ?');
      poolVals.push(updates.variantName ? updates.variantName.trim() : null);
    }
    if (updates.shortDescription !== undefined) {
      poolSets.push('short_description = ?');
      poolVals.push(updates.shortDescription.trim());
    }
    if (updates.longDescription !== undefined) {
      poolSets.push('long_description = ?');
      poolVals.push(updates.longDescription.trim());
    }
    if (updates.imageUrl !== undefined) {
      poolSets.push('image_url = ?');
      poolVals.push(updates.imageUrl);
    }
    poolVals.push(campaignId, campaignId);
    await db
      .prepare(`UPDATE pools SET ${poolSets.join(', ')} WHERE campaign_id = ? OR (campaign_id IS NULL AND slug = (SELECT slug FROM campaigns WHERE id = ?))`)
      .bind(...poolVals)
      .run();
  }

  // Synchronize pricing to child pools
  // Market price propagates to all child pools under this campaign.
  // Group price propagates ONLY to pools that do not have an active verified quotation (VENDOR_QUOTED / price_is_verified = 1).
  if (updates.defaultMarketPrice !== undefined) {
    await db
      .prepare(`
        UPDATE pools
        SET market_price = ?, updated_at = ?
        WHERE campaign_id = ? OR (campaign_id IS NULL AND slug = (SELECT slug FROM campaigns WHERE id = ?))
      `)
      .bind(updates.defaultMarketPrice, now, campaignId, campaignId)
      .run();
  }

  if (updates.defaultGroupPrice !== undefined) {
    await db
      .prepare(`
        UPDATE pools
        SET group_price = ?, updated_at = ?
        WHERE (campaign_id = ? OR (campaign_id IS NULL AND slug = (SELECT slug FROM campaigns WHERE id = ?)))
          AND (price_is_verified = 0 OR price_is_verified IS NULL)
          AND (group_price_type != 'VENDOR_QUOTED' OR group_price_type IS NULL)
      `)
      .bind(updates.defaultGroupPrice, now, campaignId, campaignId)
      .run();
  }

  return getCampaignById(campaignId);
}

/**
 * Updates city-specific pool settings (capacity, deadline, status) in strict isolation.
 */
export async function updateCityPoolSettings(
  poolId: string,
  updates: {
    targetBuyers?: number;
    deadline?: string;
    status?: PoolStatus;
    isPublished?: boolean;
  }
): Promise<AdminPool | null> {
  if (isDemoMode()) {
    return updateDemoPool(poolId, updates);
  }

  const db = await requireD1Database();
  const now = new Date().toISOString();
  const setClauses: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (updates.targetBuyers !== undefined) {
    setClauses.push('target_buyers = ?');
    values.push(updates.targetBuyers);
  }
  if (updates.deadline !== undefined) {
    setClauses.push('deadline = ?');
    values.push(updates.deadline);
  }
  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    values.push(updates.status);
  }
  if (updates.isPublished !== undefined) {
    setClauses.push('is_published = ?');
    values.push(updates.isPublished ? 1 : 0);
  }

  values.push(poolId);
  await db
    .prepare(`UPDATE pools SET ${setClauses.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  const row = await db.prepare('SELECT * FROM pools WHERE id = ?').bind(poolId).first<D1AdminPoolRow>();
  return row ? mapRowToAdminPool(row) : null;
}

/**
 * Checks dependencies before deleting a campaign.
 */
export async function getCampaignDependencies(campaignId: string) {
  if (isDemoMode()) {
    const campaign = getDemoCampaignById(campaignId);
    if (!campaign) return { poolsCount: 0, leadsCount: 0, requestsCount: 0, quotationsCount: 0, totalDependencies: 0 };
    const childPools = MOCK_ADMIN_POOLS.filter((p) => p.campaignId === campaign.id || p.slug === campaign.slug);
    const poolIds = childPools.map((p) => p.id);
    const leads = DEMO_LEADS.filter((l) => poolIds.includes(l.poolId));
    return {
      poolsCount: childPools.length,
      leadsCount: leads.length,
      requestsCount: 0,
      quotationsCount: 0,
      totalDependencies: leads.length,
    };
  }

  const db = await requireD1Database();
  const pools = await db
    .prepare('SELECT id FROM pools WHERE campaign_id = ? AND deleted_at IS NULL')
    .bind(campaignId)
    .all<{ id: string }>();

  const poolIds = (pools.results || []).map((p) => p.id);
  if (poolIds.length === 0) {
    return { poolsCount: 0, leadsCount: 0, requestsCount: 0, quotationsCount: 0, totalDependencies: 0 };
  }

  const placeholders = poolIds.map(() => '?').join(', ');
  const [leadsRow, requestsRow, quotesRow] = await Promise.all([
    db
      .prepare(`SELECT COUNT(*) as c FROM pool_leads WHERE pool_id IN (${placeholders})`)
      .bind(...poolIds)
      .first<{ c: number }>(),
    db
      .prepare(`SELECT COUNT(*) as c FROM pool_requests WHERE resulting_pool_id IN (${placeholders})`)
      .bind(...poolIds)
      .first<{ c: number }>(),
    db
      .prepare(`SELECT COUNT(*) as c FROM pool_quotations WHERE pool_id IN (${placeholders})`)
      .bind(...poolIds)
      .first<{ c: number }>(),
  ]);

  const leadsCount = Number(leadsRow?.c || 0);
  const requestsCount = Number(requestsRow?.c || 0);
  const quotationsCount = Number(quotesRow?.c || 0);

  return {
    poolsCount: poolIds.length,
    leadsCount,
    requestsCount,
    quotationsCount,
    totalDependencies: leadsCount + requestsCount + quotationsCount,
  };
}

/**
 * Safely deletes or archives a campaign.
 * Blocks hard deletion if leads, requests, or quotes exist.
 */
export async function deleteCampaign(
  campaignId: string,
  options?: { hardDelete?: boolean }
): Promise<{ action: 'soft_deleted' | 'hard_deleted'; campaign: Campaign }> {
  const deps = await getCampaignDependencies(campaignId);
  const campaign = await getCampaignById(campaignId);
  if (!campaign) {
    throw new Error('CAMPAIGN_NOT_FOUND');
  }

  if (options?.hardDelete) {
    if (deps.totalDependencies > 0) {
      throw new CampaignDeletionBlockedError(campaign.title, deps);
    }

    if (isDemoMode()) {
      deleteDemoCampaign(campaignId, { hardDelete: true });
      return { action: 'hard_deleted', campaign };
    }

    const db = await requireD1Database();
    // Delete child pools
    await db.prepare('DELETE FROM pool_cities WHERE pool_id IN (SELECT id FROM pools WHERE campaign_id = ?)').bind(campaignId).run();
    await db.prepare('DELETE FROM pools WHERE campaign_id = ?').bind(campaignId).run();
    await db.prepare('DELETE FROM campaigns WHERE id = ?').bind(campaignId).run();

    return { action: 'hard_deleted', campaign };
  }

  // Soft delete / archive
  if (isDemoMode()) {
    const res = deleteDemoCampaign(campaignId, { hardDelete: false });
    return { action: 'soft_deleted', campaign: res.campaign || campaign };
  }

  const db = await requireD1Database();
  const now = new Date().toISOString();

  await db
    .prepare("UPDATE campaigns SET status = 'ARCHIVED', is_archived = 1, is_published = 0, updated_at = ? WHERE id = ?")
    .bind(now, campaignId)
    .run();

  await db
    .prepare("UPDATE pools SET status = 'CLOSED', is_archived = 1, is_published = 0, deleted_at = ?, updated_at = ? WHERE campaign_id = ?")
    .bind(now, now, campaignId)
    .run();

  const updatedCampaign = await getCampaignById(campaignId);
  return { action: 'soft_deleted', campaign: updatedCampaign || campaign };
}

/**
 * Inspects dependencies before deleting a single city pool.
 */
export async function getPoolDependencies(poolId: string) {
  if (isDemoMode()) {
    const leads = DEMO_LEADS.filter((l) => l.poolId === poolId);
    return {
      leadsCount: leads.length,
      requestsCount: 0,
      waitlistCount: 0,
      quotationsCount: 0,
      totalDependencies: leads.length,
    };
  }

  const db = await requireD1Database();
  const [leadsRow, waitlistRow, requestsRow, quotesRow] = await Promise.all([
    db.prepare('SELECT COUNT(*) as c FROM pool_leads WHERE pool_id = ?').bind(poolId).first<{ c: number }>(),
    db.prepare('SELECT COUNT(*) as c FROM pool_waitlist WHERE pool_id = ?').bind(poolId).first<{ c: number }>(),
    db.prepare('SELECT COUNT(*) as c FROM pool_requests WHERE resulting_pool_id = ?').bind(poolId).first<{ c: number }>(),
    db.prepare('SELECT COUNT(*) as c FROM pool_quotations WHERE pool_id = ?').bind(poolId).first<{ c: number }>(),
  ]);

  const leadsCount = Number(leadsRow?.c || 0);
  const waitlistCount = Number(waitlistRow?.c || 0);
  const requestsCount = Number(requestsRow?.c || 0);
  const quotationsCount = Number(quotesRow?.c || 0);

  return {
    leadsCount,
    waitlistCount,
    requestsCount,
    quotationsCount,
    totalDependencies: leadsCount + waitlistCount + requestsCount + quotationsCount,
  };
}

/**
 * Safely deletes or archives a single city pool.
 * Does NOT delete the parent campaign or other city pools.
 */
export async function deleteCityPool(
  poolId: string,
  options?: { hardDelete?: boolean }
): Promise<{ action: 'soft_deleted' | 'hard_deleted' }> {
  const deps = await getPoolDependencies(poolId);

  if (options?.hardDelete) {
    if (deps.totalDependencies > 0) {
      throw new PoolDeletionBlockedError(poolId, deps);
    }

    if (isDemoMode()) {
      return deleteDemoPool(poolId, { hardDelete: true });
    }

    const db = await requireD1Database();
    await db.prepare('DELETE FROM pool_cities WHERE pool_id = ?').bind(poolId).run();
    await db.prepare('DELETE FROM pools WHERE id = ?').bind(poolId).run();
    return { action: 'hard_deleted' };
  }

  // Soft delete / archive
  if (isDemoMode()) {
    return deleteDemoPool(poolId, { hardDelete: false });
  }

  const db = await requireD1Database();
  const now = new Date().toISOString();
  await db
    .prepare("UPDATE pools SET status = 'CLOSED', is_archived = 1, is_published = 0, deleted_at = ?, updated_at = ? WHERE id = ?")
    .bind(now, now, poolId)
    .run();

  return { action: 'soft_deleted' };
}

export interface CityRolloutPreviewItem {
  citySlug: string;
  cityName: string;
  state: string;
  status: 'READY_TO_CREATE' | 'ALREADY_EXISTS' | 'INACTIVE' | 'NOT_FOUND';
  existingPoolId?: string;
  currentBuyers?: number;
  targetBuyers?: number;
  poolStatus?: string;
}

export interface CampaignRolloutPreview {
  campaignId: string;
  campaignTitle: string;
  categorySlug: string;
  totalCities: number;
  readyToCreateCount: number;
  alreadyExistsCount: number;
  invalidCount: number;
  cities: CityRolloutPreviewItem[];
}

export interface CityRolloutResultItem {
  citySlug: string;
  cityName: string;
  status: 'CREATED' | 'ALREADY_EXISTS' | 'FAILED' | 'SKIPPED';
  poolId?: string;
  reason: string;
  currentBuyers?: number;
}

export interface CampaignRolloutExecutionResult {
  campaignId: string;
  campaignTitle: string;
  totalRequested: number;
  createdCount: number;
  existingCount: number;
  failedCount: number;
  results: CityRolloutResultItem[];
}

/**
 * Previews bulk campaign rollout across canonical 25 launch cities.
 * Identifies existing compatible pools, missing pools, and conflicts without mutating any data.
 */
export async function previewCampaignRollout(
  campaignId: string,
  targetCitySlugs?: string[]
): Promise<CampaignRolloutPreview> {
  const campaign = await getCampaignById(campaignId);
  if (!campaign) {
    throw new Error('CAMPAIGN_NOT_FOUND: Campaign does not exist.');
  }

  const candidateCities =
    targetCitySlugs && targetCitySlugs.length > 0
      ? targetCitySlugs.map((slug) => {
          const found = LAUNCH_CITIES.find((c) => c.slug === slug);
          return found || { name: slug, slug, state: 'India' };
        })
      : LAUNCH_CITIES;

  const cities: CityRolloutPreviewItem[] = [];
  let readyToCreateCount = 0;
  let alreadyExistsCount = 0;
  let invalidCount = 0;

  for (const target of candidateCities) {
    const configuredCity = await getCityBySlug(target.slug);
    if (!configuredCity) {
      cities.push({
        citySlug: target.slug,
        cityName: target.name,
        state: target.state,
        status: 'NOT_FOUND',
      });
      invalidCount++;
      continue;
    }

    if (!configuredCity.isActive) {
      cities.push({
        citySlug: target.slug,
        cityName: target.name,
        state: target.state,
        status: 'INACTIVE',
      });
      invalidCount++;
      continue;
    }

    let existingPool: AdminPool | undefined;
    if (isDemoMode()) {
      existingPool = MOCK_ADMIN_POOLS.find(
        (p) =>
          (p.campaignId === campaign.id || p.slug === campaign.slug) &&
          p.citySlug.toLowerCase() === configuredCity.slug.toLowerCase() &&
          !p.deletedAt
      );
    } else {
      const db = await requireD1Database();
      const row = await db
        .prepare('SELECT * FROM pools WHERE campaign_id = ? AND city_slug = ? AND deleted_at IS NULL')
        .bind(campaign.id, configuredCity.slug)
        .first<D1AdminPoolRow>();
      if (row) {
        existingPool = mapRowToAdminPool(row);
      }
    }

    if (existingPool) {
      cities.push({
        citySlug: configuredCity.slug,
        cityName: configuredCity.name,
        state: configuredCity.state,
        status: 'ALREADY_EXISTS',
        existingPoolId: existingPool.id,
        currentBuyers: existingPool.currentBuyers,
        targetBuyers: existingPool.targetBuyers,
        poolStatus: existingPool.status,
      });
      alreadyExistsCount++;
    } else {
      cities.push({
        citySlug: configuredCity.slug,
        cityName: configuredCity.name,
        state: configuredCity.state,
        status: 'READY_TO_CREATE',
        targetBuyers: campaign.defaultTargetBuyers || 10,
      });
      readyToCreateCount++;
    }
  }

  return {
    campaignId: campaign.id,
    campaignTitle: campaign.title,
    categorySlug: campaign.categorySlug,
    totalCities: cities.length,
    readyToCreateCount,
    alreadyExistsCount,
    invalidCount,
    cities,
  };
}

/**
 * Idempotently executes bulk campaign rollout across canonical launch cities.
 * Creates missing city pools, preserves existing pools without modifying counts,
 * and returns granular per-city results.
 */
export async function executeCampaignRollout(
  campaignId: string,
  options?: {
    citySlugs?: string[];
    activateOnlyIntended?: boolean;
  }
): Promise<CampaignRolloutExecutionResult> {
  const campaign = await getCampaignById(campaignId);
  if (!campaign) {
    throw new Error('CAMPAIGN_NOT_FOUND: Campaign does not exist.');
  }

  const preview = await previewCampaignRollout(campaignId, options?.citySlugs);
  const results: CityRolloutResultItem[] = [];
  let createdCount = 0;
  let existingCount = 0;
  let failedCount = 0;

  for (const item of preview.cities) {
    if (item.status === 'NOT_FOUND') {
      results.push({
        citySlug: item.citySlug,
        cityName: item.cityName,
        status: 'SKIPPED',
        reason: 'City not configured in operational cities directory.',
      });
      failedCount++;
      continue;
    }

    if (item.status === 'INACTIVE') {
      results.push({
        citySlug: item.citySlug,
        cityName: item.cityName,
        status: 'SKIPPED',
        reason: 'City is currently deactivated in cities directory.',
      });
      failedCount++;
      continue;
    }

    if (item.status === 'ALREADY_EXISTS') {
      results.push({
        citySlug: item.citySlug,
        cityName: item.cityName,
        status: 'ALREADY_EXISTS',
        poolId: item.existingPoolId,
        reason: `Active pool already attached to campaign (Capacity: ${item.currentBuyers}/${item.targetBuyers}). Preserved unchanged.`,
        currentBuyers: item.currentBuyers,
      });
      existingCount++;
      continue;
    }

    try {
      const createdPool = await addCityToCampaign(campaignId, {
        cityName: item.cityName,
        citySlug: item.citySlug,
        targetBuyers: campaign.defaultTargetBuyers || 10,
      });

      results.push({
        citySlug: item.citySlug,
        cityName: item.cityName,
        status: 'CREATED',
        poolId: createdPool.id,
        reason: 'Successfully created independent city pool under campaign.',
        currentBuyers: 0,
      });
      createdCount++;
    } catch (createErr: unknown) {
      const msg = createErr instanceof Error ? createErr.message : 'Creation failed';
      results.push({
        citySlug: item.citySlug,
        cityName: item.cityName,
        status: 'FAILED',
        reason: msg,
      });
      failedCount++;
    }
  }

  return {
    campaignId: campaign.id,
    campaignTitle: campaign.title,
    totalRequested: preview.totalCities,
    createdCount,
    existingCount,
    failedCount,
    results,
  };
}

