-- ==============================================================================
-- GroupBuying / PoolBuy India — Cloudflare D1 Additive Migration
-- Migration: 0005_membership_consent_and_integrity.sql
-- Enforces:
-- 1. Explicit membership consent on demand requests (join_pool_consent)
-- 2. Fast duplicate request detection index
-- ==============================================================================

-- 1. Explicit consent column for converting requester to initial confirmed member
ALTER TABLE pool_requests ADD COLUMN join_pool_consent INTEGER NOT NULL DEFAULT 0;

-- 2. Performance and uniqueness checking index for duplicate active demand requests
CREATE INDEX IF NOT EXISTS idx_pool_requests_dup_check ON pool_requests(whatsapp_number, city, status, is_archived);

