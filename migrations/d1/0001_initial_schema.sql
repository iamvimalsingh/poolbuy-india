-- ==============================================================================
-- GroupBuying / PoolBuy India — Cloudflare D1 Initial SQLite Schema Migration
-- Migration: 0001_initial_schema.sql
-- ==============================================================================

-- 1. Cities Table (Authoritative operational cities directory)
CREATE TABLE IF NOT EXISTS cities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cities_slug ON cities(slug);
CREATE INDEX IF NOT EXISTS idx_cities_active ON cities(is_active);

-- 2. Categories Table (Dynamic categories directory)
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);

-- 3. Pools Table (Transactional group buying pools)
CREATE TABLE IF NOT EXISTS pools (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  short_description TEXT NOT NULL DEFAULT '',
  long_description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  city TEXT NOT NULL,
  city_slug TEXT NOT NULL,
  product_brand TEXT NOT NULL DEFAULT '',
  product_model TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  market_price REAL,
  group_price REAL,
  target_buyers INTEGER NOT NULL DEFAULT 10,
  current_buyers INTEGER NOT NULL DEFAULT 0,
  deadline TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'UNLOCKED', 'CLOSED', 'ARCHIVED')),
  closure_reason TEXT CHECK (closure_reason IS NULL OR closure_reason IN (
    'TARGET_ACHIEVED', 'AUTO_POOL_EXPIRED', 'OFFER_EXPIRED', 'ADMIN_EXPIRED', 'SUPPLIER_WITHDRAWN', 'MANUAL_CLOSE'
  )),
  closed_at TEXT,
  offer_valid_until TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  price_is_verified INTEGER NOT NULL DEFAULT 0,
  price_verified_at TEXT,
  dealer_name TEXT,
  token_amount REAL,
  token_payment_url TEXT,
  dealer_offer_url TEXT,
  dealer_terms TEXT,
  is_published INTEGER NOT NULL DEFAULT 1,
  market_price_type TEXT NOT NULL DEFAULT 'INDICATIVE_ESTIMATE',
  group_price_type TEXT NOT NULL DEFAULT 'INDICATIVE_ESTIMATE',
  savings_display_approved INTEGER NOT NULL DEFAULT 0,
  target_reached_at TEXT,
  target_reached_acknowledged_at TEXT,
  connection_status TEXT NOT NULL DEFAULT 'NOT_ELIGIBLE',
  payment_config_state TEXT NOT NULL DEFAULT 'DISABLED',
  quote_source TEXT,
  quote_date TEXT,
  quote_valid_until TEXT,
  quote_scope TEXT,
  quote_private_notes TEXT,
  connection_notes TEXT,
  source_request_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT pools_city_slug_unique UNIQUE (city_slug, slug)
);
CREATE INDEX IF NOT EXISTS idx_pools_city_slug ON pools(city_slug);
CREATE INDEX IF NOT EXISTS idx_pools_category ON pools(category);
CREATE INDEX IF NOT EXISTS idx_pools_status_deadline ON pools(status, deadline);
CREATE INDEX IF NOT EXISTS idx_pools_published ON pools(is_published, is_archived, deleted_at);

-- 4. Pool Leads Table (Members and joined buyers)
CREATE TABLE IF NOT EXISTS pool_leads (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES pools(id) ON DELETE RESTRICT,
  buyer_number INTEGER NOT NULL,
  full_name TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  city TEXT NOT NULL,
  buying_timeline TEXT NOT NULL DEFAULT 'THIS_MONTH',
  has_existing_quote INTEGER NOT NULL DEFAULT 0,
  existing_quote_amount REAL,
  extra_message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'NEW',
  consent_at TEXT NOT NULL DEFAULT (datetime('now')),
  privacy_notice_version TEXT NOT NULL DEFAULT '2026-10-V3',
  selected_kit_offer_id TEXT,
  selected_kit_name TEXT,
  connection_opt_in INTEGER NOT NULL DEFAULT 0,
  vendor_share_consent INTEGER NOT NULL DEFAULT 0,
  locality TEXT,
  pin_code TEXT,
  admin_notes TEXT,
  do_not_contact INTEGER NOT NULL DEFAULT 0,
  contact_preference TEXT DEFAULT 'WHATSAPP',
  quote_response TEXT,
  quote_response_notes TEXT,
  quote_response_recorded_at TEXT,
  fee_status TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
  fee_rule_version TEXT,
  fee_approved_basis REAL,
  fee_calculated_amount REAL,
  fee_disclosed_amount REAL,
  fee_disclosed_at TEXT,
  payment_reference TEXT,
  payment_reported_at TEXT,
  payment_verified_by TEXT,
  payment_verified_at TEXT,
  payment_waiver_reason TEXT,
  member_connection_status TEXT NOT NULL DEFAULT 'NOT_READY',
  connection_date TEXT,
  connection_method TEXT,
  exclusion_reason TEXT,
  excluded_at TEXT,
  last_contact_at TEXT,
  last_contact_status TEXT,
  last_contact_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT pool_leads_pool_whatsapp_unique UNIQUE (pool_id, whatsapp_number)
);
CREATE INDEX IF NOT EXISTS idx_pool_leads_pool_buyer ON pool_leads(pool_id, buyer_number);
CREATE INDEX IF NOT EXISTS idx_pool_leads_whatsapp ON pool_leads(whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_pool_leads_status ON pool_leads(status);

-- 5. Pool Waitlist Table (FIFO Waitlist when target capacity reached)
CREATE TABLE IF NOT EXISTS pool_waitlist (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES pools(id) ON DELETE RESTRICT,
  sequence_number INTEGER NOT NULL,
  full_name TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  city TEXT NOT NULL,
  buying_timeline TEXT,
  locality TEXT,
  pin_code TEXT,
  status TEXT NOT NULL DEFAULT 'WAITING' CHECK (status IN (
    'WAITING', 'INVITED', 'ACCEPTED_PROMOTION', 'DECLINED', 'EXPIRED', 'PROMOTED', 'REMOVED'
  )),
  invited_at TEXT,
  invitation_expires_at TEXT,
  response_at TEXT,
  promoted_at TEXT,
  promoted_lead_id TEXT REFERENCES pool_leads(id),
  removal_reason TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT pool_waitlist_unique_buyer UNIQUE (pool_id, whatsapp_number)
);
CREATE INDEX IF NOT EXISTS idx_pool_waitlist_pool_seq ON pool_waitlist(pool_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_pool_waitlist_status ON pool_waitlist(status, created_at);

-- 6. Pool Quotations Table (Vendor quotation lifecycle and audit)
CREATE TABLE IF NOT EXISTS pool_quotations (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES pools(id) ON DELETE RESTRICT,
  price_type TEXT NOT NULL DEFAULT 'VENDOR_QUOTED',
  vendor_name TEXT NOT NULL,
  vendor_contact_ref TEXT,
  quoted_amount REAL NOT NULL CHECK (quoted_amount > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  quote_date TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  scope TEXT NOT NULL,
  inclusions TEXT NOT NULL DEFAULT '[]',
  exclusions TEXT NOT NULL DEFAULT '[]',
  delivery_terms TEXT,
  quantity_condition TEXT,
  status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (status IN (
    'NOT_REQUESTED', 'REQUESTED', 'RECEIVED', 'PUBLISHED', 'EXPIRED', 'WITHDRAWN'
  )),
  is_current_published INTEGER NOT NULL DEFAULT 0,
  verified_by_admin TEXT,
  verified_at TEXT,
  internal_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pool_quotations_pool ON pool_quotations(pool_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pool_quotations_status ON pool_quotations(status, is_current_published);

-- 7. Pool Demand Requests Table (Public discovery requests & proposal conversion)
CREATE TABLE IF NOT EXISTS pool_requests (
  id TEXT PRIMARY KEY,
  product_name TEXT NOT NULL,
  category TEXT,
  category_name TEXT,
  brand_preference TEXT,
  model_preference TEXT,
  city TEXT NOT NULL,
  state TEXT,
  locality TEXT,
  pin_code TEXT,
  requirements_summary TEXT,
  target_buyers_requested INTEGER DEFAULT 10,
  requested_deadline TEXT,
  contact_consent INTEGER NOT NULL DEFAULT 1,
  consent_at TEXT NOT NULL DEFAULT (datetime('now')),
  request_type TEXT DEFAULT 'GROUP_PROPOSAL',
  full_name TEXT,
  whatsapp_number TEXT,
  extra_message TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'REQUESTED',
  admin_notes TEXT DEFAULT '',
  resulting_pool_id TEXT REFERENCES pools(id),
  conversion_status TEXT DEFAULT 'PENDING',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pool_requests_status ON pool_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_pool_requests_city ON pool_requests(city);

-- 8. Admin Audit Logs Table (Administrative accountability and mutation history)
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  admin_identifier TEXT NOT NULL,
  changes_summary TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON admin_audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON admin_audit_logs(created_at);

-- 9. Blog CMS Posts Table (Published articles, SEO metadata, reading times)
CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  author TEXT NOT NULL,
  topic TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  cover_image_url TEXT,
  cover_image_alt TEXT,
  meta_title TEXT,
  meta_description TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  published_at TEXT,
  sources TEXT DEFAULT '[]',
  editorial_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status, published_at);

-- ==============================================================================
-- 10. Baseline Reference / Catalog Seed Data (Verified categories and operational cities)
-- ==============================================================================

-- Verified Categories
INSERT OR IGNORE INTO categories (id, slug, label, description, is_active, sort_order) VALUES
  ('cat-ev-scooters', 'ev-scooters', 'Electric Scooters', 'Verified group buying pools for high-range electric 2-wheelers.', 1, 1),
  ('cat-cars', 'cars', 'Cars & SUVs', 'Collective purchasing pools for family cars and electric passenger vehicles.', 1, 2),
  ('cat-rooftop-solar', 'rooftop-solar', 'Rooftop Solar', 'Residential and society group orders for PM Surya Ghar rooftop solar setups.', 1, 3),
  ('cat-home-power-backup', 'home-power-backup', 'Home Power Backup', 'Inverter and battery storage systems for round-the-clock home backup.', 1, 4),
  ('cat-water-softeners', 'water-softeners', 'Water Softeners', 'Whole-house and apartment hard-water softening solutions.', 1, 5),
  ('cat-laptops', 'laptops', 'Laptops & Workstations', 'Bulk purchasing for developer, engineering, and enterprise work machines.', 1, 6),
  ('cat-smart-tvs', 'smart-tvs', 'Smart TVs & Displays', 'Large 4K screens and home entertainment group purchasing.', 1, 7),
  ('cat-tractors-commercial', 'tractors-commercial', 'Tractors & Commercial Equipment', 'Commercial machinery and agricultural equipment collective orders.', 1, 8);

-- Verified Active Operational Cities
INSERT OR IGNORE INTO cities (id, name, slug, state, is_active) VALUES
  ('city-bhopal', 'Bhopal', 'bhopal', 'Madhya Pradesh', 1),
  ('city-indore', 'Indore', 'indore', 'Madhya Pradesh', 1),
  ('city-jabalpur', 'Jabalpur', 'jabalpur', 'Madhya Pradesh', 1),
  ('city-gwalior', 'Gwalior', 'gwalior', 'Madhya Pradesh', 1),
  ('city-pune', 'Pune', 'pune', 'Maharashtra', 1),
  ('city-bengaluru', 'Bengaluru', 'bengaluru', 'Karnataka', 1),
  ('city-delhi-ncr', 'Delhi NCR', 'delhi-ncr', 'Delhi', 1),
  ('city-jaipur', 'Jaipur', 'jaipur', 'Rajasthan', 1),
  ('city-lucknow', 'Lucknow', 'lucknow', 'Uttar Pradesh', 1),
  ('city-ahmedabad', 'Ahmedabad', 'ahmedabad', 'Gujarat', 1);
