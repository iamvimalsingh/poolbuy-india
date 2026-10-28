-- ==============================================================================
-- GroupBuying / PoolBuy India — Cloudflare D1 Additive Migration
-- Migration: 0002_add_variants_and_capacity_limits.sql
-- ==============================================================================

-- 1. Predefined Brand-Kit Packages & Pool Variants Table
CREATE TABLE IF NOT EXISTS pool_kit_offers (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  inclusions TEXT NOT NULL DEFAULT '[]',
  exclusions TEXT NOT NULL DEFAULT '[]',
  warranty TEXT NOT NULL DEFAULT '',
  market_price REAL NOT NULL,
  group_price REAL NOT NULL,
  subsidy_estimate REAL,
  subsidy_disclaimer TEXT,
  target_buyers INTEGER NOT NULL DEFAULT 10,
  current_buyers INTEGER NOT NULL DEFAULT 0,
  is_available INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pool_kit_offers_pool ON pool_kit_offers(pool_id, sort_order);

-- 2. Add max_waitlist_size to pools
ALTER TABLE pools ADD COLUMN max_waitlist_size INTEGER NOT NULL DEFAULT 50;

-- 3. Add explicit communication and WhatsApp group consent fields to pool_leads
ALTER TABLE pool_leads ADD COLUMN connection_preference TEXT DEFAULT 'INDIVIDUAL_INTRO';
ALTER TABLE pool_leads ADD COLUMN group_privacy_acknowledged INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pool_leads ADD COLUMN selected_variant_id TEXT;
ALTER TABLE pool_leads ADD COLUMN selected_variant_name TEXT;

