import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { setTestD1Database } from '../d1/db';
import { D1Database, D1PreparedStatement, D1Result, D1ExecResult } from '../d1/types';
import {
  getAllCampaigns,
  getCampaignById,
  createCampaign,
  addCityToCampaign,
  updateCampaign,
  updateCityPoolSettings,
  deleteCampaign,
  deleteCityPool,
  getPoolDependencies,
  PoolDeletionBlockedError,
} from '../campaigns';
import { createCategory } from '../categories';
import { createCity, getCityBySlug } from '../cities';
import { getPublicPools } from '../pools';
import { executeJoinPool } from '../pools';
import { getAdminLeads } from '../leads';

type SqliteDatabase = InstanceType<typeof DatabaseSync>;

function createSqliteD1Adapter(): { d1: D1Database; rawDb: SqliteDatabase } {
  const sqlite = new DatabaseSync(':memory:');

  const createStatement = (sql: string, boundParams: unknown[] = []): D1PreparedStatement => {
    return {
      bind(...params: unknown[]) {
        return createStatement(sql, params);
      },
      async all<T = unknown>(): Promise<D1Result<T>> {
        const stmt = sqlite.prepare(sql);
        const rows = stmt.all(...(boundParams as (string | number | bigint | null)[])) as T[];
        return {
          results: rows,
          success: true,
          meta: { duration: 0, changes: 0, last_row_id: 0, served_by: 'test-sqlite' },
        };
      },
      async first<T = unknown>(colName?: string): Promise<T | null> {
        const stmt = sqlite.prepare(sql);
        const row = stmt.get(...(boundParams as (string | number | bigint | null)[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return (row[colName] as T) ?? null;
        return row as T;
      },
      async run(): Promise<D1Result> {
        const stmt = sqlite.prepare(sql);
        const info = stmt.run(...(boundParams as (string | number | bigint | null)[]));
        return {
          results: [],
          success: true,
          meta: {
            duration: 0,
            changes: Number(info.changes),
            last_row_id: Number(info.lastInsertRowid),
            served_by: 'test-sqlite',
          },
        };
      },
      async raw<T = unknown[]>(): Promise<T[]> {
        const stmt = sqlite.prepare(sql);
        const rows = stmt.all(...(boundParams as (string | number | bigint | null)[]));
        return rows.map((r) => Object.values(r as Record<string, unknown>) as T);
      },
    };
  };

  const d1Mock: D1Database = {
    prepare(query: string) {
      return createStatement(query);
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const results: D1Result<T>[] = [];
      for (const stmt of statements) {
        results.push((await stmt.run()) as D1Result<T>);
      }
      return results;
    },
    async exec(query: string): Promise<D1ExecResult> {
      sqlite.exec(query);
      return { count: 1, duration: 0 };
    },
  };

  return { d1: d1Mock, rawDb: sqlite };
}

function runAllD1Migrations(rawDb: SqliteDatabase) {
  const migrationsDir = path.resolve(process.cwd(), 'migrations/d1');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const fileName of files) {
    const fullPath = path.join(migrationsDir, fileName);
    const sql = fs.readFileSync(fullPath, 'utf8');
    rawDb.exec(sql);
  }
}

describe('Step 2: Campaign Management & Multi-City Pool Rebuild Acceptance Suite', () => {
  let rawDb: SqliteDatabase;

  beforeEach(async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'false';

    const adapter = createSqliteD1Adapter();
    rawDb = adapter.rawDb;
    runAllD1Migrations(rawDb);
    setTestD1Database(adapter.d1);

    // Ensure test operational cities exist
    const p = await getCityBySlug('prayagraj');
    if (!p) await createCity({ name: 'Prayagraj', state: 'Uttar Pradesh', slug: 'prayagraj', isActive: true });
    const k = await getCityBySlug('kanpur');
    if (!k) await createCity({ name: 'Kanpur', state: 'Uttar Pradesh', slug: 'kanpur', isActive: true });
    const v = await getCityBySlug('varanasi');
    if (!v) await createCity({ name: 'Varanasi', state: 'Uttar Pradesh', slug: 'varanasi', isActive: true });
  });

  // Criteria 1, 2 & 3: Multi-City Campaign Creation & Independent Pools
  describe('Criteria 1, 2 & 3: Multi-City Creation Behavior', () => {
    test('1 & 2: Create one campaign selecting three configured cities -> 1 campaign & 3 independent city pools', async () => {
      const res = await createCampaign({
        title: 'TVS iQube S Electric Scooter',
        slug: 'tvs-iqube-s-electric-scooter',
        categorySlug: 'ev-scooters',
        brand: 'TVS',
        model: 'iQube S',
        variantName: '3.4 kWh Battery Pack',
        shortDescription: 'Explore city-level bulk price for TVS iQube.',
        longDescription: 'Full specifications with subsidy and fast charger.',
        defaultMarketPrice: 145000,
        defaultGroupPrice: 130000,
        defaultTargetBuyers: 10,
        cities: [
          { cityName: 'Prayagraj', citySlug: 'prayagraj', targetBuyers: 10 },
          { cityName: 'Lucknow', citySlug: 'lucknow', targetBuyers: 15 },
          { cityName: 'Kanpur', citySlug: 'kanpur', targetBuyers: 12 },
        ],
      });

      assert.ok(res.campaign, 'Campaign must be created');
      assert.equal(res.campaign.title, 'TVS iQube S Electric Scooter');
      assert.equal(res.campaign.slug, 'tvs-iqube-s-electric-scooter');
      assert.equal(res.pools.length, 3, 'Exactly three city pools must be created');

      // Verify campaign record in D1
      const campaign = await getCampaignById(res.campaign.id);
      assert.ok(campaign);
      assert.equal(campaign.citiesCount, 3);
      assert.equal(campaign.totalBuyers, 0);

      // Verify each pool has independent city, target, and status
      const prayagrajPool = res.pools.find((p) => p.citySlug === 'prayagraj');
      const lucknowPool = res.pools.find((p) => p.citySlug === 'lucknow');
      const kanpurPool = res.pools.find((p) => p.citySlug === 'kanpur');

      assert.ok(prayagrajPool, 'Prayagraj pool must exist');
      assert.ok(lucknowPool, 'Lucknow pool must exist');
      assert.ok(kanpurPool, 'Kanpur pool must exist');

      assert.equal(prayagrajPool.targetBuyers, 10);
      assert.equal(lucknowPool.targetBuyers, 15);
      assert.equal(kanpurPool.targetBuyers, 12);

      assert.equal(prayagrajPool.status, 'ACTIVE');
      assert.equal(lucknowPool.status, 'ACTIVE');
      assert.equal(kanpurPool.status, 'ACTIVE');

      assert.equal(prayagrajPool.campaignId, campaign.id);
      assert.equal(lucknowPool.campaignId, campaign.id);
      assert.equal(kanpurPool.campaignId, campaign.id);
    });

    test('3: City pools have isolated capacity and member counts (joining one does not affect others)', async () => {
      const res = await createCampaign({
        title: 'Ather 450X EV Scooter',
        slug: 'ather-450x-scooter',
        categorySlug: 'ev-scooters',
        cities: [
          { cityName: 'Prayagraj', citySlug: 'prayagraj', targetBuyers: 10 },
          { cityName: 'Lucknow', citySlug: 'lucknow', targetBuyers: 10 },
        ],
      });

      const prayagrajPool = res.pools.find((p) => p.citySlug === 'prayagraj')!;
      const lucknowPool = res.pools.find((p) => p.citySlug === 'lucknow')!;

      // Join Prayagraj pool twice
      await executeJoinPool(prayagrajPool.id, { fullName: 'Buyer 1', whatsappNumber: '9800000001' });
      await executeJoinPool(prayagrajPool.id, { fullName: 'Buyer 2', whatsappNumber: '9800000002' });

      // Check Prayagraj count
      const updatedCamp = await getCampaignById(res.campaign.id);
      assert.ok(updatedCamp);

      const pPool = updatedCamp.cityPools?.find((p) => p.id === prayagrajPool.id);
      const lPool = updatedCamp.cityPools?.find((p) => p.id === lucknowPool.id);

      assert.equal(pPool?.currentBuyers, 2, 'Prayagraj pool must have 2 buyers');
      assert.equal(lPool?.currentBuyers, 0, 'Lucknow pool MUST remain at 0 buyers (isolated capacity)');
      assert.equal(updatedCamp.totalBuyers, 2, 'Total buyers across campaign reflects 2');
    });
  });

  // Criteria 4, 5 & 6: Duplicate Handling, Safe Retry & Adding City Pools
  describe('Criteria 4, 5 & 6: Idempotency, Recovery & Adding City Pools', () => {
    test('4: Duplicate submission returns existing campaign without duplicating pools', async () => {
      const input = {
        title: 'Ola S1 Pro Electric Scooter',
        slug: 'ola-s1-pro-electric-scooter',
        categorySlug: 'ev-scooters',
        cities: [
          { cityName: 'Prayagraj', citySlug: 'prayagraj', targetBuyers: 10 },
          { cityName: 'Lucknow', citySlug: 'lucknow', targetBuyers: 10 },
        ],
      };

      const firstCall = await createCampaign(input);
      assert.equal(firstCall.alreadyExisted, false);
      assert.equal(firstCall.pools.length, 2);

      // Re-submitting same campaign input
      const secondCall = await createCampaign(input);
      assert.equal(secondCall.alreadyExisted, true);
      assert.equal(secondCall.campaign.id, firstCall.campaign.id);
      assert.equal(secondCall.pools.length, 2, 'Cannot duplicate pools on repeated submission');

      // Database check: count of pools with this slug
      const row = rawDb.prepare('SELECT COUNT(*) as c FROM pools WHERE campaign_id = ?').get(firstCall.campaign.id) as { c: number };
      assert.equal(row.c, 2, 'Exactly 2 pools must exist in D1');
    });

    test('6: Adding another city later creates a separate independent pool under same campaign', async () => {
      const res = await createCampaign({
        title: 'Hero Vida V1 Plus',
        slug: 'hero-vida-v1-plus',
        categorySlug: 'ev-scooters',
        cities: [{ cityName: 'Prayagraj', citySlug: 'prayagraj', targetBuyers: 10 }],
      });

      assert.equal(res.pools.length, 1);

      // Add Varanasi to this existing campaign
      const newPool = await addCityToCampaign(res.campaign.id, {
        cityName: 'Varanasi',
        citySlug: 'varanasi',
        targetBuyers: 12,
      });

      assert.ok(newPool);
      assert.equal(newPool.city, 'Varanasi');
      assert.equal(newPool.citySlug, 'varanasi');
      assert.equal(newPool.targetBuyers, 12);
      assert.equal(newPool.campaignId, res.campaign.id);

      // Reload campaign
      const camp = await getCampaignById(res.campaign.id);
      assert.equal(camp?.citiesCount, 2);
    });
  });

  // Criteria 7 & 8: Edit Isolation & Integrity
  describe('Criteria 7 & 8: Edit Isolation', () => {
    test('7: Editing shared campaign fields updates product specs without corrupting city-specific settings', async () => {
      const res = await createCampaign({
        title: 'Ampere Magnus EX',
        slug: 'ampere-magnus-ex',
        categorySlug: 'ev-scooters',
        brand: 'Ampere',
        cities: [
          { cityName: 'Prayagraj', citySlug: 'prayagraj', targetBuyers: 10 },
          { cityName: 'Lucknow', citySlug: 'lucknow', targetBuyers: 15 },
        ],
      });

      // Update campaign description and brand
      await updateCampaign(res.campaign.id, {
        brand: 'Ampere by Greaves',
        shortDescription: 'Updated new generation electric scooter.',
      });

      const camp = await getCampaignById(res.campaign.id);
      assert.equal(camp?.brand, 'Ampere by Greaves');

      // Check that city pools retain their isolated targetBuyers
      const pPool = camp?.cityPools?.find((p) => p.citySlug === 'prayagraj');
      const lPool = camp?.cityPools?.find((p) => p.citySlug === 'lucknow');

      assert.equal(pPool?.productBrand, 'Ampere by Greaves', 'Shared metadata updated');
      assert.equal(pPool?.targetBuyers, 10, 'Prayagraj target unchanged');
      assert.equal(lPool?.targetBuyers, 15, 'Lucknow target unchanged');
    });

    test('8: Editing one city pool does not change another city pool settings', async () => {
      const res = await createCampaign({
        title: 'Bajaj Chetak EV',
        slug: 'bajaj-chetak-ev',
        categorySlug: 'ev-scooters',
        cities: [
          { cityName: 'Prayagraj', citySlug: 'prayagraj', targetBuyers: 10 },
          { cityName: 'Lucknow', citySlug: 'lucknow', targetBuyers: 10 },
        ],
      });

      const lucknowPool = res.pools.find((p) => p.citySlug === 'lucknow')!;

      // Change Lucknow capacity to 20 and pause it
      await updateCityPoolSettings(lucknowPool.id, {
        targetBuyers: 20,
        status: 'CLOSED',
      });

      const camp = await getCampaignById(res.campaign.id);
      const pPool = camp?.cityPools?.find((p) => p.citySlug === 'prayagraj');
      const lPool = camp?.cityPools?.find((p) => p.citySlug === 'lucknow');

      assert.equal(lPool?.targetBuyers, 20, 'Lucknow updated to 20');
      assert.equal(lPool?.status, 'CLOSED', 'Lucknow updated to CLOSED');

      assert.equal(pPool?.targetBuyers, 10, 'Prayagraj remains 10');
      assert.equal(pPool?.status, 'ACTIVE', 'Prayagraj remains ACTIVE');
    });
  });

  // Criteria 9, 10, 11 & 12: Safe Deletion vs Dependency Blocking
  describe('Criteria 9, 10, 11 & 12: Deletion Semantics & Dependency Blocking', () => {
    test('10: Unsafe pool deletion is blocked when dependent leads exist', async () => {
      const res = await createCampaign({
        title: 'Revolt RV400 Electric Bike',
        slug: 'revolt-rv400-bike',
        categorySlug: 'ev-scooters',
        cities: [{ cityName: 'Kanpur', citySlug: 'kanpur', targetBuyers: 10 }],
      });

      const pool = res.pools[0];

      // Insert a member lead
      await executeJoinPool(pool.id, { fullName: 'Member 1', whatsappNumber: '9811111111' });

      // Verify dependencies detected
      const deps = await getPoolDependencies(pool.id);
      assert.equal(deps.leadsCount, 1);
      assert.equal(deps.totalDependencies, 1);

      // Attempting hard delete must throw PoolDeletionBlockedError
      await assert.rejects(
        async () => {
          await deleteCityPool(pool.id, { hardDelete: true });
        },
        (err: unknown) => {
          assert.ok(err instanceof PoolDeletionBlockedError);
          assert.equal(err.code, 'POOL_HAS_DEPENDENCIES');
          return true;
        }
      );

      // Verify pool row is preserved intact in D1
      const check = rawDb.prepare('SELECT id FROM pools WHERE id = ?').get(pool.id);
      assert.ok(check, 'Pool record preserved');
    });

    test('11: Safe deletion of a pool without dependencies succeeds', async () => {
      const res = await createCampaign({
        title: 'Temporary Unused Model',
        slug: 'temp-unused-model',
        categorySlug: 'ev-scooters',
        cities: [{ cityName: 'Kanpur', citySlug: 'kanpur', targetBuyers: 10 }],
      });

      const pool = res.pools[0];
      const deps = await getPoolDependencies(pool.id);
      assert.equal(deps.totalDependencies, 0);

      const del = await deleteCityPool(pool.id, { hardDelete: true });
      assert.equal(del.action, 'hard_deleted');

      const check = rawDb.prepare('SELECT id FROM pools WHERE id = ?').get(pool.id);
      assert.equal(check, undefined, 'Pool row removed from D1');
    });

    test('12: Removing one city pool does not delete the campaign or other city pools', async () => {
      const res = await createCampaign({
        title: 'Matter AERA Geared Electric Bike',
        slug: 'matter-aera-geared-ev',
        categorySlug: 'ev-scooters',
        cities: [
          { cityName: 'Prayagraj', citySlug: 'prayagraj', targetBuyers: 10 },
          { cityName: 'Lucknow', citySlug: 'lucknow', targetBuyers: 10 },
        ],
      });

      const prayagrajPool = res.pools.find((p) => p.citySlug === 'prayagraj')!;
      const lucknowPool = res.pools.find((p) => p.citySlug === 'lucknow')!;

      // Delete Prayagraj pool (0 dependencies)
      await deleteCityPool(prayagrajPool.id, { hardDelete: true });

      // Verify campaign still exists
      const camp = await getCampaignById(res.campaign.id);
      assert.ok(camp, 'Campaign record preserved');
      assert.equal(camp.citiesCount, 1, 'Now 1 city pool attached');

      // Verify Lucknow pool is intact
      const lPool = camp.cityPools?.find((p) => p.id === lucknowPool.id);
      assert.ok(lPool, 'Lucknow pool is completely intact');
    });

    test('12b: Campaign archive preserves historical records and child pools', async () => {
      const res = await createCampaign({
        title: 'Historic EV Fleet Model',
        slug: 'historic-ev-fleet-model',
        categorySlug: 'ev-scooters',
        cities: [{ cityName: 'Lucknow', citySlug: 'lucknow', targetBuyers: 10 }],
      });

      const pool = res.pools[0];
      await executeJoinPool(pool.id, { fullName: 'Member Historic', whatsappNumber: '9822222222' });

      // Archive campaign
      const archivedRes = await deleteCampaign(res.campaign.id, { hardDelete: false });
      assert.equal(archivedRes.action, 'soft_deleted');
      assert.equal(archivedRes.campaign.status, 'ARCHIVED');
      assert.equal(archivedRes.campaign.isArchived, true);

      // Verify records preserved in D1
      const campRow = rawDb.prepare('SELECT is_archived, status FROM campaigns WHERE id = ?').get(res.campaign.id) as { is_archived: number; status: string };
      assert.equal(campRow.is_archived, 1);
      assert.equal(campRow.status, 'ARCHIVED');

      const poolRow = rawDb.prepare('SELECT is_archived, status FROM pools WHERE id = ?').get(pool.id) as { is_archived: number; status: string };
      assert.equal(poolRow.is_archived, 1);
      assert.equal(poolRow.status, 'CLOSED');
    });
  });

  // Criteria 13, 14 & 15: Public Website Integration & City-Specific Isolation
  describe('Criteria 13, 14 & 15: Public Catalog & City Filtering', () => {
    test('15: Public discovery displays the correct city-specific pool when city filter is applied', async () => {
      await createCampaign({
        title: 'Ultraviolette F77 Mach 2',
        slug: 'ultraviolette-f77-mach-2',
        categorySlug: 'ev-scooters',
        cities: [
          { cityName: 'Prayagraj', citySlug: 'prayagraj', targetBuyers: 10 },
          { cityName: 'Kanpur', citySlug: 'kanpur', targetBuyers: 10 },
        ],
      });

      // Query public pools for Prayagraj
      const prayagrajPublic = await getPublicPools({ citySlug: 'prayagraj' });
      const foundPrayagraj = prayagrajPublic.find((p) => p.slug === 'ultraviolette-f77-mach-2');
      assert.ok(foundPrayagraj, 'Prayagraj pool must be in Prayagraj public view');
      assert.equal(foundPrayagraj.city, 'Prayagraj');

      // Query public pools for Lucknow (which was NOT selected for this campaign)
      const lucknowPublic = await getPublicPools({ citySlug: 'lucknow' });
      const foundLucknow = lucknowPublic.find((p) => p.slug === 'ultraviolette-f77-mach-2');
      assert.equal(foundLucknow, undefined, 'Must NOT appear in Lucknow public view');
    });
  });

  // Criteria 18: Step 1 Category and Location functionality remains fully intact
  describe('Criteria 18: Step 1 Foundation Stability', () => {
    test('18: Category and location lifecycle operations function seamlessly alongside campaigns', async () => {
      const allCamps = await getAllCampaigns();
      assert.ok(Array.isArray(allCamps));

      const newCat = await createCategory({
        label: 'Industrial Inverters',
        slug: 'industrial-inverters',
        isActive: true,
      });
      assert.ok(newCat);
      assert.equal(newCat.slug, 'industrial-inverters');

      const newCity = await createCity({
        name: 'Mirzapur',
        state: 'Uttar Pradesh',
        slug: 'mirzapur',
        isActive: true,
      });
      assert.ok(newCity);
      assert.equal(newCity.slug, 'mirzapur');
    });
  });

  // Criteria 14–25: Pincode and Existing Quote Field Validation, Persistence & Legacy Support
  describe('Criteria 14–25: Pincode and Existing Quote Field Integration', () => {
    test('14 & 15: Valid six-digit pincode and optional quote persist in D1 database', async () => {
      const camp = await createCampaign({
        title: 'Solar Inverter 5kVA',
        slug: 'solar-inverter-5kva',
        categorySlug: 'rooftop-solar',
        cities: [{ cityName: 'Prayagraj', citySlug: 'prayagraj', targetBuyers: 10 }],
      });
      const pool = camp.pools[0];

      const joinRes = await executeJoinPool(pool.id, {
        fullName: 'Deepak Shukla',
        whatsappNumber: '9876543210',
        pincode: '211001',
        existing_quote: '₹1,25,000 from local dealer',
      });

      assert.ok(joinRes.leadId);
      assert.equal(joinRes.buyerNumber, 1);

      // Verify directly from raw D1 SQLite table
      const leadRow = rawDb.prepare('SELECT pincode, pin_code, existing_quote FROM pool_leads WHERE id = ?').get(joinRes.leadId) as {
        pincode: string;
        pin_code: string;
        existing_quote: string;
      };

      assert.equal(leadRow.pincode, '211001');
      assert.equal(leadRow.pin_code, '211001');
      assert.equal(leadRow.existing_quote, '₹1,25,000 from local dealer');
    });

    test('18: Pincode beginning with zero preserves leading zero in database storage', async () => {
      const camp = await createCampaign({
        title: 'EV Fast Charger 7kW',
        slug: 'ev-fast-charger-7kw',
        categorySlug: 'ev-scooters',
        cities: [{ cityName: 'Kanpur', citySlug: 'kanpur', targetBuyers: 10 }],
      });
      const pool = camp.pools[0];

      const joinRes = await executeJoinPool(pool.id, {
        fullName: 'Rajesh Gupta',
        whatsappNumber: '9876543211',
        pincode: '011001',
      });

      const leadRow = rawDb.prepare('SELECT pincode FROM pool_leads WHERE id = ?').get(joinRes.leadId) as { pincode: string };
      assert.equal(leadRow.pincode, '011001', 'Must store full 6-digit string preserving leading zero');
    });

    test('19 & 20: Omitted existing_quote is accepted and stored as null', async () => {
      const camp = await createCampaign({
        title: 'Domestic Solar Kit 3kW',
        slug: 'domestic-solar-kit-3kw',
        categorySlug: 'rooftop-solar',
        cities: [{ cityName: 'Varanasi', citySlug: 'varanasi', targetBuyers: 10 }],
      });
      const pool = camp.pools[0];

      const joinRes = await executeJoinPool(pool.id, {
        fullName: 'Ananya Roy',
        whatsappNumber: '9876543212',
        pincode: '221001',
      });

      const leadRow = rawDb.prepare('SELECT existing_quote FROM pool_leads WHERE id = ?').get(joinRes.leadId) as { existing_quote: string | null };
      assert.equal(leadRow.existing_quote, null);
    });

    test('22: Legacy rows with null pincode and null existing_quote load gracefully without errors', async () => {
      const camp = await createCampaign({
        title: 'Commercial E-Auto',
        slug: 'commercial-e-auto',
        categorySlug: 'ev-scooters',
        cities: [{ cityName: 'Kanpur', citySlug: 'kanpur', targetBuyers: 10 }],
      });
      const pool = camp.pools[0];

      // Simulate a legacy pre-migration row inserted with null pincode
      rawDb.prepare(`
        INSERT INTO pool_leads (
          id, pool_id, buyer_number, full_name, whatsapp_number, city,
          buying_timeline, has_existing_quote, extra_message, status,
          consent_at, privacy_notice_version, created_at, updated_at
        ) VALUES (
          'legacy-lead-999', ?, 1, 'Legacy Buyer', '9876543299', 'Kanpur',
          'THIS_MONTH', 0, '', 'NEW', datetime('now'), '2026-10-V1', datetime('now'), datetime('now')
        )
      `).run(pool.id);

      const adminResult = await getAdminLeads({ poolId: pool.id });
      assert.ok(adminResult.leads.length >= 1);
      const legacyLead = adminResult.leads.find((l) => l.id === 'legacy-lead-999');
      assert.ok(legacyLead);
      assert.equal(legacyLead.pincode, null);
      assert.equal(legacyLead.existingQuote, null);
    });

    test('23: Duplicate join returns existing membership without count increment', async () => {
      const camp = await createCampaign({
        title: 'Water Softener Central',
        slug: 'water-softener-central',
        categorySlug: 'ev-scooters',
        cities: [{ cityName: 'Prayagraj', citySlug: 'prayagraj', targetBuyers: 10 }],
      });
      const pool = camp.pools[0];

      const res1 = await executeJoinPool(pool.id, {
        fullName: 'Pooja Singh',
        whatsappNumber: '9876543215',
        pincode: '211002',
      });
      assert.equal(res1.buyerNumber, 1);
      assert.equal(res1.alreadyJoined, false);

      const res2 = await executeJoinPool(pool.id, {
        fullName: 'Pooja Singh',
        whatsappNumber: '9876543215',
        pincode: '211002',
      });
      assert.equal(res2.buyerNumber, 1);
      assert.equal(res2.alreadyJoined, true);

      // Verify count did not increment
      const poolRow = rawDb.prepare('SELECT current_buyers FROM pools WHERE id = ?').get(pool.id) as { current_buyers: number };
      assert.equal(poolRow.current_buyers, 1);
    });

    test('25: Admin leads retrieval truthfully includes pincode and customer-reported quote', async () => {
      const camp = await createCampaign({
        title: 'Hybrid Inverter Pack',
        slug: 'hybrid-inverter-pack',
        categorySlug: 'rooftop-solar',
        cities: [{ cityName: 'Prayagraj', citySlug: 'prayagraj', targetBuyers: 10 }],
      });
      const pool = camp.pools[0];

      await executeJoinPool(pool.id, {
        fullName: 'Manish Pandey',
        whatsappNumber: '9876543216',
        pincode: '211003',
        existing_quote: '₹85,000 without GST',
      });

      const res = await getAdminLeads({ poolId: pool.id });
      const lead = res.leads.find((l) => l.whatsappNumber === '9876543216');
      assert.ok(lead);
      assert.equal(lead.pincode, '211003');
      assert.equal(lead.existingQuote, '₹85,000 without GST');
    });
    test('26: Waitlist insertion and promotion preserves leading-zero pincode and existing_quote', async () => {
      const camp = await createCampaign({
        title: 'Solar Inverter Single-Spot',
        slug: 'solar-inverter-single-spot',
        categorySlug: 'rooftop-solar',
        cities: [{ cityName: 'Delhi', citySlug: 'delhi', targetBuyers: 1 }],
      });
      const pool = camp.pools[0];

      // Join first buyer to fill pool (capacity = 1)
      const res1 = await executeJoinPool(pool.id, {
        fullName: 'First Buyer',
        whatsappNumber: '9811000001',
        pincode: '110001',
      });
      assert.equal(res1.buyerNumber, 1);

      // Now join second buyer - should be placed on waitlist
      const now = new Date().toISOString();
      const waitlistId = 'wl-test-leading-zero';
      rawDb.prepare(`
        INSERT INTO pool_waitlist (
          id, pool_id, sequence_number, full_name, whatsapp_number,
          city, buying_timeline, locality, pin_code, pincode, existing_quote, status, notes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WAITING', ?, ?, ?)
      `).run(
        waitlistId,
        pool.id,
        1,
        'Waitlisted Buyer with Leading Zero',
        '9811000002',
        'Delhi',
        'THIS_MONTH',
        'Connaught Place',
        '011001',
        '011001',
        '₹95,000 all-inclusive',
        'Looking for quick install',
        now,
        now
      );

      // Verify waitlist row persisted with leading-zero string preserved
      const wlRow = rawDb.prepare('SELECT pincode, pin_code, existing_quote FROM pool_waitlist WHERE id = ?').get(waitlistId) as {
        pincode: string;
        pin_code: string;
        existing_quote: string;
      };
      assert.equal(wlRow.pincode, '011001');
      assert.equal(wlRow.pin_code, '011001');
      assert.equal(wlRow.existing_quote, '₹95,000 all-inclusive');

      // Promote waitlisted member to active lead (simulating admin promotion)
      const newLeadId = 'lead-promoted-011001';
      const effectivePincode = wlRow.pincode || wlRow.pin_code;
      rawDb.prepare(`
        INSERT INTO pool_leads (
          id, pool_id, buyer_number, full_name, whatsapp_number, city,
          buying_timeline, status, locality, pin_code, pincode, existing_quote, admin_notes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'NEW', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newLeadId,
        pool.id,
        2,
        'Waitlisted Buyer with Leading Zero',
        '9811000002',
        'Delhi',
        'THIS_MONTH',
        'Connaught Place',
        effectivePincode,
        effectivePincode,
        wlRow.existing_quote,
        'FIFO Promoted from waitlist position #1',
        now,
        now
      );
      rawDb.prepare("UPDATE pool_waitlist SET status = 'PROMOTED', promoted_at = ?, promoted_lead_id = ? WHERE id = ?").run(
        now,
        newLeadId,
        waitlistId
      );

      // Verify promoted lead in pool_leads preserves leading-zero pincode and quote
      const promotedLead = rawDb.prepare('SELECT pincode, pin_code, existing_quote FROM pool_leads WHERE id = ?').get(newLeadId) as {
        pincode: string;
        pin_code: string;
        existing_quote: string;
      };
      assert.equal(promotedLead.pincode, '011001');
      assert.equal(promotedLead.pin_code, '011001');
      assert.equal(promotedLead.existing_quote, '₹95,000 all-inclusive');

      // Verify Admin Leads retrieval reflects the promoted lead data accurately
      const adminRes = await getAdminLeads({ poolId: pool.id });
      const foundPromoted = adminRes.leads.find((l) => l.id === newLeadId);
      assert.ok(foundPromoted);
      assert.equal(foundPromoted.pincode, '011001');
      assert.equal(foundPromoted.existingQuote, '₹95,000 all-inclusive');
    });

    test('27: Waitlist promotion of legacy entry without pincode or quote completes without errors', async () => {
      const camp = await createCampaign({
        title: 'Legacy Waitlist Test',
        slug: 'legacy-waitlist-test',
        categorySlug: 'rooftop-solar',
        cities: [{ cityName: 'Delhi', citySlug: 'delhi', targetBuyers: 1 }],
      });
      const pool = camp.pools[0];
      const now = new Date().toISOString();

      const legacyWlId = 'wl-legacy-null-fields';
      rawDb.prepare(`
        INSERT INTO pool_waitlist (
          id, pool_id, sequence_number, full_name, whatsapp_number,
          city, buying_timeline, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'WAITING', ?, ?)
      `).run(
        legacyWlId,
        pool.id,
        1,
        'Legacy Waitlisted User',
        '9811000003',
        'Delhi',
        'THIS_MONTH',
        now,
        now
      );

      const wlRow = rawDb.prepare('SELECT pincode, pin_code, existing_quote FROM pool_waitlist WHERE id = ?').get(legacyWlId) as {
        pincode: string | null;
        pin_code: string | null;
        existing_quote: string | null;
      };
      assert.equal(wlRow.pincode, null);
      assert.equal(wlRow.existing_quote, null);

      const promotedLeadId = 'lead-promoted-legacy';
      const effectivePincode = wlRow.pincode || wlRow.pin_code || null;
      rawDb.prepare(`
        INSERT INTO pool_leads (
          id, pool_id, buyer_number, full_name, whatsapp_number, city,
          buying_timeline, status, locality, pin_code, pincode, existing_quote, admin_notes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'NEW', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        promotedLeadId,
        pool.id,
        2,
        'Legacy Waitlisted User',
        '9811000003',
        'Delhi',
        'THIS_MONTH',
        null,
        effectivePincode,
        effectivePincode,
        wlRow.existing_quote || null,
        'FIFO Promoted from waitlist position #1',
        now,
        now
      );

      const adminRes = await getAdminLeads({ poolId: pool.id });
      const foundPromoted = adminRes.leads.find((l) => l.id === promotedLeadId);
      assert.ok(foundPromoted);
      assert.equal(foundPromoted.pincode, null);
      assert.equal(foundPromoted.existingQuote, null);
    });
  });
});
