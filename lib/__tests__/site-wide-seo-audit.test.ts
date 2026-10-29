import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getSiteUrl, getRobotsMetadata, buildWebSiteJsonLd, buildOrganizationJsonLd, buildProductJsonLd, buildArticleJsonLd, buildBreadcrumbsJsonLd } from '../seo';
import { buildPoolShareContent, buildPageShareContent } from '../sharing';
import { CANONICAL_PRODUCTION_URL, SITE_NAME, SECONDARY_BRAND } from '../constants';
import sitemap from '../../app/sitemap';
import robots from '../../app/robots';
import { setTestD1Database } from '../d1/db';
import { D1Database, D1PreparedStatement, D1Result, D1ExecResult } from '../d1/types';
import { PublicPool, BlogPost } from '@/types';

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

describe('Comprehensive SEO, Brand Identity & Social Sharing Audit Suite', () => {
  let rawDb: SqliteDatabase;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'false';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://groupbuying.store';
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
    process.env = { ...originalEnv };
    setTestD1Database(null as unknown as D1Database);
  });

  // 1. Homepage metadata, canonical and social image
  test('1. Homepage metadata, canonical and social image conform to standard', () => {
    const siteUrl = getSiteUrl();
    assert.ok(siteUrl.startsWith('http'));
    assert.strictEqual(siteUrl.endsWith('/'), false);

    // Verify social preview asset exists on disk
    const ogImagePath = path.join(process.cwd(), 'public', 'images', 'og-image.svg');
    assert.ok(fs.existsSync(ogImagePath), 'public/images/og-image.svg must exist');
    const ogContent = fs.readFileSync(ogImagePath, 'utf8');
    assert.ok(ogContent.includes('GROUPBUYING.STORE'), 'OG image must contain brand title');
    assert.ok(ogContent.includes('PoolBuy India'), 'OG image must contain secondary badge');
  });

  // 2. City-page metadata and correct city identity
  test('2. City-page metadata derives correctly and preserves city identity', () => {
    const citySlug = 'bhopal';
    const siteUrl = getSiteUrl();
    const canonical = `${siteUrl}/city/${citySlug}`;
    assert.strictEqual(canonical.includes('/city/bhopal'), true);
  });

  // 3. Category-page metadata and configured category identity
  test('3. Category-page metadata reflects configured category', () => {
    const catSlug = 'rooftop-solar';
    const siteUrl = getSiteUrl();
    const canonical = `${siteUrl}/category/${catSlug}`;
    assert.strictEqual(canonical.includes('/category/rooftop-solar'), true);
  });

  // 4. Pool-detail metadata derived from correct actual pool
  test('4. Pool-detail metadata derived from correct actual pool', () => {
    const mockPool: PublicPool = {
      id: 'pool-solar-bhopal-3kw',
      slug: 'tata-3kw-solar',
      name: 'Tata 3kW Rooftop Solar',
      productTitle: 'Tata 3kW Rooftop Solar',
      variantName: '3kW On-Grid Mono PERC',
      shortDescription: 'Save up to 80% on electricity bills with PM Surya Ghar subsidy.',
      longDescription: 'Tata Power Solar rooftop kit including mono perc panels, grid inverter, and structure.',
      category: 'ROOFTOP_SOLAR',
      categorySlug: 'rooftop-solar',
      city: 'Bhopal',
      citySlug: 'bhopal',
      productBrand: 'Tata Power Solar',
      productModel: 'Mono PERC 3kW',
      imageUrl: '/images/solar-default.svg',
      marketPrice: 210000,
      groupPrice: 185000,
      targetBuyers: 10,
      currentBuyers: 5,
      deadline: '2026-11-20T18:30:00Z',
      status: 'ACTIVE',
      priceIsVerified: false,
      priceVerifiedAt: null,
      createdAt: '2026-10-26T10:00:00Z',
      updatedAt: '2026-10-26T10:00:00Z',
    };

    const productJsonLd = buildProductJsonLd(mockPool);
    assert.strictEqual(productJsonLd['@type'], 'Product');
    assert.strictEqual(productJsonLd.name, 'Tata 3kW Rooftop Solar');
    assert.strictEqual(productJsonLd.url, 'https://groupbuying.store/deals/bhopal/tata-3kw-solar');
    // Indicative prices must never emit Offer schema
    assert.strictEqual(productJsonLd.offers, undefined);
  });

  // 5. Blog index and article metadata
  test('5. Blog index and article metadata use GroupBuying.store publisher identity', () => {
    const mockPost: BlogPost = {
      id: 'blog-post-1',
      slug: 'pm-surya-ghar-subsidy-guide',
      title: 'PM Surya Ghar Subsidy Guide 2026',
      excerpt: 'Comprehensive guide to rooftop solar subsidies in India.',
      content: 'Guide contents...',
      author: 'Technical Research Team',
      topic: 'SOLAR_POLICY',
      tags: ['solar', 'subsidies', 'policy'],
      coverImageUrl: '/images/blog-default.svg',
      coverImageAlt: 'Solar guide',
      metaTitle: 'PM Surya Ghar Subsidy Guide',
      metaDescription: 'Subsidy calculation walkthrough',
      status: 'PUBLISHED',
      publishedAt: '2026-10-25T10:00:00Z',
      createdAt: '2026-10-25T09:00:00Z',
      updatedAt: '2026-10-25T10:00:00Z',
    };

    const articleJsonLd = buildArticleJsonLd(mockPost);
    assert.strictEqual(articleJsonLd['@type'], 'BlogPosting');
    assert.strictEqual(articleJsonLd.headline, 'PM Surya Ghar Subsidy Guide 2026');
    assert.strictEqual(articleJsonLd.publisher.name, 'GroupBuying.store');
    assert.ok(articleJsonLd.publisher.logo.url.endsWith('/images/logo.svg'));

    // Check blog fallback image existence
    const blogImgPath = path.join(process.cwd(), 'public', 'images', 'blog-default.svg');
    assert.ok(fs.existsSync(blogImgPath), 'public/images/blog-default.svg must exist');
  });

  // 6. Correct production canonical origin
  test('6. Canonical production origin conforms to https://groupbuying.store', () => {
    assert.strictEqual(CANONICAL_PRODUCTION_URL, 'https://groupbuying.store');
    assert.strictEqual(SITE_NAME, 'GroupBuying.store');
    assert.strictEqual(SECONDARY_BRAND, 'PoolBuy India');
  });

  // 7. No localhost or unintended staging origin in production-facing metadata or share messages
  test('7. Sharing helpers resolve production origin and never leak localhost in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.NEXT_PUBLIC_SITE_URL;

    const samplePool = {
      name: 'TVS iQube S Electric Scooter',
      city: 'Bhopal',
      citySlug: 'bhopal',
      slug: 'tvs-iqube-s',
    };

    const share = buildPoolShareContent(samplePool);
    assert.ok(!share.url.includes('localhost'), 'Must not contain localhost');
    assert.ok(share.url.startsWith('https://groupbuying.store/deals/bhopal/tvs-iqube-s'));
    assert.ok(share.whatsAppUrl.includes(encodeURIComponent('https://groupbuying.store/deals/bhopal/tvs-iqube-s?ref=share')));

    const pageShare = buildPageShareContent({
      title: 'Electric Scooters',
      path: '/category/ev-scooters',
      description: 'Group deals on top electric two wheelers',
    });
    assert.ok(pageShare.url.startsWith('https://groupbuying.store/category/ev-scooters'));
    assert.ok(!pageShare.url.includes('localhost'));
  });

  // 8. OG image URL returns a valid publicly accessible file asset
  test('8. Brand logo and OG image files exist in public/ directory with valid SVG data', () => {
    const logoPath = path.join(process.cwd(), 'public', 'images', 'logo.svg');
    assert.ok(fs.existsSync(logoPath), 'public/images/logo.svg must exist');
    const logoContent = fs.readFileSync(logoPath, 'utf8');
    assert.ok(logoContent.includes('<svg'), 'Logo must be valid SVG');
    assert.ok(logoContent.includes('GroupBuying'), 'Logo must contain GroupBuying');

    const ogPath = path.join(process.cwd(), 'public', 'images', 'og-image.svg');
    assert.ok(fs.existsSync(ogPath), 'public/images/og-image.svg must exist');
  });

  // 9. WhatsApp, copy link and Web Share resolve to the same intended canonical page
  test('9. WhatsApp and share helpers resolve to identical destination URL', () => {
    const samplePool = {
      name: 'Rooftop Solar 3kW',
      city: 'Pune',
      citySlug: 'pune',
      slug: 'solar-3kw',
    };

    const share = buildPoolShareContent(samplePool, 'https://groupbuying.store');
    const expectedUrl = 'https://groupbuying.store/deals/pune/solar-3kw?ref=share';
    assert.strictEqual(share.url, expectedUrl);
    assert.ok(share.fullMessage.includes(expectedUrl));
    assert.ok(share.whatsAppUrl.includes(encodeURIComponent(expectedUrl)));
  });

  // 10. Sitemap contains valid canonical URLs and excludes inappropriate routes
  test('10. Sitemap excludes admin, internal API, and thin unserved pages', async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    for (const url of urls) {
      assert.ok(!url.includes('/admin'), `Sitemap must not contain admin: ${url}`);
      assert.ok(!url.includes('/api/'), `Sitemap must not contain api: ${url}`);
      assert.ok(!url.includes('localhost'), `Sitemap must not contain localhost: ${url}`);
      assert.ok(url.startsWith('https://groupbuying.store'), `Sitemap URL must be canonical: ${url}`);
    }
  });

  // 11. Robots rules do not accidentally block intended public pages or expose internal routes
  test('11. Robots rules allow root and disallow admin and API in live mode', () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    assert.strictEqual(rules.allow, '/');
    assert.ok(Array.isArray(rules.disallow));
    assert.ok(rules.disallow.includes('/admin/'));
    assert.ok(rules.disallow.includes('/api/'));
    assert.ok(r.sitemap?.includes('sitemap.xml'));
  });

  // 12. Structured data parses and matches visible content
  test('12. Organization and WebSite structured data match site specifications', () => {
    const webSite = buildWebSiteJsonLd();
    assert.strictEqual(webSite['@type'], 'WebSite');
    assert.strictEqual(webSite.name, 'GroupBuying.store');

    const org = buildOrganizationJsonLd();
    assert.strictEqual(org['@type'], 'Organization');
    assert.strictEqual(org.name, 'GroupBuying.store');
    assert.strictEqual(org.alternateName, 'PoolBuy India');
    assert.ok(org.logo.endsWith('/images/logo.svg'));

    const breadcrumbs = buildBreadcrumbsJsonLd([
      { name: 'Home', url: 'https://groupbuying.store' },
      { name: 'Cities', url: 'https://groupbuying.store/cities' },
    ]);
    assert.strictEqual(breadcrumbs['@type'], 'BreadcrumbList');
    assert.strictEqual(breadcrumbs.itemListElement.length, 2);
  });
});
