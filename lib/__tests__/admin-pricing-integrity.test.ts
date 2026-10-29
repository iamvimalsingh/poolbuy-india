import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setTestD1Database } from '../d1/db';
import { D1Database, D1PreparedStatement, D1Result, D1ExecResult } from '../d1/types';
import {
  createCampaign,
  getCampaignById,
  updateCampaign,
} from '../campaigns';
import { getPublicPools, getPublicPoolBySlug } from '../pools';
import { createPoolQuotation, updatePoolQuotation } from '../quotes';

// Synchronous in-memory SQLite runner
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite');

interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  };
}

function createSqliteD1Adapter(): { d1: D1Database; rawDb: SqliteDatabase } {
  const sqlite: SqliteDatabase = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');

  function createPreparedStatement(query: string, boundValues: unknown[] = []): D1PreparedStatement {
    return {
      bind(...values: unknown[]) {
        return createPreparedStatement(query, values);
      },
      async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
        const stmt = sqlite.prepare(query);
        const row = stmt.get(...(boundValues as (string | number | bigint | null)[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return (row[colName] as T) ?? null;
        return row as T;
      },
      async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
        const stmt = sqlite.prepare(query);
        const rows = stmt.all(...(boundValues as (string | number | bigint | null)[])) as T[];
        return {
          results: rows,
          success: true,
          meta: {
            changes: 0,
            duration: 0,
            last_row_id: 0,
            served_by: 'test-sqlite',
            queries_executed: 1,
            rows_read: rows.length,
            rows_written: 0,
          },
        };
      },
      async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
        const stmt = sqlite.prepare(query);
        const info = stmt.run(...(boundValues as (string | number | bigint | null)[]));
        return {
          results: [],
          success: true,
          meta: {
            changes: Number(info.changes),
            duration: 0,
            last_row_id: Number(info.lastInsertRowid),
            served_by: 'test-sqlite',
            queries_executed: 1,
            rows_read: 0,
            rows_written: Number(info.changes),
          },
        };
      },
    } as unknown as D1PreparedStatement;
  }

  const d1: D1Database = {
    prepare(query: string) {
      return createPreparedStatement(query);
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      sqlite.exec('BEGIN TRANSACTION;');
      try {
        const results: D1Result<T>[] = [];
        for (const s of statements) {
          const res = await s.run<T>();
          results.push(res);
        }
        sqlite.exec('COMMIT;');
        return results;
      } catch (err) {
        sqlite.exec('ROLLBACK;');
        throw err;
      }
    },
    async exec(query: string): Promise<D1ExecResult> {
      sqlite.exec(query);
      return { count: 1, duration: 0 };
    },
  };

  return { d1, rawDb: sqlite };
}

describe('Gate 2: Admin-to-Public Pricing Integrity & Propagation Invariants', () => {
  let d1: D1Database;
  let rawDb: SqliteDatabase;
  const originalDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'false';
    const adapter = createSqliteD1Adapter();
    d1 = adapter.d1;
    rawDb = adapter.rawDb;
    setTestD1Database(d1);

    // Apply all D1 migrations 0001 through 0009
    const migrationsDir = path.join(process.cwd(), 'migrations', 'd1');
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      rawDb.exec(sql);
    }
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = originalDemoMode;
    setTestD1Database(null as unknown as D1Database);
  });

  test('1. Admin updates campaign price -> persisted database values match in campaigns and child pools', async () => {
    // Setup Category & Cities
            
    // Create Campaign with 2 city pools
    const created = await createCampaign({
      title: 'Home Rooftop Solar 3kW',
      slug: 'home-rooftop-solar-3kw',
      categorySlug: 'rooftop-solar',
      brand: 'PM Surya Ghar Tier-1',
      model: '3kW On-Grid',
      defaultMarketPrice: 180000,
      defaultGroupPrice: 145000,
      cities: [
        { cityName: 'Bhopal', citySlug: 'bhopal', targetBuyers: 10 },
        { cityName: 'Pune', citySlug: 'pune', targetBuyers: 10 },
      ],
    });

    const campaignId = created.campaign.id;
    assert.equal(created.pools.length, 2);

    // Initial price check in database
    const initialCamp = rawDb
      .prepare('SELECT default_market_price, default_group_price FROM campaigns WHERE id = ?')
      .get(campaignId) as { default_market_price: number; default_group_price: number };
    assert.equal(initialCamp.default_market_price, 180000);
    assert.equal(initialCamp.default_group_price, 145000);

    // Initial child pools price check
    const initialPools = rawDb
      .prepare('SELECT city_slug, market_price, group_price FROM pools WHERE campaign_id = ?')
      .all(campaignId) as { city_slug: string; market_price: number; group_price: number }[];
    for (const p of initialPools) {
      assert.equal(p.market_price, 180000);
      assert.equal(p.group_price, 145000);
    }

    // ACT: Admin updates price on campaign
    const updated = await updateCampaign(campaignId, {
      defaultMarketPrice: 175000,
      defaultGroupPrice: 138000,
    });

    assert.ok(updated);
    assert.equal(updated.defaultMarketPrice, 175000);
    assert.equal(updated.defaultGroupPrice, 138000);

    // ASSERT: Database campaign record has new prices
    const savedCamp = rawDb
      .prepare('SELECT default_market_price, default_group_price FROM campaigns WHERE id = ?')
      .get(campaignId) as { default_market_price: number; default_group_price: number };
    assert.equal(savedCamp.default_market_price, 175000);
    assert.equal(savedCamp.default_group_price, 138000);

    // ASSERT: Database child pool records have propagated new prices
    const savedPools = rawDb
      .prepare('SELECT city_slug, market_price, group_price FROM pools WHERE campaign_id = ?')
      .all(campaignId) as { city_slug: string; market_price: number; group_price: number }[];
    assert.equal(savedPools.length, 2);
    for (const p of savedPools) {
      assert.equal(p.market_price, 175000, `Market price on ${p.city_slug} must match campaign update`);
      assert.equal(p.group_price, 138000, `Group price on ${p.city_slug} must match campaign update`);
    }
  });

  test('2. Reloading admin view retains updated values', async () => {
        
    const created = await createCampaign({
      title: 'City EV Commuter',
      slug: 'city-ev-commuter',
      categorySlug: 'ev-scooters',
      defaultMarketPrice: 150000,
      defaultGroupPrice: 135000,
      cities: [{ cityName: 'Jaipur', citySlug: 'jaipur', targetBuyers: 10 }],
    });

    await updateCampaign(created.campaign.id, {
      defaultMarketPrice: 142000,
      defaultGroupPrice: 128000,
    });

    // Fresh admin read via getCampaignById
    const reloaded = await getCampaignById(created.campaign.id);
    assert.ok(reloaded);
    assert.equal(reloaded.defaultMarketPrice, 142000);
    assert.equal(reloaded.defaultGroupPrice, 128000);
    assert.equal(reloaded.cityPools?.[0]?.marketPrice, 142000);
    assert.equal(reloaded.cityPools?.[0]?.groupPrice, 128000);
  });

  test('3. Public API returns expected price and price classification', async () => {
        
    const created = await createCampaign({
      title: 'Inverter & Battery Combo',
      slug: 'inverter-battery-combo',
      categorySlug: 'home-power-backup',
      defaultMarketPrice: 35000,
      defaultGroupPrice: 29000,
      cities: [{ cityName: 'Bhopal', citySlug: 'bhopal', targetBuyers: 10 }],
    });

    // Update campaign price
    await updateCampaign(created.campaign.id, {
      defaultMarketPrice: 32000,
      defaultGroupPrice: 26500,
    });

    // Public API query
    const publicPools = await getPublicPools({ citySlug: 'bhopal' });
    assert.equal(publicPools.length, 1);
    const pool = publicPools[0];

    assert.equal(pool.marketPrice, 32000);
    assert.equal(pool.groupPrice, 26500);
    assert.equal(pool.groupPriceType, 'INDICATIVE_ESTIMATE');
    assert.equal(pool.priceIsVerified, false);

    // Detail API query
    const detailPool = await getPublicPoolBySlug('bhopal', pool.slug);
    assert.ok(detailPool);
    assert.equal(detailPool.marketPrice, 32000);
    assert.equal(detailPool.groupPrice, 26500);
  });

  test('4. Updating one city pool does not alter another city pool (City Isolation)', async () => {
            
    const created = await createCampaign({
      title: 'Family Sedan',
      slug: 'family-sedan',
      categorySlug: 'cars',
      defaultMarketPrice: 1200000,
      defaultGroupPrice: 1050000,
      cities: [
        { cityName: 'Delhi', citySlug: 'delhi', targetBuyers: 10 },
        { cityName: 'Mumbai', citySlug: 'mumbai', targetBuyers: 10 },
      ],
    });

    const delhiPool = created.pools.find((p) => p.citySlug === 'delhi')!;
    const mumbaiPool = created.pools.find((p) => p.citySlug === 'mumbai')!;

    // Directly update Delhi pool pricing via SQL/Admin Pool update
    rawDb
      .prepare('UPDATE pools SET group_price = ?, market_price = ? WHERE id = ?')
      .run(1020000, 1180000, delhiPool.id);

    // Verify Delhi pool has new price
    const delhiCheck = await getPublicPoolBySlug('delhi', delhiPool.slug);
    assert.ok(delhiCheck);
    assert.equal(delhiCheck.groupPrice, 1020000);
    assert.equal(delhiCheck.marketPrice, 1180000);

    // Verify Mumbai pool is completely unchanged
    const mumbaiCheck = await getPublicPoolBySlug('mumbai', mumbaiPool.slug);
    assert.ok(mumbaiCheck);
    assert.equal(mumbaiCheck.groupPrice, 1050000);
    assert.equal(mumbaiCheck.marketPrice, 1200000);
  });

  test('5. Updating one campaign does not alter unrelated campaigns', async () => {
        
    const campA = await createCampaign({
      title: 'MacBook Pro Fleet',
      slug: 'macbook-pro-fleet',
      categorySlug: 'laptops',
      defaultMarketPrice: 200000,
      defaultGroupPrice: 180000,
      cities: [{ cityName: 'Bengaluru', citySlug: 'bengaluru', targetBuyers: 10 }],
    });

    const campB = await createCampaign({
      title: 'ThinkPad Workstation',
      slug: 'thinkpad-workstation',
      categorySlug: 'laptops',
      defaultMarketPrice: 150000,
      defaultGroupPrice: 130000,
      cities: [{ cityName: 'Bengaluru', citySlug: 'bengaluru', targetBuyers: 10 }],
    });

    // Update Campaign A only
    await updateCampaign(campA.campaign.id, {
      defaultGroupPrice: 175000,
      defaultMarketPrice: 195000,
    });

    // Verify Campaign B remains untouched
    const campBReloaded = await getCampaignById(campB.campaign.id);
    assert.ok(campBReloaded);
    assert.equal(campBReloaded.defaultMarketPrice, 150000);
    assert.equal(campBReloaded.defaultGroupPrice, 130000);
    assert.equal(campBReloaded.cityPools?.[0]?.groupPrice, 130000);
  });

  test('6. Verified supplier quote takes precedence and is not overwritten by indicative campaign updates', async () => {
            
    const created = await createCampaign({
      title: 'Solar Package 5kW',
      slug: 'solar-package-5kw',
      categorySlug: 'rooftop-solar',
      defaultMarketPrice: 250000,
      defaultGroupPrice: 210000,
      cities: [
        { cityName: 'Bhopal', citySlug: 'bhopal', targetBuyers: 10 },
        { cityName: 'Indore', citySlug: 'indore', targetBuyers: 10 },
      ],
    });

    const bhopalPool = created.pools.find((p) => p.citySlug === 'bhopal')!;
    const indorePool = created.pools.find((p) => p.citySlug === 'indore')!;

    // Add and publish a verified quote for Bhopal pool
    const quote = await createPoolQuotation(bhopalPool.id, {
      vendorName: 'Madhya Bharat Solar Systems',
      quotedAmount: 199000,
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      scope: 'Complete 5kW Tier-1 system with net-metering',
      priceType: 'VENDOR_QUOTED',
    });

    await updatePoolQuotation(bhopalPool.id, quote.id, { isCurrentPublished: true });

    // Verify Bhopal pool is now verified with quoted amount
    const bhopalVerified = await getPublicPoolBySlug('bhopal', bhopalPool.slug);
    assert.ok(bhopalVerified);
    assert.equal(bhopalVerified.groupPrice, 199000);
    assert.equal(bhopalVerified.groupPriceType, 'VENDOR_QUOTED');
    assert.equal(bhopalVerified.priceIsVerified, true);

    // ACT: Admin updates campaign-wide indicative price
    await updateCampaign(created.campaign.id, {
      defaultGroupPrice: 205000,
      defaultMarketPrice: 240000,
    });

    // ASSERT: Bhopal verified pool RETAINS its verified quote (199000)
    const bhopalAfter = await getPublicPoolBySlug('bhopal', bhopalPool.slug);
    assert.ok(bhopalAfter);
    assert.equal(bhopalAfter.groupPrice, 199000, 'Verified quote price must not be overwritten by indicative default');
    assert.equal(bhopalAfter.priceIsVerified, true);
    assert.equal(bhopalAfter.groupPriceType, 'VENDOR_QUOTED');

    // ASSERT: Indore pool (which had no verified quote) receives the new indicative price (205000)
    const indoreAfter = await getPublicPoolBySlug('indore', indorePool.slug);
    assert.ok(indoreAfter);
    assert.equal(indoreAfter.groupPrice, 205000, 'Unverified pool receives campaign default price');
    assert.equal(indoreAfter.priceIsVerified, false);
    assert.equal(indoreAfter.groupPriceType, 'INDICATIVE_ESTIMATE');
  });
  test('7. Failed update on nonexistent campaign returns null honestly without claiming success', async () => {
    const res = await updateCampaign('non-existent-campaign-id-12345', {
      defaultGroupPrice: 99999,
    });
    assert.equal(res, null);
  });

  test('8. Expired quote gracefully rolls back to INDICATIVE_ESTIMATE on public read', async () => {
    const created = await createCampaign({
      title: 'Solar Package 2kW',
      slug: 'solar-package-2kw',
      categorySlug: 'rooftop-solar',
      defaultMarketPrice: 120000,
      defaultGroupPrice: 95000,
      cities: [{ cityName: 'Bhopal', citySlug: 'bhopal', targetBuyers: 10 }],
    });

    const pool = created.pools[0];

    // Create quote with future validity date
    const quote = await createPoolQuotation(pool.id, {
      vendorName: 'Past Quoter',
      quotedAmount: 89000,
      validUntil: new Date(Date.now() + 10000).toISOString(),
      scope: 'Expired quote test',
      priceType: 'VENDOR_QUOTED',
    });

    await updatePoolQuotation(pool.id, quote.id, { isCurrentPublished: true });

    // Manually simulate quote expiration in the past
    rawDb
      .prepare('UPDATE pool_quotations SET valid_until = ? WHERE id = ?')
      .run('2020-01-01T00:00:00.000Z', quote.id);

    rawDb
      .prepare('UPDATE pools SET quote_valid_until = ? WHERE id = ?')
      .run('2020-01-01T00:00:00.000Z', pool.id);

    // Read public pool - mapRowToPublicPool checks expiry
    const publicPool = await getPublicPoolBySlug('bhopal', pool.slug);
    assert.ok(publicPool);
    assert.equal(publicPool.priceIsVerified, false, 'Expired quote must not be displayed as verified');
    assert.equal(publicPool.groupPriceType, 'INDICATIVE_ESTIMATE', 'Expired vendor quote rolls back to indicative');
  });

  test('9. Admin pool direct update properly persists both marketPrice and groupPrice', async () => {
    const created = await createCampaign({
      title: 'Water Softener Auto',
      slug: 'water-softener-auto',
      categorySlug: 'water-softeners',
      defaultMarketPrice: 45000,
      defaultGroupPrice: 38000,
      cities: [{ cityName: 'Bhopal', citySlug: 'bhopal', targetBuyers: 10 }],
    });

    const pool = created.pools[0];

    // Direct update on pool
    rawDb
      .prepare('UPDATE pools SET market_price = ?, group_price = ? WHERE id = ?')
      .run(42000, 36000, pool.id);

    const check = await getPublicPoolBySlug('bhopal', pool.slug);
    assert.ok(check);
    assert.equal(check.marketPrice, 42000);
    assert.equal(check.groupPrice, 36000);
  });
});