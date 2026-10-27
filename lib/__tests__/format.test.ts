import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatINR,
  formatNumberIN,
  normalizePhone,
  slugify,
  getCountdownParts,
} from '../format';

describe('Format Utility Tests', () => {
  describe('Indian Rupee Currency Formatting (formatINR)', () => {
    test('formats numbers into Indian currency standard', () => {
      assert.equal(formatINR(145000), '₹1,45,000');
      assert.equal(formatINR(500), '₹500');
      assert.equal(formatINR(12500000), '₹1,25,00,000');
    });

    test('handles null, undefined, and NaN gracefully', () => {
      assert.equal(formatINR(null), '—');
      assert.equal(formatINR(undefined), '—');
      assert.equal(formatINR(NaN), '—');
    });
  });

  describe('Indian Number Formatting (formatNumberIN)', () => {
    test('formats thousands and lakhs with proper separators', () => {
      assert.equal(formatNumberIN(100000), '1,00,000');
      assert.equal(formatNumberIN(2500), '2,500');
    });
  });

  describe('Phone Normalization (normalizePhone)', () => {
    test('strips +91 or 91 country code prefix', () => {
      assert.equal(normalizePhone('+919876543210'), '9876543210');
      assert.equal(normalizePhone('919876543210'), '9876543210');
    });

    test('strips leading 0', () => {
      assert.equal(normalizePhone('09876543210'), '9876543210');
    });

    test('removes spaces, hyphens, and brackets', () => {
      assert.equal(normalizePhone('+91 98765-43210'), '9876543210');
      assert.equal(normalizePhone('(0) 98765 43210'), '9876543210');
    });
  });

  describe('URL Slug Generation (slugify)', () => {
    test('converts strings to kebab-case', () => {
      assert.equal(slugify('TVS iQube S 3.4 kWh'), 'tvs-iqube-s-34-kwh');
      assert.equal(slugify('  Tata Nexon EV 2026!  '), 'tata-nexon-ev-2026');
    });
  });

  describe('Countdown Parts Calculation (getCountdownParts)', () => {
    test('identifies expired dates correctly', () => {
      const pastDate = '2020-01-01T00:00:00Z';
      const parts = getCountdownParts(pastDate);
      assert.equal(parts.isExpired, true);
      assert.equal(parts.days, 0);
      assert.equal(parts.totalMs, 0);
    });

    test('calculates positive remaining time for future deadlines', () => {
      const futureDate = new Date(Date.now() + 86400000 * 3).toISOString(); // 3 days in future
      const parts = getCountdownParts(futureDate);
      assert.equal(parts.isExpired, false);
      assert.ok(parts.days >= 2);
    });
  });
});
