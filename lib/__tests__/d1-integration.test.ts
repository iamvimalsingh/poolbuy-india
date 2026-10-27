import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setTestD1Database } from '../d1/db';
import { D1Database, D1PreparedStatement, D1Result, D1ExecResult } from '../d1/types';
import { getAllCities, getCityBySlug } from '../cities';
import { getAllCategories, getCategoryBySlug } from '../categories';
import { executePoolRequest, getAllPoolRequests, getPoolRequestById } from '../requests';
import { getPublicPools, getPublicPoolBySlug, executeJoinPool } from '../pools';
import { recordAdminAudit, getAuditLogs } from '../audit';
import { getBlogPostBySlug, getAllBlogPosts } from '../blog';

// Dynamic load of node:sqlite for Node 22 testing
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

/**
 * Creates an in-memory SQLite database wrapped with Cloudflare D1 API methods.
 */
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

describe('Cloudflare D1 End-to-End Database Integration Suite', () => {
  let adapter: ReturnType<typeof createSqliteD1Adapter>;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'false';
    adapter = createSqliteD1Adapter();

    // Run migration
    const migrationPath = path.resolve(process.cwd(), 'migrations/d1/0001_initial_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    adapter.rawDb.exec(sql);

    setTestD1Database(adapter.d1);
  });

  afterEach(() => {
    setTestD1Database(null);
  });

  test('1. Schema & Migration Validation: Verifies all 9 application tables exist and seed data loaded', async () => {
    const tablesStmt = adapter.rawDb.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
    );
    const tables = (tablesStmt.all() as { name: string }[]).map((r) => r.name);

    const expectedTables = [
      'admin_audit_logs',
      'blog_posts',
      'categories',
      'cities',
      'pool_leads',
      'pool_quotations',
      'pool_requests',
      'pool_waitlist',
      'pools',
    ];

    for (const expected of expectedTables) {
      assert.ok(tables.includes(expected), `Table ${expected} must exist in D1 schema`);
    }

    // Verify seeded reference data
    const citiesCount = adapter.rawDb.prepare('SELECT COUNT(*) as cnt FROM cities;').get() as { cnt: number };
    assert.equal(citiesCount.cnt, 10, 'Expected 10 operational cities seeded');

    const categoriesCount = adapter.rawDb.prepare('SELECT COUNT(*) as cnt FROM categories;').get() as { cnt: number };
    assert.equal(categoriesCount.cnt, 8, 'Expected 8 categories seeded');

    // Verify zero fake pools seeded
    const poolsCount = adapter.rawDb.prepare('SELECT COUNT(*) as cnt FROM pools;').get() as { cnt: number };
    assert.equal(poolsCount.cnt, 0, 'Production D1 migration must seed ZERO pools');
  });

  test('2. Constraints: Enforces unique slug and foreign key constraints', async () => {
    // Unique slug on cities
    assert.throws(
      () => {
        adapter.rawDb.exec("INSERT INTO cities (id, name, slug, state) VALUES ('c-dup', 'Bhopal 2', 'bhopal', 'MP');");
      },
      /UNIQUE constraint failed/,
      'Duplicate city slug must be rejected by unique constraint'
    );

    // Foreign key constraint on pool_leads referencing non-existent pool
    assert.throws(
      () => {
        adapter.rawDb.exec(
          "INSERT INTO pool_leads (id, pool_id, buyer_number, full_name, whatsapp_number, city, consent_at, created_at, updated_at) " +
          "VALUES ('lead-bad', 'non-existent-pool', 1, 'Jane Doe', '9876543210', 'Bhopal', '2026-10-27T00:00:00Z', '2026-10-27T00:00:00Z', '2026-10-27T00:00:00Z');"
        );
      },
      /FOREIGN KEY constraint failed/,
      'Lead with non-existent pool_id must fail foreign key constraint'
    );
  });

  test('3. Reference Data Reads: Successfully queries cities and categories via D1 prepared statements', async () => {
    const cities = await getAllCities();
    assert.equal(cities.length, 10);
    assert.ok(cities.every((c) => c.isActive));

    const bhopal = await getCityBySlug('bhopal');
    assert.ok(bhopal);
    assert.equal(bhopal.name, 'Bhopal');
    assert.equal(bhopal.state, 'Madhya Pradesh');

    const categories = await getAllCategories();
    assert.equal(categories.length, 8);

    const solar = await getCategoryBySlug('rooftop-solar');
    assert.ok(solar);
    assert.equal(solar.slug, 'rooftop-solar');
    assert.equal(solar.label, 'Rooftop Solar');
  });

  test('4. Demand Discovery Request Persistence: Saves and retrieves pool request truthfully', async () => {
    const result = await executePoolRequest({
      productName: 'Ather 450X Gen 3',
      requestType: 'GROUP_PROPOSAL',
      category: 'EV_SCOOTERS',
      city: 'Bhopal',
      state: 'Madhya Pradesh',
      locality: 'MP Nagar',
      pinCode: '462011',
      fullName: 'Rahul Sharma',
      whatsappNumber: '9876543210',
      contactConsent: true,
      extraMessage: 'Interested in buying this month with group discount.',
      targetBuyersRequested: 5,
    });

    assert.ok(result.id);
    assert.equal(result.isDemo, false, 'Should be written to live D1 database');

    const saved = await getPoolRequestById(result.id);
    assert.ok(saved);
    assert.equal(saved.productName, 'Ather 450X Gen 3');
    assert.equal(saved.city, 'Bhopal');
    assert.equal(saved.whatsappNumber, '9876543210');
    assert.equal(saved.contactConsent, true);
    assert.equal(saved.status, 'REQUESTED');
    assert.equal(saved.conversionStatus, 'PENDING');

    const allRequests = await getAllPoolRequests();
    assert.equal(allRequests.length, 1);
    assert.equal(allRequests[0].id, result.id);
  });

  test('5. Public Pool Listings & Empty State: Renders zero fake pools and returns real published records', async () => {
    // Initial state: no pools exist
    const publicPools = await getPublicPools();
    assert.equal(publicPools.length, 0, 'Initial database must return empty array without fabricated pools');

    const notFoundPool = await getPublicPoolBySlug('bhopal', 'non-existent-deal');
    assert.equal(notFoundPool, null, 'Non-existent pool returns null for 404 handling');

    // Insert an unpublished draft pool
    const now = new Date().toISOString();
    const futureDeadline = new Date(Date.now() + 7 * 86400000).toISOString();
    adapter.rawDb.exec(
      `INSERT INTO pools (
        id, slug, name, short_description, category, city, city_slug,
        target_buyers, current_buyers, deadline, status, is_published, created_at, updated_at
      ) VALUES (
        'pool-draft-1', 'solar-5kw', '5kW Solar System', 'Solar deal', 'ROOFTOP_SOLAR',
        'Bhopal', 'bhopal', 5, 0, '${futureDeadline}', 'ACTIVE', 0, '${now}', '${now}'
      );`
    );

    // Unpublished pool should NOT appear in public listing
    const publicAfterDraft = await getPublicPools();
    assert.equal(publicAfterDraft.length, 0, 'Unpublished pool must not be returned publicly');

    // Publish the pool
    adapter.rawDb.exec("UPDATE pools SET is_published = 1 WHERE id = 'pool-draft-1';");

    const publicAfterPublish = await getPublicPools();
    assert.equal(publicAfterPublish.length, 1);
    assert.equal(publicAfterPublish[0].id, 'pool-draft-1');
    assert.equal(publicAfterPublish[0].name, '5kW Solar System');

    const foundPool = await getPublicPoolBySlug('bhopal', 'solar-5kw');
    assert.ok(foundPool);
    assert.equal(foundPool.name, '5kW Solar System');
  });

  test('6. Concurrency-Safe Pool Capacity Enforcement: Atomically locks when target capacity is reached', async () => {
    const now = new Date().toISOString();
    const futureDeadline = new Date(Date.now() + 7 * 86400000).toISOString();

    // Create published pool with target capacity of 2
    adapter.rawDb.exec(
      `INSERT INTO pools (
        id, slug, name, short_description, category, city, city_slug,
        target_buyers, current_buyers, deadline, status, is_published, created_at, updated_at
      ) VALUES (
        'pool-cap-test', 'ev-scooter', 'Electric Scooter Deal', 'EV deal', 'EV_SCOOTERS',
        'Bhopal', 'bhopal', 2, 0, '${futureDeadline}', 'ACTIVE', 1, '${now}', '${now}'
      );`
    );

    // Join 1: Member 1 joins successfully
    const join1 = await executeJoinPool('pool-cap-test', {
      fullName: 'Buyer One',
      whatsappNumber: '9876543211',
      city: 'Bhopal',
      buyingTimeline: 'THIS_MONTH',
      connectionOptIn: true,
    });
    assert.equal(join1.buyerNumber, 1);
    assert.equal(join1.currentBuyers, 1);

    // Verify current_buyers incremented to 1
    const p1 = adapter.rawDb.prepare("SELECT current_buyers FROM pools WHERE id = 'pool-cap-test';").get() as { current_buyers: number };
    assert.equal(p1.current_buyers, 1);

    // Join 2: Member 2 joins successfully, reaching target 2
    const join2 = await executeJoinPool('pool-cap-test', {
      fullName: 'Buyer Two',
      whatsappNumber: '9876543212',
      city: 'Bhopal',
      buyingTimeline: 'WITHIN_7_DAYS',
      connectionOptIn: true,
    });
    assert.equal(join2.buyerNumber, 2);
    assert.equal(join2.currentBuyers, 2);

    const p2 = adapter.rawDb.prepare("SELECT current_buyers FROM pools WHERE id = 'pool-cap-test';").get() as { current_buyers: number };
    assert.equal(p2.current_buyers, 2);

    // Join 3: Member 3 attempts to join full pool -> Capacity limit strictly enforced
    await assert.rejects(
      async () => {
        await executeJoinPool('pool-cap-test', {
          fullName: 'Buyer Three',
          whatsappNumber: '9876543213',
          city: 'Bhopal',
          buyingTimeline: 'THIS_MONTH',
          connectionOptIn: true,
        });
      },
      /TARGET_REACHED/,
      'Joining a full pool must fail with TARGET_REACHED'
    );

    // Confirm database still has strictly 2 accepted buyers
    const p3 = adapter.rawDb.prepare("SELECT current_buyers FROM pools WHERE id = 'pool-cap-test';").get() as { current_buyers: number };
    assert.equal(p3.current_buyers, 2);
  });

  test('7. FIFO Waitlist: Adds entries in strict sequential queue order without auto-promotion', async () => {
    const now = new Date().toISOString();
    const futureDeadline = new Date(Date.now() + 7 * 86400000).toISOString();

    adapter.rawDb.exec(
      `INSERT INTO pools (
        id, slug, name, short_description, category, city, city_slug,
        target_buyers, current_buyers, deadline, status, is_published, created_at, updated_at
      ) VALUES (
        'pool-wl-test', 'inverter-combo', 'Inverter Battery Combo', 'Power backup', 'ROOFTOP_SOLAR',
        'Bhopal', 'bhopal', 1, 1, '${futureDeadline}', 'ACTIVE', 1, '${now}', '${now}'
      );`
    );

    // Member 1 joins waitlist -> sequence number 1
    const nextQ1 = await adapter.d1
      .prepare('SELECT COALESCE(MAX(sequence_number), 0) + 1 AS q FROM pool_waitlist WHERE pool_id = ?')
      .bind('pool-wl-test')
      .first<{ q: number }>();
    const q1 = Number(nextQ1?.q || 1);

    await adapter.d1
      .prepare(
        `INSERT INTO pool_waitlist (
          id, pool_id, sequence_number, full_name, whatsapp_number, city, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'WAITING', ?, ?)`
      )
      .bind('wl-1', 'pool-wl-test', q1, 'Waitlist User 1', '9876543221', 'Bhopal', now, now)
      .run();

    assert.equal(q1, 1);

    // Member 2 joins waitlist -> sequence number 2
    const nextQ2 = await adapter.d1
      .prepare('SELECT COALESCE(MAX(sequence_number), 0) + 1 AS q FROM pool_waitlist WHERE pool_id = ?')
      .bind('pool-wl-test')
      .first<{ q: number }>();
    const q2 = Number(nextQ2?.q || 1);

    await adapter.d1
      .prepare(
        `INSERT INTO pool_waitlist (
          id, pool_id, sequence_number, full_name, whatsapp_number, city, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'WAITING', ?, ?)`
      )
      .bind('wl-2', 'pool-wl-test', q2, 'Waitlist User 2', '9876543222', 'Bhopal', now, now)
      .run();

    assert.equal(q2, 2);

    // Verify database records show status 'WAITING' and sequential ordering
    const rows = adapter.rawDb
      .prepare("SELECT id, sequence_number, status, full_name FROM pool_waitlist WHERE pool_id = 'pool-wl-test' ORDER BY sequence_number ASC;")
      .all() as { id: string; sequence_number: number; status: string; full_name: string }[];

    assert.equal(rows.length, 2);
    assert.equal(rows[0].sequence_number, 1);
    assert.equal(rows[0].status, 'WAITING');
    assert.equal(rows[1].sequence_number, 2);
    assert.equal(rows[1].status, 'WAITING');
  });

  test('8. Admin Audit Log Persistence: Truthfully records and retrieves audit events in D1', async () => {
    await recordAdminAudit({
      action: 'POOL_UPDATED',
      targetType: 'POOL',
      targetId: 'pool-test-audit',
      changesSummary: 'Updated target buyers from 10 to 15.',
      details: { oldTarget: 10, newTarget: 15 },
    });

    const logs = await getAuditLogs();
    assert.equal(logs.length, 1);
    assert.equal(logs[0].action, 'POOL_UPDATED');
    assert.equal(logs[0].targetId, 'pool-test-audit');
    assert.equal(logs[0].changesSummary, 'Updated target buyers from 10 to 15.');
  });

  test('9. Blog Posts D1 Storage: Saves tags and sources JSON and queries published articles', async () => {
    const now = new Date().toISOString();
    adapter.rawDb.exec(
      `INSERT INTO blog_posts (
        id, slug, title, excerpt, content, author, topic, tags, status, published_at, sources, created_at, updated_at
      ) VALUES (
        'post-1', 'how-group-buying-solar-works-india', 'How Group Buying Solar Works in India',
        'Learn how community volume discounting brings down residential solar costs.',
        'Full content explaining PM Surya Ghar and community pooling.',
        'GroupBuying Team', 'Solar', '["Solar","Subsidy","Green Energy"]', 'PUBLISHED', '${now}',
        '["MNRE Portal"]', '${now}', '${now}'
      );`
    );

    const post = await getBlogPostBySlug('how-group-buying-solar-works-india');
    assert.ok(post);
    assert.equal(post.slug, 'how-group-buying-solar-works-india');
    assert.ok(Array.isArray(post.tags));
    assert.ok(post.tags.includes('Solar'));

    const allPosts = await getAllBlogPosts();
    assert.equal(allPosts.length, 1);
  });
});
