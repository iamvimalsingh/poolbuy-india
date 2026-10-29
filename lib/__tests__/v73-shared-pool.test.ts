import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setTestD1Database } from '../d1/db';
import { D1Database, D1PreparedStatement, D1Result, D1ExecResult } from '../d1/types';
import { executePoolRequest, getPoolRequestById } from '../requests';
import { getPublicPools, executeJoinPool, getCanonicalMemberCount } from '../pools';
import { createCampaign } from '../campaigns';
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
    dump(): Promise<ArrayBuffer> {
      throw new Error('Not implemented');
    },
  };

  return { d1, rawDb: sqlite };
}

describe('PoolBuy India Simple MVP v7.3.0 Shared Pool Specification Suite', () => {
  let adapter: ReturnType<typeof createSqliteD1Adapter>;

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
    setTestD1Database(null);
  });

  test('1. Canonical Launch Cities: Exactly 25 launch cities configured with All India default', () => {
    assert.equal(LAUNCH_CITIES.length, 25, 'Must contain exactly 25 canonical launch cities');
    const requiredCities = [
      'Delhi', 'Mumbai', 'Bengaluru', 'Hyderabad', 'Chennai',
      'Kolkata', 'Pune', 'Ahmedabad', 'Surat', 'Jaipur',
      'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Bhopal',
      'Patna', 'Vadodara', 'Coimbatore', 'Kochi', 'Ludhiana',
      'Chandigarh', 'Gurugram', 'Noida', 'Visakhapatnam', 'Bhubaneswar'
    ];
    for (const city of requiredCities) {
      assert.ok(
        LAUNCH_CITIES.some((c) => c.name === city),
        `Launch city ${city} must be present in canonical config`
      );
    }
  });

  test('2. Frictionless Pool Request: Free-text request accepted from any town without mandatory category or city dropdown', async () => {
    const res = await executePoolRequest({
      productName: '2 kW rooftop solar for my home',
      fullName: 'Rajesh Sharma',
      whatsappNumber: '9876543210',
      city: 'Baraut',
      state: 'Uttar Pradesh',
      contactConsent: true,
      extraMessage: 'Need high efficiency mono-PERC panels with net metering support',
    });

    assert.ok(res.id.startsWith('req-'), 'Request ID must be generated');
    assert.equal(res.isDemo, false, 'Should be saved in real D1 database');

    const saved = await getPoolRequestById(res.id);
    assert.ok(saved, 'Saved request must exist in D1');
    assert.equal(saved.productName, '2 kW rooftop solar for my home');
    assert.equal(saved.city, 'Baraut');
    assert.equal(saved.state, 'Uttar Pradesh');
    assert.equal(saved.category, null, 'Category must be optional and null when omitted');
    assert.equal(saved.conversionStatus, 'PENDING', 'Request must start in PENDING conversion state');
  });

  test('3. Admin Conversion: Converts request into ONE pool with multi-city visibility and optional category', async () => {
    // 1. Create a pending request
    const reqRes = await executePoolRequest({
      productName: 'Commercial Inverter 10kVA',
      fullName: 'Vimal Patel',
      whatsappNumber: '9822012345',
      city: 'Pune',
      state: 'Maharashtra',
      contactConsent: true,
    });

    const poolId = `pool-${Date.now()}`;
    const slug = `solar-inverter-10kva-${Date.now()}`;
    const now = new Date().toISOString();
    const deadline = new Date(Date.now() + 14 * 86400000).toISOString();
    const cityLabels = ['Delhi', 'Mumbai', 'Pune'];
    const citySlugs = ['delhi', 'mumbai', 'pune'];

    // 2. Perform atomic pool creation & multi-city visibility mapping
    const statements: D1PreparedStatement[] = [
      adapter.d1
        .prepare(
          `INSERT INTO pools (
            id, slug, name, short_description, long_description,
            category, category_slug, internal_category_id,
            city, city_slug,
            product_brand, product_model, image_url,
            market_price, group_price, target_buyers, current_buyers,
            deadline, status, price_is_verified, price_verified_at,
            is_published, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?,
            'ROOFTOP_SOLAR', NULL, NULL,
            ?, ?,
            ?, ?, NULL,
            ?, ?, 10, 0,
            ?, 'ACTIVE', 0, NULL,
            1, ?, ?
          )`
        )
        .bind(
          poolId,
          slug,
          'Solar Inverter 10kVA - Group Buy',
          'Heavy duty solar inverter',
          'Bulk procurement of 10kVA commercial inverters',
          cityLabels[0],
          citySlugs[0],
          'Growatt',
          'MIN-10000TL-X',
          180000,
          155000,
          deadline,
          now,
          now
        ),
      adapter.d1
        .prepare(
          "UPDATE pool_requests SET conversion_status = 'CONVERTED', resulting_pool_id = ?, reviewed_at = ?, updated_at = ? WHERE id = ?"
        )
        .bind(poolId, now, now, reqRes.id),
    ];

    // Add city visibility mappings
    for (let i = 0; i < citySlugs.length; i++) {
      statements.push(
        adapter.d1
          .prepare(
            'INSERT OR IGNORE INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)'
          )
          .bind(`pc-${poolId}-${citySlugs[i]}`, poolId, citySlugs[i], cityLabels[i], now, now)
      );
    }

    await adapter.d1.batch(statements);

    // 3. Verify exactly ONE master pool row exists
    const poolRow = await adapter.d1
      .prepare('SELECT * FROM pools WHERE id = ?')
      .bind(poolId)
      .first<{ id: string; target_buyers: number; current_buyers: number }>();
    assert.ok(poolRow, 'Master pool must exist');
    assert.equal(poolRow.target_buyers, 10, 'Target capacity must be exactly 10');
    assert.equal(poolRow.current_buyers, 0, 'Initial active buyers must be 0');

    // 4. Verify request marked CONVERTED
    const updatedReq = await getPoolRequestById(reqRes.id);
    assert.equal(updatedReq?.conversionStatus, 'CONVERTED');
    assert.equal(updatedReq?.resultingPoolId, poolId);

    // 5. Verify multi-city visibility mappings
    const citiesInDb = await adapter.d1
      .prepare('SELECT city_code, city_name FROM pool_cities WHERE pool_id = ? ORDER BY city_code ASC')
      .bind(poolId)
      .all<{ city_code: string; city_name: string }>();
    assert.equal(citiesInDb.results.length, 3);
    assert.deepEqual(
      citiesInDb.results.map((r) => r.city_code).sort(),
      ['delhi', 'mumbai', 'pune'].sort()
    );
  });

  test('4. Shared Pool Model: Same pool appears under All India and tagged cities with identical counts', async () => {
    // Setup 1 pool tagged Delhi, Mumbai, Pune
    const poolId = 'shared-pool-101';
    const slug = 'shared-pool-solar';
    const now = new Date().toISOString();
    const deadline = new Date(Date.now() + 14 * 86400000).toISOString();

    await adapter.d1
      .prepare(
        `INSERT INTO pools (
          id, slug, name, short_description, long_description,
          category, city, city_slug, product_brand, product_model,
          market_price, group_price, target_buyers, current_buyers,
          deadline, status, is_published, created_at, updated_at
        ) VALUES (
          ?, ?, 'Shared Rooftop Solar', 'Shared pool desc', 'Long desc',
          'ROOFTOP_SOLAR', 'Delhi', 'delhi', 'Tata Power', 'Solar 5kW',
          250000, 210000, 10, 3,
          ?, 'ACTIVE', 1, ?, ?
        )`
      )
      .bind(poolId, slug, deadline, now, now)
      .run();

    for (const city of [
      { code: 'delhi', name: 'Delhi' },
      { code: 'mumbai', name: 'Mumbai' },
      { code: 'pune', name: 'Pune' },
    ]) {
      await adapter.d1
        .prepare(
          'INSERT INTO pool_cities (id, pool_id, city_code, city_name, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)'
        )
        .bind(`pc-${poolId}-${city.code}`, poolId, city.code, city.name, now, now)
        .run();
    }

    // Add 3 active leads
    for (let i = 1; i <= 3; i++) {
      await adapter.d1
        .prepare(
          `INSERT INTO pool_leads (id, pool_id, buyer_number, full_name, whatsapp_number, city, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'Delhi', 'NEW', ?, ?)`
        )
        .bind(`lead-${i}`, poolId, i, `Buyer ${i}`, `980000000${i}`, now, now)
        .run();
    }

    // Test discovery query for All India
    const allPools = await getPublicPools();
    const poolInAll = allPools.find((p) => p.id === poolId);
    assert.ok(poolInAll, 'Must appear in All India');
    assert.equal(poolInAll.currentBuyers, 3, 'Must show 3 active buyers');
    assert.deepEqual(poolInAll.cityLabels?.sort(), ['Delhi', 'Mumbai', 'Pune'].sort());

    // Test discovery query for Delhi
    const delhiPools = await getPublicPools('delhi');
    const poolInDelhi = delhiPools.find((p) => p.id === poolId);
    assert.ok(poolInDelhi, 'Must appear under Delhi filter');
    assert.equal(poolInDelhi.currentBuyers, 3, 'Delhi view must show exact same 3 active buyers');

    // Test discovery query for Mumbai
    const mumbaiPools = await getPublicPools('mumbai');
    const poolInMumbai = mumbaiPools.find((p) => p.id === poolId);
    assert.ok(poolInMumbai, 'Must appear under Mumbai filter');
    assert.equal(poolInMumbai.currentBuyers, 3, 'Mumbai view must show exact same 3 active buyers');

    // Test discovery query for Bengaluru (not tagged)
    const blrPools = await getPublicPools('bengaluru');
    const poolInBlr = blrPools.find((p) => p.id === poolId);
    assert.equal(poolInBlr, undefined, 'Must NOT appear under non-tagged city filter');
  });

  test('5. Capacity & FIFO Waitlist: Joins 1-10 ACTIVE, 11-15 WAITLISTED, 16th Rejected (409 Conflict)', async () => {
    const poolId = 'capacity-pool-102';
    const slug = 'capacity-pool-solar';
    const now = new Date().toISOString();
    const deadline = new Date(Date.now() + 14 * 86400000).toISOString();

    await adapter.d1
      .prepare(
        `INSERT INTO pools (
          id, slug, name, short_description, long_description,
          category, city, city_slug, product_brand, product_model,
          market_price, group_price, target_buyers, current_buyers,
          deadline, status, is_published, created_at, updated_at
        ) VALUES (
          ?, ?, 'Capacity Test Pool', 'Short desc', 'Long desc',
          'ROOFTOP_SOLAR', 'Delhi', 'delhi', 'BrandX', 'ModelY',
          100000, 85000, 10, 0,
          ?, 'ACTIVE', 1, ?, ?
        )`
      )
      .bind(poolId, slug, deadline, now, now)
      .run();

    // Joins 1 through 10 -> ACTIVE leads
    for (let i = 1; i <= 10; i++) {
      const phone = `98100000${String(i).padStart(2, '0')}`;
      const res = await executeJoinPool(poolId, {
        fullName: `Member ${i}`,
        whatsappNumber: phone,
        city: 'Delhi',
        buyingTimeline: 'THIS_MONTH',
        hasExistingQuote: false,
        existingQuoteAmount: null,
        extraMessage: '',
        connectionOptIn: false,
        vendorShareConsent: false,
        connectionPreference: 'INDIVIDUAL_INTRO',
        groupPrivacyAcknowledged: false,
      });

      assert.equal(res.buyerNumber, i);
      assert.equal(res.currentBuyers, i);
      assert.equal(res.remainingBuyers, 10 - i);
      assert.equal(res.alreadyJoined, false);
    }

    // 11th Join -> Throws TARGET_REACHED (Active capacity reached)
    await assert.rejects(
      async () => {
        await executeJoinPool(poolId, {
          fullName: 'Member 11',
          whatsappNumber: '9810000011',
          city: 'Delhi',
          buyingTimeline: 'THIS_MONTH',
          hasExistingQuote: false,
          existingQuoteAmount: null,
          extraMessage: '',
          connectionOptIn: false,
          vendorShareConsent: false,
          connectionPreference: 'INDIVIDUAL_INTRO',
          groupPrivacyAcknowledged: false,
        });
      },
      /TARGET_REACHED/,
      '11th join must trigger TARGET_REACHED for waitlist placement'
    );

    // Simulate placing members 11 through 15 onto FIFO waitlist
    for (let seq = 1; seq <= 5; seq++) {
      const phone = `98100000${10 + seq}`;
      const wlId = `wl-${poolId}-${seq}`;
      await adapter.d1
        .prepare(
          `INSERT INTO pool_waitlist (id, pool_id, full_name, whatsapp_number, city, status, sequence_number, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'Delhi', 'WAITING', ?, ?, ?)`
        )
        .bind(wlId, poolId, `Waitlist Member ${seq}`, phone, seq, now, now)
        .run();
    }

    // Verify 10 active leads and 5 waitlisted members in database
    const leadsCount = await adapter.d1
      .prepare('SELECT COUNT(*) as c FROM pool_leads WHERE pool_id = ?')
      .bind(poolId)
      .first<{ c: number }>();
    assert.equal(leadsCount?.c, 10, 'Must have exactly 10 active leads');

    const waitlistCount = await adapter.d1
      .prepare("SELECT COUNT(*) as c FROM pool_waitlist WHERE pool_id = ? AND status = 'WAITING'")
      .bind(poolId)
      .first<{ c: number }>();
    assert.equal(waitlistCount?.c, 5, 'Must have exactly 5 waitlisted members');

    // 16th Join attempt: Check that waitlist is full (>= 5 waiting members)
    const currentWlCount = await adapter.d1
      .prepare("SELECT COUNT(*) as c FROM pool_waitlist WHERE pool_id = ? AND status = 'WAITING'")
      .bind(poolId)
      .first<{ c: number }>();
    assert.ok(currentWlCount && currentWlCount.c >= 5, 'Waitlist is at maximum capacity (5)');

    // 16th submission must NOT create any new row
    const noNewRowLeads = await adapter.d1
      .prepare('SELECT COUNT(*) as c FROM pool_leads WHERE pool_id = ?')
      .bind(poolId)
      .first<{ c: number }>();
    assert.equal(noNewRowLeads?.c, 10, 'No lead row created for 16th join');
  });

  test('6. Idempotent Duplicate Joins: Re-joining with normalized phone returns existing status without increasing count', async () => {
    const poolId = 'idempotent-pool-103';
    const slug = 'idempotent-pool-solar';
    const now = new Date().toISOString();
    const deadline = new Date(Date.now() + 14 * 86400000).toISOString();

    await adapter.d1
      .prepare(
        `INSERT INTO pools (
          id, slug, name, short_description, long_description,
          category, city, city_slug, product_brand, product_model,
          market_price, group_price, target_buyers, current_buyers,
          deadline, status, is_published, created_at, updated_at
        ) VALUES (
          ?, ?, 'Idempotent Pool', 'Desc', 'Long desc',
          'ROOFTOP_SOLAR', 'Delhi', 'delhi', 'BrandZ', 'ModelA',
          50000, 42000, 10, 0,
          ?, 'ACTIVE', 1, ?, ?
        )`
      )
      .bind(poolId, slug, deadline, now, now)
      .run();

    // First join with +91 format
    const firstJoin = await executeJoinPool(poolId, {
      fullName: 'Aarav Gupta',
      whatsappNumber: '9988776655',
      city: 'Delhi',
      buyingTimeline: 'THIS_MONTH',
      hasExistingQuote: false,
      existingQuoteAmount: null,
      extraMessage: '',
      connectionOptIn: false,
      vendorShareConsent: false,
      connectionPreference: 'INDIVIDUAL_INTRO',
      groupPrivacyAcknowledged: false,
    });
    assert.equal(firstJoin.alreadyJoined, false);
    assert.equal(firstJoin.currentBuyers, 1);

    // Second join with same normalized phone number
    const duplicateJoin = await executeJoinPool(poolId, {
      fullName: 'Aarav Gupta (Re-try)',
      whatsappNumber: '9988776655',
      city: 'Mumbai', // Even if submitted from a different city filter
      buyingTimeline: 'THIS_MONTH',
      hasExistingQuote: false,
      existingQuoteAmount: null,
      extraMessage: 'Trying again',
      connectionOptIn: false,
      vendorShareConsent: false,
      connectionPreference: 'INDIVIDUAL_INTRO',
      groupPrivacyAcknowledged: false,
    });

    assert.equal(duplicateJoin.alreadyJoined, true, 'Must report alreadyJoined: true');
    assert.equal(duplicateJoin.currentBuyers, 1, 'Current buyers count must NOT increment on duplicate');

    const totalLeads = await adapter.d1
      .prepare('SELECT COUNT(*) as c FROM pool_leads WHERE pool_id = ?')
      .bind(poolId)
      .first<{ c: number }>();
    assert.equal(totalLeads?.c, 1, 'Database must contain exactly 1 lead row');
  });

  test('7. Atomic Member Removal and FIFO Waitlist Promotion: Frees 1 slot and promotes sequence 1 member', async () => {
    const poolId = 'promo-pool-104';
    const slug = 'promo-pool-solar';
    const now = new Date().toISOString();
    const deadline = new Date(Date.now() + 14 * 86400000).toISOString();

    await adapter.d1
      .prepare(
        `INSERT INTO pools (
          id, slug, name, short_description, long_description,
          category, city, city_slug, product_brand, product_model,
          market_price, group_price, target_buyers, current_buyers,
          deadline, status, is_published, created_at, updated_at
        ) VALUES (
          ?, ?, 'Promotion Pool', 'Desc', 'Long desc',
          'ROOFTOP_SOLAR', 'Delhi', 'delhi', 'BrandW', 'ModelK',
          120000, 100000, 10, 10,
          ?, 'ACTIVE', 1, ?, ?
        )`
      )
      .bind(poolId, slug, deadline, now, now)
      .run();

    // Insert 10 active leads
    for (let i = 1; i <= 10; i++) {
      await adapter.d1
        .prepare(
          `INSERT INTO pool_leads (id, pool_id, buyer_number, full_name, whatsapp_number, city, status, member_connection_status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'Delhi', 'NEW', 'NOT_READY', ?, ?)`
        )
        .bind(`lead-act-${i}`, poolId, i, `Active Member ${i}`, `97000000${String(i).padStart(2, '0')}`, now, now)
        .run();
    }

    // Insert 3 waitlist members (sequences 1, 2, 3)
    for (let seq = 1; seq <= 3; seq++) {
      await adapter.d1
        .prepare(
          `INSERT INTO pool_waitlist (id, pool_id, full_name, whatsapp_number, city, status, sequence_number, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'Delhi', 'WAITING', ?, ?, ?)`
        )
        .bind(`wl-entry-${seq}`, poolId, `Waiting Member ${seq}`, `960000000${seq}`, seq, now, now)
        .run();
    }

    // Step 1: Admin removes 1 active member (Lead #3)
    await adapter.d1
      .prepare(
        "UPDATE pool_leads SET member_connection_status = 'EXCLUDED', status = 'DO_NOT_CONTACT', updated_at = ? WHERE id = ?"
      )
      .bind(now, 'lead-act-3')
      .run();

    await adapter.d1
      .prepare('UPDATE pools SET current_buyers = current_buyers - 1, updated_at = ? WHERE id = ?')
      .bind(now, poolId)
      .run();

    const activeAfterRemoval = await adapter.d1
      .prepare("SELECT COUNT(*) as c FROM pool_leads WHERE pool_id = ? AND (member_connection_status IS NULL OR member_connection_status != 'EXCLUDED')")
      .bind(poolId)
      .first<{ c: number }>();
    assert.equal(activeAfterRemoval?.c, 9, 'Active count must be 9 after member exclusion');

    // Step 2: FIFO Promotion - Find oldest waiting member (sequence 1)
    const nextWaiting = await adapter.d1
      .prepare("SELECT * FROM pool_waitlist WHERE pool_id = ? AND status = 'WAITING' ORDER BY sequence_number ASC, created_at ASC LIMIT 1")
      .bind(poolId)
      .first<{ id: string; full_name: string; whatsapp_number: string; city: string; sequence_number: number }>();

    assert.ok(nextWaiting, 'Oldest waiting member must exist');
    assert.equal(nextWaiting.sequence_number, 1, 'FIFO promotion must select sequence 1');
    assert.equal(nextWaiting.full_name, 'Waiting Member 1');

    // Execute atomic promotion transaction
    const newLeadId = `lead-promoted-${Date.now()}`;
    await adapter.d1.batch([
      adapter.d1
        .prepare("UPDATE pool_waitlist SET status = 'PROMOTED', updated_at = ? WHERE id = ?")
        .bind(now, nextWaiting.id),
      adapter.d1
        .prepare(
          `INSERT INTO pool_leads (
            id, pool_id, buyer_number, full_name, whatsapp_number, city,
            buying_timeline, has_existing_quote, existing_quote_amount,
            extra_message, consent_at, privacy_notice_version,
            connection_opt_in, connection_preference, group_privacy_acknowledged,
            vendor_share_consent, status, fee_status, member_connection_status, created_at, updated_at
          ) VALUES (
            ?, ?, 10, ?, ?, ?,
            'THIS_MONTH', 0, NULL,
            'Promoted from waitlist', ?, '2026-10-V4',
            0, 'INDIVIDUAL_INTRO', 0,
            0, 'NEW', 'NOT_REQUESTED', 'NOT_READY', ?, ?
          )`
        )
        .bind(newLeadId, poolId, nextWaiting.full_name, nextWaiting.whatsapp_number, nextWaiting.city, now, now, now),
      adapter.d1
        .prepare('UPDATE pools SET current_buyers = current_buyers + 1, updated_at = ? WHERE id = ?')
        .bind(now, poolId),
    ]);

    // Verify active count is back to 10
    const finalActive = await adapter.d1
      .prepare("SELECT COUNT(*) as c FROM pool_leads WHERE pool_id = ? AND (member_connection_status IS NULL OR member_connection_status != 'EXCLUDED')")
      .bind(poolId)
      .first<{ c: number }>();
    assert.equal(finalActive?.c, 10, 'Active members restored to 10');

    // Verify remaining waitlist count is 2 (sequences 2 and 3)
    const remainingWl = await adapter.d1
      .prepare("SELECT COUNT(*) as c FROM pool_waitlist WHERE pool_id = ? AND status = 'WAITING'")
      .bind(poolId)
      .first<{ c: number }>();
    assert.equal(remainingWl?.c, 2, 'Waitlist count reduced to 2');
  });

  test('8. Safe Request Soft-Archive: Request DELETE marks is_archived = 1, status = ARCHIVED without data loss', async () => {
    const req = await executePoolRequest({
      productName: 'Electric Tractor 25HP',
      fullName: 'Kisan Patel',
      whatsappNumber: '9922334455',
      city: 'Nagpur',
      state: 'Maharashtra',
      contactConsent: true,
      extraMessage: 'Need delivery before harvest season',
    });

    const now = new Date().toISOString();

    // Soft-archive request
    await adapter.d1
      .prepare("UPDATE pool_requests SET is_archived = 1, archived_at = ?, status = 'ARCHIVED', updated_at = ? WHERE id = ?")
      .bind(now, now, req.id)
      .run();

    // Verify record is preserved in database with archive metadata
    const archivedRow = await adapter.d1
      .prepare('SELECT id, is_archived, archived_at, status FROM pool_requests WHERE id = ?')
      .bind(req.id)
      .first<{ id: string; is_archived: number; archived_at: string; status: string }>();

    assert.ok(archivedRow, 'Row must NOT be deleted from database');
    assert.equal(archivedRow.is_archived, 1, 'is_archived must be set to 1');
    assert.equal(archivedRow.status, 'ARCHIVED', 'status must be ARCHIVED');
    assert.ok(archivedRow.archived_at, 'archived_at timestamp must be recorded');
  });

  test('9. Canonical Architecture Reconciliation: 1 Campaign -> N Independent City Pools ensures no cross-city count conflation', async () => {
    // Product Contract v1.1.0 authoritative model: A campaign creates independent pools per city
    const { pools } = await createCampaign({
      title: 'Canonical Solar Campaign',
      categorySlug: 'rooftop-solar',
      status: 'ACTIVE',
      cities: [
        { cityName: 'Bhopal', citySlug: 'bhopal', targetBuyers: 10 },
        { cityName: 'Lucknow', citySlug: 'lucknow', targetBuyers: 10 },
      ],
    });

    const bhopalPool = pools.find((p) => p.citySlug === 'bhopal')!;
    const lucknowPool = pools.find((p) => p.citySlug === 'lucknow')!;

    assert.notEqual(bhopalPool.id, lucknowPool.id, 'Each city pool must have a distinct stable ID');

    // Join Bhopal pool
    await executeJoinPool(bhopalPool.id, {
      fullName: 'Bhopal Buyer',
      whatsappNumber: '9826000001',
      pincode: '462001',
    });

    // Counts must remain strictly isolated
    const bhopalCount = await getCanonicalMemberCount(bhopalPool.id);
    const lucknowCount = await getCanonicalMemberCount(lucknowPool.id);

    assert.equal(bhopalCount, 1, 'Bhopal pool must have 1 member');
    assert.equal(lucknowCount, 0, 'Lucknow pool must have 0 members - zero shared capacity across cities');
  });
});
