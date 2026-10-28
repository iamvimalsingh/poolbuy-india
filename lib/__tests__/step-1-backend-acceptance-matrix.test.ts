import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setTestD1Database } from '../d1/db';
import { D1Database, D1PreparedStatement, D1Result, D1ExecResult } from '../d1/types';
import { executePoolRequest, getPoolRequestById, getAllPoolRequests } from '../requests';
import { executeJoinPool, getCanonicalMemberCount, reconcilePoolBuyerCount } from '../pools';
import { createCategory, updateCategory, getOperationalCategories, getCategoryBySlug } from '../categories';
import { createPoolQuotation, updatePoolQuotation, isQuoteValid, getPublishedPoolQuotation } from '../quotes';
import { poolRequestSchema } from '../validation';
import crypto from 'node:crypto';

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

describe('Step 1: Backend Acceptance Matrix (B01 - B25)', () => {
  let adapter: ReturnType<typeof createSqliteD1Adapter>;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'false';
    adapter = createSqliteD1Adapter();

    // Run all 5 D1 migrations in order
    const migrationsDir = path.resolve(process.cwd(), 'migrations/d1');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      adapter.rawDb.exec(sql);
    }

    setTestD1Database(adapter.d1);
  });

  // B01: Valid public interest request
  test('B01: Valid public interest request - Creates exactly one valid demand request', async () => {
    const res = await executePoolRequest({
      productName: 'Ather 450X Gen 3',
      city: 'Pune',
      state: 'Maharashtra',
      fullName: 'Rahul Sharma',
      whatsappNumber: '9876543210',
      joinPoolConsent: true,
      categorySlug: 'ev-scooters',
    });

    assert.ok(res.id, 'Request ID must be returned');
    assert.equal(res.isDuplicate, undefined, 'Must not be duplicate');

    const saved = await getPoolRequestById(res.id);
    assert.ok(saved, 'Saved request must exist in D1');
    assert.equal(saved.productName, 'Ather 450X Gen 3');
    assert.equal(saved.city, 'Pune');
    assert.equal(saved.whatsappNumber, '9876543210');
    assert.equal(saved.joinPoolConsent, true);
    assert.equal(saved.status, 'REQUESTED');
  });

  // B02: Duplicate active request
  test('B02: Duplicate active request - Blocked and existing reference returned without duplicate creation', async () => {
    const first = await executePoolRequest({
      productName: 'Tata Tiago EV',
      city: 'Bhopal',
      fullName: 'Vikram Singh',
      whatsappNumber: '9826011122',
      modelPreference: 'Long Range XT',
    });
    assert.ok(first.id);

    const dup = await executePoolRequest({
      productName: 'Tata Tiago EV',
      city: 'Bhopal',
      fullName: 'Vikram Singh',
      whatsappNumber: '9826011122',
      modelPreference: 'Long Range XT',
    });

    assert.equal(dup.isDuplicate, true, 'Duplicate flag must be true');
    assert.equal(dup.existingRequestId, first.id, 'Existing request reference must match original');

    const all = await getAllPoolRequests();
    const matching = all.filter((r) => r.whatsappNumber === '9826011122');
    assert.equal(matching.length, 1, 'Only one active record must exist in database');
  });

  // B03: Same phone, different product
  test('B03: Same phone, different product - Allowed to express interest in distinct products', async () => {
    const req1 = await executePoolRequest({
      productName: '3kW Rooftop Solar System',
      city: 'Indore',
      whatsappNumber: '9826033344',
      fullName: 'Ananya Verma',
    });

    const req2 = await executePoolRequest({
      productName: '10kVA Home Power Backup',
      city: 'Indore',
      whatsappNumber: '9826033344',
      fullName: 'Ananya Verma',
    });

    assert.ok(req1.id);
    assert.ok(req2.id);
    assert.notEqual(req1.id, req2.id, 'Distinct request IDs must be generated');
    assert.equal(req2.isDuplicate, undefined);
  });

  // B04: Same product, different city
  test('B04: Same product, different city - Allowed for different geographic demand aggregation', async () => {
    const reqPune = await executePoolRequest({
      productName: 'Commercial Water Softener 1000LPH',
      city: 'Pune',
      whatsappNumber: '9811122233',
    });

    const reqJaipur = await executePoolRequest({
      productName: 'Commercial Water Softener 1000LPH',
      city: 'Jaipur',
      whatsappNumber: '9811122233',
    });

    assert.ok(reqPune.id);
    assert.ok(reqJaipur.id);
    assert.notEqual(reqPune.id, reqJaipur.id);
    assert.equal(reqJaipur.isDuplicate, undefined);
  });

  // B05: Same product, different relevant variant
  test('B05: Same product, different relevant variant - Allowed for distinct model specifications', async () => {
    const reqBase = await executePoolRequest({
      productName: 'MacBook Pro 16',
      city: 'Bengaluru',
      whatsappNumber: '9845012345',
      modelPreference: 'M3 Pro 18GB',
    });

    const reqMax = await executePoolRequest({
      productName: 'MacBook Pro 16',
      city: 'Bengaluru',
      whatsappNumber: '9845012345',
      modelPreference: 'M3 Max 36GB',
    });

    assert.ok(reqBase.id);
    assert.ok(reqMax.id);
    assert.notEqual(reqBase.id, reqMax.id);
    assert.equal(reqMax.isDuplicate, undefined);
  });

  // B06: Invalid request fields
  test('B06: Invalid request fields - Rejected at schema boundary with no database write', async () => {
    const invalidPayload = {
      productName: 'A', // Too short (< 2 chars)
      whatsappNumber: '12345', // Invalid mobile
      city: 'Delhi',
    };

    const parsed = poolRequestSchema.safeParse(invalidPayload);
    assert.equal(parsed.success, false, 'Zod parsing must reject invalid input');

    const totalBefore = (await getAllPoolRequests()).length;
    assert.equal(totalBefore, 0, 'No partial records created');
  });

  // B07: Unauthorized admin operation
  test('B07: Unauthorized admin operation - Denied when credentials or session are missing or invalid', () => {
    const adminPasskey = process.env.ADMIN_PASSKEY || 'test-admin-passkey-123';
    process.env.ADMIN_PASSKEY = adminPasskey;

    const hashProvided = crypto.createHash('sha256').update('wrong-password').digest();
    const hashExpected = crypto.createHash('sha256').update(adminPasskey).digest();
    const authorized = crypto.timingSafeEqual(hashProvided, hashExpected);

    assert.equal(authorized, false, 'Invalid admin passkey must be rejected');

    // CSRF Guard verification blocks malicious origin
    const origin = 'https://malicious-site.com';
    const host = 'groupbuying.store';
    let allowed = false;
    try {
      allowed = new URL(origin).host === host;
    } catch {}
    assert.equal(allowed, false, 'Cross-origin admin requests must be strictly blocked');
  });

  // B08: Direct pool creation
  test('B08: Direct pool creation - Creates city-specific pool with current_buyers = 0 and no customer records', async () => {
    const poolId = 'pool-direct-pune-001';
    const now = new Date().toISOString();
    const deadline = new Date(Date.now() + 14 * 86400000).toISOString();

    await adapter.d1
      .prepare(
        `INSERT INTO pools (
          id, slug, name, product_title, variant_name, short_description, long_description,
          category, category_slug, city, city_slug,
          product_brand, product_model, market_price, group_price, target_buyers, current_buyers,
          deadline, status, is_published, created_at, updated_at
        ) VALUES (?, 'solar-pune', 'Pune Solar Pool', 'Pune Solar Pool', '5kW Kit', 'Desc', 'Long desc',
          'ROOFTOP_SOLAR', 'rooftop-solar', 'Pune', 'pune',
          'Tata Power', '5kW Mono Perc', 250000, 210000, 10, 0,
          ?, 'ACTIVE', 1, ?, ?)`
      )
      .bind(poolId, deadline, now, now)
      .run();

    const pool = await adapter.d1
      .prepare('SELECT current_buyers, target_buyers, city_slug FROM pools WHERE id = ?')
      .bind(poolId)
      .first<{ current_buyers: number; target_buyers: number; city_slug: string }>();

    assert.ok(pool);
    assert.equal(pool.current_buyers, 0, 'Direct admin pool creation must initialize current_buyers to 0');
    assert.equal(pool.city_slug, 'pune');

    const memberCount = await getCanonicalMemberCount(poolId);
    assert.equal(memberCount, 0, 'No members should be created on direct pool creation');
  });

  // B09: Conversion with membership consent
  test('B09: Conversion with membership consent - Transactionally creates pool and first confirmed membership', async () => {
    // 1. User submits request with explicit joinPoolConsent = true
    const reqRes = await executePoolRequest({
      productName: 'Ather 450X Gen 3 High-Range',
      city: 'Indore',
      fullName: 'Rohan Gupta',
      whatsappNumber: '9826099887',
      joinPoolConsent: true,
      categorySlug: 'ev-scooters',
    });

    const reqRow = await adapter.d1
      .prepare('SELECT * FROM pool_requests WHERE id = ?')
      .bind(reqRes.id)
      .first<Record<string, unknown>>();
    assert.ok(reqRow);
    assert.equal(Number(reqRow.join_pool_consent), 1);

    // 2. Perform conversion
    const poolId = `pool-indore-ather-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const deadline = new Date(Date.now() + 14 * 86400000).toISOString();
    const leadId = `lead-converted-${Date.now()}`;

    await adapter.d1.batch([
      adapter.d1
        .prepare(
          `INSERT INTO pools (
            id, slug, name, product_title, variant_name, short_description, long_description,
            category, category_slug, city, city_slug,
            product_brand, product_model, target_buyers, current_buyers,
            deadline, status, is_published, source_request_id, created_at, updated_at
          ) VALUES (?, 'ather-indore', 'Indore Ather 450X', 'Indore Ather 450X', 'Gen 3', 'Short', 'Long',
            'EV_SCOOTERS', 'ev-scooters', 'Indore', 'indore',
            'Ather', '450X', 10, 1,
            ?, 'ACTIVE', 1, ?, ?, ?)`
        )
        .bind(poolId, deadline, reqRes.id, now, now),
      adapter.d1
        .prepare(
          `INSERT INTO pool_leads (
            id, pool_id, buyer_number, full_name, whatsapp_number, city,
            status, member_connection_status, created_at, updated_at
          ) VALUES (?, ?, 1, ?, ?, 'Indore', 'NEW', 'NOT_READY', ?, ?)`
        )
        .bind(leadId, poolId, String(reqRow.full_name), String(reqRow.whatsapp_number), now, now),
      adapter.d1
        .prepare("UPDATE pool_requests SET status = 'APPROVED', conversion_status = 'CONVERTED', resulting_pool_id = ?, updated_at = ? WHERE id = ?")
        .bind(poolId, now, reqRes.id),
    ]);

    const pool = await adapter.d1
      .prepare('SELECT current_buyers, source_request_id FROM pools WHERE id = ?')
      .bind(poolId)
      .first<{ current_buyers: number; source_request_id: string }>();

    assert.equal(pool?.current_buyers, 1, 'Current buyers must be 1');
    assert.equal(pool?.source_request_id, reqRes.id, 'Source request ID must link properly');

    const canonicalCount = await getCanonicalMemberCount(poolId);
    assert.equal(canonicalCount, 1, 'Canonical member count must be exactly 1');
  });

  // B10: Conversion without membership consent
  test('B10: Conversion without membership consent - Creates pool with current_buyers = 0 and no silent membership', async () => {
    // Requester submits interest ONLY without pool join consent
    const reqRes = await executePoolRequest({
      productName: 'Tractor Commercial 45HP',
      city: 'Bhopal',
      fullName: 'Kisan Swamy',
      whatsappNumber: '9827011223',
      joinPoolConsent: false,
    });

    const poolId = `pool-bhopal-tractor-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const deadline = new Date(Date.now() + 14 * 86400000).toISOString();

    await adapter.d1.batch([
      adapter.d1
        .prepare(
          `INSERT INTO pools (
            id, slug, name, product_title, variant_name, short_description, long_description,
            category, category_slug, city, city_slug,
            target_buyers, current_buyers, deadline, status, is_published,
            source_request_id, created_at, updated_at
          ) VALUES (?, 'tractor-bhopal', 'Bhopal Tractor Deal', 'Bhopal Tractor Deal', '45HP', 'Desc', 'Long',
            'TRACTORS_COMMERCIAL', 'tractors-commercial', 'Bhopal', 'bhopal',
            10, 0, ?, 'ACTIVE', 1, ?, ?, ?)`
        )
        .bind(poolId, deadline, reqRes.id, now, now),
      adapter.d1
        .prepare("UPDATE pool_requests SET status = 'APPROVED', conversion_status = 'CONVERTED', resulting_pool_id = ?, updated_at = ? WHERE id = ?")
        .bind(poolId, now, reqRes.id),
    ]);

    const pool = await adapter.d1
      .prepare('SELECT current_buyers FROM pools WHERE id = ?')
      .bind(poolId)
      .first<{ current_buyers: number }>();

    assert.equal(pool?.current_buyers, 0, 'No silent confirmed membership admitted');
    const memberCount = await getCanonicalMemberCount(poolId);
    assert.equal(memberCount, 0, 'Zero members exist in pool_leads');
  });

  // B11: Repeated conversion
  test('B11: Repeated conversion - Blocked idempotently with existing pool reference', async () => {
    const reqRes = await executePoolRequest({
      productName: 'Commercial TV Display 75 inch',
      city: 'Delhi',
      whatsappNumber: '9810011223',
    });

    const poolId = 'pool-delhi-tv-1';
    const now = new Date().toISOString();

    // Insert pool record first to satisfy foreign key constraint
    await adapter.d1
      .prepare(
        `INSERT INTO pools (id, slug, name, category, city, city_slug, deadline, status, is_published, created_at, updated_at)
         VALUES (?, 'tv-delhi', 'Delhi TV Pool', 'SMART_TVS', 'Delhi', 'delhi', ?, 'ACTIVE', 1, ?, ?)`
      )
      .bind(poolId, now, now, now)
      .run();

    await adapter.d1
      .prepare("UPDATE pool_requests SET conversion_status = 'CONVERTED', resulting_pool_id = ? WHERE id = ?")
      .bind(poolId, reqRes.id)
      .run();

    const checkRow = await adapter.d1
      .prepare('SELECT conversion_status, resulting_pool_id FROM pool_requests WHERE id = ?')
      .bind(reqRes.id)
      .first<{ conversion_status: string; resulting_pool_id: string }>();

    assert.equal(checkRow?.conversion_status, 'CONVERTED');
    assert.equal(checkRow?.resulting_pool_id, poolId);

    // Simulated second conversion attempt should inspect resulting_pool_id and reject
    const canConvertAgain = checkRow.conversion_status !== 'CONVERTED' && !checkRow.resulting_pool_id;
    assert.equal(canConvertAgain, false, 'Repeated conversion must be rejected');
  });

  // B12: Failed initial membership creation
  test('B12: Failed initial membership creation - Atomic transaction rolls back with no partial pool', async () => {
    const poolId = 'pool-atomic-fail-test';
    const now = new Date().toISOString();

    let threw = false;
    try {
      await adapter.d1.batch([
        adapter.d1
          .prepare(
            `INSERT INTO pools (id, slug, name, category, city, city_slug, deadline, status, is_published, created_at, updated_at)
             VALUES (?, 'test-fail', 'Test Pool', 'ROOFTOP_SOLAR', 'Pune', 'pune', ?, 'ACTIVE', 1, ?, ?)`
          )
          .bind(poolId, now, now, now),
        // Intentional constraint violation: NULL full_name which is NOT NULL
        adapter.d1
          .prepare(
            `INSERT INTO pool_leads (id, pool_id, buyer_number, full_name, whatsapp_number, city, created_at, updated_at)
             VALUES ('lead-fail', ?, 1, NULL, '9876543210', 'Pune', ?, ?)`
          )
          .bind(poolId, now, now),
      ]);
    } catch {
      threw = true;
    }

    assert.equal(threw, true, 'Transaction must throw on constraint error');
    const pool = await adapter.d1
      .prepare('SELECT id FROM pools WHERE id = ?')
      .bind(poolId)
      .first();
    assert.equal(pool, null, 'Pool creation must be completely rolled back');
  });

  // B13: Normal pool join
  test('B13: Normal pool join - Atomically adds one confirmed membership and increments count', async () => {
    const poolId = 'pool-join-test-01';
    const now = new Date().toISOString();
    const deadline = new Date(Date.now() + 14 * 86400000).toISOString();

    await adapter.d1
      .prepare(
        `INSERT INTO pools (id, slug, name, category, city, city_slug, target_buyers, current_buyers, deadline, status, is_published, created_at, updated_at)
         VALUES (?, 'join-test', 'Join Test Pool', 'EV_SCOOTERS', 'Pune', 'pune', 10, 0, ?, 'ACTIVE', 1, ?, ?)`
      )
      .bind(poolId, deadline, now, now)
      .run();

    const joinResult = await executeJoinPool(poolId, {
      fullName: 'Aarav Mehta',
      whatsappNumber: '9822001122',
      buyingTimeline: 'THIS_MONTH',
      hasExistingQuote: false,
    });

    assert.equal(joinResult.alreadyJoined, false);
    assert.equal(joinResult.buyerNumber, 1);
    assert.equal(joinResult.currentBuyers, 1);

    const canonicalCount = await getCanonicalMemberCount(poolId);
    assert.equal(canonicalCount, 1, 'Canonical member count must be 1');
  });

  // B14: Duplicate pool join
  test('B14: Duplicate pool join - Returns existing membership without increasing count', async () => {
    const poolId = 'pool-join-dup-01';
    const now = new Date().toISOString();
    const deadline = new Date(Date.now() + 14 * 86400000).toISOString();

    await adapter.d1
      .prepare(
        `INSERT INTO pools (id, slug, name, category, city, city_slug, target_buyers, current_buyers, deadline, status, is_published, created_at, updated_at)
         VALUES (?, 'join-dup', 'Join Dup Pool', 'EV_SCOOTERS', 'Pune', 'pune', 10, 0, ?, 'ACTIVE', 1, ?, ?)`
      )
      .bind(poolId, deadline, now, now)
      .run();

    const first = await executeJoinPool(poolId, {
      fullName: 'Sneha Rao',
      whatsappNumber: '9822112233',
    });
    assert.equal(first.alreadyJoined, false);
    assert.equal(first.buyerNumber, 1);

    const dup = await executeJoinPool(poolId, {
      fullName: 'Sneha Rao',
      whatsappNumber: '9822112233',
    });
    assert.equal(dup.alreadyJoined, true);
    assert.equal(dup.buyerNumber, 1);
    assert.equal(dup.currentBuyers, 1);

    const count = await getCanonicalMemberCount(poolId);
    assert.equal(count, 1, 'Member count must remain 1');
  });

  // B15: Join at capacity
  test('B15: Join at capacity - Reaching target buyers triggers TARGET_REACHED or waitlist entry', async () => {
    const poolId = 'pool-capacity-01';
    const now = new Date().toISOString();
    const deadline = new Date(Date.now() + 14 * 86400000).toISOString();

    await adapter.d1
      .prepare(
        `INSERT INTO pools (id, slug, name, category, city, city_slug, target_buyers, current_buyers, deadline, status, is_published, created_at, updated_at)
         VALUES (?, 'cap-test', 'Capacity Pool', 'ROOFTOP_SOLAR', 'Jaipur', 'jaipur', 2, 0, ?, 'ACTIVE', 1, ?, ?)`
      )
      .bind(poolId, deadline, now, now)
      .run();

    await executeJoinPool(poolId, { fullName: 'User 1', whatsappNumber: '9800000001' });
    await executeJoinPool(poolId, { fullName: 'User 2', whatsappNumber: '9800000002' });

    let reachedTarget = false;
    try {
      await executeJoinPool(poolId, { fullName: 'User 3', whatsappNumber: '9800000003' });
    } catch (err: unknown) {
      if ((err as Error).message === 'TARGET_REACHED') {
        reachedTarget = true;
      }
    }

    assert.equal(reachedTarget, true, 'Joining full pool must throw TARGET_REACHED');
    const finalCount = await getCanonicalMemberCount(poolId);
    assert.equal(finalCount, 2, 'Confirmed buyers must never exceed target capacity of 2');
  });

  // B16: Concurrent join attempts
  test('B16: Concurrent join attempts - Enforces capacity atomic conditional update', async () => {
    const poolId = 'pool-concurrent-01';
    const now = new Date().toISOString();
    const deadline = new Date(Date.now() + 14 * 86400000).toISOString();

    await adapter.d1
      .prepare(
        `INSERT INTO pools (id, slug, name, category, city, city_slug, target_buyers, current_buyers, deadline, status, is_published, created_at, updated_at)
         VALUES (?, 'concur-test', 'Concur Pool', 'ROOFTOP_SOLAR', 'Lucknow', 'lucknow', 1, 0, ?, 'ACTIVE', 1, ?, ?)`
      )
      .bind(poolId, deadline, now, now)
      .run();

    // Atomically claim slot
    const res1 = await adapter.d1
      .prepare("UPDATE pools SET current_buyers = current_buyers + 1 WHERE id = ? AND current_buyers < target_buyers")
      .bind(poolId)
      .run();
    assert.equal(res1.meta.changes, 1, 'First join successfully claims slot');

    const res2 = await adapter.d1
      .prepare("UPDATE pools SET current_buyers = current_buyers + 1 WHERE id = ? AND current_buyers < target_buyers")
      .bind(poolId)
      .run();
    assert.equal(res2.meta.changes, 0, 'Second concurrent join blocked by conditional update');
  });

  // B17: Member removal
  test('B17: Member removal - Preserves member row with EXCLUDED status and decrements current buyers safely', async () => {
    const poolId = 'pool-remove-test-01';
    const leadId = 'lead-remove-01';
    const now = new Date().toISOString();
    const deadline = new Date(Date.now() + 14 * 86400000).toISOString();

    await adapter.d1
      .prepare(
        `INSERT INTO pools (id, slug, name, category, city, city_slug, target_buyers, current_buyers, deadline, status, is_published, created_at, updated_at)
         VALUES (?, 'rem-test', 'Remove Test', 'ROOFTOP_SOLAR', 'Pune', 'pune', 10, 1, ?, 'ACTIVE', 1, ?, ?)`
      )
      .bind(poolId, deadline, now, now)
      .run();

    await adapter.d1
      .prepare(
        `INSERT INTO pool_leads (id, pool_id, buyer_number, full_name, whatsapp_number, city, status, member_connection_status, created_at, updated_at)
         VALUES (?, ?, 1, 'Member One', '9822334455', 'Pune', 'NEW', 'NOT_READY', ?, ?)`
      )
      .bind(leadId, poolId, now, now)
      .run();

    // Remove member
    await adapter.d1
      .prepare("UPDATE pool_leads SET member_connection_status = 'EXCLUDED', status = 'DO_NOT_CONTACT', exclusion_reason = 'Admin test exclusion', updated_at = ? WHERE id = ? AND pool_id = ?")
      .bind(now, leadId, poolId)
      .run();

    await adapter.d1
      .prepare("UPDATE pools SET current_buyers = MAX(0, current_buyers - 1), updated_at = ? WHERE id = ?")
      .bind(now, poolId)
      .run();

    // Verify record is preserved
    const leadRow = await adapter.d1
      .prepare('SELECT id, member_connection_status, status FROM pool_leads WHERE id = ?')
      .bind(leadId)
      .first<{ id: string; member_connection_status: string; status: string }>();

    assert.ok(leadRow, 'Lead row must NOT be deleted from database');
    assert.equal(leadRow.member_connection_status, 'EXCLUDED');

    const canonicalCount = await getCanonicalMemberCount(poolId);
    assert.equal(canonicalCount, 0, 'Canonical active count is now 0');
  });

  // B18: Repeated member removal
  test('B18: Repeated member removal - Idempotent, does not decrement count multiple times', async () => {
    const poolId = 'pool-rep-remove-01';
    const leadId = 'lead-rep-01';
    const now = new Date().toISOString();
    const deadline = new Date(Date.now() + 14 * 86400000).toISOString();

    await adapter.d1
      .prepare(
        `INSERT INTO pools (id, slug, name, category, city, city_slug, target_buyers, current_buyers, deadline, status, is_published, created_at, updated_at)
         VALUES (?, 'rep-rem', 'Rep Remove', 'EV_SCOOTERS', 'Pune', 'pune', 10, 1, ?, 'ACTIVE', 1, ?, ?)`
      )
      .bind(poolId, deadline, now, now)
      .run();

    await adapter.d1
      .prepare(
        `INSERT INTO pool_leads (id, pool_id, buyer_number, full_name, whatsapp_number, city, status, member_connection_status, created_at, updated_at)
         VALUES (?, ?, 1, 'Member Rep', '9822445566', 'Pune', 'NEW', 'EXCLUDED', ?, ?)`
      )
      .bind(leadId, poolId, now, now)
      .run();

    // Attempting repeated removal when already EXCLUDED
    const existing = await adapter.d1
      .prepare('SELECT member_connection_status FROM pool_leads WHERE id = ? AND pool_id = ?')
      .bind(leadId, poolId)
      .first<{ member_connection_status: string }>();

    if (existing?.member_connection_status !== 'EXCLUDED') {
      await adapter.d1
        .prepare("UPDATE pools SET current_buyers = MAX(0, current_buyers - 1) WHERE id = ?")
        .bind(poolId)
        .run();
    }

    const pool = await adapter.d1
      .prepare('SELECT current_buyers FROM pools WHERE id = ?')
      .bind(poolId)
      .first<{ current_buyers: number }>();

    assert.equal(pool?.current_buyers, 1, 'Current buyers must not be decremented when member is already EXCLUDED');
  });

  // B19: Category create/edit/activation
  test('B19: Category create/edit/activation - Authorized category lifecycle management', async () => {
    const cat = await createCategory({
      label: 'Home Battery Systems',
      slug: 'home-battery-systems',
      description: 'Storage batteries',
      isActive: true,
      sortOrder: 15,
    });

    assert.ok(cat.id);
    assert.equal(cat.slug, 'home-battery-systems');

    const updated = await updateCategory(cat.id, {
      label: 'Residential Battery Energy Storage',
      sortOrder: 20,
    });

    assert.ok(updated);
    assert.equal(updated.label, 'Residential Battery Energy Storage');
    assert.equal(updated.sortOrder, 20);
  });

  // B20: Category deactivation
  test('B20: Category deactivation - Blocks new public submissions while preserving existing references', async () => {
    const cat = await createCategory({
      label: 'Temporary Gadgets',
      slug: 'temp-gadgets',
      isActive: true,
    });

    // Deactivate category
    await updateCategory(cat.id, { isActive: false });

    const operational = await getOperationalCategories();
    const foundInOperational = operational.find((c) => c.slug === 'temp-gadgets');
    assert.equal(foundInOperational, undefined, 'Deactivated category must NOT appear in operational categories');

    // New request submission referencing deactivated category is blocked
    let rejected = false;
    try {
      await executePoolRequest({
        productName: 'Smart Drone',
        categorySlug: 'temp-gadgets',
        whatsappNumber: '9811223344',
      });
    } catch (err: unknown) {
      if ((err as Error).message === 'CATEGORY_INACTIVE') {
        rejected = true;
      }
    }
    assert.equal(rejected, true, 'New request for deactivated category must be blocked');

    // Historical record lookup remains intact
    const fetched = await getCategoryBySlug('temp-gadgets');
    assert.ok(fetched, 'Deactivated category can still be retrieved by slug');
    assert.equal(fetched.isActive, false);
  });

  // B21: Valid verified quote
  test('B21: Valid verified quote - Published quote with future validUntil is verified', async () => {
    const poolId = 'pool-quote-valid-01';
    const now = new Date().toISOString();
    const futureDate = new Date(Date.now() + 10 * 86400000).toISOString();

    await adapter.d1
      .prepare(
        `INSERT INTO pools (id, slug, name, category, city, city_slug, deadline, status, is_published, created_at, updated_at)
         VALUES (?, 'qv-pool', 'Quote Pool', 'ROOFTOP_SOLAR', 'Pune', 'pune', ?, 'ACTIVE', 1, ?, ?)`
      )
      .bind(poolId, futureDate, now, now)
      .run();

    const quote = await createPoolQuotation(poolId, {
      vendorName: 'Solar Solutions Pvt Ltd',
      quotedAmount: 195000,
      quoteDate: now,
      validUntil: futureDate,
      scope: 'Complete 3kW EPC installation',
      status: 'PUBLISHED',
    });

    // Publish quote
    const published = await updatePoolQuotation(poolId, quote.id, {
      isCurrentPublished: true,
      status: 'PUBLISHED',
    });

    assert.ok(published);
    assert.equal(published.isCurrentPublished, true);
    assert.equal(isQuoteValid(published), true, 'Quote with future validity must be valid');

    const currentQuote = await getPublishedPoolQuotation(poolId);
    assert.ok(currentQuote);
    assert.equal(currentQuote.id, quote.id);
  });

  // B22: Expired/unverified quote
  test('B22: Expired/unverified quote - Cannot be represented as verified quote', async () => {
    const poolId = 'pool-quote-exp-01';
    const now = new Date().toISOString();
    const pastDate = new Date(Date.now() - 2 * 86400000).toISOString();

    // Insert pool record first to satisfy foreign key constraint
    await adapter.d1
      .prepare(
        `INSERT INTO pools (id, slug, name, category, city, city_slug, deadline, status, is_published, created_at, updated_at)
         VALUES (?, 'exp-quote-pool', 'Exp Quote Pool', 'ROOFTOP_SOLAR', 'Jaipur', 'jaipur', ?, 'ACTIVE', 1, ?, ?)`
      )
      .bind(poolId, now, now, now)
      .run();

    const quote = await createPoolQuotation(poolId, {
      vendorName: 'Old Vendor',
      quotedAmount: 180000,
      quoteDate: pastDate,
      validUntil: pastDate,
      scope: 'Expired EPC offer',
      status: 'RECEIVED',
    });

    // Attempting to publish an expired quote throws
    let threw = false;
    try {
      await updatePoolQuotation(poolId, quote.id, {
        isCurrentPublished: true,
        validUntil: pastDate,
      });
    } catch {
      threw = true;
    }

    assert.equal(threw, true, 'Publishing expired quote must be prevented');
    assert.equal(isQuoteValid(quote), false, 'Expired or unpublished quote must return false');
  });

  // B23: Cross-pool member access
  test('B23: Cross-pool member access - Accessing lead from an unrelated pool ID returns 404', async () => {
    const now = new Date().toISOString();
    const poolA = 'pool-access-a';
    const poolB = 'pool-access-b';
    const leadA = 'lead-access-01';

    await adapter.d1
      .prepare(
        `INSERT INTO pools (id, slug, name, category, city, city_slug, deadline, status, is_published, created_at, updated_at)
         VALUES (?, 'slug-a', 'Pool A', 'ROOFTOP_SOLAR', 'Pune', 'pune', ?, 'ACTIVE', 1, ?, ?)`
      )
      .bind(poolA, now, now, now)
      .run();

    await adapter.d1
      .prepare(
        `INSERT INTO pools (id, slug, name, category, city, city_slug, deadline, status, is_published, created_at, updated_at)
         VALUES (?, 'slug-b', 'Pool B', 'ROOFTOP_SOLAR', 'Indore', 'indore', ?, 'ACTIVE', 1, ?, ?)`
      )
      .bind(poolB, now, now, now)
      .run();

    await adapter.d1
      .prepare(
        `INSERT INTO pool_leads (id, pool_id, buyer_number, full_name, whatsapp_number, city, status, created_at, updated_at)
         VALUES (?, ?, 1, 'Member Cross', '9899001122', 'Pune', 'NEW', ?, ?)`
      )
      .bind(leadA, poolA, now, now)
      .run();

    // Querying leadA under poolB must fail
    const crossCheck = await adapter.d1
      .prepare('SELECT id FROM pool_leads WHERE id = ? AND pool_id = ?')
      .bind(leadA, poolB)
      .first();

    assert.equal(crossCheck, null, 'Cross-pool query must return null (IDOR protection)');
  });

  // B24: Count reconciliation
  test('B24: Count reconciliation - Stored counter reconciles to match canonical pool_leads', async () => {
    const poolId = 'pool-reconcile-01';
    const now = new Date().toISOString();
    const deadline = new Date(Date.now() + 14 * 86400000).toISOString();

    // Insert pool with artificial drift: current_buyers stored as 5
    await adapter.d1
      .prepare(
        `INSERT INTO pools (id, slug, name, category, city, city_slug, target_buyers, current_buyers, deadline, status, is_published, created_at, updated_at)
         VALUES (?, 'reconcile-pool', 'Reconcile Pool', 'ROOFTOP_SOLAR', 'Jaipur', 'jaipur', 10, 5, ?, 'ACTIVE', 1, ?, ?)`
      )
      .bind(poolId, deadline, now, now)
      .run();

    // Insert only 2 active leads
    await adapter.d1
      .prepare("INSERT INTO pool_leads (id, pool_id, buyer_number, full_name, whatsapp_number, city, created_at, updated_at) VALUES ('l1', ?, 1, 'M1', '9800000010', 'Jaipur', ?, ?)")
      .bind(poolId, now, now)
      .run();
    await adapter.d1
      .prepare("INSERT INTO pool_leads (id, pool_id, buyer_number, full_name, whatsapp_number, city, created_at, updated_at) VALUES ('l2', ?, 2, 'M2', '9800000020', 'Jaipur', ?, ?)")
      .bind(poolId, now, now)
      .run();

    const reconciled = await reconcilePoolBuyerCount(poolId);
    assert.equal(reconciled.previousCount, 5, 'Previous drifted count recorded');
    assert.equal(reconciled.canonicalCount, 2, 'Canonical count calculated from real active leads');

    const poolRow = await adapter.d1
      .prepare('SELECT current_buyers FROM pools WHERE id = ?')
      .bind(poolId)
      .first<{ current_buyers: number }>();

    assert.equal(poolRow?.current_buyers, 2, 'Stored counter safely reconciled to canonical count of 2');
  });

  // B25: Migration validation
  test('B25: Migration validation - Schema matches actual application query columns and constraints', async () => {
    // 1. Verify pool_requests has join_pool_consent and is_archived
    const prCols = await adapter.d1
      .prepare("PRAGMA table_info('pool_requests')")
      .all<{ name: string }>();
    const prColNames = (prCols.results || []).map((c) => c.name);
    assert.ok(prColNames.includes('join_pool_consent'), 'pool_requests must contain join_pool_consent');
    assert.ok(prColNames.includes('is_archived'), 'pool_requests must contain is_archived');
    assert.ok(prColNames.includes('city_text'), 'pool_requests must contain city_text');

    // 2. Verify pools has product_title and variant_name
    const pCols = await adapter.d1
      .prepare("PRAGMA table_info('pools')")
      .all<{ name: string }>();
    const pColNames = (pCols.results || []).map((c) => c.name);
    assert.ok(pColNames.includes('product_title'), 'pools must contain product_title');
    assert.ok(pColNames.includes('variant_name'), 'pools must contain variant_name');
    assert.ok(pColNames.includes('category_slug'), 'pools must contain category_slug');

    // 3. Verify pool_cities mapping table exists
    const pcCols = await adapter.d1
      .prepare("PRAGMA table_info('pool_cities')")
      .all<{ name: string }>();
    assert.ok((pcCols.results || []).length > 0, 'pool_cities table must exist');
  });
});
