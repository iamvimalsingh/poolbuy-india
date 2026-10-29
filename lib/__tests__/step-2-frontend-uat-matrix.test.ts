import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setTestD1Database } from '../d1/db';
import { D1Database, D1PreparedStatement, D1Result, D1ExecResult } from '../d1/types';
import { executePoolRequest, getPoolRequestById } from '../requests';
import { executeJoinPool, getPublicPools } from '../pools';
import { createCategory, updateCategory, getOperationalCategories } from '../categories';
import { createPoolQuotation, updatePoolQuotation, isQuoteValid, getPublishedPoolQuotation } from '../quotes';

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
        const result = stmt.run(...(boundValues as (string | number | bigint | null)[]));
        return {
          results: [] as T[],
          success: true,
          meta: {
            changes: Number(result.changes),
            duration: 0,
            last_row_id: Number(result.lastInsertRowid),
            served_by: 'test-sqlite',
            queries_executed: 1,
            rows_read: 0,
            rows_written: Number(result.changes),
          },
        };
      },
    };
  }

  const d1Mock: D1Database = {
    prepare(query: string): D1PreparedStatement {
      return createPreparedStatement(query);
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const results: D1Result<T>[] = [];
      sqlite.exec('BEGIN IMMEDIATE TRANSACTION;');
      try {
        for (const stmt of statements) {
          const res = await stmt.run<T>();
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

  return { d1: d1Mock, rawDb: sqlite };
}

function runAllD1Migrations(rawDb: SqliteDatabase) {
  const migrationsDir = path.resolve(process.cwd(), 'migrations/d1');
  const migrationFiles = [
    '0001_initial_schema.sql',
    '0002_add_variants_and_capacity_limits.sql',
    '0003_v73_shared_pool_cities.sql',
    '0004_category_agnostic_city_pools.sql',
    '0005_membership_consent_and_integrity.sql',
    '0006_location_requests.sql',
    '0007_campaigns_and_city_pools.sql',
    '0008_lead_pincode_and_existing_quote.sql',
  ];

  for (const fileName of migrationFiles) {
    const fullPath = path.join(migrationsDir, fileName);
    const sql = fs.readFileSync(fullPath, 'utf8');
    rawDb.exec(sql);
  }
}

describe('Step 2: Frontend & E2E UAT Acceptance Matrix', () => {
  let d1: D1Database;
  let rawDb: SqliteDatabase;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'false';
    const adapter = createSqliteD1Adapter();
    d1 = adapter.d1;
    rawDb = adapter.rawDb;
    runAllD1Migrations(rawDb);
    setTestD1Database(d1);
  });

  // Journey 1: Public Homepage Discovery & City Selection
  test('Journey 1: Public Homepage Discovery & City Selection isolates city cohorts while All India shows all', async () => {
    // Insert test pools in two cities: Pune and Bhopal
    const now = new Date();
    const futureDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

    rawDb.exec(`
      INSERT INTO pools (id, slug, name, city, city_slug, category, category_slug, product_title, target_buyers, current_buyers, status, deadline, is_published)
      VALUES 
        ('p-pune-1', 'pune-ev-scooter', 'Pune EV Scooter Deal', 'Pune', 'pune', 'EV_SCOOTERS', 'ev-scooters', 'Ather 450X', 10, 3, 'ACTIVE', '${futureDate}', 1),
        ('p-bhopal-1', 'bhopal-solar-3kw', 'Bhopal Rooftop Solar', 'Bhopal', 'bhopal', 'ROOFTOP_SOLAR', 'rooftop-solar', '3kW Solar', 10, 5, 'ACTIVE', '${futureDate}', 1);
      INSERT INTO pool_cities (id, pool_id, city_code, city_name, is_enabled)
      VALUES
        ('pc-pune', 'p-pune-1', 'pune', 'Pune', 1),
        ('pc-bhopal', 'p-bhopal-1', 'bhopal', 'Bhopal', 1);
    `);

    // 1a. National query (All India): returns both
    const allPools = await getPublicPools();
    assert.ok(allPools.length >= 2, 'All India returns pools across all cities');
    const citiesRepresented = new Set(allPools.map((p) => p.citySlug));
    assert.ok(citiesRepresented.has('pune'), 'Pune represented in All India');
    assert.ok(citiesRepresented.has('bhopal'), 'Bhopal represented in All India');

    // 1b. City-filtered query for Pune: returns only Pune
    const punePools = await getPublicPools({ citySlug: 'pune' });
    assert.ok(punePools.every((p) => p.citySlug === 'pune'), 'City filter strictly isolates Pune');
    assert.ok(punePools.some((p) => p.id === 'p-pune-1'));

    // 1c. City-filtered query for Bhopal: returns only Bhopal
    const bhopalPools = await getPublicPools({ citySlug: 'bhopal' });
    assert.ok(bhopalPools.every((p) => p.citySlug === 'bhopal'), 'City filter strictly isolates Bhopal');
    assert.ok(bhopalPools.some((p) => p.id === 'p-bhopal-1'));
  });

  // Journey 2: Configurable Dynamic Category Filtering
  test('Journey 2: Dynamic Category Filtering supports active categories and excludes inactive ones', async () => {
    // Operational categories must include active ones
    const cats = await getOperationalCategories();
    assert.ok(cats.length > 0, 'Categories loaded from D1');

    // Create a new dynamic category
    const evCarCat = await createCategory({
      label: 'Electric Passenger Cars',
      slug: 'electric-cars',
      description: 'Collective buying for EV cars',
      isActive: true,
      sortOrder: 10,
    });
    assert.equal(evCarCat.slug, 'electric-cars');

    // Verify it appears in operational categories
    const updatedCats = await getOperationalCategories();
    assert.ok(updatedCats.some((c) => c.slug === 'electric-cars'));

    // Deactivate category
    await updateCategory(evCarCat.id, { isActive: false });
    const activeCatsAfter = await getOperationalCategories();
    assert.ok(!activeCatsAfter.some((c) => c.slug === 'electric-cars'), 'Deactivated category excluded from operational list');
  });

  // Journey 3: Frictionless Pool Request Submission (with and without membership consent)
  test('Journey 3: Public Demand Proposal captures explicit membership consent correctly', async () => {
    // 3a. Submitting with consent (joinPoolConsent = true)
    const reqWithConsent = await executePoolRequest({
      productName: 'Tata Punch EV Adventure',
      requestedTitle: 'Tata Punch EV Adventure',
      fullName: 'Vikram Sengupta',
      whatsappNumber: '9876543210',
      city: 'Pune',
      cityText: 'Pune',
      contactConsent: true,
      joinPoolConsent: true,
    });
    assert.ok(reqWithConsent.id, 'Request ID generated');

    const fetchedWithConsent = await getPoolRequestById(reqWithConsent.id);
    assert.equal(fetchedWithConsent?.joinPoolConsent, true, 'joinPoolConsent should be true');

    // 3b. Submitting without consent (joinPoolConsent = false)
    const reqWithoutConsent = await executePoolRequest({
      productName: 'Mahindra XUV400 EV',
      requestedTitle: 'Mahindra XUV400 EV',
      fullName: 'Aarav Sharma',
      whatsappNumber: '9876543211',
      city: 'Pune',
      cityText: 'Pune',
      contactConsent: true,
      joinPoolConsent: false,
    });
    assert.ok(reqWithoutConsent.id, 'Request ID generated');

    const fetchedWithoutConsent = await getPoolRequestById(reqWithoutConsent.id);
    assert.equal(fetchedWithoutConsent?.joinPoolConsent, false, 'joinPoolConsent should be false');
  });

  // Journey 4: Duplicate Active Request Handling
  test('Journey 4: Duplicate interest submission returns DUPLICATE_ACTIVE_REQUEST with existing request ID', async () => {
    // Submit first request
    const firstReq = await executePoolRequest({
      productName: 'Ather 450 Apex',
      requestedTitle: 'Ather 450 Apex',
      fullName: 'Ramesh Patel',
      whatsappNumber: '9826012345',
      city: 'Indore',
      cityText: 'Indore',
      contactConsent: true,
      joinPoolConsent: false,
    });
    assert.ok(firstReq.id);

    // Duplicate submission with same phone, city, product
    const dupResult = await executePoolRequest({
      productName: 'Ather 450 Apex',
      requestedTitle: 'Ather 450 Apex',
      fullName: 'Ramesh Patel Duplicate',
      whatsappNumber: '9826012345',
      city: 'Indore',
      cityText: 'Indore',
      contactConsent: true,
      joinPoolConsent: true,
    });

    assert.equal(dupResult.isDuplicate, true, 'isDuplicate must be true');
    assert.equal(dupResult.id, firstReq.id, 'Must return the original request ID');
  });

  // Journey 5: Public Pool Joining, Idempotence & FIFO Waitlist Routing
  test('Journey 5: Public Pool Joining enforces sequential buyer numbering, idempotency and FIFO waitlist', async () => {
    const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    rawDb.exec(`
      INSERT INTO pools (id, slug, name, city, city_slug, category, category_slug, product_title, target_buyers, current_buyers, max_waitlist_size, status, deadline, is_published)
      VALUES ('p-uat-join', 'pune-solar-5kw', 'Pune 5kW Solar Pool', 'Pune', 'pune', 'ROOFTOP_SOLAR', 'rooftop-solar', '5kW Solar System', 2, 0, 5, 'ACTIVE', '${futureDate}', 1);
    `);

    // Buyer 1 joins
    const join1 = await executeJoinPool('p-uat-join', {
      fullName: 'Buyer One',
      whatsappNumber: '9876500001',
      city: 'Pune',
      connectionOptIn: true,
      vendorShareConsent: true,
    });
    assert.equal(join1.buyerNumber, 1);
    assert.equal(join1.currentBuyers, 1);

    // Duplicate join by Buyer 1: idempotent, returns existing buyerNumber without increment
    const join1Dup = await executeJoinPool('p-uat-join', {
      fullName: 'Buyer One Again',
      whatsappNumber: '9876500001',
      city: 'Pune',
      connectionOptIn: true,
      vendorShareConsent: true,
    });
    assert.equal(join1Dup.alreadyJoined, true);
    assert.equal(join1Dup.buyerNumber, 1);
    assert.equal(join1Dup.currentBuyers, 1);

    // Buyer 2 joins (reaches target capacity of 2)
    const join2 = await executeJoinPool('p-uat-join', {
      fullName: 'Buyer Two',
      whatsappNumber: '9876500002',
      city: 'Pune',
      connectionOptIn: true,
      vendorShareConsent: true,
    });
    assert.equal(join2.buyerNumber, 2);
    assert.equal(join2.currentBuyers, 2);

    // Buyer 3 joins when pool is at capacity (target reached)
    await assert.rejects(
      async () => {
        await executeJoinPool('p-uat-join', {
          fullName: 'Buyer Three',
          whatsappNumber: '9876500003',
          city: 'Pune',
          connectionOptIn: true,
          vendorShareConsent: true,
        });
      },
      (err: Error) => {
        return err.message === 'TARGET_REACHED';
      }
    );
  });

  // Journey 6: Truthful Quotation Verification
  test('Journey 6: Truthful supplier quotation requires future validUntil date and PUBLISHED status', async () => {
    const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    rawDb.exec(`
      INSERT INTO pools (id, slug, name, city, city_slug, category, category_slug, product_title, target_buyers, current_buyers, status, deadline, is_published)
      VALUES ('p-quote-pool', 'pune-solar-quote', 'Pune Quote Pool', 'Pune', 'pune', 'ROOFTOP_SOLAR', 'rooftop-solar', '5kW Solar', 10, 3, 'ACTIVE', '${futureDate}', 1);
    `);

    // Add received quote and publish it
    const createdQuote = await createPoolQuotation('p-quote-pool', {
      priceType: 'VENDOR_QUOTED',
      vendorName: 'Mahindra Solar Power Pune',
      quotedAmount: 185000,
      currency: 'INR',
      quoteDate: new Date().toISOString(),
      validUntil: futureDate,
      scope: 'Complete 5kW On-Grid Solar Installation with Net Metering',
      inclusions: ['5kW Solar Inverter', 'Tier-1 Mono PERC Panels', 'GST 18%'],
      exclusions: ['Civil Structure Modification'],
      status: 'RECEIVED',
    });

    const publishedQuote = await updatePoolQuotation('p-quote-pool', createdQuote.id, {
      isCurrentPublished: true,
      status: 'PUBLISHED',
    });

    assert.equal(isQuoteValid(publishedQuote), true, 'Future published quote is valid');
    const published = await getPublishedPoolQuotation('p-quote-pool');
    assert.equal(published?.vendorName, 'Mahindra Solar Power Pune');
    assert.equal(published?.quotedAmount, 185000);

    // Expired quote
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const expiredQuote = await createPoolQuotation('p-quote-pool', {
      priceType: 'VENDOR_QUOTED',
      vendorName: 'Old Supplier Pune',
      quotedAmount: 150000,
      currency: 'INR',
      quoteDate: pastDate,
      validUntil: pastDate,
      scope: 'Expired Solar Promotion',
      status: 'PUBLISHED',
      isCurrentPublished: false,
    });
    assert.equal(isQuoteValid(expiredQuote), false, 'Expired quote must not be valid');
  });

  // Journey 7: UI White-on-White Text & High-Contrast Protection
  test('Journey 7: All UI form controls include explicit text-slate-900 and high-contrast styles', () => {
    const componentFiles = [
      'components/pool-request-form.tsx',
      'components/join-pool-modal.tsx',
      'components/location-selector.tsx',
      'components/pool-catalog.tsx',
      'components/admin-campaigns-tab.tsx',
      'components/admin-locations-tab.tsx',
      'components/admin-categories-tab.tsx',
      'components/admin-login-form.tsx',
    ];

    for (const relPath of componentFiles) {
      const fullPath = path.resolve(process.cwd(), relPath);
      assert.ok(fs.existsSync(fullPath), `File ${relPath} must exist`);
      const content = fs.readFileSync(fullPath, 'utf8');

      // Every file with an input must contain explicit text color styling
      if (content.includes('<input')) {
        assert.ok(
          content.includes('text-slate-900') || content.includes('text-gray-900'),
          `Component ${relPath} must have explicit high contrast text styling for form inputs`
        );
      }
    }

    // Verify globals.css default input contrast safety
    const globalsCss = fs.readFileSync(path.resolve(process.cwd(), 'app/globals.css'), 'utf8');
    assert.ok(globalsCss.includes('input, textarea, select'), 'globals.css must include default form control text styling');
    assert.ok(globalsCss.includes('color: #0f172a'), 'globals.css must enforce high-contrast foreground #0f172a');
  });
});
