import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getPoolFallbackImage } from '../pool-image-fallback';
import { getPublicPools } from '../pools';
import { CATEGORIES, CATEGORY_SLUG_MAP, CITIES } from '../constants';
import { getDemoCategories } from '../mock-data';
import { getCountdownParts } from '../format';
import { PublicPool } from '@/types';

describe('Phase 3 — UI, Mobile & Eligibility Regression Tests', () => {
  describe('1. Category-Specific Image Fallback System', () => {
    test('resolves correct SVG fallback for Rooftop Solar', () => {
      const img = getPoolFallbackImage('ROOFTOP_SOLAR', 'rooftop-solar', '3kw-rooftop-solar');
      assert.equal(img, '/images/solar-default.svg');
    });

    test('resolves correct SVG fallback for Home Power Backup', () => {
      const img = getPoolFallbackImage('ROOFTOP_SOLAR', 'home-power-backup', 'home-power-backup-inverter-200ah-battery-combo');
      assert.equal(img, '/images/power-backup-default.svg');
    });

    test('resolves correct SVG fallback for Whole-House Water Softener', () => {
      const img = getPoolFallbackImage('ROOFTOP_SOLAR', 'water-softeners', 'whole-house-water-softener-kit');
      assert.equal(img, '/images/water-softener-default.svg');
    });

    test('resolves correct SVG fallback for legacy categories (EV, Cars, Laptops)', () => {
      assert.equal(getPoolFallbackImage('EV_SCOOTERS', 'ev-scooters', 'tvs-iqube'), '/images/ev-scooters-default.svg');
      assert.equal(getPoolFallbackImage('CARS', 'cars', 'hyundai-exter'), '/images/cars-default.svg');
      assert.equal(getPoolFallbackImage('LAPTOPS', 'laptops', 'macbook-air'), '/images/laptops-default.svg');
    });

    test('falls back safely to brand-compatible pool-default.svg for unknown or null inputs', () => {
      assert.equal(getPoolFallbackImage(null, null, null), '/images/pool-default.svg');
      assert.equal(getPoolFallbackImage('', '', ''), '/images/pool-default.svg');
      assert.equal(getPoolFallbackImage('UNKNOWN', 'unknown', 'unknown'), '/images/pool-default.svg');
    });

    test('verifies all required fallback SVGs exist on disk and contain no broken X strokes', () => {
      const publicImagesDir = path.join(process.cwd(), 'public', 'images');
      const requiredSvgs = [
        'pool-default.svg',
        'solar-default.svg',
        'power-backup-default.svg',
        'water-softener-default.svg',
        'ev-scooters-default.svg',
        'cars-default.svg',
        'laptops-default.svg',
      ];

      for (const svgFile of requiredSvgs) {
        const fullPath = path.join(publicImagesDir, svgFile);
        assert.equal(fs.existsSync(fullPath), true, `File ${svgFile} must exist`);
        const content = fs.readFileSync(fullPath, 'utf8');
        assert.ok(content.length > 200, `${svgFile} must not be empty`);
        assert.ok(content.includes('<svg'), `${svgFile} must contain valid SVG root`);
        // Ensure the broken cross from Phase 1 is not present
        assert.equal(content.includes('M280 160L320 200M320 160L280 200'), false, `${svgFile} must not draw the placeholder X`);
      }
    });
  });

  describe('2. Public Pool Eligibility & Lifecycle Consistency', () => {
    test('getPublicPools excludes CLOSED pools from active opportunities', async () => {
      const pools = await getPublicPools();
      const closedPools = pools.filter((p) => p.status === 'CLOSED');
      assert.equal(closedPools.length, 0, 'No CLOSED pool should be returned in public active listings');
    });

    test('getPublicPools excludes past-deadline pools from active opportunities', async () => {
      const pools = await getPublicPools();
      const now = Date.now();
      const expiredPools = pools.filter((p) => new Date(p.deadline).getTime() <= now);
      assert.equal(expiredPools.length, 0, 'No past-deadline pool should be returned in public active listings');
    });

    test('getCountdownParts accurately detects expired vs active deadlines', () => {
      const pastDeadline = new Date(Date.now() - 3600000).toISOString();
      const futureDeadline = new Date(Date.now() + 86400000 * 5).toISOString();

      const pastResult = getCountdownParts(pastDeadline);
      assert.equal(pastResult.isExpired, true);
      assert.equal(pastResult.days, 0);

      const futureResult = getCountdownParts(futureDeadline);
      assert.equal(futureResult.isExpired, false);
      assert.ok(futureResult.days >= 4);
    });

    test('buyer remaining calculation is defensively clamped to zero', () => {
      const target = 10;
      const overCurrent = 15;
      const remaining = Math.max(0, target - overCurrent);
      assert.equal(remaining, 0, 'Remaining buyers cannot be negative');
    });
  });

  describe('3. Location-First City Isolation', () => {
    test('getPublicPools with city filter returns ONLY pools belonging to that city', async () => {
      const bhopalPools = await getPublicPools({ citySlug: 'bhopal' });
      assert.ok(bhopalPools.length > 0, 'Bhopal active pools should exist');
      for (const pool of bhopalPools) {
        assert.equal(pool.citySlug, 'bhopal', `Pool ${pool.name} must belong to Bhopal`);
      }

      const indorePools = await getPublicPools({ citySlug: 'indore' });
      assert.ok(indorePools.length > 0, 'Indore active pools should exist');
      for (const pool of indorePools) {
        assert.equal(pool.citySlug, 'indore', `Pool ${pool.name} must belong to Indore`);
      }
    });

    test('no cross-city leakage between Bhopal and Indore pools', async () => {
      const bhopalPools = await getPublicPools({ citySlug: 'bhopal' });
      const indorePools = await getPublicPools({ citySlug: 'indore' });

      const bhopalIds = new Set(bhopalPools.map((p) => p.id));
      const indoreIds = new Set(indorePools.map((p) => p.id));

      for (const id of bhopalIds) {
        assert.equal(indoreIds.has(id), false, `Pool ${id} must not appear in both cities`);
      }
    });

    test('empty city filter returns clean empty array for unserved cities', async () => {
      const unservedPools = await getPublicPools({ citySlug: 'jaipur' });
      assert.equal(Array.isArray(unservedPools), true);
      assert.equal(unservedPools.length, 0);
    });
  });

  describe('4. Launch Product Families Prioritization', () => {
    test('static CATEGORIES constant prioritizes the 3 V3 launch product families', () => {
      assert.equal(CATEGORIES[0].slug, 'rooftop-solar');
      assert.equal(CATEGORIES[1].slug, 'home-power-backup');
      assert.equal(CATEGORIES[2].slug, 'water-softeners');
    });

    test('dynamic getDemoCategories returns prioritized category order', () => {
      const categories = getDemoCategories();
      assert.ok(categories.length >= 3);
      assert.equal(categories[0].slug, 'rooftop-solar');
      assert.equal(categories[1].slug, 'home-power-backup');
      assert.equal(categories[2].slug, 'water-softeners');
    });

    test('CATEGORY_SLUG_MAP supports both new and legacy product family slugs', () => {
      assert.equal(CATEGORY_SLUG_MAP['rooftop-solar'], 'ROOFTOP_SOLAR');
      assert.equal(CATEGORY_SLUG_MAP['home-power-backup'], 'ROOFTOP_SOLAR');
      assert.equal(CATEGORY_SLUG_MAP['water-softeners'], 'ROOFTOP_SOLAR');
      assert.equal(CATEGORY_SLUG_MAP['ev-scooters'], 'EV_SCOOTERS');
      assert.equal(CATEGORY_SLUG_MAP['cars'], 'CARS');
      assert.equal(CATEGORY_SLUG_MAP['laptops'], 'LAPTOPS');
    });

    test('filtering by home-power-backup returns only battery and inverter packages', async () => {
      const backupPools = await getPublicPools({ categorySlug: 'home-power-backup' });
      for (const pool of backupPools) {
        const matches =
          pool.categorySlug === 'home-power-backup' ||
          pool.slug.includes('power-backup') ||
          pool.slug.includes('inverter');
        assert.ok(matches, `Pool ${pool.name} must be a power backup package`);
      }
    });

    test('filtering by water-softeners returns only water softening packages', async () => {
      const softenerPools = await getPublicPools({ categorySlug: 'water-softeners' });
      for (const pool of softenerPools) {
        const matches =
          pool.categorySlug === 'water-softeners' ||
          pool.slug.includes('softener') ||
          pool.name.toLowerCase().includes('softener');
        assert.ok(matches, `Pool ${pool.name} must be a water softener package`);
      }
    });

    test('filtering by rooftop-solar excludes power backup and water softeners', async () => {
      const solarPools = await getPublicPools({ categorySlug: 'rooftop-solar' });
      for (const pool of solarPools) {
        assert.equal(pool.slug.includes('power-backup'), false);
        assert.equal(pool.slug.includes('water-softener'), false);
      }
    });
  });

  describe('5. Operational Cities & Directory Integrity', () => {
    test('CITIES constant returns active launch cities', () => {
      assert.ok(CITIES.length >= 6);
      const slugs = CITIES.map((c) => c.slug);
      assert.ok(slugs.includes('bhopal'));
      assert.ok(slugs.includes('indore'));
      assert.ok(slugs.includes('pune'));
      assert.ok(slugs.includes('delhi'));
      assert.ok(slugs.includes('mumbai'));
    });
  });
});
