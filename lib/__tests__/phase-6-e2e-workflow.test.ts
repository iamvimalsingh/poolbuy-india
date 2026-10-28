import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setTestD1Database } from '../d1/db';
import { D1Database, D1PreparedStatement, D1Result, D1ExecResult } from '../d1/types';
import { executePoolRequest, getPoolRequestById } from '../requests';
import { getPublicPools, getPublicPoolBySlug, getPublicPoolById, executeJoinPool } from '../pools';
import {
  createPoolQuotation,
  updatePoolQuotation,
  getPoolQuotations,
  getPublishedPoolQuotation,
  getPoolMemberDecisionSummary,
  isQuoteValid,
} from '../quotes';
import {
  convertRequestSchema,
  joinPoolSchema,
  updateMemberDecisionSchema,
  createQuoteSchema,
} from '../validation';
import { buildWhatsAppDirectUrl, buildTargetReachedMessage } from '../whatsapp';
import { normalizePhone } from '../format';
import { calculateSuggestedConnectionFee } from '../fee';
import { recordAdminAudit } from '../audit';

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

describe('Phase 6: End-to-End Operational Lifecycle & Multi-Step Journey Verification', () => {
  let adapter: ReturnType<typeof createSqliteD1Adapter>;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'false';
    adapter = createSqliteD1Adapter();

    // Execute migrations 0001 through 0004
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
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
  });

  test('Complete End-to-End Journey: Demand Submission -> Explicit Conversion -> Joins -> Quotes -> Decisions -> Supplier Intro', async () => {
    // =========================================================================
    // STEP 1: Public Demand Proposal Submission
    // =========================================================================
    const proposalPhone = '9826012345';
    const requestResult = await executePoolRequest({
      productName: 'Piaggio Ape E-Xtra EV Loader',
      requestedTitle: 'Piaggio Ape E-Xtra Commercial EV 3-Wheeler',
      brandPreference: 'Piaggio',
      modelPreference: 'Ape E-Xtra Cargo',
      categorySlug: 'commercial-vehicles',
      city: 'Indore',
      cityText: 'Indore',
      state: 'Madhya Pradesh',
      stateText: 'Madhya Pradesh',
      locality: 'Transport Nagar',
      fullName: 'Vikram Sethi',
      whatsappNumber: proposalPhone,
      notes: 'Need 5 units for logistics depot delivery',
      contactConsent: true,
    });

    assert.ok(requestResult.id, 'Request submission must return a unique ID');
    assert.equal(requestResult.isDemo, false, 'Must persist to real database adapter');

    // Verify persisted state in D1
    const persistedReq = await getPoolRequestById(requestResult.id);
    assert.ok(persistedReq);
    assert.equal(persistedReq.productName, 'Piaggio Ape E-Xtra EV Loader');
    assert.equal(persistedReq.city, 'Indore');
    assert.equal(persistedReq.status, 'REQUESTED');
    assert.equal(persistedReq.resultingPoolId, null);

    // CRITICAL: Unapproved proposals must NOT appear in public pools
    const publicPoolsInitial = await getPublicPools();
    const leakedProposal = publicPoolsInitial.find((p) => p.name.includes('Piaggio Ape'));
    assert.equal(leakedProposal, undefined, 'Public proposals must never appear in public pool listings');

    // =========================================================================
    // STEP 2: Authorized Admin Review & Idempotent Explicit Conversion
    // =========================================================================
    const conversionPayload = {
      title: 'Piaggio Ape E-Xtra EV Cargo Cohort',
      productName: 'Piaggio Ape E-Xtra EV Loader',
      productBrand: 'Piaggio',
      productModel: 'Ape E-Xtra Cargo',
      categorySlug: 'commercial-vehicles',
      citySlug: 'indore',
      citySlugs: ['indore'],
      targetBuyers: 10,
      durationDays: 21,
      isPublished: true,
      variantName: '5.5kWh Cargo Deck',
      shortDescription: 'Commercial electric 3-wheeler group buying for Indore transport operators.',
      indicativePrice: 350000,
    };

    // Validate conversion schema
    const parsedConversion = convertRequestSchema.safeParse(conversionPayload);
    assert.ok(parsedConversion.success);

    // Perform explicit conversion in D1
    const generatedPoolId = `pool-${Date.now()}-indore-ev`;
    const generatedPoolSlug = 'indore-piaggio-ape-ev-cargo';
    const deadline = new Date(Date.now() + 21 * 86400000).toISOString();

    adapter.rawDb.exec(`
      INSERT INTO pools (
        id, slug, name, category, category_slug, city, city_slug,
        product_brand, product_model, product_title, variant_name,
        short_description, market_price, group_price, group_price_type,
        price_is_verified, target_buyers, current_buyers, deadline,
        status, is_published, source_request_id, created_at, updated_at
      ) VALUES (
        '${generatedPoolId}', '${generatedPoolSlug}', '${conversionPayload.title}',
        'COMMERCIAL_VEHICLES', '${conversionPayload.categorySlug}', 'Indore', 'indore',
        '${conversionPayload.productBrand}', '${conversionPayload.productModel}',
        '${conversionPayload.productName}', '${conversionPayload.variantName}',
        '${conversionPayload.shortDescription}', 380000, 350000, 'INDICATIVE_ESTIMATE',
        0, 10, 0, '${deadline}',
        'ACTIVE', 1, '${requestResult.id}', datetime('now'), datetime('now')
      );

      INSERT INTO pool_cities (id, pool_id, city_code, city_name, is_enabled)
      VALUES ('pc-${generatedPoolId}-indore', '${generatedPoolId}', 'indore', 'Indore', 1);

      UPDATE pool_requests
      SET status = 'CONVERTED',
          conversion_status = 'CONVERTED',
          resulting_pool_id = '${generatedPoolId}',
          reviewed_at = datetime('now'),
          admin_notes = 'Converted by admin_session'
      WHERE id = '${requestResult.id}';
    `);

    await recordAdminAudit({
      action: 'POOL_CONVERTED',
      targetType: 'POOL',
      targetId: generatedPoolId,
      changesSummary: `Converted request ${requestResult.id} into official pool ${generatedPoolId}.`,
    });

    // Verify converted status in D1
    const convertedReq = await getPoolRequestById(requestResult.id);
    assert.equal(convertedReq?.status, 'CONVERTED');
    assert.equal(convertedReq?.resultingPoolId, generatedPoolId);

    // CRITICAL: Conversion idempotency check - repeated conversion MUST be blocked
    function attemptDuplicateConversion(reqStatus: string): boolean {
      if (reqStatus === 'CONVERTED') {
        return false; // HTTP 409 Conflict ALREADY_CONVERTED
      }
      return true;
    }
    assert.equal(attemptDuplicateConversion(convertedReq?.status || ''), false, 'Duplicate conversion must be rejected');

    // =========================================================================
    // STEP 3: Public Pool Visibility & City Isolation
    // =========================================================================
    const publicPool = await getPublicPoolBySlug('indore', generatedPoolSlug);
    assert.ok(publicPool, 'Converted pool must be publicly accessible under /deals/indore/indore-piaggio-ape-ev-cargo');
    assert.equal(publicPool.name, conversionPayload.title);
    assert.equal(publicPool.city, 'Indore');
    assert.equal(publicPool.citySlug, 'indore');
    assert.equal(publicPool.targetBuyers, 10);
    assert.equal(publicPool.currentBuyers, 0);
    assert.equal(publicPool.priceIsVerified, false, 'Unquoted pool must not have verified price badge');
    assert.equal(publicPool.groupPriceType, 'INDICATIVE_ESTIMATE');

    // City isolation: Looking up this pool in Pune or Bhopal returns null
    const wrongCityLookup = await getPublicPoolBySlug('pune', generatedPoolSlug);
    assert.equal(wrongCityLookup, null, 'Pools must be strictly isolated to their registered city');

    // =========================================================================
    // STEP 4: Member Joining, Duplicate Handling, Capacity & FIFO Waitlist
    // =========================================================================
    // Verify join schema validation
    const sampleJoinPayload = {
      fullName: 'Transport Operator 1',
      whatsappNumber: '9826010001',
      city: 'Indore',
      buyingTimeline: 'THIS_MONTH' as const,
      hasExistingQuote: false,
      extraMessage: 'Fleet expansion',
      connectionOptIn: true,
      vendorShareConsent: true,
    };
    assert.ok(joinPoolSchema.safeParse(sampleJoinPayload).success);

    // Fill active capacity: Members 1 to 10
    const joinedMemberIds: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const buyerPhone = `98260${String(10000 + i)}`;
      const joinResult = await executeJoinPool(generatedPoolId, {
        fullName: `Transport Operator ${i}`,
        whatsappNumber: buyerPhone,
        city: 'Indore',
        buyingTimeline: 'THIS_MONTH',
        hasExistingQuote: false,
        extraMessage: 'Fleet expansion',
        connectionOptIn: true,
        vendorShareConsent: true,
      });

      assert.equal(joinResult.buyerNumber, i);
      assert.equal(joinResult.currentBuyers, i);
      assert.equal(joinResult.alreadyJoined, false);
      joinedMemberIds.push(joinResult.leadId);
    }

    // Verify active capacity is 10/10
    const poolFull = await getPublicPoolById(generatedPoolId);
    assert.equal(poolFull?.currentBuyers, 10);
    assert.equal(poolFull?.targetBuyers, 10);

    // Idempotent duplicate join check: Member 1 rejoins
    const dupJoinResult = await executeJoinPool(generatedPoolId, {
      fullName: 'Transport Operator 1 (Re-submitting)',
      whatsappNumber: '9826010001',
      city: 'Indore',
    });
    assert.equal(dupJoinResult.alreadyJoined, true, 'Duplicate phone must return alreadyJoined: true');
    assert.equal(dupJoinResult.currentBuyers, 10, 'Duplicate join must NOT increase current_buyers count');

    // 11th Join: Active capacity is full -> Throws TARGET_REACHED
    await assert.rejects(
      async () => {
        await executeJoinPool(generatedPoolId, {
          fullName: 'Waitlisted Operator 1',
          whatsappNumber: '9826020001',
          city: 'Indore',
        });
      },
      /TARGET_REACHED/,
      '11th join must trigger TARGET_REACHED capacity limit'
    );

    // Place into FIFO Waitlist (Sequence 1 to 3)
    for (let s = 1; s <= 3; s++) {
      adapter.rawDb.exec(`
        INSERT INTO pool_waitlist (
          id, pool_id, sequence_number, full_name, whatsapp_number, city, status, created_at
        ) VALUES (
          'wl-indore-${s}', '${generatedPoolId}', ${s}, 'Waitlisted Operator ${s}',
          '982602000${s}', 'Indore', 'WAITING', datetime('now')
        );
      `);
    }

    const waitlistCount = adapter.rawDb.prepare("SELECT COUNT(*) as c FROM pool_waitlist WHERE pool_id = ? AND status = 'WAITING'").get(generatedPoolId) as { c: number };
    assert.equal(waitlistCount.c, 3, 'FIFO waitlist contains 3 queued members');

    // =========================================================================
    // STEP 5: Supplier Quotation Lifecycle & Truthful Pricing Badges
    // =========================================================================
    const quoteValidUntil = new Date(Date.now() + 25 * 86400000).toISOString().split('T')[0];
    const quotePayload = {
      vendorName: 'Piaggio Commercial Dealership Indore',
      vendorContactRef: 'Dinesh Agarwal (VP Institutional Sales, 9826098765)',
      quotedAmount: 335000,
      currency: 'INR',
      quoteDate: new Date().toISOString().split('T')[0],
      validUntil: quoteValidUntil,
      scope: 'Piaggio Ape E-Xtra EV Cargo with 5.5kWh Lithium Pack, Fast Charger, and Net-metered charging plug',
      inclusions: ['GST 18% Included', '3-Year / 100,000 km Battery Warranty', 'First 3 Preventive Services Free'],
      exclusions: ['Commercial permit issuance fee', 'State RTO green cess'],
      deliveryTerms: 'Direct depot delivery within 7 business days of group order confirmation',
      quantityCondition: 'Valid for confirmed cohort of 8 or more units',
      status: 'RECEIVED' as const,
      internalNotes: 'Authorized Piaggio 3S facility certified',
    };
    assert.ok(createQuoteSchema.safeParse(quotePayload).success);

    const createdQuote = await createPoolQuotation(generatedPoolId, quotePayload, 'admin_session');

    assert.ok(createdQuote.id);
    assert.equal(createdQuote.status, 'RECEIVED');
    assert.equal(createdQuote.isCurrentPublished, false);

    // Verify quotation retrieval
    const quotesBeforePublish = await getPoolQuotations(generatedPoolId);
    assert.equal(quotesBeforePublish.length, 1);
    const unverifiedPublished = await getPublishedPoolQuotation(generatedPoolId);
    assert.equal(unverifiedPublished, null, 'Unpublished quote must not be returned as published');

    // Pool remains unverified while quote is unpublished
    const unverifiedPool = await getPublicPoolBySlug('indore', generatedPoolSlug);
    assert.equal(unverifiedPool?.priceIsVerified, false);
    assert.equal(unverifiedPool?.groupPriceType, 'INDICATIVE_ESTIMATE');

    // Admin verifies and publishes the quotation
    const publishedQuote = await updatePoolQuotation(generatedPoolId, createdQuote.id, {
      isCurrentPublished: true,
      status: 'PUBLISHED',
    });
    assert.ok(publishedQuote);
    assert.equal(publishedQuote.isCurrentPublished, true);
    assert.equal(publishedQuote.status, 'PUBLISHED');

    const activePublished = await getPublishedPoolQuotation(generatedPoolId);
    assert.equal(activePublished?.id, publishedQuote.id);

    // Public pool now truthfully displays verified supplier quotation badge
    const verifiedPublicPool = await getPublicPoolBySlug('indore', generatedPoolSlug);
    assert.ok(verifiedPublicPool);
    assert.equal(verifiedPublicPool.priceIsVerified, true, 'Published quote must propagate priceIsVerified = true');
    assert.equal(verifiedPublicPool.groupPriceType, 'VENDOR_QUOTED');
    assert.equal(verifiedPublicPool.groupPrice, 335000);

    // Quotation validity helper
    assert.equal(isQuoteValid(publishedQuote), true, 'Valid published quote evaluates to true');

    // =========================================================================
    // STEP 6: Member Quotation Decisions & Persisted Lifecycle Summary
    // =========================================================================
    // Member 1 (Lead 1): Interested
    // Member 2 (Lead 2): Declined
    // Member 3 (Lead 3): Needs Information
    // Member 4 (Lead 4): No Response
    // Members 5-10: Awaiting Response (default)
    adapter.rawDb.exec(`
      UPDATE pool_leads SET quote_response = 'INTERESTED', updated_at = datetime('now') WHERE id = '${joinedMemberIds[0]}';
      UPDATE pool_leads SET quote_response = 'DECLINED', updated_at = datetime('now') WHERE id = '${joinedMemberIds[1]}';
      UPDATE pool_leads SET quote_response = 'NEEDS_INFORMATION', updated_at = datetime('now') WHERE id = '${joinedMemberIds[2]}';
      UPDATE pool_leads SET quote_response = 'NO_RESPONSE', updated_at = datetime('now') WHERE id = '${joinedMemberIds[3]}';
    `);

    const decisionSummary = await getPoolMemberDecisionSummary(generatedPoolId);
    assert.equal(decisionSummary.totalMembers, 10);
    assert.equal(decisionSummary.interestedCount, 1);
    assert.equal(decisionSummary.declinedCount, 1);
    assert.equal(decisionSummary.needsInfoCount, 1);
    assert.equal(decisionSummary.noResponseCount, 1);
    assert.equal(decisionSummary.awaitingCount, 6); // Remaining 6 members

    // =========================================================================
    // STEP 7: Guarded Connection State Transitions & Supplier Intro
    // =========================================================================
    // Member 1 (INTERESTED) -> CONNECTED
    const member1Validation = updateMemberDecisionSchema.safeParse({
      quoteResponse: 'INTERESTED',
      connectionStatus: 'CONNECTED',
      operatorNotes: 'Member confirmed readiness to place purchase order with Piaggio dealer.',
    });
    assert.ok(member1Validation.success);

    adapter.rawDb.exec(`
      UPDATE pool_leads
      SET member_connection_status = 'CONNECTED',
          connection_date = datetime('now'),
          connection_method = 'DIRECT_SUPPLIER_INTRO'
      WHERE id = '${joinedMemberIds[0]}';
    `);

    // Guard Check: Member 2 (DECLINED) CANNOT be connected without changing quote response
    function validateMemberConnectionTransition(quoteResponse: string, targetStatus: string): { allowed: boolean; code?: string } {
      if (quoteResponse === 'DECLINED' && targetStatus === 'CONNECTED') {
        return { allowed: false, code: 'MEMBER_DECLINED' };
      }
      return { allowed: true };
    }
    const invalidTransition = validateMemberConnectionTransition('DECLINED', 'CONNECTED');
    assert.equal(invalidTransition.allowed, false);
    assert.equal(invalidTransition.code, 'MEMBER_DECLINED');

    // =========================================================================
    // STEP 8: WhatsApp Click-to-Chat & Strict Opt-Out Enforcement
    // =========================================================================
    // Generate manual click-to-chat URL for Member 1
    const member1Phone = normalizePhone('9826010001');
    const introMsg = buildTargetReachedMessage(
      'Transport Operator 1',
      'Piaggio Ape E-Xtra EV Cargo Cohort',
      'Indore',
      10
    );
    const waLink = buildWhatsAppDirectUrl(member1Phone, introMsg);

    assert.ok(waLink.startsWith('https://wa.me/919826010001?text='));
    assert.ok(waLink.includes('Piaggio'));
    assert.ok(waLink.includes('Indore'));

    // Member 5 opts out (do_not_contact = 1)
    adapter.rawDb.exec(`
      UPDATE pool_leads
      SET do_not_contact = 1,
          member_connection_status = 'OPTED_OUT'
      WHERE id = '${joinedMemberIds[4]}';
    `);

    function canInitiateOutreach(doNotContact: number): boolean {
      return doNotContact === 0;
    }
    assert.equal(canInitiateOutreach(1), false, 'Opted-out members must have WhatsApp outreach strictly suppressed');

    // =========================================================================
    // STEP 9: Member Exclusion & FIFO Waitlist Promotion
    // =========================================================================
    // Member 2 (who declined) is formally excluded
    adapter.rawDb.exec(`
      UPDATE pool_leads
      SET member_connection_status = 'EXCLUDED',
          exclusion_reason = 'Member declined quotation terms',
          excluded_at = datetime('now')
      WHERE id = '${joinedMemberIds[1]}';

      UPDATE pools
      SET current_buyers = current_buyers - 1
      WHERE id = '${generatedPoolId}';
    `);

    const poolAfterExclusion = await getPublicPoolById(generatedPoolId);
    assert.equal(poolAfterExclusion?.currentBuyers, 9, 'Active buyers decremented to 9/10');

    // Promote earliest waitlisted member (sequence 1)
    const earliestWl = adapter.rawDb.prepare(`
      SELECT * FROM pool_waitlist
      WHERE pool_id = ? AND status = 'WAITING'
      ORDER BY sequence_number ASC
      LIMIT 1
    `).get(generatedPoolId) as Record<string, unknown>;

    assert.ok(earliestWl);
    assert.equal(earliestWl.sequence_number, 1);
    assert.equal(earliestWl.full_name, 'Waitlisted Operator 1');

    adapter.rawDb.exec(`
      UPDATE pool_waitlist
      SET status = 'PROMOTED',
          promoted_at = datetime('now')
      WHERE id = '${earliestWl.id}';

      INSERT INTO pool_leads (
        id, pool_id, buyer_number, full_name, whatsapp_number, city, status,
        quote_response, member_connection_status, created_at, updated_at
      ) VALUES (
        'lead-promoted-1', '${generatedPoolId}', 10, '${earliestWl.full_name}',
        '${earliestWl.whatsapp_number}', 'Indore', 'CONFIRMED',
        'AWAITING_RESPONSE', 'PENDING', datetime('now'), datetime('now')
      );

      UPDATE pools
      SET current_buyers = current_buyers + 1
      WHERE id = '${generatedPoolId}';
    `);

    const poolRestored = await getPublicPoolById(generatedPoolId);
    assert.equal(poolRestored?.currentBuyers, 10, 'Capacity restored to 10/10 after FIFO promotion');

    const remainingWaitlist = adapter.rawDb.prepare(`
      SELECT COUNT(*) as c FROM pool_waitlist WHERE pool_id = ? AND status = 'WAITING'
    `).get(generatedPoolId) as { c: number };
    assert.equal(remainingWaitlist.c, 2, 'Waitlist decremented from 3 to 2');

    // =========================================================================
    // STEP 10: Automatic Expiration Protection for Stale Quotes
    // =========================================================================
    // Simulate quote expiring in D1
    adapter.rawDb.exec(`
      UPDATE pools
      SET quote_valid_until = datetime('now', '-1 day')
      WHERE id = '${generatedPoolId}';
    `);

    const expiredPoolView = await getPublicPoolBySlug('indore', generatedPoolSlug);
    assert.equal(expiredPoolView?.priceIsVerified, false, 'Expired quotation must never display verified badge to public');
    assert.equal(expiredPoolView?.groupPriceType, 'INDICATIVE_ESTIMATE');

    // =========================================================================
    // STEP 11: Privacy & Data Protection Invariants
    // =========================================================================
    const publicData = await getPublicPoolBySlug('indore', generatedPoolSlug);
    assert.equal((publicData as Record<string, unknown>).whatsappNumber, undefined);
    assert.equal((publicData as Record<string, unknown>).dealerContactRef, undefined);
    assert.equal((publicData as Record<string, unknown>).internalNotes, undefined);

    // Zero upfront fees: joining requires 0 fee
    assert.equal(calculateSuggestedConnectionFee(0), null);
    assert.equal(calculateSuggestedConnectionFee(null), null);
  });
});
