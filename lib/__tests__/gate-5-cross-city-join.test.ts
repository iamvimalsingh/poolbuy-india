import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setTestD1Database } from '../d1/db';
import { D1Database, D1PreparedStatement, D1Result, D1ExecResult } from '../d1/types';
import { executeJoinPool, getCanonicalMemberCount } from '../pools';
import { createCampaign } from '../campaigns';

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

describe('Gate 5: Join Pool and Cross-City Registration Invariants Suite', () => {
  let adapter: ReturnType<typeof createSqliteD1Adapter>;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'false';
    adapter = createSqliteD1Adapter();

    // Run all D1 migrations in order (0001 through 0009)
    const migrationsDir = path.resolve(process.cwd(), 'migrations/d1');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      adapter.rawDb.exec(sql);
    }

    setTestD1Database(adapter.d1);
  });

  test('1. City Mismatch: Rejects join with CITY_MISMATCH when user city differs without explicit confirmation', async () => {
    const { pools } = await createCampaign({
      title: 'Gate 5 Solar Campaign',
      categorySlug: 'rooftop-solar',
      status: 'ACTIVE',
      cities: [{ cityName: 'Bhopal', citySlug: 'bhopal', targetBuyers: 10 }],
    });
    const pool = pools[0];

    // Attempt join for Bhopal pool while stating userCity is Lucknow
    await assert.rejects(
      async () => {
        await executeJoinPool(pool.id, {
          fullName: 'Vikram Joshi',
          whatsappNumber: '+919876500001',
          userCity: 'Lucknow',
          confirmCityMismatch: false,
          pincode: '226001',
        });
      },
      (err: Error & { code?: string }) => {
        assert.strictEqual(err.code, 'CITY_MISMATCH');
        assert.ok(err.message.includes('You are joining the Bhopal pool, not the Lucknow pool'));
        return true;
      }
    );

    // With explicit confirmation, registration succeeds
    const result = await executeJoinPool(pool.id, {
      fullName: 'Vikram Joshi',
      whatsappNumber: '+919876500001',
      userCity: 'Lucknow',
      confirmCityMismatch: true,
      pincode: '226001',
    });

    assert.strictEqual(result.buyerNumber, 1);
    assert.strictEqual(result.alreadyJoined, false);

    // Verify lead was stored under Bhopal pool
    const lead = adapter.rawDb.prepare('SELECT city, pool_id FROM pool_leads WHERE id = ?').get(result.leadId) as { city: string; pool_id: string };
    assert.strictEqual(lead.city, 'Bhopal');
    assert.strictEqual(lead.pool_id, pool.id);
  });

  test('2. Exact Target Pool Idempotency: Duplicate join does not increment count or duplicate rows', async () => {
    const { pools } = await createCampaign({
      title: 'Gate 5 Idempotency Campaign',
      categorySlug: 'rooftop-solar',
      status: 'ACTIVE',
      cities: [{ cityName: 'Pune', citySlug: 'pune', targetBuyers: 10 }],
    });
    const pool = pools[0];

    const phone = '+919876500002';

    // First join
    const res1 = await executeJoinPool(pool.id, {
      fullName: 'Ananya Sharma',
      whatsappNumber: phone,
      pincode: '411001',
    });
    assert.strictEqual(res1.buyerNumber, 1);
    assert.strictEqual(res1.alreadyJoined, false);

    // Second join with same phone
    const res2 = await executeJoinPool(pool.id, {
      fullName: 'Ananya Sharma',
      whatsappNumber: phone,
      pincode: '411001',
    });
    assert.strictEqual(res2.buyerNumber, 1);
    assert.strictEqual(res2.alreadyJoined, true);

    // Verify canonical count remains 1
    const count = await getCanonicalMemberCount(pool.id);
    assert.strictEqual(count, 1);

    const rows = adapter.rawDb.prepare('SELECT COUNT(*) as c FROM pool_leads WHERE pool_id = ?').get(pool.id) as { c: number };
    assert.strictEqual(rows.c, 1);
  });

  test('3. Cross-City Duplicate Detection: Flags registration in another city within same category, then permits on confirmation', async () => {
    const { pools } = await createCampaign({
      title: 'Gate 5 Multi-City Solar Campaign',
      categorySlug: 'rooftop-solar',
      status: 'ACTIVE',
      cities: [
        { cityName: 'Bhopal', citySlug: 'bhopal', targetBuyers: 10 },
        { cityName: 'Lucknow', citySlug: 'lucknow', targetBuyers: 10 },
      ],
    });

    const bhopalPool = pools.find((p) => p.citySlug === 'bhopal')!;
    const lucknowPool = pools.find((p) => p.citySlug === 'lucknow')!;

    const phone = '+919876500003';

    // 1. User joins Bhopal pool
    const bhopalRes = await executeJoinPool(bhopalPool.id, {
      fullName: 'Rahul Verma',
      whatsappNumber: phone,
      pincode: '462001',
    });
    assert.strictEqual(bhopalRes.buyerNumber, 1);

    // 2. Same user tries to join Lucknow pool (same category: rooftop-solar) without confirmCrossCity
    await assert.rejects(
      async () => {
        await executeJoinPool(lucknowPool.id, {
          fullName: 'Rahul Verma',
          whatsappNumber: phone,
          confirmCrossCity: false,
          pincode: '226001',
        });
      },
      (err: Error & { code?: string; existingCity?: string }) => {
        assert.strictEqual(err.code, 'CROSS_CITY_DUPLICATE_NOTICE');
        assert.strictEqual(err.existingCity, 'Bhopal');
        assert.ok(err.message.includes('already have an active registration for rooftop-solar in Bhopal'));
        return true;
      }
    );

    // Bhopal count should still be 1, Lucknow count still 0
    assert.strictEqual(await getCanonicalMemberCount(bhopalPool.id), 1);
    assert.strictEqual(await getCanonicalMemberCount(lucknowPool.id), 0);

    // 3. User explicitly confirms separate cross-city registration
    const lucknowRes = await executeJoinPool(lucknowPool.id, {
      fullName: 'Rahul Verma',
      whatsappNumber: phone,
      confirmCrossCity: true,
      pincode: '226001',
    });
    assert.strictEqual(lucknowRes.buyerNumber, 1);
    assert.strictEqual(lucknowRes.alreadyJoined, false);

    // Both pools now have 1 confirmed member, completely independent
    assert.strictEqual(await getCanonicalMemberCount(bhopalPool.id), 1);
    assert.strictEqual(await getCanonicalMemberCount(lucknowPool.id), 1);
  });

  test('4. Cross-Category Exemption: Different category registration does NOT trigger cross-city warning', async () => {
    // Campaign 1: Rooftop Solar in Bhopal
    const { pools: solarPools } = await createCampaign({
      title: 'Gate 5 Solar Campaign',
      categorySlug: 'rooftop-solar',
      status: 'ACTIVE',
      cities: [{ cityName: 'Bhopal', citySlug: 'bhopal', targetBuyers: 10 }],
    });
    const solarPool = solarPools[0];

    // Campaign 2: Water Softeners in Lucknow
    const { pools: waterPools } = await createCampaign({
      title: 'Gate 5 Water Softener Campaign',
      categorySlug: 'water-softeners',
      status: 'ACTIVE',
      cities: [{ cityName: 'Lucknow', citySlug: 'lucknow', targetBuyers: 10 }],
    });
    const waterPool = waterPools[0];

    const phone = '+919876500004';

    // 1. Join solar in Bhopal
    await executeJoinPool(solarPool.id, {
      fullName: 'Pooja Nair',
      whatsappNumber: phone,
      pincode: '462001',
    });

    // 2. Join water softeners in Lucknow (different category!)
    // Should succeed immediately without CROSS_CITY_DUPLICATE_NOTICE
    const waterRes = await executeJoinPool(waterPool.id, {
      fullName: 'Pooja Nair',
      whatsappNumber: phone,
      confirmCrossCity: false,
      pincode: '226001',
    });

    assert.strictEqual(waterRes.buyerNumber, 1);
    assert.strictEqual(waterRes.alreadyJoined, false);
  });

  test('5. Waitlist Cross-City Notice: Flags waitlisted status from prior city', async () => {
    const { pools } = await createCampaign({
      title: 'Gate 5 Waitlist Cross-City Campaign',
      categorySlug: 'rooftop-solar',
      status: 'ACTIVE',
      cities: [
        { cityName: 'Indore', citySlug: 'indore', targetBuyers: 1 },
        { cityName: 'Bhopal', citySlug: 'bhopal', targetBuyers: 10 },
      ],
    });

    const indorePool = pools.find((p) => p.citySlug === 'indore')!;
    const bhopalPool = pools.find((p) => p.citySlug === 'bhopal')!;

    // Fill Indore pool to capacity
    await executeJoinPool(indorePool.id, {
      fullName: 'Member One',
      whatsappNumber: '+919876500010',
      pincode: '452001',
    });

    // Put phone in Indore waitlist
    const wlPhone = '+919876500099';
    adapter.rawDb.exec(
      `INSERT INTO pool_waitlist (id, pool_id, sequence_number, full_name, whatsapp_number, city, status, created_at, updated_at)
       VALUES ('wl-test-1', '${indorePool.id}', 1, 'Waiting User', '${wlPhone}', 'Indore', 'WAITING', datetime('now'), datetime('now'))`
    );

    // Attempt to join Bhopal pool in same category without confirmation
    await assert.rejects(
      async () => {
        await executeJoinPool(bhopalPool.id, {
          fullName: 'Waiting User',
          whatsappNumber: wlPhone,
          confirmCrossCity: false,
          pincode: '462001',
        });
      },
      (err: Error & { code?: string; existingStatus?: string }) => {
        assert.strictEqual(err.code, 'CROSS_CITY_DUPLICATE_NOTICE');
        assert.strictEqual(err.existingStatus, 'WAITLISTED');
        assert.ok(err.message.includes('currently on the waitlist for rooftop-solar in Indore'));
        return true;
      }
    );

    // Confirming allows joining Bhopal pool
    const bhopalRes = await executeJoinPool(bhopalPool.id, {
      fullName: 'Waiting User',
      whatsappNumber: wlPhone,
      confirmCrossCity: true,
      pincode: '462001',
    });

    assert.strictEqual(bhopalRes.buyerNumber, 1);
  });

  test('6. Pincode Integrity: Preserves 6-digit postal code string with leading zeros', async () => {
    const { pools } = await createCampaign({
      title: 'Gate 5 Pincode Campaign',
      categorySlug: 'rooftop-solar',
      status: 'ACTIVE',
      cities: [{ cityName: 'Delhi', citySlug: 'delhi', targetBuyers: 10 }],
    });
    const pool = pools[0];

    // Leading zero pincode
    const pin = '011001';
    const res = await executeJoinPool(pool.id, {
      fullName: 'Amitabh Sen',
      whatsappNumber: '+919876500020',
      pincode: pin,
    });

    const lead = adapter.rawDb.prepare('SELECT pincode, pin_code FROM pool_leads WHERE id = ?').get(res.leadId) as { pincode: string; pin_code: string };
    assert.strictEqual(lead.pincode, '011001');
    assert.strictEqual(lead.pin_code, '011001');
    assert.strictEqual(typeof lead.pincode, 'string');
  });
});
