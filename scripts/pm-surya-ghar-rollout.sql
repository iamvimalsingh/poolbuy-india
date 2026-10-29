-- ==============================================================================
-- GroupBuying / PoolBuy India — Rollout PM Surya Ghar Solar for home
-- Deletes legacy solar pool(s) and creates campaign + pools across all 28 cities
-- ==============================================================================

-- 1. Clean up old solar pools
DELETE FROM pool_cities WHERE pool_id IN (SELECT id FROM pools WHERE category = 'ROOFTOP_SOLAR' OR category_slug = 'rooftop-solar' OR slug LIKE '%solar%');
DELETE FROM pool_kit_offers WHERE pool_id IN (SELECT id FROM pools WHERE category = 'ROOFTOP_SOLAR' OR category_slug = 'rooftop-solar' OR slug LIKE '%solar%');
DELETE FROM pool_leads WHERE pool_id IN (SELECT id FROM pools WHERE category = 'ROOFTOP_SOLAR' OR category_slug = 'rooftop-solar' OR slug LIKE '%solar%');
DELETE FROM pool_waitlist WHERE pool_id IN (SELECT id FROM pools WHERE category = 'ROOFTOP_SOLAR' OR category_slug = 'rooftop-solar' OR slug LIKE '%solar%');
DELETE FROM pools WHERE category = 'ROOFTOP_SOLAR' OR category_slug = 'rooftop-solar' OR slug LIKE '%solar%';
DELETE FROM campaigns WHERE slug = 'pm-surya-ghar-solar-for-home' OR id = 'camp-pm-surya-ghar-solar-for-home';

-- 2. Insert Master Campaign
INSERT INTO campaigns (
  id, slug, title, category_slug, category_name, brand, model, variant_name,
  short_description, long_description, image_url, default_market_price,
  default_group_price, default_target_buyers, default_max_waitlist_size,
  status, is_published, is_archived, created_at, updated_at
) VALUES (
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home',
  'rooftop-solar',
  'Rooftop Solar',
  'PM Surya Ghar',
  '3kW Residential Solar',
  '3kW On-Grid System',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  50,
  'ACTIVE',
  1,
  0,
  datetime('now'),
  datetime('now')
);

-- 3. Insert Independent City Pools for all 28 Listed Cities

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-ahmedabad',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Ahmedabad)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Ahmedabad',
  'ahmedabad',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-ahmedabad-ahmedabad', 'pool-pm-surya-ghar-solar-for-home-ahmedabad', 'ahmedabad', 'Ahmedabad', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-bengaluru',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Bengaluru)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Bengaluru',
  'bengaluru',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-bengaluru-bengaluru', 'pool-pm-surya-ghar-solar-for-home-bengaluru', 'bengaluru', 'Bengaluru', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-bhopal',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Bhopal)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Bhopal',
  'bhopal',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-bhopal-bhopal', 'pool-pm-surya-ghar-solar-for-home-bhopal', 'bhopal', 'Bhopal', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-bhubaneswar',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Bhubaneswar)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Bhubaneswar',
  'bhubaneswar',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-bhubaneswar-bhubaneswar', 'pool-pm-surya-ghar-solar-for-home-bhubaneswar', 'bhubaneswar', 'Bhubaneswar', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-chandigarh',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Chandigarh)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Chandigarh',
  'chandigarh',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-chandigarh-chandigarh', 'pool-pm-surya-ghar-solar-for-home-chandigarh', 'chandigarh', 'Chandigarh', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-chennai',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Chennai)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Chennai',
  'chennai',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-chennai-chennai', 'pool-pm-surya-ghar-solar-for-home-chennai', 'chennai', 'Chennai', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-coimbatore',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Coimbatore)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Coimbatore',
  'coimbatore',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-coimbatore-coimbatore', 'pool-pm-surya-ghar-solar-for-home-coimbatore', 'coimbatore', 'Coimbatore', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-delhi',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Delhi)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Delhi',
  'delhi',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-delhi-delhi', 'pool-pm-surya-ghar-solar-for-home-delhi', 'delhi', 'Delhi', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-delhi-ncr',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Delhi NCR)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Delhi NCR',
  'delhi-ncr',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-delhi-ncr-delhi-ncr', 'pool-pm-surya-ghar-solar-for-home-delhi-ncr', 'delhi-ncr', 'Delhi NCR', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-gurugram',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Gurugram)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Gurugram',
  'gurugram',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-gurugram-gurugram', 'pool-pm-surya-ghar-solar-for-home-gurugram', 'gurugram', 'Gurugram', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-gwalior',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Gwalior)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Gwalior',
  'gwalior',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-gwalior-gwalior', 'pool-pm-surya-ghar-solar-for-home-gwalior', 'gwalior', 'Gwalior', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-hyderabad',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Hyderabad)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Hyderabad',
  'hyderabad',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-hyderabad-hyderabad', 'pool-pm-surya-ghar-solar-for-home-hyderabad', 'hyderabad', 'Hyderabad', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-indore',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Indore)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Indore',
  'indore',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-indore-indore', 'pool-pm-surya-ghar-solar-for-home-indore', 'indore', 'Indore', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-jabalpur',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Jabalpur)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Jabalpur',
  'jabalpur',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-jabalpur-jabalpur', 'pool-pm-surya-ghar-solar-for-home-jabalpur', 'jabalpur', 'Jabalpur', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-jaipur',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Jaipur)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Jaipur',
  'jaipur',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-jaipur-jaipur', 'pool-pm-surya-ghar-solar-for-home-jaipur', 'jaipur', 'Jaipur', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-kanpur',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Kanpur)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Kanpur',
  'kanpur',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-kanpur-kanpur', 'pool-pm-surya-ghar-solar-for-home-kanpur', 'kanpur', 'Kanpur', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-kochi',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Kochi)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Kochi',
  'kochi',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-kochi-kochi', 'pool-pm-surya-ghar-solar-for-home-kochi', 'kochi', 'Kochi', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-kolkata',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Kolkata)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Kolkata',
  'kolkata',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-kolkata-kolkata', 'pool-pm-surya-ghar-solar-for-home-kolkata', 'kolkata', 'Kolkata', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-lucknow',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Lucknow)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Lucknow',
  'lucknow',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-lucknow-lucknow', 'pool-pm-surya-ghar-solar-for-home-lucknow', 'lucknow', 'Lucknow', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-ludhiana',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Ludhiana)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Ludhiana',
  'ludhiana',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-ludhiana-ludhiana', 'pool-pm-surya-ghar-solar-for-home-ludhiana', 'ludhiana', 'Ludhiana', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-mumbai',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Mumbai)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Mumbai',
  'mumbai',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-mumbai-mumbai', 'pool-pm-surya-ghar-solar-for-home-mumbai', 'mumbai', 'Mumbai', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-nagpur',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Nagpur)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Nagpur',
  'nagpur',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-nagpur-nagpur', 'pool-pm-surya-ghar-solar-for-home-nagpur', 'nagpur', 'Nagpur', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-noida',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Noida)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Noida',
  'noida',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-noida-noida', 'pool-pm-surya-ghar-solar-for-home-noida', 'noida', 'Noida', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-patna',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Patna)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Patna',
  'patna',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-patna-patna', 'pool-pm-surya-ghar-solar-for-home-patna', 'patna', 'Patna', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-pune',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Pune)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Pune',
  'pune',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-pune-pune', 'pool-pm-surya-ghar-solar-for-home-pune', 'pune', 'Pune', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-surat',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Surat)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Surat',
  'surat',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-surat-surat', 'pool-pm-surya-ghar-solar-for-home-surat', 'surat', 'Surat', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-vadodara',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Vadodara)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Vadodara',
  'vadodara',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-vadodara-vadodara', 'pool-pm-surya-ghar-solar-for-home-vadodara', 'vadodara', 'Vadodara', 1, datetime('now'), datetime('now'));

INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  'pool-pm-surya-ghar-solar-for-home-visakhapatnam',
  'camp-pm-surya-ghar-solar-for-home',
  'pm-surya-ghar-solar-for-home',
  'PM Surya Ghar Solar for home (Visakhapatnam)',
  'PM Surya Ghar Solar for home',
  '3kW On-Grid System',
  'ROOFTOP_SOLAR',
  'rooftop-solar',
  'Visakhapatnam',
  'visakhapatnam',
  'PM Surya Ghar',
  '3kW Residential Solar',
  'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  '/images/solar-default.svg',
  180000,
  145000,
  10,
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  50,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-pool-pm-surya-ghar-solar-for-home-visakhapatnam-visakhapatnam', 'pool-pm-surya-ghar-solar-for-home-visakhapatnam', 'visakhapatnam', 'Visakhapatnam', 1, datetime('now'), datetime('now'));

-- 4. Audit Log
INSERT INTO admin_audit_logs (
  id, action, target_type, target_id, admin_identifier, changes_summary, details, created_at
) VALUES (
  'audit-' || hex(randomblob(8)),
  'CAMPAIGN_ROLLOUT',
  'CAMPAIGN',
  'camp-pm-surya-ghar-solar-for-home',
  'system-admin',
  'Rolled out PM Surya Ghar Solar for home across all 28 listed cities, deleting legacy solar pools.',
  '{"campaignId":"camp-pm-surya-ghar-solar-for-home","citiesCount":28}',
  datetime('now')
);
