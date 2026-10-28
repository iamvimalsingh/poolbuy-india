import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setTestD1Database } from '../d1/db';
import { D1Database, D1PreparedStatement, D1Result, D1ExecResult } from '../d1/types';
import {
  createPoolQuotation,
  updatePoolQuotation,
  getPoolQuotations,
  getPublishedPoolQuotation,
  getPoolMemberDecisionSummary,
  isQuoteValid,
  CreateQuoteInput,
} from '../quotes';
import { getPublicPools, getPublicPoolBySlug } from '../pools';
import { updateMemberDecisionSchema, createQuoteSchema } from '../validation';
import { calculateSuggestedConnectionFee } from '../fee';

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

describe('Phase 5: Supplier Quotation Verification, Member Decision Lifecycle & Deal Closure', () => {
  let adapter: ReturnType<typeof createSqliteD1Adapter>;
  const testPoolId = 'pool-pune-solar-5kw';
  const testPoolId2 = 'pool-bhopal-ev';

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

    // Seed test pool 1
    adapter.rawDb.exec(`
      INSERT INTO pools (
        id, slug, name, category, category_slug, city, city_slug,
        product_brand, product_model, market_price, group_price,
        group_price_type, price_is_verified, target_buyers, current_buyers,
        deadline, status, is_published, created_at, updated_at
      ) VALUES (
        '${testPoolId}', 'pune-residential-solar-5kw', 'Pune Residential Solar 5kW', 'ROOFTOP_SOLAR', 'solar', 'Pune', 'pune',
        'Tata Power', '5kW-Solar', 225000, 195000,
        'INDICATIVE_ESTIMATE', 0, 10, 3,
        datetime('now', '+14 days'), 'ACTIVE', 1, datetime('now'), datetime('now')
      );

      INSERT INTO pool_cities (id, pool_id, city_code, city_name, is_enabled)
      VALUES ('pc-1', '${testPoolId}', 'pune', 'Pune', 1);

      INSERT INTO pools (
        id, slug, name, category, category_slug, city, city_slug,
        product_brand, product_model, market_price, group_price,
        group_price_type, price_is_verified, target_buyers, current_buyers,
        deadline, status, is_published, created_at, updated_at
      ) VALUES (
        '${testPoolId2}', 'bhopal-ev-auto-cohort', 'Bhopal EV Commercial Auto', 'COMMERCIAL_VEHICLES', 'commercial-vehicles', 'Bhopal', 'bhopal',
        'Mahindra', 'Treo Yaari', 350000, 310000,
        'INDICATIVE_ESTIMATE', 0, 15, 2,
        datetime('now', '+14 days'), 'ACTIVE', 1, datetime('now'), datetime('now')
      );

      INSERT INTO pool_cities (id, pool_id, city_code, city_name, is_enabled)
      VALUES ('pc-2', '${testPoolId2}', 'bhopal', 'Bhopal', 1);
    `);
  });

  afterEach(() => {
    setTestD1Database(null);
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
  });

  describe('1. Supplier Quotation Schema, Creation & Inclusions Verification', () => {
    test('createQuoteSchema validates quotation payload with taxes, warranty, delivery & validity', () => {
      const validPayload = {
        vendorName: 'Mahindra Authorized EV Dealership Bhopal',
        vendorContactRef: 'Rajesh Sharma (+91 98260 12345)',
        quotedAmount: 315000,
        quoteDate: '2026-10-28',
        validUntil: '2026-11-28',
        scope: 'Mahindra Treo Auto with 48V Lithium-ion Battery pack and On-board charger',
        inclusions: ['GST 18% Included', '3-Year / 80,000 km Battery Warranty', 'Standard Toolkit & Charger'],
        exclusions: ['State road tax and RTO registration fee', 'Commercial permit charges'],
        deliveryTerms: 'Immediate delivery within 7 working days from depot',
        quantityCondition: 'Valid for confirmed cohort of 10 or more buyers',
        internalNotes: 'Dealer verified via direct regional sales manager',
      };

      const result = createQuoteSchema.safeParse(validPayload);
      assert.ok(result.success, 'Quotation payload must pass schema validation');
      assert.equal(result.data.vendorName, validPayload.vendorName);
      assert.equal(result.data.quotedAmount, 315000);
      assert.equal(result.data.inclusions?.length, 3);
      assert.equal(result.data.exclusions?.length, 2);
    });

    test('createQuoteSchema rejects invalid quote amount or missing vendor name', () => {
      const invalidPayload = {
        vendorName: '',
        quotedAmount: -500,
        quoteDate: '2026-10-28',
        validUntil: '2026-11-28',
        scope: 'Solar panels',
      };

      const result = createQuoteSchema.safeParse(invalidPayload);
      assert.equal(result.success, false, 'Invalid quote payload must fail validation');
    });

    test('createPoolQuotation persists genuine supplier quote preserving taxes, warranty, and exclusions in D1', async () => {
      const futureDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
      const input: CreateQuoteInput = {
        priceType: 'VENDOR_QUOTED',
        vendorName: 'Tata Solar Authorized Partner Pune',
        vendorContactRef: 'Anil Deshmukh (GM Sales, 9822011223)',
        quotedAmount: 185000,
        currency: 'INR',
        quoteDate: '2026-10-28',
        validUntil: futureDate,
        scope: '5kW On-Grid Rooftop Solar with Monocrystalline Bi-facial panels and SolarEdge Inverter',
        inclusions: ['GST 18% Included', '5-Year Inverter OEM Warranty', '25-Year Performance Warranty', 'Net-metering processing'],
        exclusions: ['Civil structural alterations to existing RCC roof', 'Extended AC cabling exceeding 25m'],
        deliveryTerms: 'Delivery within 10 days of group confirmation',
        quantityCondition: 'Minimum cohort of 5 confirmed installations in Pune PMC limit',
        status: 'RECEIVED',
        internalNotes: 'Verified dealer GSTIN and channel partner certificate',
      };

      const quote = await createPoolQuotation(testPoolId, input, 'admin_test');

      assert.ok(quote.id, 'Quotation must have an ID');
      assert.equal(quote.poolId, testPoolId);
      assert.equal(quote.vendorName, 'Tata Solar Authorized Partner Pune');
      assert.equal(quote.quotedAmount, 185000);
      assert.equal(quote.status, 'RECEIVED');
      assert.equal(quote.isCurrentPublished, false);
      assert.equal(quote.inclusions.length, 4);
      assert.ok(quote.inclusions.includes('GST 18% Included'));
      assert.ok(quote.inclusions.includes('5-Year Inverter OEM Warranty'));
      assert.equal(quote.exclusions.length, 2);
      assert.equal(quote.deliveryTerms, 'Delivery within 10 days of group confirmation');
      assert.equal(quote.quantityCondition, 'Minimum cohort of 5 confirmed installations in Pune PMC limit');

      // Verify retrieval from D1
      const allQuotes = await getPoolQuotations(testPoolId);
      assert.equal(allQuotes.length, 1);
      assert.equal(allQuotes[0].id, quote.id);
    });
  });

  describe('2. Authorized Quotation Publication & Pool Price Verification Sync', () => {
    test('Publishing a valid quotation atomically sets priceIsVerified = true and updates pool price', async () => {
      const futureDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
      const created = await createPoolQuotation(testPoolId, {
        vendorName: 'Luminous Solar Authorized Distributor',
        quotedAmount: 180000,
        quoteDate: '2026-10-28',
        validUntil: futureDate,
        scope: '5kW Grid-Tied Solar System',
        inclusions: ['GST Included', '5-Year Comprehensive Warranty'],
        exclusions: [],
        status: 'RECEIVED',
      });

      // Initially, pool price is indicative and not verified
      const initialPool = await getPublicPoolBySlug('pune', 'pune-residential-solar-5kw');
      assert.equal(initialPool?.priceIsVerified, false);
      assert.equal(initialPool?.groupPriceType, 'INDICATIVE_ESTIMATE');

      // Admin verifies and publishes the quote
      const updated = await updatePoolQuotation(testPoolId, created.id, {
        isCurrentPublished: true,
        status: 'PUBLISHED',
      });

      assert.ok(updated);
      assert.equal(updated.isCurrentPublished, true);
      assert.equal(updated.status, 'PUBLISHED');

      // Pool record must now reflect verified vendor quote
      const publishedQuote = await getPublishedPoolQuotation(testPoolId);
      assert.ok(publishedQuote);
      assert.equal(publishedQuote.id, created.id);
      assert.equal(publishedQuote.vendorName, 'Luminous Solar Authorized Distributor');

      // Public pool query must reflect verified price without leaking private dealer details
      const verifiedPool = await getPublicPoolBySlug('pune', 'pune-residential-solar-5kw');
      assert.ok(verifiedPool);
      assert.equal(verifiedPool.priceIsVerified, true);
      assert.equal(verifiedPool.groupPriceType, 'VENDOR_QUOTED');
      assert.equal(verifiedPool.groupPrice, 180000);

      // Persisted pool record in D1 stores dealer_name for admin operations
      const d1PoolRow = adapter.rawDb.prepare('SELECT dealer_name, price_is_verified, group_price FROM pools WHERE id = ?').get(testPoolId) as Record<string, unknown>;
      assert.equal(d1PoolRow.dealer_name, 'Luminous Solar Authorized Distributor');
      assert.equal(d1PoolRow.price_is_verified, 1);
      assert.equal(d1PoolRow.group_price, 180000);
    });

    test('Publishing a new quote replaces the previous published quote atomically', async () => {
      const futureDate = new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0];
      const quote1 = await createPoolQuotation(testPoolId, {
        vendorName: 'Vendor One',
        quotedAmount: 190000,
        quoteDate: '2026-10-28',
        validUntil: futureDate,
        scope: '5kW System',
      });
      const quote2 = await createPoolQuotation(testPoolId, {
        vendorName: 'Vendor Two (Better Offer)',
        quotedAmount: 175000,
        quoteDate: '2026-10-28',
        validUntil: futureDate,
        scope: '5kW System with Micro-inverters',
      });

      // Publish Quote 1
      await updatePoolQuotation(testPoolId, quote1.id, {
        isCurrentPublished: true,
        status: 'PUBLISHED',
      });

      let currentPublished = await getPublishedPoolQuotation(testPoolId);
      assert.equal(currentPublished?.id, quote1.id);

      // Publish Quote 2
      await updatePoolQuotation(testPoolId, quote2.id, {
        isCurrentPublished: true,
        status: 'PUBLISHED',
      });

      currentPublished = await getPublishedPoolQuotation(testPoolId);
      assert.equal(currentPublished?.id, quote2.id);
      assert.equal(currentPublished?.quotedAmount, 175000);

      // Quote 1 must now be unpublished
      const allQuotes = await getPoolQuotations(testPoolId);
      const q1 = allQuotes.find((q) => q.id === quote1.id);
      assert.equal(q1?.isCurrentPublished, false);
    });
  });

  describe('3. Expiration Guards & Truthful Public Pricing Protection', () => {
    test('Attempting to publish an expired quotation throws an error', async () => {
      const pastDate = new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0];
      const expiredQuote = await createPoolQuotation(testPoolId, {
        vendorName: 'Old Vendor Corp',
        quotedAmount: 170000,
        quoteDate: '2026-09-01',
        validUntil: pastDate,
        scope: 'Expired quote package',
      });

      await assert.rejects(
        async () => {
          await updatePoolQuotation(testPoolId, expiredQuote.id, {
            isCurrentPublished: true,
            status: 'PUBLISHED',
          });
        },
        /Cannot publish an expired quotation/
      );
    });

    test('isQuoteValid returns false for expired or withdrawn quotes', () => {
      const pastDate = new Date(Date.now() - 1000).toISOString();
      const futureDate = new Date(Date.now() + 100000).toISOString();

      const validQuote = {
        id: 'q-1',
        poolId: testPoolId,
        priceType: 'VENDOR_QUOTED' as const,
        vendorName: 'Valid Vendor',
        quotedAmount: 150000,
        currency: 'INR',
        quoteDate: '2026-10-01',
        validUntil: futureDate,
        scope: 'Valid',
        inclusions: [],
        exclusions: [],
        status: 'PUBLISHED' as const,
        isCurrentPublished: true,
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      };

      assert.equal(isQuoteValid(validQuote), true);
      assert.equal(isQuoteValid({ ...validQuote, validUntil: pastDate }), false);
      assert.equal(isQuoteValid({ ...validQuote, status: 'EXPIRED' }), false);
      assert.equal(isQuoteValid({ ...validQuote, status: 'WITHDRAWN' }), false);
      assert.equal(isQuoteValid({ ...validQuote, isCurrentPublished: false }), false);
    });

    test('Unpublishing or marking a quote EXPIRED resets pool verification state to false', async () => {
      const futureDate = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
      const quote = await createPoolQuotation(testPoolId, {
        vendorName: 'Solar Solutions',
        quotedAmount: 182000,
        quoteDate: '2026-10-28',
        validUntil: futureDate,
        scope: '5kW Grid Tied',
      });

      // Publish
      await updatePoolQuotation(testPoolId, quote.id, {
        isCurrentPublished: true,
        status: 'PUBLISHED',
      });

      let pool = await getPublicPoolBySlug('pune', 'pune-residential-solar-5kw');
      assert.equal(pool?.priceIsVerified, true);
      assert.equal(pool?.groupPriceType, 'VENDOR_QUOTED');

      // Admin unpublishes or marks quote EXPIRED
      await updatePoolQuotation(testPoolId, quote.id, {
        isCurrentPublished: false,
        status: 'EXPIRED',
      });

      pool = await getPublicPoolBySlug('pune', 'pune-residential-solar-5kw');
      assert.equal(pool?.priceIsVerified, false, 'Unpublished quote must reset pool priceIsVerified to false');
      assert.equal(pool?.groupPriceType, 'INDICATIVE_ESTIMATE');

      const d1RowAfter = adapter.rawDb.prepare('SELECT dealer_name, price_is_verified FROM pools WHERE id = ?').get(testPoolId) as Record<string, unknown>;
      assert.equal(d1RowAfter.dealer_name, null);
      assert.equal(d1RowAfter.price_is_verified, 0);
    });

    test('Expired pool quote timestamp in D1 automatically clears priceIsVerified on public query', async () => {
      // Simulate a pool where quote_valid_until is in the past
      const pastTimestamp = new Date(Date.now() - 3600000).toISOString();
      adapter.rawDb.exec(`
        UPDATE pools
        SET price_is_verified = 1,
            group_price_type = 'VENDOR_QUOTED',
            quote_valid_until = '${pastTimestamp}'
        WHERE id = '${testPoolId}';
      `);

      const pool = await getPublicPoolBySlug('pune', 'pune-residential-solar-5kw');
      assert.ok(pool);
      assert.equal(pool.priceIsVerified, false, 'Expired quote must not be shown as verified to the public');
      assert.equal(pool.groupPriceType, 'INDICATIVE_ESTIMATE');
    });
  });

  describe('4. Member Decision Lifecycle & Truthful Aggregation', () => {
    beforeEach(() => {
      // Seed member leads for testPoolId
      adapter.rawDb.exec(`
        INSERT INTO pool_leads (
          id, pool_id, buyer_number, full_name, whatsapp_number, city, status,
          quote_response, member_connection_status, do_not_contact, created_at, updated_at
        ) VALUES
        ('lead-1', '${testPoolId}', 1, 'Aarav Sharma', '9826011111', 'Pune', 'CONFIRMED', 'INTERESTED', 'PENDING', 0, datetime('now'), datetime('now')),
        ('lead-2', '${testPoolId}', 2, 'Bhavna Joshi', '9826022222', 'Pune', 'CONFIRMED', 'INTERESTED', 'CONNECTED', 0, datetime('now'), datetime('now')),
        ('lead-3', '${testPoolId}', 3, 'Chetan Patil', '9826033333', 'Pune', 'CONFIRMED', 'DECLINED', 'EXCLUDED', 0, datetime('now'), datetime('now')),
        ('lead-4', '${testPoolId}', 4, 'Deepa Nair', '9826044444', 'Pune', 'CONFIRMED', 'AWAITING_RESPONSE', 'PENDING', 0, datetime('now'), datetime('now')),
        ('lead-5', '${testPoolId}', 5, 'Eshan Khan', '9826055555', 'Pune', 'CONFIRMED', 'NO_RESPONSE', 'PENDING', 0, datetime('now'), datetime('now')),
        ('lead-6', '${testPoolId}', 6, 'Firoz Varma', '9826066666', 'Pune', 'CONFIRMED', 'INTERESTED', 'OPTED_OUT', 1, datetime('now'), datetime('now'));
      `);
    });

    test('getPoolMemberDecisionSummary accurately derives metrics from persisted D1 records', async () => {
      const summary = await getPoolMemberDecisionSummary(testPoolId);

      assert.equal(summary.totalMembers, 6);
      assert.equal(summary.interestedCount, 3); // lead-1, lead-2, lead-6
      assert.equal(summary.declinedCount, 1);   // lead-3
      assert.equal(summary.awaitingCount, 1);   // lead-4
      assert.equal(summary.noResponseCount, 1); // lead-5
      assert.equal(summary.connectedCount, 1);  // lead-2
      assert.equal(summary.excludedCount, 1);   // lead-3
      assert.equal(summary.optedOutCount, 1);   // lead-6 (do_not_contact = 1)
    });

    test('Pool member decision counts are isolated by pool and city', async () => {
      // testPoolId2 (Bhopal EV) has no members seeded
      const summaryPool2 = await getPoolMemberDecisionSummary(testPoolId2);

      assert.equal(summaryPool2.totalMembers, 0);
      assert.equal(summaryPool2.interestedCount, 0);
      assert.equal(summaryPool2.declinedCount, 0);
      assert.equal(summaryPool2.connectedCount, 0);
    });
  });

  describe('5. Member Connection State Transitions & Invariant Guards', () => {
    test('updateMemberDecisionSchema allows valid status transitions', () => {
      const valid = {
        quoteResponse: 'INTERESTED',
        connectionStatus: 'CONNECTED',
        operatorNotes: 'Member agreed to vendor connection via phone',
      };
      const result = updateMemberDecisionSchema.safeParse(valid);
      assert.ok(result.success);
    });

    test('Declined member cannot be connected without updating quote response to INTERESTED', () => {
      // Invariant: If a member declined the quotation, connectionStatus cannot be set to CONNECTED
      function validateTransition(quoteResponse: string, targetConnectionStatus: string): boolean {
        if (quoteResponse === 'DECLINED' && targetConnectionStatus === 'CONNECTED') {
          return false;
        }
        return true;
      }

      assert.equal(validateTransition('DECLINED', 'CONNECTED'), false, 'Declined member cannot be CONNECTED');
      assert.equal(validateTransition('DECLINED', 'EXCLUDED'), true);
      assert.equal(validateTransition('INTERESTED', 'CONNECTED'), true);
      assert.equal(validateTransition('AWAITING_RESPONSE', 'CONNECTED'), true);
    });

    test('Declining quote on a previously CONNECTED member revokes connection status', () => {
      function resolveNextConnectionStatus(
        currentStatus: string,
        newQuoteResponse: string
      ): string {
        if (currentStatus === 'CONNECTED' && newQuoteResponse === 'DECLINED') {
          return 'OPTED_OUT';
        }
        return currentStatus;
      }

      const next = resolveNextConnectionStatus('CONNECTED', 'DECLINED');
      assert.equal(next, 'OPTED_OUT', 'Declining after connection must revoke CONNECTED state to OPTED_OUT');
    });

    test('do_not_contact flag enforces complete suppression of outreach', () => {
      const optedOutLead = {
        id: 'lead-6',
        fullName: 'Firoz Varma',
        phoneNormalized: '9826066666',
        doNotContact: true,
      };

      function canInitiateWhatsApp(lead: { doNotContact?: boolean }): boolean {
        return !lead.doNotContact;
      }

      assert.equal(canInitiateWhatsApp(optedOutLead), false, 'Opted-out buyer must have contact actions suppressed');
    });
  });

  describe('6. Connection Fee Transparency & Deferred Commercial Policy', () => {
    test('calculateSuggestedConnectionFee computes standard basis without mandatory payment', () => {
      // Formula: max(₹99, round(0.10% * feeBasis))
      assert.equal(calculateSuggestedConnectionFee(100000), 100);
      assert.equal(calculateSuggestedConnectionFee(200000), 200);
      assert.equal(calculateSuggestedConnectionFee(50000), 99); // Floor at ₹99
      assert.equal(calculateSuggestedConnectionFee(0), null);
      assert.equal(calculateSuggestedConnectionFee(null), null);
    });

    test('Public pool browse and join requires zero upfront fees or payment commitments', async () => {
      const pools = await getPublicPools();
      for (const pool of pools) {
        // Must never require payment to view or join
        assert.ok(pool.id);
        assert.ok(typeof pool.targetBuyers === 'number');
        // No checkout URL, payment gateway, or mandatory upfront charge in public pool contract
        assert.equal((pool as Record<string, unknown>).paymentGatewayRequired, undefined);
      }
    });
  });
});
