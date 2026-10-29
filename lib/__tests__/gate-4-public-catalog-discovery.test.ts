import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setTestD1Database } from '../d1/db';
import { D1Database, D1PreparedStatement, D1Result, D1ExecResult } from '../d1/types';
import { getPublicPools, getPublicPoolBySlug } from '../pools';
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

describe('Gate 4: Public Catalog and City Discovery Invariants Suite', () => {
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

  test('1. Discovery: Returns national All-India pools and isolates by city when city filter is supplied', async () => {
    const { pools } = await createCampaign({
      title: 'Gate 4 Test Discovery Campaign',
      categorySlug: 'rooftop-solar',
      brand: 'Tata Power',
      model: 'TP-5KW',
      status: 'ACTIVE',
      defaultGroupPrice: 135000,
      defaultMarketPrice: 160000,
      cities: [
        { cityName: 'Bhopal', citySlug: 'bhopal', targetBuyers: 10 },
        { cityName: 'Lucknow', citySlug: 'lucknow', targetBuyers: 10 },
      ],
    });

    const poolBhopal = pools.find((p) => p.citySlug === 'bhopal');
    const poolLucknow = pools.find((p) => p.citySlug === 'lucknow');
    assert.ok(poolBhopal, 'Bhopal pool should be created with campaign');
    assert.ok(poolLucknow, 'Lucknow pool should be created with campaign');

    // National discovery (All India) should contain both
    const allIndiaPools = await getPublicPools();
    const bhopalInAll = allIndiaPools.find((p) => p.id === poolBhopal.id);
    const lucknowInAll = allIndiaPools.find((p) => p.id === poolLucknow.id);
    assert.ok(bhopalInAll, 'Bhopal pool should be present in All India discovery');
    assert.ok(lucknowInAll, 'Lucknow pool should be present in All India discovery');

    // Filter strictly by Bhopal
    const bhopalFiltered = await getPublicPools({ citySlug: 'bhopal' });
    assert.strictEqual(bhopalFiltered.some((p) => p.id === poolBhopal.id), true);
    assert.strictEqual(bhopalFiltered.some((p) => p.id === poolLucknow.id), false);

    // Filter strictly by Lucknow
    const lucknowFiltered = await getPublicPools({ citySlug: 'lucknow' });
    assert.strictEqual(lucknowFiltered.some((p) => p.id === poolLucknow.id), true);
    assert.strictEqual(lucknowFiltered.some((p) => p.id === poolBhopal.id), false);
  });

  test('2. Status filtering: CLOSED, DRAFT, and expired pools are strictly excluded from public discovery', async () => {
    // 1. DRAFT campaign & pool
    const { pools: draftPools } = await createCampaign({
      title: 'Gate 4 Draft Campaign',
      categorySlug: 'rooftop-solar',
      status: 'DRAFT',
      cities: [{ cityName: 'Indore', citySlug: 'indore', targetBuyers: 10 }],
    });
    const draftPool = draftPools[0];

    // 2. Active campaign with pools where one is closed and one is expired
    const { pools: activePools } = await createCampaign({
      title: 'Gate 4 Lifecycle Status Campaign',
      categorySlug: 'rooftop-solar',
      status: 'ACTIVE',
      cities: [
        { cityName: 'Indore', citySlug: 'indore', targetBuyers: 10 },
        { cityName: 'Pune', citySlug: 'pune', targetBuyers: 10 },
      ],
    });
    const closedPool = activePools[0];
    const expiredPool = activePools[1];

    // Mark closedPool as CLOSED
    adapter.rawDb.exec(`UPDATE pools SET status = 'CLOSED' WHERE id = '${closedPool.id}'`);

    // Mark expiredPool deadline in the past
    const pastDeadline = new Date(Date.now() - 86400000).toISOString();
    adapter.rawDb.exec(`UPDATE pools SET deadline = '${pastDeadline}' WHERE id = '${expiredPool.id}'`);

    const allPublic = await getPublicPools();
    assert.strictEqual(allPublic.some((p) => p.id === draftPool.id), false, 'DRAFT pool must not appear in public catalog');
    assert.strictEqual(allPublic.some((p) => p.id === closedPool.id), false, 'CLOSED pool must not appear in public catalog');
    assert.strictEqual(allPublic.some((p) => p.id === expiredPool.id), false, 'Expired pool must not appear in public catalog');
  });

  test('3. Category filtering: Filters strictly to the requested category slug', async () => {
    const { pools: waterPools } = await createCampaign({
      title: 'Gate 4 Whole House Water Softener Campaign',
      categorySlug: 'water-softeners',
      status: 'ACTIVE',
      cities: [{ cityName: 'Bhopal', citySlug: 'bhopal', targetBuyers: 10 }],
    });
    const waterPool = waterPools[0];

    const { pools: solarPools } = await createCampaign({
      title: 'Gate 4 Rooftop Solar System Campaign',
      categorySlug: 'rooftop-solar',
      status: 'ACTIVE',
      cities: [{ cityName: 'Bhopal', citySlug: 'bhopal', targetBuyers: 10 }],
    });
    const solarPool = solarPools[0];

    // Filter by water-softeners category
    const waterResults = await getPublicPools({ categorySlug: 'water-softeners' });
    assert.strictEqual(waterResults.some((p) => p.id === waterPool.id), true);
    assert.strictEqual(waterResults.some((p) => p.id === solarPool.id), false);

    // Filter by rooftop-solar category
    const solarResults = await getPublicPools({ categorySlug: 'rooftop-solar' });
    assert.strictEqual(solarResults.some((p) => p.id === solarPool.id), true);
    assert.strictEqual(solarResults.some((p) => p.id === waterPool.id), false);
  });

  test('4. Canonical detail route & PII protection: Slug lookup returns public metadata without member PII', async () => {
    const { pools } = await createCampaign({
      title: 'Gate 4 Detail Verification Campaign',
      categorySlug: 'rooftop-solar',
      status: 'ACTIVE',
      cities: [{ cityName: 'Bhopal', citySlug: 'bhopal', targetBuyers: 10 }],
    });

    const pool = pools[0];

    // Insert a private member lead into pool_leads
    adapter.rawDb.exec(
      `INSERT INTO pool_leads (id, pool_id, full_name, whatsapp_number, pincode, city, status, buyer_number, created_at, updated_at)
       VALUES ('lead-test-secret', '${pool.id}', 'Confidential Buyer', '+919999888877', '462001', 'Bhopal', 'NEW', 1, datetime('now'), datetime('now'))`
    );

    // Query canonical pool by citySlug and poolSlug
    const fetched = await getPublicPoolBySlug('bhopal', pool.slug);
    assert.ok(fetched !== null, 'Public pool should be found');
    assert.strictEqual(fetched.id, pool.id);
    assert.strictEqual(fetched.currentBuyers, 1);

    // Verify absolutely no PII fields exist in the returned public structure
    const publicPoolJson = JSON.stringify(fetched);
    assert.strictEqual(publicPoolJson.includes('Confidential Buyer'), false);
    assert.strictEqual(publicPoolJson.includes('+919999888877'), false);
    assert.strictEqual(publicPoolJson.includes('462001'), false);

    // Wrong city slug must return null (404 behavior)
    const wrongCity = await getPublicPoolBySlug('lucknow', pool.slug);
    assert.strictEqual(wrongCity, null);
  });

  test('5. Status transitions: Updating pool status to CLOSED hides it immediately from discovery', async () => {
    const { pools } = await createCampaign({
      title: 'Gate 4 Status Transition Campaign',
      categorySlug: 'rooftop-solar',
      status: 'ACTIVE',
      cities: [{ cityName: 'Bhopal', citySlug: 'bhopal', targetBuyers: 10 }],
    });

    const pool = pools[0];

    // Verify it is active
    let currentPools = await getPublicPools({ citySlug: 'bhopal' });
    assert.strictEqual(currentPools.some((p) => p.id === pool.id), true);

    // Admin closes the pool
    adapter.rawDb.exec(`UPDATE pools SET status = 'CLOSED' WHERE id = '${pool.id}'`);

    // Verify it is immediately excluded from public catalog
    currentPools = await getPublicPools({ citySlug: 'bhopal' });
    assert.strictEqual(currentPools.some((p) => p.id === pool.id), false);
  });
});
