import { PublicPool, JoinPoolInput, JoinPoolResult, PoolFilters } from '@/types';
import { isDemoMode } from './data-mode';
import { MOCK_POOLS } from './mock-data';
import { getPublicSupabase } from './supabase/public';
import { CATEGORY_SLUG_MAP } from './constants';

interface SupabasePoolRow {
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
  market_price: number | string | null;
  group_price: number | string | null;
  target_buyers: number;
  current_buyers: number;
  deadline: string;
  status: string;
  price_is_verified: boolean;
  price_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRowToPublicPool(row: SupabasePoolRow): PublicPool {
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
  };
}

/**
 * Loads public pools matching optional city/category filters.
 */
export async function getPublicPools(filters?: PoolFilters): Promise<PublicPool[]> {
  if (isDemoMode()) {
    let result = MOCK_POOLS.filter((p) => !p.deletedAt && !p.isArchived);
    if (filters?.citySlug && filters.citySlug !== 'all') {
      result = result.filter((p) => p.citySlug === filters.citySlug);
    }
    if (filters?.categorySlug && filters.categorySlug !== 'all') {
      const mapped = CATEGORY_SLUG_MAP[filters.categorySlug];
      if (Array.isArray(mapped)) {
        result = result.filter((p) => mapped.includes(p.category));
      } else if (mapped) {
        result = result.filter((p) => p.category === mapped || p.categorySlug === filters.categorySlug);
      } else {
        result = result.filter((p) => p.categorySlug === filters.categorySlug);
      }
    }
    return result;
  }

  const supabase = getPublicSupabase();
  if (!supabase) {
    return [];
  }

  let query = supabase
    .from('public_pools')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.citySlug && filters.citySlug !== 'all') {
    query = query.eq('city_slug', filters.citySlug);
  }

  if (filters?.categorySlug && filters.categorySlug !== 'all') {
    const mapped = CATEGORY_SLUG_MAP[filters.categorySlug];
    if (Array.isArray(mapped)) {
      query = query.in('category', mapped);
    } else if (mapped) {
      query = query.or(`category.eq.${mapped},category_slug.eq.${filters.categorySlug}`);
    } else {
      query = query.eq('category_slug', filters.categorySlug);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching public pools from Supabase:', error.message);
    throw new Error(`Failed to load pools: ${error.message}`);
  }

  return (data || []).map((row) => mapRowToPublicPool(row as SupabasePoolRow));
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
      (p) => p.citySlug === citySlug && p.slug === poolSlug && !p.deletedAt && !p.isArchived
    );
    return found || null;
  }

  const supabase = getPublicSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('public_pools')
    .select('*')
    .eq('city_slug', citySlug)
    .eq('slug', poolSlug)
    .maybeSingle();

  if (error) {
    console.error('Error fetching pool by slug:', error.message);
    throw new Error(`Failed to load pool: ${error.message}`);
  }

  if (!data) return null;
  return mapRowToPublicPool(data as SupabasePoolRow);
}

/**
 * Loads a single public pool by id
 */
export async function getPublicPoolById(id: string): Promise<PublicPool | null> {
  if (isDemoMode()) {
    const found = MOCK_POOLS.find((p) => p.id === id && !p.deletedAt && !p.isArchived);
    return found || null;
  }

  const supabase = getPublicSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('public_pools')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching pool by id:', error.message);
    throw new Error(`Failed to load pool: ${error.message}`);
  }

  if (!data) return null;
  return mapRowToPublicPool(data as SupabasePoolRow);
}

/**
 * Server-side join_pool RPC invocation
 */
export async function executeJoinPool(
  poolId: string,
  input: JoinPoolInput
): Promise<JoinPoolResult> {
  const supabase = getPublicSupabase();
  if (!supabase) {
    throw new Error('Supabase client is not available');
  }

  const { data, error } = await supabase.rpc('join_pool', {
    p_pool_id: poolId,
    p_full_name: input.fullName,
    p_whatsapp_number: input.whatsappNumber,
    p_city: input.city,
    p_buying_timeline: input.buyingTimeline,
    p_has_existing_quote: input.hasExistingQuote,
    p_existing_quote_amount: input.existingQuoteAmount,
    p_extra_message: input.extraMessage || '',
    p_selected_kit_offer_id: input.selectedKitOfferId || null,
  });

  if (error) {
    throw error;
  }

  // The RPC returns a table of 1 row
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error('No data returned from join_pool');
  }

  return {
    leadId: row.lead_id,
    buyerNumber: Number(row.buyer_number),
    currentBuyers: Number(row.current_buyers),
    targetBuyers: Number(row.target_buyers),
    remainingBuyers: Number(row.remaining_buyers),
    alreadyJoined: Boolean(row.already_joined),
    poolStatus: row.pool_status,
  };
}
