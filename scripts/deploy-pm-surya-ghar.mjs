// scripts/deploy-pm-surya-ghar.mjs
import { execSync } from 'node:child_process';

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

function runSql(targetEnv, sql) {
  const flags = targetEnv === 'prod'
    ? '--remote'
    : targetEnv === 'staging'
      ? '--config wrangler.staging.jsonc --remote'
      : '--local';

  // Escape double quotes and newlines for CLI
  const cleanSql = sql.replace(/\r?\n/g, ' ').replace(/"/g, '\\"');
  const cmd = `npx wrangler d1 execute DB ${flags} --command="${cleanSql}"`;
  console.log(`Executing batch on ${targetEnv}...`);
  const output = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'inherit'] });
  return output;
}

async function deploy(targetEnv) {
  console.log(`\n========================================`);
  console.log(`Deploying PM Surya Ghar Solar for home to [${targetEnv}]`);
  console.log(`========================================\n`);

  // 1. Insert Campaign
  const insertCampaignSql = `
    INSERT OR REPLACE INTO campaigns (
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
  `;
  runSql(targetEnv, insertCampaignSql);
  console.log(`Master campaign created.`);

  // 2. Insert Pools 1 city at a time to stay well within Windows command-line length limits
  const batchSize = 1;
  for (let i = 0; i < CITIES.length; i += batchSize) {
    const cityBatch = CITIES.slice(i, i + batchSize);
    let batchSql = '';
    for (const city of cityBatch) {
      const poolId = `pool-${campaign.slug}-${city.slug}`;
      const poolName = campaign.title;
      batchSql += `
        INSERT OR REPLACE INTO pools (
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
    runSql(targetEnv, batchSql);
    console.log(`Inserted batch ${Math.floor(i / batchSize) + 1} (${cityBatch.map(c => c.name).join(', ')})`);
  }

  // 3. Audit log
  const auditSql = `
    INSERT INTO admin_audit_logs (
      id, action, target_type, target_id, admin_identifier, changes_summary, details, created_at
    ) VALUES (
      'audit-' || hex(randomblob(8)),
      'CAMPAIGN_ROLLOUT',
      'CAMPAIGN',
      '${campaign.id}',
      'system-admin',
      'Rolled out PM Surya Ghar Solar for home across all 28 listed cities.',
      '{\\"campaignId\\":\\"${campaign.id}\\",\\"citiesCount\\":${CITIES.length}}',
      datetime('now')
    );
  `;
  runSql(targetEnv, auditSql);
  console.log(`Audit log written.`);

  console.log(`Deployment to [${targetEnv}] completed successfully!`);
}

const target = process.argv[2] || 'local';
deploy(target).catch(err => {
  console.error('Deployment failed:', err);
  process.exit(1);
});
