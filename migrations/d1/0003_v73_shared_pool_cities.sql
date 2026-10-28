-- ==============================================================================
-- GroupBuying / PoolBuy India — Cloudflare D1 Additive Migration
-- Migration: 0003_v73_shared_pool_cities.sql
-- Implements Simple MVP v7.3 Shared Pool Model:
-- - One pool master with multiple city visibility labels (pool_cities)
-- - Shared cohort and global active/waitlist capacity across all cities
-- - Soft archive columns for pool_requests
-- ==============================================================================

-- 1. Pool City Visibility Mapping Table
CREATE TABLE IF NOT EXISTS pool_cities (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  city_code TEXT NOT NULL,
  city_name TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT pool_cities_unique UNIQUE (pool_id, city_code)
);
CREATE INDEX IF NOT EXISTS idx_pool_cities_city ON pool_cities(city_code, is_enabled);
CREATE INDEX IF NOT EXISTS idx_pool_cities_pool ON pool_cities(pool_id);

-- 2. Additive columns to pools for category flexibility
ALTER TABLE pools ADD COLUMN category_slug TEXT;
ALTER TABLE pools ADD COLUMN internal_category_id TEXT;

-- 3. Additive columns to pool_requests for soft-archive and free-text locations
ALTER TABLE pool_requests ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pool_requests ADD COLUMN archived_at TEXT;
ALTER TABLE pool_requests ADD COLUMN city_text TEXT;
ALTER TABLE pool_requests ADD COLUMN state_text TEXT;

-- 4. Safe backfill for existing pools into pool_cities (if any exist)
INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
SELECT
  'pc-' || id || '-' || city_slug,
  id,
  city_slug,
  city,
  1,
  created_at,
  updated_at
FROM pools
WHERE city_slug IS NOT NULL AND city_slug != '';

