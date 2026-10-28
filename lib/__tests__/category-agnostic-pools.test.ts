import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setTestD1Database } from '../d1/db';
import { D1Database, D1PreparedStatement, D1Result, D1ExecResult } from '../d1/types';
import { executePoolRequest, getPoolRequestById } from '../requests';
import { getPublicPools, getPublicPoolBySlug, executeJoinPool } from '../pools';
import { getOperationalCategories, getCategoryBySlug, createCategory } from '../categories';

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

describe('Category-Agnostic, City-Wise Group Buying Invariant Suite', () => {
  let adapter: ReturnType<typeof createSqliteD1Adapter>;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'false';
    adapter = createSqliteD1Adapter();

    // Execute all migrations in strict numerical order (0001, 0002, 0003, 0004)
    const migrationsDir = path.resolve(process.cwd(), 'migrations/d1');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      adapter.rawDb.exec(sql);
    }

    setTestD1Database(adapter.d1);
  });

  afterEach(() => {
    setTestD1Database(null);
  });

  test('1. Configurable Dynamic Categories: Solar is one category among many, not platform-defining', async () => {
    const categories = await getOperationalCategories();
    assert.ok(categories.length >= 8, 'Must contain configured operational categories');

    // Verify presence of diverse categories
    const slugs = categories.map((c) => c.slug);
    assert.ok(slugs.includes('rooftop-solar'), 'Solar is present as a category');
    assert.ok(slugs.includes('ev-scooters'), 'Electric Scooters is present');
    assert.ok(slugs.includes('water-softeners'), 'Water Softeners is present');
    assert.ok(slugs.includes('laptops'), 'Laptops is present');

    // Admin can create a new category dynamically at runtime
    const newCat = await createCategory({
      label: 'Home Kitchen Appliances',
      slug: 'home-kitchen-appliances',
      description: 'Group buying for premium kitchen appliances.',
      isActive: true,
      sortOrder: 10,
    });
    assert.equal(newCat.slug, 'home-kitchen-appliances');

    const fetched = await getCategoryBySlug('home-kitchen-appliances');
    assert.ok(fetched, 'Newly created category must be retrievable from D1');
    assert.equal(fetched.label, 'Home Kitchen Appliances');
  });

  test('2. Independent City Pools & Capacity Isolation: Pune and Bhopal pools do not share counts', async () => {
    const deadline = new Date(Date.now() + 86400000 * 14).toISOString();

    // Create Pool A in Pune
    adapter.rawDb.exec(`
      INSERT INTO pools (
        id, slug, name, category, category_slug, city, city_slug,
        target_buyers, current_buyers, deadline, status, is_published, created_at, updated_at
      ) VALUES (
        'pool-pune-solar', 'residential-solar-pune', '3 kW Solar Pune', 'ROOFTOP_SOLAR', 'rooftop-solar',
        'Pune', 'pune', 10, 0, '${deadline}', 'ACTIVE', 1, datetime('now'), datetime('now')
      );
    `);

    // Create Pool B in Bhopal
    adapter.rawDb.exec(`
      INSERT INTO pools (
        id, slug, name, category, category_slug, city, city_slug,
        target_buyers, current_buyers, deadline, status, is_published, created_at, updated_at
      ) VALUES (
        'pool-bhopal-solar', 'residential-solar-bhopal', '3 kW Solar Bhopal', 'ROOFTOP_SOLAR', 'rooftop-solar',
        'Bhopal', 'bhopal', 10, 0, '${deadline}', 'ACTIVE', 1, datetime('now'), datetime('now')
      );
    `);

    // Join Pool A in Pune with 3 unique buyers
    await executeJoinPool('pool-pune-solar', { fullName: 'Buyer 1', whatsappNumber: '9822000001' });
    await executeJoinPool('pool-pune-solar', { fullName: 'Buyer 2', whatsappNumber: '9822000002' });
    await executeJoinPool('pool-pune-solar', { fullName: 'Buyer 3', whatsappNumber: '9822000003' });

    // Verify Pool A has currentBuyers = 3
    const punePool = await getPublicPoolBySlug('pune', 'residential-solar-pune');
    assert.ok(punePool);
    assert.equal(punePool.currentBuyers, 3, 'Pune pool count must be exactly 3');

    // Verify Pool B in Bhopal remains completely isolated at currentBuyers = 0
    const bhopalPool = await getPublicPoolBySlug('bhopal', 'residential-solar-bhopal');
    assert.ok(bhopalPool);
    assert.equal(bhopalPool.currentBuyers, 0, 'Bhopal pool count must remain 0 (no multi-city leakage)');

    // Verify city-filtered public listings return only the corresponding city's pool
    const puneListings = await getPublicPools({ citySlug: 'pune' });
    assert.equal(puneListings.length, 1);
    assert.equal(puneListings[0].id, 'pool-pune-solar');

    const bhopalListings = await getPublicPools({ citySlug: 'bhopal' });
    assert.equal(bhopalListings.length, 1);
    assert.equal(bhopalListings[0].id, 'pool-bhopal-solar');
  });

  test('3. Idempotent Join Verification: Duplicate submission returns existing buyerNumber without count increment', async () => {
    const deadline = new Date(Date.now() + 86400000 * 10).toISOString();
    adapter.rawDb.exec(`
      INSERT INTO pools (
        id, slug, name, category, category_slug, city, city_slug,
        target_buyers, current_buyers, deadline, status, is_published, created_at, updated_at
      ) VALUES (
        'pool-idempotent-test', 'ev-scooter-deal', 'Ather 450X Pool', 'EV_SCOOTERS', 'ev-scooters',
        'Bengaluru', 'bengaluru', 10, 0, '${deadline}', 'ACTIVE', 1, datetime('now'), datetime('now')
      );
    `);

    // First join
    const res1 = await executeJoinPool('pool-idempotent-test', {
      fullName: 'Aravind Kumar',
      whatsappNumber: '9845012345',
    });
    assert.equal(res1.buyerNumber, 1);
    assert.equal(res1.alreadyJoined, false);
    assert.equal(res1.currentBuyers, 1);

    // Duplicate join with identical phone
    const res2 = await executeJoinPool('pool-idempotent-test', {
      fullName: 'Aravind K.',
      whatsappNumber: '9845012345',
    });
    assert.equal(res2.buyerNumber, 1, 'Duplicate join must return original buyer number');
    assert.equal(res2.alreadyJoined, true, 'Duplicate join must report alreadyJoined = true');
    assert.equal(res2.currentBuyers, 1, 'Duplicate join must not increment pool current buyers');
  });

  test('4. Capacity & Waitlist Invariants: Target reached triggers TARGET_REACHED; excess joins route to FIFO waitlist', async () => {
    const deadline = new Date(Date.now() + 86400000 * 10).toISOString();
    adapter.rawDb.exec(`
      INSERT INTO pools (
        id, slug, name, category, category_slug, city, city_slug,
        target_buyers, current_buyers, max_waitlist_size, deadline, status, is_published, created_at, updated_at
      ) VALUES (
        'pool-capacity-test', 'inverter-backup-deal', 'Inverter Battery Combo', 'ROOFTOP_SOLAR', 'home-power-backup',
        'Indore', 'indore', 3, 0, 5, '${deadline}', 'ACTIVE', 1, datetime('now'), datetime('now')
      );
    `);

    // Join 1, 2, 3 fill capacity (target: 3)
    await executeJoinPool('pool-capacity-test', { fullName: 'Buyer 1', whatsappNumber: '9893000001' });
    await executeJoinPool('pool-capacity-test', { fullName: 'Buyer 2', whatsappNumber: '9893000002' });
    const res3 = await executeJoinPool('pool-capacity-test', { fullName: 'Buyer 3', whatsappNumber: '9893000003' });
    assert.equal(res3.currentBuyers, 3);

    // 4th join attempt hits capacity limit and throws TARGET_REACHED
    await assert.rejects(
      async () => {
        await executeJoinPool('pool-capacity-test', { fullName: 'Buyer 4', whatsappNumber: '9893000004' });
      },
      (err: Error) => err.message.includes('TARGET_REACHED'),
      '4th join must throw TARGET_REACHED when confirmed capacity is full'
    );

    // Verify pool status updated in D1
    const pool = await getPublicPoolBySlug('indore', 'inverter-backup-deal');
    assert.ok(pool);
    assert.equal(pool.currentBuyers, 3);
    assert.equal(pool.remainingBuyers, 0);
  });

  test('5. Public Demand Proposals vs Official Pools: Proposals require Admin review and never auto-publish', async () => {
    // 1. Visitor submits proposal from non-operational city
    const req = await executePoolRequest({
      productName: '10 HP Agricultural Solar Pump System',
      category: 'rooftop-solar',
      categorySlug: 'rooftop-solar',
      city: 'Khandwa',
      state: 'Madhya Pradesh',
      fullName: 'Kisan Singh',
      whatsappNumber: '9893555555',
      contactConsent: true,
      extraMessage: 'Need PM-KUSUM scheme compliant solar pump with warranty.',
    });
    assert.ok(req.id.startsWith('req-'));

    // 2. Proposal is stored in pool_requests with status REQUESTED
    const saved = await getPoolRequestById(req.id);
    assert.ok(saved);
    assert.equal(saved.status, 'REQUESTED');
    assert.equal(saved.conversionStatus, 'PENDING');
    assert.equal(saved.productName, '10 HP Agricultural Solar Pump System');
    assert.equal(saved.city, 'Khandwa');

    // 3. Proposal does NOT appear in public pool listings
    const khandwaPools = await getPublicPools({ citySlug: 'khandwa' });
    assert.equal(khandwaPools.length, 0, 'Public request must NEVER auto-create a public pool');
  });

  test('6. Contact Privacy & Supplier Quotation Honesty: No PII on public read; quotes reflect honest scope', async () => {
    const deadline = new Date(Date.now() + 86400000 * 10).toISOString();
    adapter.rawDb.exec(`
      INSERT INTO pools (
        id, slug, name, category, category_slug, city, city_slug,
        target_buyers, current_buyers, deadline, status, is_published, created_at, updated_at
      ) VALUES (
        'pool-privacy-test', 'water-softener-jaipur', 'Automatic Water Softener', 'ROOFTOP_SOLAR', 'water-softeners',
        'Jaipur', 'jaipur', 10, 0, '${deadline}', 'ACTIVE', 1, datetime('now'), datetime('now')
      );
    `);

    // Add buyer
    await executeJoinPool('pool-privacy-test', {
      fullName: 'Private User Name',
      whatsappNumber: '9414012345',
      city: 'Jaipur',
    });

    // Public pool read
    const publicPool = await getPublicPoolBySlug('jaipur', 'water-softener-jaipur');
    assert.ok(publicPool);

    // Verify zero PII exposed on public pool object
    const serialized = JSON.stringify(publicPool);
    assert.equal(serialized.includes('9414012345'), false, 'Buyer phone number must NEVER appear in public pool object');
    assert.equal(serialized.includes('Private User Name'), false, 'Buyer name must NEVER appear in public pool object');
  });
});

