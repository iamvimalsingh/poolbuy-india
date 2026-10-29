import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { setTestD1Database } from '../d1/db';
import { D1Database, D1PreparedStatement, D1Result } from '../d1/types';
import { getCityBySlug, getOperationalCities } from '../cities';
import { getCategoryBySlug, getOperationalCategories } from '../categories';
import { executePoolRequest, getAllPoolRequests } from '../requests';
import { getPublicPoolBySlug, executeJoinPool } from '../pools';
import { recordAdminAudit, getAuditLogs } from '../audit';

// Use Node's built-in synchronous SQLite engine to connect directly to the real disk DB
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite');

const REAL_DB_PATH = path.resolve(
  '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/7903b755904049be769518c2a21a3cb0f2b71d7041d5eac0c5ee8b3911471260.sqlite'
);

interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  };
  close(): void;
}

/**
 * Creates a D1 adapter connecting directly to the real persistent SQLite file on disk.
 */
function createRealDiskD1Adapter(filePath: string): { d1: D1Database; rawDb: SqliteDatabase } {
  const sqlite: SqliteDatabase = new DatabaseSync(filePath);
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
            served_by: 'real-disk-sqlite',
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
            served_by: 'real-disk-sqlite',
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
    async exec(query: string) {
      sqlite.exec(query);
      return { count: 1, duration: 0 };
    },
  };

  return { d1, rawDb: sqlite };
}

function cleanTestRecords(rawDb: SqliteDatabase) {
  try {
    rawDb.exec("DELETE FROM pool_leads WHERE pool_id LIKE 'test-pool-%' OR whatsapp_number LIKE '98888%';");
    rawDb.exec("DELETE FROM pool_waitlist WHERE pool_id LIKE 'test-pool-%' OR whatsapp_number LIKE '98888%';");
    rawDb.exec("DELETE FROM pool_kit_offers WHERE pool_id LIKE 'test-pool-%' OR id LIKE 'test-offer-%';");
    rawDb.exec("DELETE FROM pools WHERE id LIKE 'test-pool-%' OR slug LIKE 'test-%';");
    rawDb.exec("DELETE FROM pool_requests WHERE whatsapp_number LIKE '98888%';");
    rawDb.exec("DELETE FROM admin_audit_logs WHERE admin_identifier = 'test-admin-real-d1';");
  } catch (err) {
    console.error('Clean error:', err);
  }
}

describe('Real Disk D1 SQLite Persistence Verification', () => {
  let adapter: { d1: D1Database; rawDb: SqliteDatabase };
  const origDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE;

  beforeEach(() => {
    // Explicitly enforce live D1 mode to test real database logic
    process.env.NEXT_PUBLIC_DEMO_MODE = 'false';
    adapter = createRealDiskD1Adapter(REAL_DB_PATH);
    cleanTestRecords(adapter.rawDb);
    setTestD1Database(adapter.d1);
  });

  afterEach(() => {
    cleanTestRecords(adapter.rawDb);
    setTestD1Database(null);
    adapter.rawDb.close();
    process.env.NEXT_PUBLIC_DEMO_MODE = origDemoMode;
  });

  test('1. Real Cities Table: Reads 10 operational cities directly from disk D1 in live mode', async () => {
    const cities = await getOperationalCities();
    assert.strictEqual(cities.length, 10, 'Expected exactly 10 seeded operational cities in real D1');
    
    const bhopal = await getCityBySlug('bhopal');
    assert.ok(bhopal, 'Bhopal must exist in real D1');
    assert.strictEqual(bhopal?.name, 'Bhopal');
    assert.strictEqual(bhopal?.state, 'Madhya Pradesh');

    const indore = await getCityBySlug('indore');
    assert.ok(indore, 'Indore must exist in real D1');
    assert.strictEqual(indore?.name, 'Indore');
  });

  test('2. Real Categories Table: Reads 8 operational categories directly from disk D1 in live mode', async () => {
    const categories = await getOperationalCategories();
    assert.strictEqual(categories.length, 8, 'Expected exactly 8 seeded categories in real D1');

    const solar = await getCategoryBySlug('rooftop-solar');
    assert.ok(solar, 'Rooftop solar must exist in real D1');
    assert.strictEqual(solar?.slug, 'rooftop-solar');
    assert.ok(solar?.label.includes('Rooftop Solar'), 'Category label should match rooftop solar');
  });

  test('3. Real Pool Persistence & Kit Variant Attachment: Writes to disk and re-reads after connection reset', async () => {
    const poolId = 'test-pool-real-d1-01';
    const poolSlug = 'test-solar-bhopal-real-d1';
    const offerId = 'test-offer-real-d1-01';
    const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();

    // 1. Insert pool directly into real SQLite file on disk
    adapter.rawDb.prepare(`
      INSERT INTO pools (
        id, slug, name, short_description, long_description, category, city, city_slug,
        product_brand, product_model, market_price, group_price, target_buyers, current_buyers,
        deadline, status, is_archived, is_published, max_waitlist_size
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      poolId, poolSlug, 'Real D1 3kW Solar Pool', 'Test rooftop solar', 'Long description',
      'rooftop-solar', 'Bhopal', 'bhopal', 'Tata Power Solar', '3kW On-Grid',
      210000, 185000, 5, 0, futureDate, 'ACTIVE', 0, 1, 20
    );

    // 2. Insert kit offer (variant) linked by foreign key
    adapter.rawDb.prepare(`
      INSERT INTO pool_kit_offers (
        id, pool_id, name, sku, brand, model, market_price, group_price, target_buyers, current_buyers, is_available, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      offerId, poolId, 'Standard 3kW Mono-PERC Kit', 'SKU-SOLAR-3KW', 'Tata Power Solar', '3kW Mono-PERC',
      210000, 185000, 5, 0, 1, 0
    );

    // 3. Close the DB connection and re-open to guarantee cross-handle persistence
    adapter.rawDb.close();
    adapter = createRealDiskD1Adapter(REAL_DB_PATH);
    setTestD1Database(adapter.d1);

    // 4. Query public pool through domain logic
    const pool = await getPublicPoolBySlug('bhopal', poolSlug);
    assert.ok(pool, 'Pool must be retrievable from real disk D1');
    assert.strictEqual(pool?.id, poolId);
    assert.strictEqual(pool?.name, 'Real D1 3kW Solar Pool');
    assert.strictEqual(pool?.kitOffers?.length, 1, 'Attached kit offers must be fetched from real D1');
    assert.strictEqual(pool?.kitOffers?.[0].id, offerId);
    assert.strictEqual(pool?.kitOffers?.[0].groupPrice, 185000);

    // 5. Test joining the pool through real D1 transactions
    const joinResult = await executeJoinPool(poolId, {
      fullName: 'Real D1 Test User',
      whatsappNumber: '9888800001',
      city: 'Bhopal',
      purchasingTimeline: 'IMMEDIATELY',
      selectedKitOfferId: offerId,
      connectionPreference: 'WHATSAPP_GROUP',
      groupPrivacyAcknowledged: true,
    });

    assert.ok(joinResult.leadId, 'Lead ID must be generated');
    assert.strictEqual(joinResult.currentBuyers, 1);
    assert.strictEqual(joinResult.alreadyJoined, false);

    // Re-verify the updated counts persisted to the real disk DB
    const updatedPool = await getPublicPoolBySlug('bhopal', poolSlug);
    assert.strictEqual(updatedPool?.currentBuyers, 1, 'current_buyers must persist updated state in real D1');
  });

  test('4. Real Demand Discovery Request: Persists and verifies real disk persistence', async () => {
    const res = await executePoolRequest({
      productName: '5kW Hybrid Solar Inverter',
      city: 'Indore',
      state: 'Madhya Pradesh',
      locality: 'Vijay Nagar',
      proposerName: 'Real D1 Proposer',
      contactPhone: '9888800002',
      notes: 'Real disk D1 persistence check',
    });

    assert.ok(res.id, 'Request ID should be generated');

    // Close and reopen adapter
    adapter.rawDb.close();
    adapter = createRealDiskD1Adapter(REAL_DB_PATH);
    setTestD1Database(adapter.d1);

    const allRequests = await getAllPoolRequests();
    const found = allRequests.find((r) => r.id === res.id);
    assert.ok(found, 'Pool request must be found on real disk storage');
    assert.strictEqual(found?.productName, '5kW Hybrid Solar Inverter');
    assert.strictEqual(found?.city, 'Indore');
  });

  test('5. Real Admin Audit Log: Persists administrative events to disk', async () => {
    await recordAdminAudit({
      action: 'REAL_D1_AUDIT_TEST',
      targetType: 'SYSTEM',
      targetId: 'sys-01',
      adminIdentifier: 'test-admin-real-d1',
      changesSummary: 'Verified real disk persistence for admin audit logs',
    });

    const logs = await getAuditLogs(10);
    const foundLog = logs.find((l) => l.adminIdentifier === 'test-admin-real-d1');
    assert.ok(foundLog, 'Audit log must be found in real disk D1');
    assert.strictEqual(foundLog?.action, 'REAL_D1_AUDIT_TEST');
  });
  test('6. Real Disk Join Pool with Leading-Zero Pincode and Existing Quote: Persists to real SQLite file and recovers after connection restart', async () => {
    const poolId = 'test-pool-real-d1-pincode';
    const poolSlug = 'test-disk-pincode-pool';

    adapter.rawDb.prepare(`
      INSERT INTO pools (
        id, slug, name, category, city, city_slug, target_buyers, current_buyers,
        status, deadline, created_at, updated_at
      ) VALUES (
        ?, ?, 'Real Disk Pincode Pool', 'rooftop-solar', 'Bhopal', 'bhopal', 10, 0,
        'ACTIVE', datetime('now', '+30 days'), datetime('now'), datetime('now')
      );
    `).run(poolId, poolSlug);

    // 1. Join with leading-zero pincode and existing quote
    const joinRes = await executeJoinPool(poolId, {
      fullName: 'Disk Pincode User',
      whatsappNumber: '9888800003',
      city: 'Bhopal',
      pincode: '011001',
      existing_quote: '₹92,000 without tax',
    });
    assert.ok(joinRes.leadId);

    // 2. Join second user with omitted quote
    const joinRes2 = await executeJoinPool(poolId, {
      fullName: 'Omitted Quote User',
      whatsappNumber: '9888800004',
      city: 'Bhopal',
      pincode: '462001',
    });
    assert.ok(joinRes2.leadId);

    // 3. Force connection restart to guarantee data was flushed to disk
    adapter.rawDb.close();
    adapter = createRealDiskD1Adapter(REAL_DB_PATH);
    setTestD1Database(adapter.d1);

    // 4. Inspect raw SQLite rows on disk
    const row1 = adapter.rawDb.prepare('SELECT pincode, pin_code, existing_quote FROM pool_leads WHERE id = ?').get(joinRes.leadId) as {
      pincode: string;
      pin_code: string;
      existing_quote: string;
    };
    assert.strictEqual(row1.pincode, '011001', 'Leading zero must not be stripped in real disk D1');
    assert.strictEqual(row1.pin_code, '011001');
    assert.strictEqual(row1.existing_quote, '₹92,000 without tax');

    const row2 = adapter.rawDb.prepare('SELECT pincode, pin_code, existing_quote FROM pool_leads WHERE id = ?').get(joinRes2.leadId) as {
      pincode: string;
      pin_code: string;
      existing_quote: string | null;
    };
    assert.strictEqual(row2.pincode, '462001');
    assert.strictEqual(row2.existing_quote, null, 'Omitted existing_quote must persist as null in real disk D1');

    // 5. Test waitlist persistence and promotion on real disk D1
    const waitlistId = 'test-wl-disk-01';
    const now = new Date().toISOString();
    adapter.rawDb.prepare(`
      INSERT INTO pool_waitlist (
        id, pool_id, sequence_number, full_name, whatsapp_number,
        city, buying_timeline, locality, pin_code, pincode, existing_quote, status, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WAITING', ?, ?, ?)
    `).run(
      waitlistId,
      poolId,
      1,
      'Disk Waitlist Member',
      '9888800005',
      'Bhopal',
      'THIS_MONTH',
      'Arera Colony',
      '011002',
      '011002',
      '₹89,000 direct offer',
      'Disk waitlist note',
      now,
      now
    );

    // Verify raw waitlist row on disk
    const wlRow = adapter.rawDb.prepare('SELECT pincode, pin_code, existing_quote FROM pool_waitlist WHERE id = ?').get(waitlistId) as {
      pincode: string;
      pin_code: string;
      existing_quote: string;
    };
    assert.strictEqual(wlRow.pincode, '011002');
    assert.strictEqual(wlRow.existing_quote, '₹89,000 direct offer');

    // Promote waitlist member on real disk DB
    const promotedLeadId = 'test-promoted-disk-01';
    adapter.rawDb.prepare(`
      INSERT INTO pool_leads (
        id, pool_id, buyer_number, full_name, whatsapp_number, city,
        buying_timeline, status, locality, pin_code, pincode, existing_quote, admin_notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'NEW', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      promotedLeadId,
      poolId,
      3,
      'Disk Waitlist Member',
      '9888800005',
      'Bhopal',
      'THIS_MONTH',
      'Arera Colony',
      wlRow.pincode,
      wlRow.pincode,
      wlRow.existing_quote,
      'FIFO Promoted from waitlist position #1',
      now,
      now
    );

    // Inspect promoted row from real disk D1
    const promotedRow = adapter.rawDb.prepare('SELECT pincode, pin_code, existing_quote FROM pool_leads WHERE id = ?').get(promotedLeadId) as {
      pincode: string;
      pin_code: string;
      existing_quote: string;
    };
    assert.strictEqual(promotedRow.pincode, '011002');
    assert.strictEqual(promotedRow.existing_quote, '₹89,000 direct offer');
  });
});
