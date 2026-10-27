import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWhatsAppDirectUrl,
  buildBuyerViralShareUrl,
  buildUnlockedPoolMessage,
  buildLeadFallbackMessage,
  buildQuoteFollowupMessage,
} from '../whatsapp';
import { PublicPool, AdminPool } from '@/types';

describe('WhatsApp Integration Tests', () => {
  describe('Direct WhatsApp URL Builder', () => {
    test('formats wa.me link with 91 prefix and encodes text', () => {
      const url = buildWhatsAppDirectUrl('9876543210', 'Hello from PoolBuy!');
      assert.equal(
        url,
        'https://wa.me/919876543210?text=Hello%20from%20PoolBuy!'
      );
    });

    test('normalizes raw numbers containing +91 or hyphens', () => {
      const url = buildWhatsAppDirectUrl('+91 98765-43210', 'Test');
      assert.equal(url, 'https://wa.me/919876543210?text=Test');
    });
  });

  describe('Buyer Viral Share URL', () => {
    test('contains no buyer personal information or unsupported discount guarantees', () => {
      const pool: PublicPool = {
        id: 'pool-1',
        slug: 'tvs-iqube-s',
        name: 'TVS iQube S',
        shortDescription: 'Short desc',
        longDescription: 'Long desc',
        category: 'EV_SCOOTERS',
        city: 'Bhopal',
        citySlug: 'bhopal',
        productBrand: 'TVS',
        productModel: 'iQube S',
        imageUrl: null,
        marketPrice: 140000,
        groupPrice: 125000,
        targetBuyers: 15,
        currentBuyers: 8,
        deadline: '2026-11-15T18:30:00Z',
        status: 'ACTIVE',
        priceIsVerified: false,
        priceVerifiedAt: null,
        createdAt: '2026-10-26T10:00:00Z',
        updatedAt: '2026-10-26T10:00:00Z',
      };

      const shareUrl = buildBuyerViralShareUrl(pool, 'https://poolbuy.in');
      const decoded = decodeURIComponent(shareUrl);

      // Verify no PII
      assert.ok(!decoded.includes('buyer'));
      assert.ok(!decoded.includes('+91'));
      // Verify no fake "guaranteed" discount claim
      assert.ok(!decoded.includes('guaranteed'));
      // Verify correct deal URL link
      assert.ok(decoded.includes('https://poolbuy.in/deals/bhopal/tvs-iqube-s'));
    });
  });

  describe('Admin Templates', () => {
    test('Unlocked pool message contains token amount, dealer name, and payment URL', () => {
      const adminPool: AdminPool = {
        id: 'pool-1',
        slug: 'tvs-iqube-s',
        name: 'TVS iQube S',
        shortDescription: 'Desc',
        longDescription: 'Desc',
        category: 'EV_SCOOTERS',
        city: 'Bhopal',
        citySlug: 'bhopal',
        productBrand: 'TVS',
        productModel: 'iQube S',
        imageUrl: null,
        marketPrice: 140000,
        groupPrice: 125000,
        targetBuyers: 15,
        currentBuyers: 15,
        deadline: '2026-11-15T18:30:00Z',
        status: 'UNLOCKED',
        priceIsVerified: true,
        priceVerifiedAt: '2026-10-26T10:00:00Z',
        createdAt: '2026-10-26T10:00:00Z',
        updatedAt: '2026-10-26T10:00:00Z',
        dealerName: 'Bhopal TVS Main Showroom',
        tokenAmount: 499,
        tokenPaymentUrl: 'https://checkout.dealer.com/token/tvs-bhopal-01',
        dealerOfferUrl: null,
        dealerTerms: 'Delivery within 7 business days',
      };

      const message = buildUnlockedPoolMessage(
        'Vikram Sharma',
        adminPool,
        'https://checkout.dealer.com/token/tvs-bhopal-01',
        499
      );

      assert.ok(message.includes('Namaste Vikram Sharma'));
      assert.ok(message.includes('₹499'));
      assert.ok(message.includes('Bhopal TVS Main Showroom'));
      assert.ok(message.includes('https://checkout.dealer.com/token/tvs-bhopal-01'));
      assert.ok(message.includes('100% refundable'));
    });

    test('Lead fallback message mentions direct quotation without fake guarantees', () => {
      const message = buildLeadFallbackMessage(
        'Ananya Patel',
        'Tata Nexon EV',
        'Indore',
        'Tata Motors Indore'
      );

      assert.ok(message.includes('Namaste Ananya Patel'));
      assert.ok(message.includes('Tata Nexon EV'));
      assert.ok(message.includes('Tata Motors Indore'));
    });

    test('Quote followup message politely requests voluntary sharing of existing quotation', () => {
      const message = buildQuoteFollowupMessage(
        'Rahul Verma',
        'Apple MacBook Air M3',
        'Pune'
      );

      assert.ok(message.includes('Namaste Rahul Verma'));
      assert.ok(message.includes('Apple MacBook Air M3'));
      assert.ok(message.includes('voluntarily share'));
    });
  });
});
