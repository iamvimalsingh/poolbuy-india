import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { getPublicPools } from '../pools';
import { getOperationalCategories } from '../categories';
import { getOperationalCities } from '../cities';
import { executePoolRequest, getAllPoolRequests } from '../requests';
import { poolRequestSchema } from '../validation';
import { formatINR } from '../format';
import { PublicPool } from '@/types';

describe('Phase 3: Public Consumer Experience & Category-Agnostic UI Invariants', () => {
  describe('1. Category-Agnostic Dynamic Product Categories', () => {
    test('getOperationalCategories returns all active categories configured in database', async () => {
      const categories = await getOperationalCategories();
      assert.ok(categories.length >= 3, 'At least 3 categories must be configured');
      const slugs = categories.map((c) => c.slug);
      
      // Solar is present, but not the exclusive or platform-defining category
      assert.ok(slugs.includes('rooftop-solar'), 'Rooftop solar must be available');
      // Diverse non-solar categories must also be supported
      assert.ok(
        slugs.some((s) => s !== 'rooftop-solar'),
        'Non-solar categories must be present and active'
      );
    });

    test('getPublicPools supports filtering by any dynamic category slug without solar-only assumption', async () => {
      const allPools = await getPublicPools();
      assert.ok(allPools.length > 0, 'Public pools must exist');

      // Filter by rooftop-solar
      const solarPools = await getPublicPools({ categorySlug: 'rooftop-solar' });
      for (const p of solarPools) {
        assert.ok(
          p.categorySlug === 'rooftop-solar' || p.category === 'ROOFTOP_SOLAR',
          `Pool ${p.name} must belong to rooftop-solar`
        );
      }

      // Filter by power backup
      const backupPools = await getPublicPools({ categorySlug: 'home-power-backup' });
      for (const p of backupPools) {
        assert.ok(
          p.categorySlug === 'home-power-backup' ||
          p.slug.includes('power-backup') ||
          p.slug.includes('inverter'),
          `Pool ${p.name} must belong to home-power-backup`
        );
      }
    });
  });

  describe('2. Truthful Pricing and Quotation Status Data Integrity', () => {
    test('Verified quotation is indicated only when priceIsVerified is true or VENDOR_VERIFIED', () => {
      const verifiedPool: Partial<PublicPool> = {
        groupPrice: 155000,
        priceIsVerified: true,
        groupPriceType: 'VENDOR_VERIFIED',
      };
      const isVerified = Boolean(
        verifiedPool.priceIsVerified || verifiedPool.groupPriceType === 'VENDOR_VERIFIED'
      );
      assert.equal(isVerified, true);
      assert.equal(formatINR(verifiedPool.groupPrice), '₹1,55,000');

      const unverifiedPool: Partial<PublicPool> = {
        groupPrice: 160000,
        priceIsVerified: false,
        groupPriceType: 'INDICATIVE_ESTIMATE',
      };
      const isUnverifiedQuote = Boolean(
        unverifiedPool.priceIsVerified || unverifiedPool.groupPriceType === 'VENDOR_VERIFIED'
      );
      assert.equal(isUnverifiedQuote, false);
      assert.equal(formatINR(unverifiedPool.groupPrice), '₹1,60,000');

      const pendingPool: Partial<PublicPool> = {
        groupPrice: null,
        priceIsVerified: false,
        groupPriceType: 'UNKNOWN',
      };
      assert.equal(pendingPool.groupPrice, null);
      assert.equal(formatINR(pendingPool.groupPrice), '—');
    });

    test('No fabricated pricing or active member numbers in public pool catalog', async () => {
      const pools = await getPublicPools();
      for (const pool of pools) {
        // Members must be non-negative real numbers
        assert.ok(typeof pool.currentBuyers === 'number');
        assert.ok(pool.currentBuyers >= 0);

        // Target capacity must be a positive integer
        assert.ok(typeof pool.targetBuyers === 'number');
        assert.ok(pool.targetBuyers > 0);

        // If marketPrice or groupPrice is present, it must be positive
        if (pool.groupPrice !== null) {
          assert.ok(pool.groupPrice > 0, `groupPrice for ${pool.slug} must be positive`);
        }
        if (pool.marketPrice !== null) {
          assert.ok(pool.marketPrice > 0, `marketPrice for ${pool.slug} must be positive`);
        }
      }
    });
  });

  describe('3. Location Experience & Non-Compulsory Browsing', () => {
    test('Nationwide query without city filter returns pools across multiple Indian cities', async () => {
      const nationwidePools = await getPublicPools();
      const cities = new Set(nationwidePools.map((p) => p.citySlug));
      assert.ok(
        cities.size >= 2,
        'Nationwide overview must contain pools from multiple cities when available'
      );
    });

    test('City filtering strictly isolates pools to the selected city slug', async () => {
      const cities = await getOperationalCities();
      assert.ok(cities.length >= 2, 'Must have at least 2 operational cities');

      for (const city of cities) {
        const cityPools = await getPublicPools({ citySlug: city.slug });
        for (const p of cityPools) {
          assert.equal(
            p.citySlug,
            city.slug,
            `Pool ${p.slug} must match requested city ${city.slug}`
          );
        }
      }
    });

    test('Unserved city returns an honest empty array without crashing or fabricating mock pools', async () => {
      const unserved = await getPublicPools({ citySlug: 'non-existent-city-xyz' });
      assert.ok(Array.isArray(unserved));
      assert.equal(unserved.length, 0, 'Unserved city must return an empty list');
    });
  });

  describe('4. Strict Separation: Pool Requests vs Official Published Pools', () => {
    test('Public pool request schema validates demand proposals with category and contact consent', () => {
      const validProposal = {
        productName: 'Ather 450X Gen 3',
        categorySlug: 'ev-scooters',
        categoryName: 'Electric Scooters',
        brandPreference: 'Ather Energy',
        modelPreference: '450X with Pro Pack',
        fullName: 'Vikram Sharma',
        whatsappNumber: '9876543210',
        city: 'Jaipur',
        cityText: 'Jaipur',
        state: 'Rajasthan',
        stateText: 'Rajasthan',
        locality: 'Malviya Nagar',
        contactConsent: true,
        extraMessage: 'Group of 4 society members ready to buy',
      };

      const parsed = poolRequestSchema.safeParse(validProposal);
      assert.equal(parsed.success, true);
    });

    test('Submitting a pool request never injects it into official getPublicPools without admin approval', async () => {
      const initialPools = await getPublicPools();
      const initialPoolIds = new Set(initialPools.map((p) => p.id));

      const requestResult = await executePoolRequest({
        productName: 'Commercial Solar Dryer 500kg',
        requestedTitle: 'Commercial Solar Dryer 500kg',
        categorySlug: 'rooftop-solar',
        fullName: 'Test Requester',
        whatsappNumber: '9876543210',
        city: 'Nashik',
        cityText: 'Nashik',
        contactConsent: true,
        extraMessage: 'Cooperative society demand proposal',
      });

      assert.ok(requestResult.id, 'Request must return a tracking ID');

      // Verify getPublicPools does NOT include the newly submitted demand proposal
      const afterPools = await getPublicPools();
      for (const p of afterPools) {
        assert.notEqual(
          p.id,
          requestResult.id,
          'Demand proposal must never appear as an official active pool'
        );
      }
      assert.equal(afterPools.length, initialPoolIds.size);

      // Verify the request is saved in pool_requests with status REQUESTED
      const requests = await getAllPoolRequests();
      const found = requests.find((r) => r.id === requestResult.id);
      assert.ok(found, 'Pool request must be stored in pool_requests');
      assert.equal(found.status, 'REQUESTED', 'New request must have REQUESTED status');
      assert.equal(found.productName, 'Commercial Solar Dryer 500kg');
    });
  });
});
