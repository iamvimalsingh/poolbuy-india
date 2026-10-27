-- ==============================================================================
-- POOLBUY INDIA — MIGRATION 20261026000005: POOL LIFECYCLE & EXPIRY
-- Implements Phase F Authoritative Requirements:
-- 1. Pool closure reasons and lifecycle timestamps (closed_at, offer_valid_until)
-- 2. Soft-delete (deleted_at) and archive (is_archived) columns
-- 3. Idempotent process_pool_expiry() RPC for scheduler and automated lifecycle
-- 4. Rebuilds public_pools view to filter out archived and soft-deleted records
-- 5. Hard delete prevention trigger when leads exist
-- ==============================================================================

-- 1. Add lifecycle columns to pools table
ALTER TABLE pools
  ADD COLUMN IF NOT EXISTS closure_reason TEXT CHECK (
    closure_reason IS NULL OR closure_reason IN (
      'ADMIN_CLOSED',
      'AUTO_POOL_EXPIRED',
      'ADMIN_EXPIRED',
      'AUTO_OFFER_EXPIRED',
      'OFFER_EXPIRED',
      'VENDOR_UNAVAILABLE',
      'SUPPLIER_WITHDRAWN',
      'TARGET_ACHIEVED',
      'MANUAL_CLOSE',
      'OTHER'
    )
  ),
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offer_valid_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Indexes for efficient lifecycle and query enforcement
CREATE INDEX IF NOT EXISTS idx_pools_lifecycle_active_deadline 
  ON pools(status, deadline) 
  WHERE status = 'ACTIVE' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pools_lifecycle_archived_deleted 
  ON pools(is_archived, deleted_at);

-- 3. Prevent hard delete if associated leads exist
CREATE OR REPLACE FUNCTION check_pool_hard_delete_allowed()
RETURNS TRIGGER AS $$
DECLARE
  v_lead_count INT;
BEGIN
  SELECT COUNT(*) INTO v_lead_count FROM public.pool_leads WHERE pool_id = OLD.id;
  IF v_lead_count > 0 THEN
    RAISE EXCEPTION 'CANNOT_HARD_DELETE_POOL_WITH_LEADS: Pool % has % recorded buyer leads. Use soft-delete (deleted_at) or archive instead.', OLD.id, v_lead_count;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_pool_hard_delete ON pools;
CREATE TRIGGER trg_prevent_pool_hard_delete
  BEFORE DELETE ON pools
  FOR EACH ROW
  EXECUTE FUNCTION check_pool_hard_delete_allowed();

-- 4. Idempotent pool expiry processor for cron scheduler and RPC
CREATE OR REPLACE FUNCTION process_pool_expiry()
RETURNS JSON AS $$
DECLARE
  v_expired_deadline_count INT := 0;
  v_expired_offer_count INT := 0;
BEGIN
  -- Mark pools expired by deadline
  WITH expired_pools AS (
    UPDATE pools
    SET 
      status = 'CLOSED',
      closure_reason = 'AUTO_POOL_EXPIRED',
      closed_at = COALESCE(closed_at, NOW()),
      updated_at = NOW()
    WHERE status = 'ACTIVE'
      AND deadline < NOW()
      AND deleted_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_expired_deadline_count FROM expired_pools;

  -- Mark pools expired by vendor offer expiry date
  WITH expired_offers AS (
    UPDATE pools
    SET 
      status = 'CLOSED',
      closure_reason = 'OFFER_EXPIRED',
      closed_at = COALESCE(closed_at, NOW()),
      updated_at = NOW()
    WHERE status = 'ACTIVE'
      AND offer_valid_until IS NOT NULL
      AND offer_valid_until < NOW()
      AND deleted_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_expired_offer_count FROM expired_offers;

  RETURN json_build_object(
    'success', true,
    'timestamp', NOW(),
    'expiredByDeadlineCount', v_expired_deadline_count,
    'expiredByOfferCount', v_expired_offer_count,
    'totalClosedCount', v_expired_deadline_count + v_expired_offer_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Recreate public_pools view to respect archive, soft delete, and query enforcement
DROP VIEW IF EXISTS public_pools;
CREATE VIEW public_pools AS
SELECT 
  id,
  slug,
  name,
  short_description,
  long_description,
  category,
  category_slug,
  city,
  city_slug,
  product_brand,
  product_model,
  image_url,
  market_price,
  group_price,
  target_buyers,
  current_buyers,
  deadline,
  status,
  closure_reason,
  closed_at,
  offer_valid_until,
  price_is_verified,
  price_verified_at,
  created_at,
  updated_at
FROM pools
WHERE is_archived = FALSE
  AND deleted_at IS NULL;

COMMENT ON VIEW public_pools IS 'Authoritative public view of non-archived, non-deleted buying pools.';
