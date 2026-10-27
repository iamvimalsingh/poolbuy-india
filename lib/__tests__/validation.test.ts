import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  joinPoolSchema,
  poolRequestSchema,
  isValidIndianMobile,
  isValidHttpsUrl,
} from '../validation';

describe('Validation Tests', () => {
  describe('Indian Mobile Validation', () => {
    test('accepts valid 10-digit Indian mobiles starting with 6, 7, 8, 9', () => {
      assert.equal(isValidIndianMobile('9876543210'), true);
      assert.equal(isValidIndianMobile('8123456789'), true);
      assert.equal(isValidIndianMobile('7012345678'), true);
      assert.equal(isValidIndianMobile('6301234567'), true);
    });

    test('rejects numbers starting with 0-5', () => {
      assert.equal(isValidIndianMobile('5123456789'), false);
      assert.equal(isValidIndianMobile('1234567890'), false);
      assert.equal(isValidIndianMobile('0987654321'), false);
    });

    test('rejects numbers with incorrect lengths or non-digits', () => {
      assert.equal(isValidIndianMobile('987654321'), false); // 9 digits
      assert.equal(isValidIndianMobile('98765432101'), false); // 11 digits
      assert.equal(isValidIndianMobile('98765abcde'), false);
      assert.equal(isValidIndianMobile(''), false);
    });
  });

  describe('Join Pool Zod Schema', () => {
    test('validates correct join payload', () => {
      const validPayload = {
        fullName: 'Vikram Sharma',
        whatsappNumber: '9876543210',
        city: 'Bhopal',
        buyingTimeline: 'WITHIN_7_DAYS',
        hasExistingQuote: true,
        existingQuoteAmount: 145000,
        extraMessage: 'Looking for Matte Black variant',
      };

      const result = joinPoolSchema.safeParse(validPayload);
      assert.equal(result.success, true);
    });

    test('rejects short name (< 2 characters)', () => {
      const payload = {
        fullName: 'V',
        whatsappNumber: '9876543210',
        city: 'Bhopal',
        buyingTimeline: 'WITHIN_7_DAYS',
        hasExistingQuote: false,
      };

      const result = joinPoolSchema.safeParse(payload);
      assert.equal(result.success, false);
    });

    test('rejects invalid timeline enum', () => {
      const payload = {
        fullName: 'Vikram Sharma',
        whatsappNumber: '9876543210',
        city: 'Bhopal',
        buyingTimeline: 'NEXT_YEAR',
        hasExistingQuote: false,
      };

      const result = joinPoolSchema.safeParse(payload);
      assert.equal(result.success, false);
    });

    test('rejects negative quote amount', () => {
      const payload = {
        fullName: 'Vikram Sharma',
        whatsappNumber: '9876543210',
        city: 'Bhopal',
        buyingTimeline: 'WITHIN_15_DAYS',
        hasExistingQuote: true,
        existingQuoteAmount: -500,
      };

      const result = joinPoolSchema.safeParse(payload);
      assert.equal(result.success, false);
    });
  });

  describe('Pool Request Zod Schema', () => {
    test('validates demand discovery request', () => {
      const valid = {
        productName: 'Tata Sierra EV',
        city: 'Indore',
        category: 'CARS',
        fullName: 'Rajesh Gupta',
        whatsappNumber: '9876543210',
        extraMessage: 'Need delivery in 3 months',
      };

      const result = poolRequestSchema.safeParse(valid);
      assert.equal(result.success, true);
    });

    test('rejects missing product name', () => {
      const invalid = {
        productName: '  ',
        city: 'Indore',
      };

      const result = poolRequestSchema.safeParse(invalid);
      assert.equal(result.success, false);
    });
  });

  describe('HTTPS URL Validation', () => {
    test('allows secure HTTPS URLs', () => {
      assert.equal(isValidHttpsUrl('https://payments.cashfree.com/links/123'), true);
      assert.equal(isValidHttpsUrl('https://razorpay.com/pay/pl_456'), true);
    });

    test('rejects insecure or dangerous URL schemes', () => {
      assert.equal(isValidHttpsUrl('http://insecure-site.com'), false);
      assert.equal(isValidHttpsUrl('javascript:alert(1)'), false);
      assert.equal(isValidHttpsUrl('data:text/html,bad'), false);
      assert.equal(isValidHttpsUrl('//protocol-relative.com'), false);
    });
  });
});
