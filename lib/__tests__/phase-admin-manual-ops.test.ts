import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateSuggestedConnectionFee, CURRENT_FEE_RULE_VERSION } from '../fee';
import {
  buildWhatsAppDirectUrl,
  buildGroupPublishedMessage,
  buildQuoteAvailableMessage,
  buildConnectionFeeDisclosureMessage,
  buildWaitlistInvitationMessage,
  buildWaitlistPromotionMessage,
  buildExclusionNoticeMessage,
} from '../whatsapp';
import {
  getDemoWaitlist,
  addDemoWaitlistEntry,
  updateDemoWaitlistEntry,
  getDemoQuotations,
  addDemoQuotation,
  updateDemoQuotation,
  deleteDemoPool,
  restoreDemoPool,
  getDemoOverviewMetrics,
  MOCK_ADMIN_POOLS,
} from '../mock-data';

describe('Admin Manual Operations — Fee Calculation Suite', () => {
  test('Applies minimum floor of ₹99 for small values and disables when basis is unavailable', () => {
    assert.equal(calculateSuggestedConnectionFee(0), null);
    assert.equal(calculateSuggestedConnectionFee(-500), null);
    assert.equal(calculateSuggestedConnectionFee(null), null);
    assert.equal(calculateSuggestedConnectionFee(undefined), null);
    assert.equal(calculateSuggestedConnectionFee(50000), 99);
    assert.equal(calculateSuggestedConnectionFee(99000), 99);
  });

  test('Calculates 0.10% accurately for high-ticket values', () => {
    assert.equal(calculateSuggestedConnectionFee(130000), 130);
    assert.equal(calculateSuggestedConnectionFee(285000), 285);
    assert.equal(calculateSuggestedConnectionFee(1500000), 1500);
  });

  test('Current fee rule version is 2026-10-v1', () => {
    assert.equal(CURRENT_FEE_RULE_VERSION, '2026-10-v1');
  });
});

describe('Admin Manual Operations — WhatsApp Templates Suite', () => {
  const buyerName = 'Rohit Verma';
  const poolName = 'TVS iQube Electric Scooter';
  const cityName = 'Bhopal';

  test('buildGroupPublishedMessage contains group name and target buyers', () => {
    const text = buildGroupPublishedMessage(buyerName, poolName, cityName, 10, '2026-11-15T18:00:00Z');
    assert.ok(text.includes('Rohit Verma'));
    assert.ok(text.includes('TVS iQube'));
    assert.ok(text.includes('10 buyers'));
  });

  test('buildQuoteAvailableMessage discloses price and asks for INTERESTED/DECLINED without commitment', () => {
    const text = buildQuoteAvailableMessage(buyerName, poolName, cityName, 130000, '2026-11-15T18:00:00Z');
    assert.ok(text.includes('₹1,30,000'));
    assert.ok(text.includes('INTERESTED'));
    assert.ok(text.includes('DECLINED'));
    assert.ok(text.includes('does not obligate'));
  });

  test('buildConnectionFeeDisclosureMessage contains exact disclosed amount and calculation formula', () => {
    const text = buildConnectionFeeDisclosureMessage(buyerName, poolName, cityName, 130, 130000);
    assert.ok(text.includes('₹130'));
    assert.ok(text.includes('max(₹99, 0.10% × approved basis of ₹1,30,000)'));
  });

  test('buildWaitlistInvitationMessage and buildWaitlistPromotionMessage contain queue sequence', () => {
    const invite = buildWaitlistInvitationMessage(buyerName, poolName, cityName, 1);
    assert.ok(invite.includes('position #1'));

    const promo = buildWaitlistPromotionMessage(buyerName, poolName, cityName, 11);
    assert.ok(promo.includes('Buyer #11'));
  });

  test('buildExclusionNoticeMessage includes mandatory reason', () => {
    const notice = buildExclusionNoticeMessage(buyerName, poolName, cityName, 'Non-response after deadline');
    assert.ok(notice.includes('Non-response after deadline'));
  });

  test('Direct WhatsApp URL encodes message correctly with 91 country code', () => {
    const url = buildWhatsAppDirectUrl('9826012345', 'Namaste Rohit');
    assert.ok(url.startsWith('https://wa.me/919826012345?text='));
    assert.ok(url.includes('Namaste%20Rohit'));
  });
});

describe('Admin Manual Operations — Waitlist Management Suite', () => {
  const testPoolId = 'test-pool-waitlist-1';

  test('Creates FIFO waitlist entries with sequential numbers', () => {
    const w1 = addDemoWaitlistEntry(testPoolId, {
      fullName: 'Alice',
      whatsappNumber: '9826011111',
      city: 'Bhopal',
    });
    const w2 = addDemoWaitlistEntry(testPoolId, {
      fullName: 'Bob',
      whatsappNumber: '9826022222',
      city: 'Bhopal',
    });

    assert.equal(w1.sequenceNumber, 1);
    assert.equal(w2.sequenceNumber, 2);
    assert.equal(w1.status, 'WAITING');

    const list = getDemoWaitlist(testPoolId);
    assert.equal(list.length, 2);
    assert.equal(list[0].fullName, 'Alice');
    assert.equal(list[1].fullName, 'Bob');
  });

  test('Updates waitlist entry with invite and decline states', () => {
    const list = getDemoWaitlist(testPoolId);
    const first = list[0];

    const invited = updateDemoWaitlistEntry(first.id, { status: 'INVITED' });
    assert.equal(invited?.status, 'INVITED');

    const declined = updateDemoWaitlistEntry(first.id, { status: 'DECLINED', removalReason: 'Buyer opted out.' });
    assert.equal(declined?.status, 'DECLINED');
    assert.equal(declined?.removalReason, 'Buyer opted out.');
  });
});

describe('Admin Manual Operations — Quotation Lifecycle Suite', () => {
  const testPoolId = '11111111-1111-4111-8111-111111111111';

  test('Retrieves seeded quotations for operational pools', () => {
    const quotes = getDemoQuotations(testPoolId);
    assert.ok(quotes.length >= 1);
    const current = quotes.find((q) => q.isCurrentPublished);
    assert.ok(current);
    assert.equal(current?.status, 'PUBLISHED');
  });

  test('Adds a new quote and updates publication status', () => {
    const newQuote = addDemoQuotation(testPoolId, {
      priceType: 'VENDOR_QUOTED',
      vendorName: 'Regional Fleet Dealership',
      quotedAmount: 128000,
      currency: 'INR',
      quoteDate: '2026-10-26T10:00:00Z',
      validUntil: '2026-11-20T18:00:00Z',
      scope: 'Institutional fleet pricing for 10 units.',
      inclusions: ['Charger', 'Insurance'],
      exclusions: [],
      status: 'RECEIVED',
      isCurrentPublished: false,
    });

    assert.equal(newQuote.quotedAmount, 128000);
    assert.equal(newQuote.status, 'RECEIVED');

    // Publish this quote
    const published = updateDemoQuotation(newQuote.id, { isCurrentPublished: true, status: 'PUBLISHED' });
    assert.equal(published?.isCurrentPublished, true);
    assert.equal(published?.status, 'PUBLISHED');

    // Verify pool group price was synchronized
    const pool = MOCK_ADMIN_POOLS.find((p) => p.id === testPoolId);
    assert.equal(pool?.groupPrice, 128000);
  });
});

describe('Admin Manual Operations — Group Lifecycle & Guards Suite', () => {
  const poolId = '11111111-1111-4111-8111-111111111111';

  test('Hard delete is strictly blocked when dependencies exist', () => {
    assert.throws(
      () => deleteDemoPool(poolId, { hardDelete: true }),
      (err: Error) => err.message.includes('CANNOT_HARD_DELETE_POOL_WITH_DEPENDENCIES')
    );
  });

  test('Restoring a pool does NOT automatically republish it (isPublished remains false)', () => {
    const restored = restoreDemoPool(poolId);
    assert.equal(restored?.isArchived, false);
    assert.equal(restored?.deletedAt, null);
    assert.equal(restored?.isPublished, false, 'Specification requirement: Restore must not auto-publish');
  });

  test('Calculates overview action queues metrics truthfully', () => {
    const metrics = getDemoOverviewMetrics();
    assert.ok(typeof metrics.totalOpenGroups === 'number');
    assert.ok(typeof metrics.totalTargetReached === 'number');
    assert.ok(typeof metrics.totalWaitlistPending === 'number');
    assert.ok(typeof metrics.totalQuotesAwaitingReview === 'number');
  });
});
