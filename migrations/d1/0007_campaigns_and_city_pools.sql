-- ==============================================================================
-- GroupBuying / PoolBuy India — Cloudflare D1 Additive Migration
-- Migration: 0007_campaigns_and_city_pools.sql
-- Implements Canonical 1-to-N Campaign to City Pools Architecture:
-- 1. Campaigns table for shared product offers & campaigns across cities
-- 2. campaign_id foreign reference on pools
-- ==============================================================================

-- 1. Campaigns Table (Shared product offers across multiple cities)
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category_slug TEXT NOT NULL,
  category_name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  variant_name TEXT NOT NULL DEFAULT '',
  short_description TEXT NOT NULL DEFAULT '',
  long_description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  default_market_price REAL,
  default_group_price REAL,
  default_target_buyers INTEGER NOT NULL DEFAULT 10,
  default_max_waitlist_size INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED', 'ARCHIVED')),
  is_published INTEGER NOT NULL DEFAULT 1,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_campaigns_slug ON campaigns(slug);
CREATE INDEX IF NOT EXISTS idx_campaigns_cat ON campaigns(category_slug, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status, is_published);

-- 2. Add campaign_id column to pools (nullable for backward-compatibility with standalone pools)
ALTER TABLE pools ADD COLUMN campaign_id TEXT REFERENCES campaigns(id);
CREATE INDEX IF NOT EXISTS idx_pools_campaign_id ON pools(campaign_id);

