import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setTestD1Database } from '../d1/db';
import { D1Database, D1PreparedStatement, D1Result, D1ExecResult } from '../d1/types';
import {
  createCampaign,
  previewCampaignRollout,
  executeCampaignRollout,
} from '../campaigns';
import { executeJoinPool, getCanonicalMemberCount } from '../pools';
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

describe('Gate 3: Admin Solar Campaign & 25-City Bulk Rollout Suite', () => {
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

  test('1. Create Solar Campaign across initial subset of launch cities', async () => {
    const created = await createCampaign({
      title: 'Tata Power 5kW Rooftop Solar System',
      categorySlug: 'rooftop-solar',
      brand: 'Tata Power',
      model: 'TP-5KW-MONO',
      variantName: '5kW On-Grid',
      cities: [
        { cityName: 'Pune', citySlug: 'pune', targetBuyers: 10 },
        { cityName: 'Bhopal', citySlug: 'bhopal', targetBuyers: 10 },
        { cityName: 'Delhi', citySlug: 'delhi', targetBuyers: 10 },
      ],
      defaultMarketPrice: 285000,
      defaultGroupPrice: 245000,
      defaultTargetBuyers: 10,
    });

    assert.ok(created.campaign.id);
    assert.strictEqual(created.pools.length, 3);
    assert.strictEqual(created.campaign.categorySlug, 'rooftop-solar');

    // Verify independent pool IDs
    const poolIds = new Set(created.pools.map((p) => p.id));
    assert.strictEqual(poolIds.size, 3, 'Every city pool must have a distinct unique ID');

    // Verify database relations
    const d1Pools = adapter.rawDb
      .prepare('SELECT id, city_slug, campaign_id, current_buyers, target_buyers FROM pools WHERE campaign_id = ?')
      .all(created.campaign.id) as { id: string; city_slug: string; campaign_id: string; current_buyers: number; target_buyers: number }[];

    assert.strictEqual(d1Pools.length, 3);
    assert.ok(d1Pools.every((p) => p.campaign_id === created.campaign.id));
    assert.ok(d1Pools.every((p) => p.current_buyers === 0));
    assert.ok(d1Pools.every((p) => p.target_buyers === 10));
  });

  test('2. Preview 25-City Rollout: Accurately identifies 3 existing and 22 ready-to-create pools without mutating data', async () => {
    // Setup campaign with 3 existing cities
    const created = await createCampaign({
      title: 'Tata Power 5kW Rooftop Solar System',
      categorySlug: 'rooftop-solar',
      cities: [
        { cityName: 'Pune', citySlug: 'pune' },
        { cityName: 'Bhopal', citySlug: 'bhopal' },
        { cityName: 'Delhi', citySlug: 'delhi' },
      ],
    });

    const preview = await previewCampaignRollout(created.campaign.id);

    assert.strictEqual(preview.totalCities, 25);
    assert.strictEqual(preview.alreadyExistsCount, 3, 'Pune, Bhopal, Delhi must be identified as ALREADY_EXISTS');
    assert.strictEqual(preview.readyToCreateCount, 22, 'Remaining 22 launch cities must be READY_TO_CREATE');
    assert.strictEqual(preview.invalidCount, 0);

    // Verify database was NOT mutated
    const poolsCount = adapter.rawDb
      .prepare('SELECT COUNT(*) as c FROM pools WHERE campaign_id = ?')
      .get(created.campaign.id) as { c: number };
    assert.strictEqual(poolsCount.c, 3, 'Preview must not mutate database pools count');
  });

  test('3. Execute 25-City Rollout: Creates remaining 22 pools, preserves existing 3, and retains independent capacities', async () => {
    const created = await createCampaign({
      title: 'Tata Power 5kW Rooftop Solar System',
      categorySlug: 'rooftop-solar',
      cities: [
        { cityName: 'Pune', citySlug: 'pune' },
        { cityName: 'Bhopal', citySlug: 'bhopal' },
        { cityName: 'Delhi', citySlug: 'delhi' },
      ],
    });

    // Pune gets 1 member prior to rollout
    const punePool = created.pools.find((p) => p.citySlug === 'pune')!;
    const joinRes = await executeJoinPool(punePool.id, {
      fullName: 'Vikram Joshi',
      whatsappNumber: '9822011223',
      city: 'Pune',
      pincode: '411001',
      buyingTimeline: 'THIS_MONTH',
    });
    assert.strictEqual(joinRes.buyerNumber, 1);

    // Execute Rollout across all 25 cities
    const rollout = await executeCampaignRollout(created.campaign.id);

    assert.strictEqual(rollout.totalRequested, 25);
    assert.strictEqual(rollout.createdCount, 22, 'Must create exactly 22 missing city pools');
    assert.strictEqual(rollout.existingCount, 3, 'Must preserve existing 3 city pools');
    assert.strictEqual(rollout.failedCount, 0);

    // Pune count must remain 1
    const puneCount = await getCanonicalMemberCount(punePool.id);
    assert.strictEqual(puneCount, 1, 'Pune pool member count must remain 1 after rollout');

    // Total pools under campaign must now be exactly 25
    const totalPools = adapter.rawDb
      .prepare('SELECT COUNT(*) as c FROM pools WHERE campaign_id = ?')
      .get(created.campaign.id) as { c: number };
    assert.strictEqual(totalPools.c, 25, 'Total pools under campaign must be 25');

    // Verify all 25 launch cities are present
    const campaignPools = adapter.rawDb
      .prepare('SELECT city_slug FROM pools WHERE campaign_id = ?')
      .all(created.campaign.id) as { city_slug: string }[];
    const createdSlugs = new Set(campaignPools.map((p) => p.city_slug));

    for (const launchCity of LAUNCH_CITIES) {
      assert.ok(createdSlugs.has(launchCity.slug), `City "${launchCity.name}" (${launchCity.slug}) must have a pool under campaign`);
    }
  });

  test('4. Rollout Idempotency: Running rollout a second time creates 0 pools and preserves all counts', async () => {
    const created = await createCampaign({
      title: 'Luminous Solar Inverter Package',
      categorySlug: 'rooftop-solar',
      cities: [{ cityName: 'Pune', citySlug: 'pune' }],
    });

    // First rollout: creates 24 pools (1 was already created)
    const run1 = await executeCampaignRollout(created.campaign.id);
    assert.strictEqual(run1.createdCount, 24);
    assert.strictEqual(run1.existingCount, 1);

    // Member joins Mumbai pool
    const mumbaiRow = adapter.rawDb
      .prepare('SELECT id FROM pools WHERE campaign_id = ? AND city_slug = ?')
      .get(created.campaign.id, 'mumbai') as { id: string };
    assert.ok(mumbaiRow);

    await executeJoinPool(mumbaiRow.id, {
      fullName: 'Rahul Mehra',
      whatsappNumber: '9820012345',
      city: 'Mumbai',
      pincode: '400001',
      buyingTimeline: 'THIS_MONTH',
    });

    // Second rollout: RERUN IDEMPOTENCY CHECK
    const run2 = await executeCampaignRollout(created.campaign.id);
    assert.strictEqual(run2.createdCount, 0, 'Rerun must create 0 new pools');
    assert.strictEqual(run2.existingCount, 25, 'All 25 pools must be reported as ALREADY_EXISTS');
    assert.strictEqual(run2.failedCount, 0);

    // Verify Mumbai count is still 1
    const mumbaiCount = await getCanonicalMemberCount(mumbaiRow.id);
    assert.strictEqual(mumbaiCount, 1, 'Mumbai count must remain 1');

    // Total pools must remain 25
    const totalPools = adapter.rawDb
      .prepare('SELECT COUNT(*) as c FROM pools WHERE campaign_id = ?')
      .get(created.campaign.id) as { c: number };
    assert.strictEqual(totalPools.c, 25);
  });

  test('5. Safe Partial Recovery: Skips invalid/unconfigured cities without crashing or failing valid cities', async () => {
    const created = await createCampaign({
      title: 'Havells Solar Inverter Solution',
      categorySlug: 'rooftop-solar',
      cities: [{ cityName: 'Indore', citySlug: 'indore' }],
    });

    // Rollout targeting 2 valid cities and 1 non-existent dummy city
    const customRollout = await executeCampaignRollout(created.campaign.id, {
      citySlugs: ['jaipur', 'lucknow', 'non-existent-city-xyz'],
    });

    assert.strictEqual(customRollout.totalRequested, 3);
    assert.strictEqual(customRollout.createdCount, 2, 'Jaipur and Lucknow must be created');
    assert.strictEqual(customRollout.failedCount, 1, 'Non-existent city must be reported as skipped/failed');

    const skippedItem = customRollout.results.find((r) => r.citySlug === 'non-existent-city-xyz');
    assert.ok(skippedItem);
    assert.strictEqual(skippedItem.status, 'SKIPPED');
  });

  test('6. Campaign-level update isolates: Shared edits do not overwrite city-specific customized target or deadline', async () => {
    const created = await createCampaign({
      title: 'Adani Solar High Efficiency Modules',
      categorySlug: 'rooftop-solar',
      cities: [
        { cityName: 'Pune', citySlug: 'pune', targetBuyers: 15 },
        { cityName: 'Bhopal', citySlug: 'bhopal', targetBuyers: 10 },
      ],
      defaultTargetBuyers: 10,
    });

    const pune = created.pools.find((p) => p.citySlug === 'pune')!;
    const bhopal = created.pools.find((p) => p.citySlug === 'bhopal')!;

    assert.strictEqual(pune.targetBuyers, 15, 'Pune has custom target of 15');
    assert.strictEqual(bhopal.targetBuyers, 10, 'Bhopal has default target of 10');

    // Check D1 raw values
    const puneRow = adapter.rawDb.prepare('SELECT target_buyers FROM pools WHERE id = ?').get(pune.id) as { target_buyers: number };
    const bhopalRow = adapter.rawDb.prepare('SELECT target_buyers FROM pools WHERE id = ?').get(bhopal.id) as { target_buyers: number };

    assert.strictEqual(puneRow.target_buyers, 15);
    assert.strictEqual(bhopalRow.target_buyers, 10);
  });
});
