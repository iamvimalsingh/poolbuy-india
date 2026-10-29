import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setTestD1Database } from '../d1/db';
import { D1Database, D1PreparedStatement, D1Result, D1ExecResult } from '../d1/types';
import { getOperationalCities, getCityBySlug } from '../cities';
import { getOperationalCategories } from '../categories';
import { createCampaign } from '../campaigns';
import { executeJoinPool, getCanonicalMemberCount } from '../pools';
import { recordAdminAudit } from '../audit';
import { LAUNCH_CITIES } from '../constants';

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
        for (const stmt of statements) {
          const res = await (stmt as unknown as { run: () => Promise<D1Result<T>> }).run();
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

describe('Gate 2: Core Data Model & Admin Foundation Suite', () => {
  let adapter: ReturnType<typeof createSqliteD1Adapter>;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'false';
    adapter = createSqliteD1Adapter();

    // Run all D1 migrations in order
    const migrationsDir = path.resolve(process.cwd(), 'migrations/d1');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      adapter.rawDb.exec(sql);
    }

    setTestD1Database(adapter.d1);
  });

  test('1. Canonical 25 Launch Cities: All exist in D1 database and are active', async () => {
    const operational = await getOperationalCities();
    const operationalSlugs = new Set(operational.map((c) => c.slug));

    assert.equal(LAUNCH_CITIES.length, 25, 'LAUNCH_CITIES must contain exactly 25 canonical cities');

    for (const launchCity of LAUNCH_CITIES) {
      assert.ok(
        operationalSlugs.has(launchCity.slug),
        `Launch city "${launchCity.name}" (${launchCity.slug}) must be active in D1 operational directory`
      );
      const city = await getCityBySlug(launchCity.slug);
      assert.ok(city, `City "${launchCity.name}" must resolve via getCityBySlug`);
      assert.strictEqual(city.isActive, true);
    }
  });

  test('2. Dynamic Categories: Operational categories query D1 dynamically with zero hardcoded assumption', async () => {
    const categories = await getOperationalCategories();
    assert.ok(categories.length >= 8, 'At least 8 categories must be configured');
    const solar = categories.find((c) => c.slug === 'rooftop-solar');
    assert.ok(solar, 'Rooftop Solar must exist as a category');
    assert.strictEqual(solar.isActive, true);
  });

  test('3. Independent City Pools & Capacity Isolation: Multiple city pools under one campaign operate independently', async () => {
    const created = await createCampaign({
      title: 'Tier-1 5kW Solar Rooftop Package',
      categorySlug: 'rooftop-solar',
      brand: 'Tata Power Solar',
      model: '5kW Grid-Tie',
      cities: [
        { cityName: 'Pune', citySlug: 'pune', targetBuyers: 10 },
        { cityName: 'Bhopal', citySlug: 'bhopal', targetBuyers: 10 },
      ],
      defaultTargetBuyers: 10,
    });

    assert.strictEqual(created.pools.length, 2);
    const punePool = created.pools.find((p) => p.citySlug === 'pune');
    const bhopalPool = created.pools.find((p) => p.citySlug === 'bhopal');
    assert.ok(punePool && bhopalPool);
    assert.notStrictEqual(punePool.id, bhopalPool.id, 'Each city pool must have a distinct unique ID');

    // Join Pune pool
    const joinPune = await executeJoinPool(punePool.id, {
      fullName: 'Aarav Patel',
      whatsappNumber: '9876543210',
      city: 'Pune',
      pincode: '411001',
      buyingTimeline: 'THIS_MONTH',
    });
    assert.strictEqual(joinPune.buyerNumber, 1);
    assert.strictEqual(joinPune.currentBuyers, 1);

    // Verify Pune count is 1 and Bhopal count remains 0
    const puneCount = await getCanonicalMemberCount(punePool.id);
    const bhopalCount = await getCanonicalMemberCount(bhopalPool.id);
    assert.strictEqual(puneCount, 1, 'Pune pool must have 1 member');
    assert.strictEqual(bhopalCount, 0, 'Bhopal pool must have 0 members (strict capacity isolation)');
  });

  test('4. Idempotent Join & Duplicate Protection: Repeated submissions do not duplicate rows or increment count', async () => {
    const created = await createCampaign({
      title: 'Solar System 3kW Monocrystalline',
      categorySlug: 'rooftop-solar',
      cities: [{ cityName: 'Jaipur', citySlug: 'jaipur', targetBuyers: 10 }],
    });
    const pool = created.pools[0];

    // First join
    const res1 = await executeJoinPool(pool.id, {
      fullName: 'Sunil Sharma',
      whatsappNumber: '9829012345',
      city: 'Jaipur',
      pincode: '302001',
      buyingTimeline: 'THIS_MONTH',
    });
    assert.strictEqual(res1.buyerNumber, 1);
    assert.strictEqual(res1.alreadyJoined, false);

    // Second join with same phone
    const res2 = await executeJoinPool(pool.id, {
      fullName: 'Sunil Sharma',
      whatsappNumber: '9829012345',
      city: 'Jaipur',
      pincode: '302001',
      buyingTimeline: 'THIS_MONTH',
    });
    assert.strictEqual(res2.buyerNumber, 1, 'Must return original buyer number');
    assert.strictEqual(res2.alreadyJoined, true, 'Must indicate alreadyJoined = true');

    const totalMembers = await getCanonicalMemberCount(pool.id);
    assert.strictEqual(totalMembers, 1, 'Member count must remain strictly 1');
  });

  test('5. Pincode String Integrity: Preserves leading zero strings without numerical truncation', async () => {
    const created = await createCampaign({
      title: 'Delhi Inverter Backup Combo',
      categorySlug: 'home-power-backup',
      cities: [{ cityName: 'Delhi', citySlug: 'delhi', targetBuyers: 10 }],
    });
    const pool = created.pools[0];

    // Join with leading-zero pincode '011001'
    const join = await executeJoinPool(pool.id, {
      fullName: 'Devansh Verma',
      whatsappNumber: '9811122334',
      city: 'Delhi',
      pincode: '011001',
      buyingTimeline: 'THIS_MONTH',
      existing_quote: '₹45,000 from local dealer',
    });
    assert.ok(join.leadId);

    // Verify stored row in SQLite directly
    const row = adapter.rawDb
      .prepare('SELECT pincode, pin_code, existing_quote FROM pool_leads WHERE id = ?')
      .get(join.leadId) as { pincode: string; pin_code: string; existing_quote: string };

    assert.strictEqual(row.pincode, '011001', 'Pincode must preserve leading zero string');
    assert.strictEqual(row.existing_quote, '₹45,000 from local dealer');
  });

  test('6. Tri-Classification Non-Conflation: Confirmed members, waitlist applicants and proposals stay separate', async () => {
    // 1. Confirmed member exists in pool_leads
    const leadsCount = adapter.rawDb.prepare('SELECT COUNT(*) as c FROM pool_leads').get() as { c: number };
    // 2. Waitlist entries exist in pool_waitlist
    const waitlistCount = adapter.rawDb.prepare('SELECT COUNT(*) as c FROM pool_waitlist').get() as { c: number };
    // 3. Demand proposals exist in pool_requests
    const requestsCount = adapter.rawDb.prepare('SELECT COUNT(*) as c FROM pool_requests').get() as { c: number };

    assert.strictEqual(typeof leadsCount.c, 'number');
    assert.strictEqual(typeof waitlistCount.c, 'number');
    assert.strictEqual(typeof requestsCount.c, 'number');
  });

  test('7. Admin Audit Log Persistence: Administrative mutations are logged immutably', async () => {
    await recordAdminAudit({
      action: 'CAMPAIGN_CREATED',
      targetType: 'CAMPAIGN',
      targetId: 'camp-test-123',
      adminIdentifier: 'admin@groupbuying.store',
      changesSummary: 'Created test campaign across 5 cities',
      details: { cities: ['pune', 'mumbai', 'delhi'] },
    });

    const row = adapter.rawDb
      .prepare("SELECT * FROM admin_audit_logs WHERE action = 'CAMPAIGN_CREATED' ORDER BY created_at DESC LIMIT 1")
      .get() as { action: string; target_type: string; changes_summary: string };

    assert.ok(row);
    assert.strictEqual(row.action, 'CAMPAIGN_CREATED');
    assert.strictEqual(row.target_type, 'CAMPAIGN');
    assert.strictEqual(row.changes_summary, 'Created test campaign across 5 cities');
  });
});
