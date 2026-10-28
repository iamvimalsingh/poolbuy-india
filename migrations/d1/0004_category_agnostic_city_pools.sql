-- ==============================================================================
-- GroupBuying / PoolBuy India — Cloudflare D1 Additive Migration
-- Migration: 0004_category_agnostic_city_pools.sql
-- Enables category-agnostic city-plus-product interest pools:
-- - Explicit product_title and variant_name columns on pools
-- - Indexes for city and category filtering
-- ==============================================================================

-- 1. Additive columns to pools for category-agnostic product and variant specifications
ALTER TABLE pools ADD COLUMN product_title TEXT;
ALTER TABLE pools ADD COLUMN variant_name TEXT;

-- 2. Indexes for fast city-wise and category-wise pool lookups
CREATE INDEX IF NOT EXISTS idx_pools_city_cat ON pools(city_slug, category_slug, is_published, status);
CREATE INDEX IF NOT EXISTS idx_pools_city_status ON pools(city_slug, status, is_published);

-- 3. Index for category lookups on pool_requests (using existing category column)
CREATE INDEX IF NOT EXISTS idx_pool_requests_cat ON pool_requests(category, status);
