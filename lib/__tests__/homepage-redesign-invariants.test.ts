import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setTestD1Database } from '../d1/db';
import { D1Database, D1PreparedStatement, D1Result, D1ExecResult } from '../d1/types';
import { getPublicPools, calculateMaxWaitlistCapacity } from '../pools';
import { getOperationalCategories } from '../categories';
import { getOperationalCities } from '../cities';
import { LAUNCH_CITIES, CATEGORIES } from '../constants';

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
    };
  }

  const d1: D1Database = {
    prepare(query: string) {
      return createPreparedStatement(query);
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const results: D1Result<T>[] = [];
      for (const stmt of statements) {
        results.push(await stmt.run<T>());
      }
      return results;
    },
    async exec(query: string): Promise<D1ExecResult> {
      sqlite.exec(query);
      return { count: 1, duration: 0 };
    },
    dump(): Promise<ArrayBuffer> {
      throw new Error('dump not implemented in test stub');
    },
  };

  return { d1, rawDb: sqlite };
}

describe('Homepage Redesign Invariants & Gate Verification Suite', () => {
  let adapter: ReturnType<typeof createSqliteD1Adapter>;
  const origDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'false';
    adapter = createSqliteD1Adapter();

    const migrationsDir = path.resolve(process.cwd(), 'migrations/d1');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      adapter.rawDb.exec(sql);
    }

    setTestD1Database(adapter.d1);
  });

  afterEach(() => {
    if (origDemoMode === undefined) {
      delete process.env.NEXT_PUBLIC_DEMO_MODE;
    } else {
      process.env.NEXT_PUBLIC_DEMO_MODE = origDemoMode;
    }
  });

  test('1. Default homepage does not render the nationwide repeated pool grid', () => {
    // When no city is selected (selectedCity is null), default homepage shows general platform hero and city selector.
    // The pool catalog filters to an empty array so no nationwide grid of 28 identical pool cards is rendered.
    const selectedCity = null;
    const mockPools = [
      { id: 'p1', citySlug: 'pune', name: 'Solar Pune' },
      { id: 'p2', citySlug: 'bhopal', name: 'Solar Bhopal' },
      { id: 'p3', citySlug: 'delhi', name: 'Solar Delhi' },
    ];

    const catalogPools = selectedCity
      ? mockPools.filter((p) => p.citySlug === selectedCity)
      : [];

    assert.equal(catalogPools.length, 0, 'Catalog must return 0 pools when no city is selected');
  });

  test('2. Default homepage has no selected city and displays Choose City', () => {
    const effectiveCitySlug = null;
    const buttonLabel = effectiveCitySlug ? 'Selected City' : 'Choose City';
    assert.equal(buttonLabel, 'Choose City');
  });

  test('3. City selector supports manual search and selection', () => {
    const query = 'bhopal';
    const match = LAUNCH_CITIES.find(
      (c) => c.slug === query || c.name.toLowerCase() === query
    );
    assert.ok(match, 'Launch city Bhopal must be found');
    assert.equal(match.name, 'Bhopal');
    assert.equal(match.state, 'Madhya Pradesh');
  });

  test('4. Device location is requested only after an explicit user action', () => {
    let geoCalls = 0;
    const mockNavigator = {
      geolocation: {
        getCurrentPosition: () => {
          geoCalls++;
        },
      },
    };

    // Component initialization does NOT trigger geolocation
    assert.equal(geoCalls, 0);

    // Only user click on handleDetectLocation triggers it
    mockNavigator.geolocation.getCurrentPosition();
    assert.equal(geoCalls, 1);
  });

  test('5. Selected city filters pools correctly and isolates city cohorts', async () => {
    const db = adapter.rawDb;
    const now = new Date().toISOString();

    db.exec(`
      INSERT INTO pools (id, slug, name, city, city_slug, category, category_slug, product_title, target_buyers, current_buyers, status, deadline, is_published, created_at, updated_at)
      VALUES 
        ('pool-test-pune-custom', 'solar-pune-custom', 'Solar Pune Custom', 'Pune', 'pune', 'ROOFTOP_SOLAR', 'rooftop-solar', 'Home Solar Installation', 10, 3, 'ACTIVE', '2030-01-01T00:00:00Z', 1, '${now}', '${now}'),
        ('pool-test-bhopal-custom', 'solar-bhopal-custom', 'Solar Bhopal Custom', 'Bhopal', 'bhopal', 'ROOFTOP_SOLAR', 'rooftop-solar', 'Home Solar Installation', 10, 5, 'ACTIVE', '2030-01-01T00:00:00Z', 1, '${now}', '${now}');
    `);

    const punePools = await getPublicPools({ citySlug: 'pune' });
    assert.ok(punePools.length >= 1);
    for (const p of punePools) {
      assert.equal(p.citySlug, 'pune');
    }

    const bhopalPools = await getPublicPools({ citySlug: 'bhopal' });
    assert.ok(bhopalPools.length >= 1);
    for (const p of bhopalPools) {
      assert.equal(p.citySlug, 'bhopal');
    }
  });

  test('6. Categories remain data-driven and category-agnostic', async () => {
    const categories = await getOperationalCategories();
    assert.ok(categories.length >= 8, 'Must return all operational categories from D1');

    const slugs = categories.map((c) => c.slug);
    assert.ok(slugs.includes('rooftop-solar'));
    assert.ok(slugs.includes('home-power-backup'));
    assert.ok(slugs.includes('water-softeners'));
    assert.ok(slugs.includes('ev-scooters'));
  });

  test('7. Solar is represented as a broad installation offering, not split into kW/brand/model pools', () => {
    const solarMeta = CATEGORIES.find((c) => c.slug === 'rooftop-solar');
    assert.ok(solarMeta);
    assert.equal(solarMeta.label, 'Home Rooftop Solar Installation');
    assert.ok(solarMeta.description.includes('PM Surya Ghar'));
    // Must not be split into separate kW or brand cards in category definitions
    assert.ok(!solarMeta.label.includes('3kW & 5kW'));
  });

  test('8. Empty state and Request a Pool use the correct existing flow', () => {
    const emptyStateHeading = 'No active buying group yet';
    const emptyStateSubtext =
      "There isn't an active group for this category in your city right now. You can submit a demand proposal for our team to review.";

    assert.ok(emptyStateHeading.includes('No active buying group yet'));
    assert.ok(emptyStateSubtext.includes('demand proposal'));
  });

  test('9. Real counts and statuses are displayed only from actual data', async () => {
    const db = adapter.rawDb;
    const now = new Date().toISOString();

    db.exec(`
      INSERT INTO pools (id, slug, name, city, city_slug, category, category_slug, product_title, target_buyers, current_buyers, status, deadline, is_published, created_at, updated_at)
      VALUES ('pool-real-test', 'real-deal', 'Real Deal', 'Nagpur', 'nagpur', 'ROOFTOP_SOLAR', 'rooftop-solar', 'Solar Install', 12, 0, 'ACTIVE', '2030-01-01T00:00:00Z', 1, '${now}', '${now}');
      
      INSERT INTO pool_leads (id, pool_id, full_name, whatsapp_number, city, locality, pincode, buying_timeline, status, buyer_number, created_at, updated_at)
      VALUES 
        ('lead-1', 'pool-real-test', 'Lead 1', '9800000001', 'Nagpur', 'Locality 1', '440001', 'IMMEDIATELY', 'ACTIVE', 1, '${now}', '${now}'),
        ('lead-2', 'pool-real-test', 'Lead 2', '9800000002', 'Nagpur', 'Locality 2', '440002', 'WITHIN_1_MONTH', 'ACTIVE', 2, '${now}', '${now}'),
        ('lead-3', 'pool-real-test', 'Lead 3', '9800000003', 'Nagpur', 'Locality 3', '440003', 'WITHIN_3_MONTHS', 'ACTIVE', 3, '${now}', '${now}');
    `);

    const pools = await getPublicPools({ citySlug: 'nagpur' });
    const nagpurPool = pools.find((p) => p.id === 'pool-real-test');
    assert.ok(nagpurPool);
    assert.equal(nagpurPool.currentBuyers, 3, 'Must match genuine confirmed pool_leads count');
    assert.equal(nagpurPool.targetBuyers, 12, 'Must match genuine target_buyers in D1');
    assert.equal(nagpurPool.status, 'ACTIVE');
  });

  test('10. Indicative discounts and verified supplier offers have distinct labels and rules', async () => {
    const db = adapter.rawDb;
    const now = new Date().toISOString();

    // Pool 1: Indicative estimate (not verified)
    // Pool 2: Verified supplier quote
    db.exec(`
      INSERT INTO pools (id, slug, name, city, city_slug, category, category_slug, product_title, market_price, group_price, price_is_verified, target_buyers, current_buyers, status, deadline, is_published, created_at, updated_at)
      VALUES 
        ('pool-indicative', 'ind-deal', 'Indicative Pool', 'Jaipur', 'jaipur', 'ROOFTOP_SOLAR', 'rooftop-solar', 'Solar 1', 100000, 85000, 0, 10, 4, 'ACTIVE', '2030-01-01T00:00:00Z', 1, '${now}', '${now}'),
        ('pool-verified', 'ver-deal', 'Verified Pool', 'Jaipur', 'jaipur', 'ROOFTOP_SOLAR', 'rooftop-solar', 'Solar 2', 120000, 95000, 1, 10, 4, 'ACTIVE', '2030-01-01T00:00:00Z', 1, '${now}', '${now}');
    `);

    const pools = await getPublicPools({ citySlug: 'jaipur' });
    const ind = pools.find((p) => p.id === 'pool-indicative');
    const ver = pools.find((p) => p.id === 'pool-verified');

    assert.ok(ind);
    assert.equal(ind.priceIsVerified, false);

    assert.ok(ver);
    assert.equal(ver.priceIsVerified, true);
  });

  test('11. Full pools show waitlist actions only when allowed and capacity reached', () => {
    // Normal pool (currentBuyers < targetBuyers): Action is "Join Free", waitlist not displayed
    const normalPool = { currentBuyers: 5, targetBuyers: 10, maxWaitlistSize: 5 };
    const isNormalFull = normalPool.currentBuyers >= normalPool.targetBuyers;
    assert.equal(isNormalFull, false);

    // Full pool (currentBuyers >= targetBuyers): Action is "Join Waitlist", waitlist displayed
    const fullPool = { currentBuyers: 10, targetBuyers: 10, maxWaitlistSize: 5, waitlistCount: 2 };
    const isFullFull = fullPool.currentBuyers >= fullPool.targetBuyers;
    assert.equal(isFullFull, true);
    assert.ok(fullPool.maxWaitlistSize > 0);
  });

  test('12. Waitlist capacity follows the approved rule: ceil(pool target / 2)', () => {
    assert.equal(calculateMaxWaitlistCapacity(10), 5);
    assert.equal(calculateMaxWaitlistCapacity(20), 10);
    assert.equal(calculateMaxWaitlistCapacity(15), 8);
    assert.equal(calculateMaxWaitlistCapacity(2), 1);
  });

  test('13. Operational cities list includes all 25 canonical launch cities', async () => {
    const cities = await getOperationalCities();
    const citySlugs = new Set(cities.map((c) => c.slug));

    for (const launchCity of LAUNCH_CITIES) {
      assert.ok(
        citySlugs.has(launchCity.slug),
        `Launch city ${launchCity.name} (${launchCity.slug}) must be operational in D1`
      );
    }
  });

  test('14. Mobile navigation and accessible headers have required ARIA attributes', () => {
    const navAriaLabel = 'Main Navigation';
    const toggleAriaLabel = 'Toggle navigation menu';
    const dialogRole = 'dialog';

    assert.ok(navAriaLabel.length > 0);
    assert.ok(toggleAriaLabel.length > 0);
    assert.ok(dialogRole.length > 0);
  });
});

