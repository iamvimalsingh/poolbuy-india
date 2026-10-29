// scripts/generate-pm-surya-ghar-sql.mjs
import fs from 'node:fs';

const CITIES = [
  { name: 'Ahmedabad', slug: 'ahmedabad' },
  { name: 'Bengaluru', slug: 'bengaluru' },
  { name: 'Bhopal', slug: 'bhopal' },
  { name: 'Bhubaneswar', slug: 'bhubaneswar' },
  { name: 'Chandigarh', slug: 'chandigarh' },
  { name: 'Chennai', slug: 'chennai' },
  { name: 'Coimbatore', slug: 'coimbatore' },
  { name: 'Delhi', slug: 'delhi' },
  { name: 'Delhi NCR', slug: 'delhi-ncr' },
  { name: 'Gurugram', slug: 'gurugram' },
  { name: 'Gwalior', slug: 'gwalior' },
  { name: 'Hyderabad', slug: 'hyderabad' },
  { name: 'Indore', slug: 'indore' },
  { name: 'Jabalpur', slug: 'jabalpur' },
  { name: 'Jaipur', slug: 'jaipur' },
  { name: 'Kanpur', slug: 'kanpur' },
  { name: 'Kochi', slug: 'kochi' },
  { name: 'Kolkata', slug: 'kolkata' },
  { name: 'Lucknow', slug: 'lucknow' },
  { name: 'Ludhiana', slug: 'ludhiana' },
  { name: 'Mumbai', slug: 'mumbai' },
  { name: 'Nagpur', slug: 'nagpur' },
  { name: 'Noida', slug: 'noida' },
  { name: 'Patna', slug: 'patna' },
  { name: 'Pune', slug: 'pune' },
  { name: 'Surat', slug: 'surat' },
  { name: 'Vadodara', slug: 'vadodara' },
  { name: 'Visakhapatnam', slug: 'visakhapatnam' },
];

const campaign = {
  id: 'camp-pm-surya-ghar-solar-for-home',
  slug: 'pm-surya-ghar-solar-for-home',
  title: 'PM Surya Ghar Solar for home',
  categorySlug: 'rooftop-solar',
  categoryName: 'Rooftop Solar',
  brand: 'PM Surya Ghar',
  model: '3kW Residential Solar',
  variantName: '3kW On-Grid System',
  shortDescription: 'Residential rooftop solar setup under PM Surya Ghar Muft Bijli Yojana with collective bulk discount.',
  longDescription: 'Join the community group buying pool for PM Surya Ghar rooftop solar systems. Aggregate demand across your city to unlock verified bulk supplier pricing, subsidy assistance, and Tier-1 solar equipment.',
  imageUrl: '/images/solar-default.svg',
  defaultMarketPrice: 180000,
  defaultGroupPrice: 145000,
  defaultTargetBuyers: 10,
  defaultMaxWaitlistSize: 50,
  status: 'ACTIVE',
  isPublished: 1,
};

let sql = `-- ==============================================================================
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
  '${campaign.id}',
  '${campaign.slug}',
  '${campaign.title}',
  '${campaign.categorySlug}',
  '${campaign.categoryName}',
  '${campaign.brand}',
  '${campaign.model}',
  '${campaign.variantName}',
  '${campaign.shortDescription}',
  '${campaign.longDescription}',
  '${campaign.imageUrl}',
  ${campaign.defaultMarketPrice},
  ${campaign.defaultGroupPrice},
  ${campaign.defaultTargetBuyers},
  ${campaign.defaultMaxWaitlistSize},
  '${campaign.status}',
  ${campaign.isPublished},
  0,
  datetime('now'),
  datetime('now')
);

-- 3. Insert Independent City Pools for all 28 Listed Cities
`;

for (const city of CITIES) {
  const poolId = `pool-${campaign.slug}-${city.slug}`;
  const poolName = `${campaign.title} (${city.name})`;
  sql += `
INSERT INTO pools (
  id, campaign_id, slug, name, product_title, variant_name, category, category_slug,
  city, city_slug, product_brand, product_model, short_description, long_description,
  image_url, market_price, group_price, target_buyers, current_buyers, deadline,
  status, is_published, price_is_verified, market_price_type, group_price_type,
  connection_status, payment_config_state, max_waitlist_size, created_at, updated_at
) VALUES (
  '${poolId}',
  '${campaign.id}',
  '${campaign.slug}',
  '${poolName}',
  '${campaign.title}',
  '${campaign.variantName}',
  'ROOFTOP_SOLAR',
  '${campaign.categorySlug}',
  '${city.name}',
  '${city.slug}',
  '${campaign.brand}',
  '${campaign.model}',
  '${campaign.shortDescription}',
  '${campaign.longDescription}',
  '${campaign.imageUrl}',
  ${campaign.defaultMarketPrice},
  ${campaign.defaultGroupPrice},
  ${campaign.defaultTargetBuyers},
  0,
  datetime('now', '+30 days'),
  'ACTIVE',
  1,
  0,
  'INDICATIVE_ESTIMATE',
  'INDICATIVE_ESTIMATE',
  'NOT_ELIGIBLE',
  'DISABLED',
  ${campaign.defaultMaxWaitlistSize},
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at)
VALUES ('pc-${poolId}-${city.slug}', '${poolId}', '${city.slug}', '${city.name}', 1, datetime('now'), datetime('now'));
`;
}

sql += `
-- 4. Audit Log
INSERT INTO admin_audit_logs (
  id, action, target_type, target_id, admin_identifier, changes_summary, details, created_at
) VALUES (
  'audit-' || hex(randomblob(8)),
  'CAMPAIGN_ROLLOUT',
  'CAMPAIGN',
  '${campaign.id}',
  'system-admin',
  'Rolled out PM Surya Ghar Solar for home across all 28 listed cities, deleting legacy solar pools.',
  '{"campaignId":"${campaign.id}","citiesCount":${CITIES.length}}',
  datetime('now')
);
`;

fs.writeFileSync('scripts/pm-surya-ghar-rollout.sql', sql);
console.log('Successfully generated scripts/pm-surya-ghar-rollout.sql with 28 city pools!');
