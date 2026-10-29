import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setTestD1Database } from '../d1/db';
import { D1Database, D1PreparedStatement, D1Result, D1ExecResult } from '../d1/types';
import {
  buildWhatsAppDirectUrl,
  buildBuyerViralShareUrl,
  buildUnlockedPoolMessage,
  buildConnectionFeeDisclosureMessage,
  buildPaymentInstructionsMessage,
  buildTargetReachedMessage,
} from '../whatsapp';
import { PublicPool, AdminPool } from '@/types';
import { createCampaign } from '../campaigns';
import { executeJoinPool } from '../pools';

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

describe('Gate 6: CRM, Waitlist, Proposals, Quotes & Share Pool Invariants Suite', () => {
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

  test('1. WhatsApp Templates: Truthfully reflect zero-payment coordination without token fees', () => {
    const adminPool: AdminPool = {
      id: 'pool-solar-bhopal',
      campaignId: 'camp-solar',
      slug: 'solar-5kw',
      name: '5kW Rooftop Solar System',
      category: 'ROOFTOP_SOLAR',
      categorySlug: 'rooftop-solar',
      city: 'Bhopal',
      citySlug: 'bhopal',
      targetBuyers: 10,
      currentBuyers: 10,
      groupPrice: 245000,
      marketPrice: 285000,
      status: 'UNLOCKED',
      isPublished: true,
      priceIsVerified: true,
      deadline: '2026-12-31T23:59:59Z',
      createdAt: '2026-10-26T10:00:00Z',
      updatedAt: '2026-10-26T10:00:00Z',
      dealerName: 'Bhopal Solar Power Solutions',
    };

    // 1a. Unlocked pool template
    const unlockedMsg = buildUnlockedPoolMessage(
      'Sunil Verma',
      adminPool,
      'https://groupbuying.store/deals/bhopal/solar-5kw'
    );
    assert.ok(unlockedMsg.includes('Namaste Sunil Verma'));
    assert.ok(unlockedMsg.includes('Bhopal Solar Power Solutions'));
    assert.ok(unlockedMsg.includes('zero platform fees'));
    assert.strictEqual(unlockedMsg.includes('token deposit'), false);
    assert.strictEqual(unlockedMsg.includes('₹499'), false);

    // 1b. Connection disclosure template
    const disclosureMsg = buildConnectionFeeDisclosureMessage(
      'Sunil Verma',
      '5kW Rooftop Solar System',
      'Bhopal'
    );
    assert.ok(disclosureMsg.includes('Namaste Sunil Verma'));
    assert.ok(disclosureMsg.includes('zero platform charges in MVP'));
    assert.strictEqual(disclosureMsg.includes('max(₹99, 0.10%)'), false);

    // 1c. Direct supplier fulfillment instructions template
    const coordMsg = buildPaymentInstructionsMessage(
      'Sunil Verma',
      '5kW Rooftop Solar System',
      'Bhopal Solar Power Solutions',
      'Installer will visit your premises on Friday for shade analysis.'
    );
    assert.ok(coordMsg.includes('Direct supplier coordination details'));
    assert.ok(coordMsg.includes('Bhopal Solar Power Solutions'));
    assert.ok(coordMsg.includes('Installer will visit your premises'));
    assert.ok(coordMsg.includes('zero platform fees'));
    assert.strictEqual(coordMsg.includes('UPI / UTR transaction reference'), false);

    // 1d. Target reached template
    const targetReachedMsg = buildTargetReachedMessage(
      'Sunil Verma',
      '5kW Rooftop Solar System',
      'Bhopal',
      10
    );
    assert.ok(targetReachedMsg.includes('reached its buyer target of 10 members'));
    assert.ok(targetReachedMsg.includes('no payment or commitment required'));
  });

  test('2. Share Pool Deep Link: Generates correct canonical deal path without buyer PII', () => {
    const publicPool: PublicPool = {
      id: 'pool-tvs-bhopal',
      slug: 'tvs-iqube-electric',
      name: 'TVS iQube Electric Scooter',
      category: 'ELECTRIC_VEHICLES',
      categorySlug: 'electric-vehicles',
      city: 'Bhopal',
      citySlug: 'bhopal',
      targetBuyers: 10,
      currentBuyers: 6,
      groupPrice: 112000,
      marketPrice: 135000,
      status: 'ACTIVE',
      isPublished: true,
      priceIsVerified: true,
      deadline: '2026-12-31T23:59:59Z',
      createdAt: '2026-10-26T10:00:00Z',
      updatedAt: '2026-10-26T10:00:00Z',
    };

    const shareUrl = buildBuyerViralShareUrl(publicPool, 'https://groupbuying.store');
    assert.ok(shareUrl.startsWith('https://wa.me/?text='));

    const decoded = decodeURIComponent(shareUrl);
    assert.ok(decoded.includes('/deals/bhopal/tvs-iqube-electric'));
    assert.ok(decoded.includes('Bhopal'));
    assert.strictEqual(decoded.includes('+91'), false);
    assert.strictEqual(decoded.includes('Rahul'), false);
  });

  test('3. WhatsApp Direct URL: Normalizes raw number and creates valid wa.me link', () => {
    const directUrl = buildWhatsAppDirectUrl('+91-98765-43210', 'Namaste test message');
    assert.strictEqual(directUrl, 'https://wa.me/919876543210?text=Namaste%20test%20message');
  });

  test('4. FIFO Waitlist Retention: Preserves sequence order, leading zero pincode, and quote notes', async () => {
    const { pools } = await createCampaign({
      title: 'Gate 6 Waitlist Campaign',
      categorySlug: 'rooftop-solar',
      status: 'ACTIVE',
      cities: [{ cityName: 'Bhopal', citySlug: 'bhopal', targetBuyers: 1 }],
    });
    const pool = pools[0];

    // Member 1 fills capacity
    await executeJoinPool(pool.id, {
      fullName: 'First Confirmed Member',
      whatsappNumber: '+919876500031',
      pincode: '462001',
    });

    // Insert 2 waitlist applicants in sequence
    const now = new Date().toISOString();
    adapter.rawDb.exec(
      `INSERT INTO pool_waitlist (id, pool_id, sequence_number, full_name, whatsapp_number, city, locality, pincode, pin_code, existing_quote, status, created_at, updated_at)
       VALUES ('wl-g6-1', '${pool.id}', 1, 'Waitlist First', '+919876500032', 'Bhopal', 'MP Nagar', '046201', '046201', 'Quoted ₹1,40,000', 'WAITING', '${now}', '${now}')`
    );

    adapter.rawDb.exec(
      `INSERT INTO pool_waitlist (id, pool_id, sequence_number, full_name, whatsapp_number, city, locality, pincode, pin_code, existing_quote, status, created_at, updated_at)
       VALUES ('wl-g6-2', '${pool.id}', 2, 'Waitlist Second', '+919876500033', 'Bhopal', 'Arera Colony', '046202', '046202', 'Quoted ₹1,45,000', 'WAITING', '${now}', '${now}')`
    );

    // Verify FIFO ordering
    const rows = adapter.rawDb
      .prepare('SELECT sequence_number, full_name, pincode, existing_quote FROM pool_waitlist WHERE pool_id = ? ORDER BY sequence_number ASC')
      .all(pool.id) as { sequence_number: number; full_name: string; pincode: string; existing_quote: string }[];

    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0].sequence_number, 1);
    assert.strictEqual(rows[0].full_name, 'Waitlist First');
    assert.strictEqual(rows[0].pincode, '046201');
    assert.strictEqual(rows[0].existing_quote, 'Quoted ₹1,40,000');

    assert.strictEqual(rows[1].sequence_number, 2);
    assert.strictEqual(rows[1].full_name, 'Waitlist Second');
    assert.strictEqual(rows[1].pincode, '046202');
  });

  test('5. Strict Tri-Classification: Confirmed members, waitlist applicants and demand proposals reside in separate tables', async () => {
    const { pools } = await createCampaign({
      title: 'Gate 6 Separation Campaign',
      categorySlug: 'rooftop-solar',
      status: 'ACTIVE',
      cities: [{ cityName: 'Bhopal', citySlug: 'bhopal', targetBuyers: 10 }],
    });
    const pool = pools[0];

    // 1. Confirmed member
    await executeJoinPool(pool.id, {
      fullName: 'Confirmed Member',
      whatsappNumber: '+919876500041',
      pincode: '462001',
    });

    // 2. Waitlist applicant
    const now = new Date().toISOString();
    adapter.rawDb.exec(
      `INSERT INTO pool_waitlist (id, pool_id, sequence_number, full_name, whatsapp_number, city, pincode, status, created_at, updated_at)
       VALUES ('wl-sep-1', '${pool.id}', 1, 'Waitlisted Applicant', '+919876500042', 'Bhopal', '462002', 'WAITING', '${now}', '${now}')`
    );

    // 3. Demand proposal
    adapter.rawDb.exec(
      `INSERT INTO pool_requests (id, product_name, city, whatsapp_number, status, created_at, updated_at)
       VALUES ('req-sep-1', 'Bespoke Solar Panel', 'Bhopal', '+919876500043', 'REQUESTED', '${now}', '${now}')`
    );

    // Verify strict isolation
    const leadCount = adapter.rawDb.prepare('SELECT COUNT(*) as c FROM pool_leads WHERE pool_id = ?').get(pool.id) as { c: number };
    const waitlistCount = adapter.rawDb.prepare('SELECT COUNT(*) as c FROM pool_waitlist WHERE pool_id = ?').get(pool.id) as { c: number };
    const requestCount = adapter.rawDb.prepare('SELECT COUNT(*) as c FROM pool_requests WHERE id = ?').get('req-sep-1') as { c: number };

    assert.strictEqual(leadCount.c, 1);
    assert.strictEqual(waitlistCount.c, 1);
    assert.strictEqual(requestCount.c, 1);
  });
});
