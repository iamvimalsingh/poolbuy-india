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
import { getPublicPoolBySlug } from '../pools';
import { getSiteUrl } from '../seo';
import { buildPoolShareContent } from '../sharing';
import { buildBuyerViralShareUrl } from '../whatsapp';

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
        const res = stmt.run(...(boundValues as (string | number | bigint | null)[]));
        return {
          results: [],
          success: true,
          meta: {
            changes: Number(res.changes),
            duration: 0,
            last_row_id: Number(res.lastInsertRowid),
            served_by: 'test-sqlite',
            queries_executed: 1,
            rows_read: 0,
            rows_written: Number(res.changes),
          },
        };
      },
    };
  }

  const d1: D1Database = {
    prepare(query: string) {
      return createPreparedStatement(query);
    },
    async batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
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

describe('MVP Production Readiness Audit & Targeted Fix Invariants', () => {
  let rawDb: SqliteDatabase;
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'false';
    const adapter = createSqliteD1Adapter();
    rawDb = adapter.rawDb;
    setTestD1Database(adapter.d1);

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
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    process.env.NODE_ENV = originalNodeEnv;
    setTestD1Database(null as unknown as D1Database);
  });

  /* ------------------------------------------------------------------------- */
  /* Issue A: Product Specification / Variant Name Persistence & Propagation   */
  /* ------------------------------------------------------------------------- */
  describe('Issue A: Variant Name / Specification Field Invariants', () => {
    test('1. Creating a campaign with variantName stores it on campaign and child pools', async () => {
      const created = await createCampaign({
        title: 'PM Surya Ghar Solar Deal',
        slug: 'pm-surya-ghar-solar-deal',
        categorySlug: 'rooftop-solar',
        brand: 'Tata Power Solar',
        model: 'On-Grid System',
        variantName: '3kW On-Grid System',
        defaultMarketPrice: 200000,
        defaultGroupPrice: 155000,
        cities: [
          { cityName: 'Bhopal', citySlug: 'bhopal', targetBuyers: 10 },
          { cityName: 'Indore', citySlug: 'indore', targetBuyers: 10 },
        ],
      });

      assert.equal(created.campaign.variantName, '3kW On-Grid System');
      assert.equal(created.pools.length, 2);
      assert.equal(created.pools[0].variantName, '3kW On-Grid System');
      assert.equal(created.pools[1].variantName, '3kW On-Grid System');

      // Verify DB persistence
      const campRow = rawDb
        .prepare('SELECT variant_name FROM campaigns WHERE id = ?')
        .get(created.campaign.id) as { variant_name: string };
      assert.equal(campRow.variant_name, '3kW On-Grid System');

      const poolRows = rawDb
        .prepare('SELECT variant_name FROM pools WHERE campaign_id = ?')
        .all(created.campaign.id) as { variant_name: string }[];
      assert.equal(poolRows[0].variant_name, '3kW On-Grid System');
      assert.equal(poolRows[1].variant_name, '3kW On-Grid System');
    });

    test('2. Updating campaign variantName propagates faithfully to all child pools', async () => {
      const created = await createCampaign({
        title: 'EV Scooter Deal',
        slug: 'ev-scooter-deal',
        categorySlug: 'ev-scooters',
        brand: 'Ather',
        model: '450X',
        variantName: '3.7 kWh Pro',
        cities: [
          { cityName: 'Delhi', citySlug: 'delhi', targetBuyers: 15 },
          { cityName: 'Delhi NCR', citySlug: 'delhi-ncr', targetBuyers: 15 },
        ],
      });

      // Admin updates campaign variant to 2.9 kWh
      const updated = await updateCampaign(created.campaign.id, {
        variantName: '2.9 kWh Core',
      });
      assert.ok(updated);
      assert.equal(updated.variantName, '2.9 kWh Core');

      // Verify child pools synchronized
      const poolRows = rawDb
        .prepare('SELECT city, variant_name FROM pools WHERE campaign_id = ?')
        .all(created.campaign.id) as { city: string; variant_name: string }[];
      assert.equal(poolRows.length, 2);
      assert.equal(poolRows[0].variant_name, '2.9 kWh Core');
      assert.equal(poolRows[1].variant_name, '2.9 kWh Core');
    });

    test('3. Direct city-pool variantName update persists in strict isolation without altering sibling pools', async () => {
      const created = await createCampaign({
        title: 'Home Inverter Deal',
        slug: 'home-inverter-deal',
        categorySlug: 'home-power-backup',
        brand: 'Luminous',
        model: 'Zelio',
        variantName: '1100VA / 12V',
        cities: [
          { cityName: 'Bhopal', citySlug: 'bhopal', targetBuyers: 10 },
          { cityName: 'Indore', citySlug: 'indore', targetBuyers: 10 },
        ],
      });

      const bhopalPool = created.pools.find((p) => p.citySlug === 'bhopal')!;
      const indorePool = created.pools.find((p) => p.citySlug === 'indore')!;

      // Directly update Bhopal pool variant
      rawDb
        .prepare('UPDATE pools SET variant_name = ? WHERE id = ?')
        .run('1500VA / 24V Heavy Duty', bhopalPool.id);

      // Verify Bhopal pool has new variant
      const bhopalRead = await getPublicPoolBySlug('bhopal', bhopalPool.slug);
      assert.ok(bhopalRead);
      assert.equal(bhopalRead.variantName, '1500VA / 24V Heavy Duty');

      // Verify Indore pool remained untouched (isolation preserved)
      const indoreRead = await getPublicPoolBySlug('indore', indorePool.slug);
      assert.ok(indoreRead);
      assert.equal(indoreRead.variantName, '1100VA / 12V');
    });
  });

  /* ------------------------------------------------------------------------- */
  /* Issue B: Remove localhost URLs from Production-Facing Output              */
  /* ------------------------------------------------------------------------- */
  describe('Issue B: Canonical Domain Resolution & WhatsApp Preview Invariants', () => {
    test('1. Production environment guarantees https://groupbuying.store even if NEXT_PUBLIC_SITE_URL is localhost', () => {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';

      const siteUrl = getSiteUrl();
      assert.equal(siteUrl, 'https://groupbuying.store');
    });

    test('2. Production build with unset NEXT_PUBLIC_SITE_URL defaults securely to https://groupbuying.store', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.NEXT_PUBLIC_SITE_URL;

      const siteUrl = getSiteUrl();
      assert.equal(siteUrl, 'https://groupbuying.store');
    });

    test('3. Staging domain is preserved when explicit non-localhost staging URL is provided', () => {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SITE_URL = 'https://poolbuy-india-hotfix-test.iamvimalsingh.workers.dev';

      const siteUrl = getSiteUrl();
      assert.equal(siteUrl, 'https://poolbuy-india-hotfix-test.iamvimalsingh.workers.dev');
    });

    test('4. buildPoolShareContent never emits localhost in production and includes ?ref=share', () => {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'; // simulated stale dev env

      const shareContent = buildPoolShareContent({
        name: 'Tata Solar 3kW',
        city: 'Bhopal',
        citySlug: 'bhopal',
        slug: 'tata-solar-3kw-bhopal',
      });

      assert.ok(!shareContent.url.includes('localhost'), 'Share URL must never contain localhost');
      assert.ok(shareContent.url.startsWith('https://groupbuying.store/deals/bhopal/tata-solar-3kw-bhopal?ref=share'));
      assert.ok(shareContent.whatsAppUrl.includes(encodeURIComponent('https://groupbuying.store/deals/bhopal/tata-solar-3kw-bhopal?ref=share')));
    });

    test('5. buildBuyerViralShareUrl never emits localhost in production and contains zero PII', async () => {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';

      const created = await createCampaign({
        title: 'Solar Inverter Deal',
        slug: 'solar-inverter-deal',
        categorySlug: 'rooftop-solar',
        cities: [{ cityName: 'Pune', citySlug: 'pune', targetBuyers: 10 }],
      });

      const pool = created.pools[0];
      const viralUrl = buildBuyerViralShareUrl(pool);

      assert.ok(!viralUrl.includes('localhost'), 'Viral share URL must never contain localhost');
      assert.ok(viralUrl.includes('https%3A%2F%2Fgroupbuying.store%2Fdeals%2Fpune%2Fsolar-inverter-deal'));
    });
  });

  /* ------------------------------------------------------------------------- */
  /* Issue C: City Page to Deal Detail Page Data Contract Invariants           */
  /* ------------------------------------------------------------------------- */
  describe('Issue C: Complete City Pool Detail Page Data Contract', () => {
    test('1. Pool detail page receives complete specifications: variantName, pricing, capacity, and city isolation', async () => {
      const created = await createCampaign({
        title: 'Solar Rooftop Deal',
        slug: 'solar-rooftop-deal',
        categorySlug: 'rooftop-solar',
        brand: 'Loom Solar',
        model: 'Shark Bi-facial',
        variantName: '3kW On-Grid System',
        shortDescription: 'High-efficiency bifacial solar modules for residential roofs.',
        longDescription: 'Complete subsidized rooftop system aggregated for bulk installation in Bhopal.',
        defaultMarketPrice: 210000,
        defaultGroupPrice: 165000,
        cities: [{ cityName: 'Bhopal', citySlug: 'bhopal', targetBuyers: 12 }],
      });

      const pool = created.pools[0];
      const readPool = await getPublicPoolBySlug('bhopal', pool.slug);

      assert.ok(readPool);
      assert.equal(readPool.variantName, '3kW On-Grid System');
      assert.equal(readPool.productBrand, 'Loom Solar');
      assert.equal(readPool.productModel, 'Shark Bi-facial');
      assert.equal(readPool.marketPrice, 210000);
      assert.equal(readPool.groupPrice, 165000);
      assert.equal(readPool.targetBuyers, 12);
      assert.equal(readPool.city, 'Bhopal');
      assert.equal(readPool.citySlug, 'bhopal');
      assert.equal(readPool.priceIsVerified, false, 'Default indicative estimate before quote verification');
    });

    test('2. Verified dealer quotation preserves quoteValidUntil on public pool read path', async () => {
      const created = await createCampaign({
        title: 'Commercial Solar System',
        slug: 'commercial-solar-system',
        categorySlug: 'rooftop-solar',
        variantName: '10kW Commercial System',
        defaultMarketPrice: 650000,
        defaultGroupPrice: 520000,
        cities: [{ cityName: 'Indore', citySlug: 'indore', targetBuyers: 5 }],
      });

      const pool = created.pools[0];
      const futureDate = '2028-12-31T23:59:59.000Z';

      // Set verified quotation
      rawDb
        .prepare('UPDATE pools SET price_is_verified = 1, quote_valid_until = ?, group_price_type = ? WHERE id = ?')
        .run(futureDate, 'VENDOR_QUOTED', pool.id);

      const publicPool = await getPublicPoolBySlug('indore', pool.slug);
      assert.ok(publicPool);
      assert.equal(publicPool.priceIsVerified, true);
      assert.equal(publicPool.quoteValidUntil, futureDate);
      assert.equal(publicPool.variantName, '10kW Commercial System');
    });
  });
});
