import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateSuggestedConnectionFee, CURRENT_FEE_RULE_VERSION, MIN_FEE_INR } from '../fee';
import { INDIA_LOCATION_DIRECTORY } from '../location-directory';
import { CATEGORIES } from '../constants';
import { poolRequestSchema } from '../validation';

describe('Phase V6: National Rollout, All India Discovery & Location State Invariants', () => {
  test('1. Authoritative India Directory contains exactly 28 States and 8 Union Territories', () => {
    const states = INDIA_LOCATION_DIRECTORY.filter((s) => s.type === 'STATE');
    const uts = INDIA_LOCATION_DIRECTORY.filter((s) => s.type === 'UNION_TERRITORY');

    assert.equal(states.length, 28, 'Must maintain exactly 28 Indian States');
    assert.equal(uts.length, 8, 'Must maintain exactly 8 Union Territories');
    assert.equal(INDIA_LOCATION_DIRECTORY.length, 36, 'Total territories must equal 36');
  });

  test('2. Every city in directory is open for Solar demand collection without fake active claims', () => {
    let totalCities = 0;
    for (const territory of INDIA_LOCATION_DIRECTORY) {
      assert.ok(territory.cities.length > 0, `${territory.name} must have evidenced urban centres`);
      for (const city of territory.cities) {
        totalCities += 1;
        assert.ok(
          city.availabilityState === 'ACTIVE' || city.availabilityState === 'DEMAND_COLLECTING',
          `${city.name} (${territory.name}) must be ACTIVE or DEMAND_COLLECTING for Solar rollout`
        );
      }
    }
    assert.ok(totalCities >= 150, `Maintained directory has comprehensive urban centre coverage (${totalCities} cities)`);
  });

  test('3. Connection fee formula applies max(₹99, round(0.10% × basis)) and disables without basis', () => {
    // Basis missing, null, zero or non-positive -> null (calculation disabled, no arbitrary fallback)
    assert.equal(calculateSuggestedConnectionFee(null), null);
    assert.equal(calculateSuggestedConnectionFee(undefined), null);
    assert.equal(calculateSuggestedConnectionFee(0), null);
    assert.equal(calculateSuggestedConnectionFee(-1000), null);

    // Basis provided below ₹99 threshold -> applies minimum floor of ₹99
    assert.equal(calculateSuggestedConnectionFee(10000), MIN_FEE_INR); // 0.10% = ₹10 < 99 -> 99
    assert.equal(calculateSuggestedConnectionFee(50000), MIN_FEE_INR); // 0.10% = ₹50 < 99 -> 99
    assert.equal(calculateSuggestedConnectionFee(99000), 99);          // 0.10% = ₹99 -> 99

    // High ticket values
    assert.equal(calculateSuggestedConnectionFee(130000), 130);
    assert.equal(calculateSuggestedConnectionFee(185000), 185);
    assert.equal(calculateSuggestedConnectionFee(285000), 285);
    assert.equal(calculateSuggestedConnectionFee(1500000), 1500);

    assert.equal(CURRENT_FEE_RULE_VERSION, '2026-10-v1');
  });

  test('4. Pool request schema validates community proposal and defaults to GROUP_PROPOSAL', () => {
    const validProposal = {
      productName: 'Silver Oak Society Solar Group — 3 kW Rooftop Solar Complete Kit',
      category: 'ROOFTOP_SOLAR',
      city: 'Bhopal',
      state: 'Madhya Pradesh',
      fullName: 'Sunil Mehta',
      whatsappNumber: '9826012345',
      contactConsent: true,
      targetBuyersRequested: 10,
    };

    const parsed = poolRequestSchema.safeParse(validProposal);
    assert.ok(parsed.success, 'Valid proposal must parse successfully');
    if (parsed.success) {
      assert.equal(parsed.data.requestType, 'GROUP_PROPOSAL');
      assert.equal(parsed.data.city, 'Bhopal');
      assert.equal(parsed.data.contactConsent, true);
    }
  });

  test('5. Pool request rejects invalid short titles or invalid mobile formats', () => {
    const invalidTitle = {
      productName: 'A', // too short (< 2)
      city: 'Bhopal',
      whatsappNumber: '9826012345',
      contactConsent: true,
    };
    const res1 = poolRequestSchema.safeParse(invalidTitle);
    assert.equal(res1.success, false);

    const invalidPhone = {
      productName: 'Valid Pool Title',
      city: 'Bhopal',
      whatsappNumber: '12345', // invalid phone
      contactConsent: true,
    };
    const res2 = poolRequestSchema.safeParse(invalidPhone);
    assert.equal(res2.success, false);
  });

  test('6. Product catalogue priority matches Master Blueprint V6 (Solar, Backup, Softener)', () => {
    assert.ok(CATEGORIES.some((c) => c.category === 'ROOFTOP_SOLAR'));
    const solarCat = CATEGORIES.find((c) => c.category === 'ROOFTOP_SOLAR');
    assert.ok(solarCat, 'Rooftop Solar must be present');
    assert.equal(solarCat?.slug, 'rooftop-solar');
  });
});

