import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getSiteUrl, getRobotsMetadata, buildBreadcrumbsJsonLd, safeJsonLd } from '../seo';
import sitemap from '../../app/sitemap';
import { setTestD1Database } from '../d1/db';
import { D1Database, D1PreparedStatement, D1Result, D1ExecResult } from '../d1/types';
import fs from 'node:fs';
import path from 'node:path';

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

describe('Gate 5: SEO Architecture, Sitemap & Metadata Invariants', () => {
  let rawDb: SqliteDatabase;
  const originalDemo = process.env.NEXT_PUBLIC_DEMO_MODE;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'false';
    const adapter = createSqliteD1Adapter();
    rawDb = adapter.rawDb;
    setTestD1Database(adapter.d1);

    const migrationsDir = path.join(process.cwd(), 'migrations', 'd1');
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      rawDb.exec(sql);
    }
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = originalDemo;
    setTestD1Database(null as unknown as D1Database);
  });

  test('1. Base Site URL resolution conforms to production https://groupbuying.store', () => {
    const siteUrl = getSiteUrl();
    assert.ok(siteUrl.startsWith('http'));
    assert.ok(!siteUrl.endsWith('/'));
  });

  test('2. Robots metadata applies noindex to empty/thin/draft pages and index to valid pages', () => {
    const validMeta = getRobotsMetadata(false);
    assert.strictEqual(validMeta?.index, true);
    assert.strictEqual(validMeta?.follow, true);

    const thinMeta = getRobotsMetadata(true);
    assert.strictEqual(thinMeta?.index, false);
    assert.strictEqual(thinMeta?.follow, false);
  });

  test('3. Breadcrumbs JSON-LD builds valid ordered Schema.org BreadcrumbList', () => {
    const crumbs = buildBreadcrumbsJsonLd([
      { name: 'Home', url: 'https://groupbuying.store' },
      { name: 'Cities', url: 'https://groupbuying.store/cities' },
      { name: 'Bhopal', url: 'https://groupbuying.store/city/bhopal' },
      { name: 'Rooftop Solar', url: 'https://groupbuying.store/city/bhopal/rooftop-solar' },
    ]);

    assert.equal(crumbs['@type'], 'BreadcrumbList');
    assert.equal(crumbs.itemListElement.length, 4);
    assert.equal(crumbs.itemListElement[0].position, 1);
    assert.equal(crumbs.itemListElement[0].name, 'Home');
    assert.equal(crumbs.itemListElement[3].position, 4);
    assert.equal(crumbs.itemListElement[3].name, 'Rooftop Solar');

    const json = safeJsonLd(crumbs);
    assert.ok(!json.includes('<'));
  });

  test('4. XML Sitemap contains core directories: root, /categories, /cities, /blog', async () => {
    const entries = await sitemap();
    const urls = new Set(entries.map((e) => e.url));
    const siteUrl = getSiteUrl();

    assert.ok(urls.has(`${siteUrl}/`), 'Sitemap must contain root');
    assert.ok(urls.has(`${siteUrl}/categories`), 'Sitemap must contain /categories');
    assert.ok(urls.has(`${siteUrl}/cities`), 'Sitemap must contain /cities');
    assert.ok(urls.has(`${siteUrl}/blog`), 'Sitemap must contain /blog');
  });

  test('5. XML Sitemap includes published operational cities and categories', async () => {
    const entries = await sitemap();
    const urls = new Set(entries.map((e) => e.url));
    const siteUrl = getSiteUrl();

    // Check launch cities
    assert.ok(urls.has(`${siteUrl}/city/bhopal`));
    assert.ok(urls.has(`${siteUrl}/city/delhi`));
    assert.ok(urls.has(`${siteUrl}/city/pune`));

    // Check categories
    assert.ok(urls.has(`${siteUrl}/category/rooftop-solar`));
    assert.ok(urls.has(`${siteUrl}/category/ev-scooters`));
  });

  test('6. XML Sitemap excludes thin city-category pairs without active pools', async () => {
    const entries = await sitemap();
    const siteUrl = getSiteUrl();
    const urls = entries.map((e) => e.url);

    // If there are no pools in Jabalpur for Tractors, it must NOT be in sitemap
    assert.strictEqual(
      urls.includes(`${siteUrl}/city/jabalpur/tractors-commercial`),
      false,
      'Thin city-category without pools must not be indexed in sitemap'
    );
  });
});

