import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  MOCK_POOLS,
  MOCK_ADMIN_POOLS,
  DEMO_LEADS,
  recordDemoLead,
  updateDemoLead,
  addDemoWaitlistEntry,
  promoteDemoWaitlistEntry,
  getDemoWaitlist,
} from '../mock-data';
import { checkRateLimit } from '../rate-limit';

describe('V4 Capacity, FIFO Waitlist, Exclusion and Promotion Regression Suite', () => {
  // Setup a dedicated mock pool for this suite
  const testPoolId = 'test-v4-regress-pool';
  const testPool = {
    id: testPoolId,
    slug: 'test-v4-scooter',
    name: 'Test V4 Scooter Deal',
    shortDescription: 'Regression test pool',
    longDescription: 'Detailed description',
    category: 'EV_SCOOTERS' as const,
    city: 'Bhopal',
    citySlug: 'bhopal',
    productBrand: 'TestBrand',
    productModel: 'ModelV4',
    imageUrl: null,
    marketPrice: 120000,
    groupPrice: 105000,
    targetBuyers: 2,
    currentBuyers: 0,
    deadline: new Date(Date.now() + 864000000).toISOString(),
    status: 'ACTIVE' as const,
    priceIsVerified: true,
    priceVerifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    maxWaitlistSize: 2,
  };

  const testAdminPool = { ...testPool };

  MOCK_POOLS.push(testPool);
  MOCK_ADMIN_POOLS.push(testAdminPool);

  test('1. Member 1 joins: increments current buyers to 1', () => {
    const res1 = recordDemoLead(testPoolId, {
      fullName: 'Buyer Alpha',
      whatsappNumber: '9111111111',
      city: 'Bhopal',
      connectionPreference: 'WHATSAPP_GROUP',
      groupPrivacyAcknowledged: true,
    });

    assert.equal(res1.buyerNumber, 1);
    assert.equal(res1.currentBuyers, 1);
    assert.equal(testPool.currentBuyers, 1);
  });

  test('2. Duplicate submission by same active member is rejected idempotently without count increase', () => {
    const dupRes = recordDemoLead(testPoolId, {
      fullName: 'Buyer Alpha Dup',
      whatsappNumber: '9111111111',
      city: 'Bhopal',
    });

    assert.equal(dupRes.alreadyJoined, true);
    assert.equal(dupRes.isDuplicate, true);
    assert.equal(testPool.currentBuyers, 1, 'Current buyers must not increment on duplicate');
  });

  test('3. Member 2 joins: reaches target capacity of 2', () => {
    const res2 = recordDemoLead(testPoolId, {
      fullName: 'Buyer Beta',
      whatsappNumber: '9222222222',
      city: 'Bhopal',
      connectionPreference: 'INDIVIDUAL_INTRO',
    });

    assert.equal(res2.buyerNumber, 2);
    assert.equal(res2.currentBuyers, 2);
    assert.equal(testPool.currentBuyers, 2);
  });

  test('4. Capacity Full: Member 3 attempting to join active pool throws TARGET_REACHED', () => {
    assert.throws(() => {
      recordDemoLead(testPoolId, {
        fullName: 'Buyer Gamma',
        whatsappNumber: '9333333333',
        city: 'Bhopal',
      });
    }, /TARGET_REACHED/);
  });

  test('5. FIFO Waitlist: Adds entries in strict queue sequence', () => {
    const wl1 = addDemoWaitlistEntry(testPoolId, {
      fullName: 'Waitlist User 1',
      whatsappNumber: '9444444441',
      city: 'Bhopal',
    });
    assert.equal(wl1.sequenceNumber, 1);

    const wl2 = addDemoWaitlistEntry(testPoolId, {
      fullName: 'Waitlist User 2',
      whatsappNumber: '9444444442',
      city: 'Bhopal',
    });
    assert.equal(wl2.sequenceNumber, 2);
  });

  test('6. Promotion blocked when capacity is full', () => {
    const wlList = getDemoWaitlist(testPoolId);
    assert.equal(wlList.length, 2);

    const promoteAttempt = promoteDemoWaitlistEntry(wlList[0].id);
    assert.equal(promoteAttempt, null, 'Promotion must be blocked when currentBuyers >= targetBuyers');
    assert.equal(testPool.currentBuyers, 2);
  });

  test('7. Exclusion decrements current buyers safely', () => {
    const leadAlpha = DEMO_LEADS.find((l) => l.whatsappNumber === '9111111111');
    assert.ok(leadAlpha);

    updateDemoLead(leadAlpha.id, { connectionStatus: 'EXCLUDED', exclusionReason: 'Duplicate phone' });
    assert.equal(testPool.currentBuyers, 1, 'Pool currentBuyers should decrement from 2 to 1 on exclusion');
  });

  test('8. Promotion succeeds after slot opened by exclusion', () => {
    const wlList = getDemoWaitlist(testPoolId);
    const promoteResult = promoteDemoWaitlistEntry(wlList[0].id);

    assert.ok(promoteResult);
    assert.equal(promoteResult.waitlist.status, 'PROMOTED');
    assert.equal(promoteResult.lead.fullName, 'Waitlist User 1');
    assert.equal(testPool.currentBuyers, 2, 'Pool currentBuyers restored to 2 upon promotion');
  });

  test('9. Excluded member can rejoin without being blocked as duplicate (reaches capacity check)', () => {
    assert.throws(() => {
      recordDemoLead(testPoolId, {
        fullName: 'Buyer Alpha Rejoin',
        whatsappNumber: '9111111111',
        city: 'Bhopal',
        connectionPreference: 'INDIVIDUAL_INTRO',
      });
    }, /TARGET_REACHED/);
  });

  test('10. Rate limiting helper accurately restricts bursts and reports reset time', () => {
    const key = 'test-client-ip';
    const limit = 3;
    const windowMs = 5000;

    const r1 = checkRateLimit(key, limit, windowMs);
    assert.equal(r1.allowed, true);
    assert.equal(r1.remaining, 2);

    const r2 = checkRateLimit(key, limit, windowMs);
    assert.equal(r2.allowed, true);
    assert.equal(r2.remaining, 1);

    const r3 = checkRateLimit(key, limit, windowMs);
    assert.equal(r3.allowed, true);
    assert.equal(r3.remaining, 0);

    const r4 = checkRateLimit(key, limit, windowMs);
    assert.equal(r4.allowed, false);
    assert.equal(r4.remaining, 0);
    assert.ok(r4.resetMs > 0);
  });
});

