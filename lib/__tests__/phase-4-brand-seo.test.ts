import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  SITE_NAME,
  SECONDARY_BRAND,
  CANONICAL_PRODUCTION_URL,
  SITE_TAGLINE,
  SITE_DESCRIPTION,
} from '../constants';
import {
  getSiteUrl,
  getRobotsMetadata,
  buildWebSiteJsonLd,
  buildOrganizationJsonLd,
  buildProductJsonLd,
  buildArticleJsonLd,
} from '../seo';
import { PublicPool, BlogPost } from '@/types';

describe('Phase 4: Brand & SEO Alignment Tests', () => {
  describe('Brand Hierarchy Constants', () => {
    test('Primary brand is GroupBuying.store', () => {
      assert.equal(SITE_NAME, 'GroupBuying.store');
    });

    test('Secondary brand label is PoolBuy India', () => {
      assert.equal(SECONDARY_BRAND, 'PoolBuy India');
    });

    test('Production canonical domain is https://groupbuying.store', () => {
      assert.equal(CANONICAL_PRODUCTION_URL, 'https://groupbuying.store');
    });

    test('Tagline and description highlight solar, power backup, and water softeners', () => {
      assert.ok(SITE_TAGLINE.includes('Solar, Power Backup & Water Softener'));
      assert.ok(SITE_DESCRIPTION.includes('rooftop solar'));
      assert.ok(SITE_DESCRIPTION.includes('inverter-battery'));
      assert.ok(SITE_DESCRIPTION.includes('water softeners'));
    });
  });

  describe('Site URL and Canonical Resolution', () => {
    test('Resolves sanitized URL without trailing slashes', () => {
      const url = getSiteUrl();
      assert.ok(!url.endsWith('/'));
      assert.ok(url.startsWith('http://') || url.startsWith('https://'));
    });
  });

  describe('Structured Data (JSON-LD) Site Identity', () => {
    test('WebSite schema uses GroupBuying.store as primary site identity', () => {
      const website = buildWebSiteJsonLd();
      assert.equal(website['@type'], 'WebSite');
      assert.equal(website.name, 'GroupBuying.store');
      assert.ok(typeof website.url === 'string');
    });

    test('Organization schema reflects GroupBuying.store with PoolBuy India alternate name', () => {
      const org = buildOrganizationJsonLd();
      assert.equal(org['@type'], 'Organization');
      assert.equal(org.name, 'GroupBuying.store');
      assert.equal(org.alternateName, 'PoolBuy India');
    });

    test('BlogPosting schema reflects GroupBuying.store publisher', () => {
      const mockPost: BlogPost = {
        id: 'post-1',
        slug: 'rooftop-solar-guide-bhopal',
        title: 'Complete Guide to Rooftop Solar in Bhopal',
        excerpt: 'How to save on electricity with PM Surya Ghar subsidy.',
        content: 'Article content here...',
        author: 'PoolBuy Technical Team',
        topic: 'SOLAR_POLICY',
        tags: ['solar', 'bhopal', 'subsidies'],
        coverImageUrl: null,
        coverImageAlt: null,
        metaTitle: 'Solar Guide',
        metaDescription: 'Solar Guide Desc',
        status: 'PUBLISHED',
        publishedAt: '2026-10-26T12:00:00Z',
        createdAt: '2026-10-26T10:00:00Z',
        updatedAt: '2026-10-26T12:00:00Z',
      };

      const articleJsonLd = buildArticleJsonLd(mockPost);
      assert.equal(articleJsonLd['@type'], 'BlogPosting');
      assert.equal(articleJsonLd.publisher.name, 'GroupBuying.store');
    });

    test('Product schema formats product deal properly', () => {
      const mockPool: PublicPool = {
        id: 'pool-solar-3kw',
        slug: '3kw-solar-bhopal',
        name: '3 kW Residential Rooftop Solar Kit',
        shortDescription: 'Complete 3kW grid-tie system',
        longDescription: 'High efficiency mono perc panels with inverter',
        category: 'ROOFTOP_SOLAR',
        categorySlug: 'rooftop-solar',
        city: 'Bhopal',
        citySlug: 'bhopal',
        productBrand: 'Tata Power Solar',
        productModel: '3 kW On-Grid Kit',
        imageUrl: null,
        marketPrice: 210000,
        groupPrice: 185000,
        targetBuyers: 10,
        currentBuyers: 6,
        deadline: '2026-11-20T18:30:00Z',
        status: 'ACTIVE',
        priceIsVerified: false,
        priceVerifiedAt: null,
        createdAt: '2026-10-26T10:00:00Z',
        updatedAt: '2026-10-26T10:00:00Z',
      };

      const productJsonLd = buildProductJsonLd(mockPool);
      assert.equal(productJsonLd['@type'], 'Product');
      assert.equal(productJsonLd.name, '3 kW Residential Rooftop Solar Kit');
      // Adheres to blueprint: unverified demo prices do not emit Schema.org Offer
      assert.equal(productJsonLd.offers, undefined);
    });
  });

  describe('Search-Intent & Indexability Guardrails', () => {
    test('Unserved, empty, or closed locations receive noindex directive', () => {
      const robots = getRobotsMetadata(true);
      assert.ok(typeof robots === 'object' && robots !== null);
      assert.equal('index' in robots && robots.index, false);
      assert.equal('follow' in robots && robots.follow, false);
    });
  });

  describe('Active D1 SQLite Migration Chain Integrity', () => {
    test('Tracked migrations chain in migrations/d1 has sequential additive files', () => {
      const migrationsDir = path.resolve(process.cwd(), 'migrations/d1');
      assert.ok(fs.existsSync(migrationsDir), 'migrations/d1 directory must exist');

      const files = fs.readdirSync(migrationsDir).sort();
      assert.ok(files.length >= 4, 'Must have at least 4 versioned D1 migrations');

      assert.ok(files[0].includes('0001_initial_schema.sql'));
      assert.ok(files[1].includes('0002_add_variants_and_capacity_limits.sql'));
      assert.ok(files[2].includes('0003_v73_shared_pool_cities.sql'));
      assert.ok(files[3].includes('0004_category_agnostic_city_pools.sql'));
    });

    test('Initial D1 migration contains core tables and category-agnostic support', () => {
      const initialPath = path.resolve(
        process.cwd(),
        'migrations/d1/0001_initial_schema.sql'
      );
      const sql = fs.readFileSync(initialPath, 'utf8');

      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS pools'));
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS pool_leads'));
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS pool_requests'));
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS categories'));
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS pool_quotations'));
    });

    test('Additive D1 migration 0004 contains category-agnostic columns and indexes', () => {
      const migration4Path = path.resolve(
        process.cwd(),
        'migrations/d1/0004_category_agnostic_city_pools.sql'
      );
      const sql = fs.readFileSync(migration4Path, 'utf8');

      assert.ok(sql.includes('product_title'));
      assert.ok(sql.includes('variant_name'));
      assert.ok(sql.includes('idx_pools_city_cat'));
    });
  });
});
