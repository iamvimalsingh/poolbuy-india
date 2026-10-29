-- Migration 0008: Add pincode and existing_quote to pool_leads and pool_waitlist
-- Additive migration preserving backward compatibility for legacy records with null values

ALTER TABLE pool_leads ADD COLUMN existing_quote TEXT;
ALTER TABLE pool_leads ADD COLUMN pincode TEXT;

-- Backfill pincode from legacy pin_code column where present
UPDATE pool_leads SET pincode = pin_code WHERE pincode IS NULL AND pin_code IS NOT NULL;

-- Also add pincode and existing_quote to waitlist table
ALTER TABLE pool_waitlist ADD COLUMN existing_quote TEXT;
ALTER TABLE pool_waitlist ADD COLUMN pincode TEXT;
UPDATE pool_waitlist SET pincode = pin_code WHERE pincode IS NULL AND pin_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pool_leads_pincode ON pool_leads(pincode);

