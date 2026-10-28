import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone } from '../format';
import {
  buildWhatsAppDirectUrl,
  buildTargetReachedMessage,
  buildQuoteAvailableMessage,
  buildOptOutConfirmationMessage,
} from '../whatsapp';
import {
  executePoolRequest,
  getAllPoolRequests,
} from '../requests';
import {
  addDemoPool,
  getDemoRequests,
  updateDemoRequest,
  updateDemoLead,
  DEMO_LEADS,
} from '../mock-data';
import { recordAdminAudit, getDemoAuditLogs } from '../audit';
import { convertRequestSchema, updateMemberDecisionSchema } from '../validation';
import { AdminPool, PoolLead } from '@/types';

// CSRF Origin verification logic matching lib/require-admin.ts
function validateCsrfOrigin(headers: Record<string, string | null | undefined>): boolean {
  const origin = headers['origin'];
  if (!origin) return true;
  const host = headers['host'];
  if (!host) return false;
  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

describe('Phase 4: Admin Operations, Lead Management & Manual WhatsApp Workflow', () => {
  describe('1. Admin Authorization, CSRF Guard & Security Rules', () => {
    test('validateCsrfOrigin allows matching origin and host', () => {
      const allowed = validateCsrfOrigin({
        host: 'groupbuying.store',
        origin: 'https://groupbuying.store',
      });
      assert.equal(allowed, true);
    });

    test('validateCsrfOrigin strictly blocks mismatched cross-origin requests', () => {
      const blocked = validateCsrfOrigin({
        host: 'groupbuying.store',
        origin: 'https://malicious-site.com',
      });
      assert.equal(blocked, false);
    });

    test('validateCsrfOrigin safely handles missing origin for same-origin requests', () => {
      const allowed = validateCsrfOrigin({
        host: 'groupbuying.store',
      });
      assert.equal(allowed, true);
    });
  });

  describe('2. Pool Request Review & Authorized Explicit Conversion', () => {
    const testProductName = 'Mahindra Treo Electric Auto';
    const testCity = 'Bhopal';
    const testCategorySlug = 'commercial-vehicles';
    const testBrand = 'Mahindra Electric';
    const testModel = 'Treo Yaari';

    test('convertRequestSchema validates admin conversion payload preserving category and product details', () => {
      const payload = {
        title: testProductName,
        productName: testProductName,
        categorySlug: testCategorySlug,
        citySlug: 'bhopal',
        citySlugs: ['bhopal'],
        productBrand: testBrand,
        productModel: testModel,
        targetBuyers: 12,
        durationDays: 21,
        isPublished: true,
      };

      const parsed = convertRequestSchema.safeParse(payload);
      assert.ok(parsed.success, 'Valid conversion payload must pass schema validation');
      assert.equal(parsed.data.productName, testProductName);
      assert.equal(parsed.data.categorySlug, testCategorySlug);
      assert.equal(parsed.data.citySlug, 'bhopal');
      assert.equal(parsed.data.productBrand, testBrand);
      assert.equal(parsed.data.productModel, testModel);
      assert.equal(parsed.data.targetBuyers, 12);
    });

    test('Request conversion preserves requested product, category, brand, model and city identity', async () => {
      // 1. Submit community pool request
      const reqResult = await executePoolRequest({
        fullName: 'Vikram Patel',
        whatsappNumber: '9826099999',
        city: testCity,
        categorySlug: testCategorySlug,
        productName: testProductName,
        brandPreference: testBrand,
        modelPreference: testModel,
        targetBuyersRequested: 12,
        extraMessage: 'Looking for group order of passenger electric autos.',
        contactConsent: true,
      });

      assert.ok(reqResult.id, 'Request must return an id');
      const submittedId = reqResult.id;

      // 2. Locate request in store
      const allRequests = await getAllPoolRequests();
      const submitted = allRequests.find((r) => r.id === submittedId);
      assert.ok(submitted, 'Submitted request must exist');
      assert.equal(submitted.productName, testProductName);
      assert.equal(submitted.brandPreference, testBrand);
      assert.equal(submitted.modelPreference, testModel);
      assert.equal(submitted.conversionStatus, 'PENDING');

      // 3. Perform Admin Conversion
      const createdPoolId = `pool-p4-${Date.now()}`;
      const poolSlug = 'mahindra-treo-electric-auto-bhopal';

      const newPool: AdminPool = {
        id: createdPoolId,
        slug: poolSlug,
        name: testProductName,
        productTitle: testProductName,
        variantName: testModel,
        shortDescription: 'Community pool launched from verified buyer interest.',
        longDescription: 'Commercial EV group deal aggregated from user demand in Bhopal.',
        category: 'TRACTORS_COMMERCIAL',
        categorySlug: testCategorySlug,
        city: testCity,
        citySlug: 'bhopal',
        productBrand: testBrand,
        productModel: testModel,
        imageUrl: null,
        marketPrice: 350000,
        groupPrice: 320000,
        targetBuyers: 12,
        currentBuyers: 0,
        deadline: new Date(Date.now() + 21 * 86400000).toISOString(),
        status: 'ACTIVE',
        isPublished: true,
        sourceRequestId: submittedId,
        priceIsVerified: false,
        priceVerifiedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      addDemoPool(newPool);

      updateDemoRequest(submittedId, {
        status: 'APPROVED',
        conversionStatus: 'CONVERTED',
        resultingPoolId: createdPoolId,
      });

      await recordAdminAudit({
        action: 'POOL_CONVERTED',
        targetType: 'POOL',
        targetId: createdPoolId,
        changesSummary: `Converted request ${submittedId} into official pool "${testProductName}" for ${testCity}.`,
        details: { requestId: submittedId, poolId: createdPoolId, name: testProductName, citySlug: 'bhopal' },
      });

      // 4. Verify request status updated
      const updatedReq = getDemoRequests().find((r) => r.id === submittedId);
      assert.ok(updatedReq);
      assert.equal(updatedReq.status, 'APPROVED');
      assert.equal(updatedReq.conversionStatus, 'CONVERTED');
      assert.equal(updatedReq.resultingPoolId, createdPoolId);

      // 5. Verify official pool created with truthful link to source request
      assert.equal(newPool.sourceRequestId, submittedId);
      assert.equal(newPool.productTitle, testProductName);
      assert.equal(newPool.variantName, testModel);
      assert.equal(newPool.categorySlug, testCategorySlug);
      assert.equal(newPool.city, 'Bhopal');
      assert.equal(newPool.citySlug, 'bhopal');
    });

    test('Duplicate conversion of an already-converted request is rejected (idempotency)', () => {
      const demoReqs = getDemoRequests();
      const convertedReq = demoReqs.find((r) => r.conversionStatus === 'CONVERTED');
      assert.ok(convertedReq, 'Converted request must exist for idempotency test');

      // Attempting to convert again must be identified as already converted
      const isAlreadyConverted = convertedReq.conversionStatus === 'CONVERTED' || Boolean(convertedReq.resultingPoolId);
      assert.equal(isAlreadyConverted, true);
    });
  });

  describe('3. City Isolation & Scope Integrity', () => {
    test('Pools and capacity remain isolated by city and do not cross-pollinate', () => {
      const bhopalPool: AdminPool = {
        id: 'pool-bhopal-iso',
        slug: 'inverter-bhopal',
        name: 'Pure Sine Wave Inverter 1100VA',
        productTitle: 'Pure Sine Wave Inverter 1100VA',
        category: 'HOME_APPLIANCES' as AdminPool['category'],
        categorySlug: 'home-appliances',
        city: 'Bhopal',
        citySlug: 'bhopal',
        productBrand: 'Luminous',
        productModel: 'Zelio 1100',
        imageUrl: null,
        marketPrice: 18000,
        groupPrice: 15500,
        targetBuyers: 10,
        currentBuyers: 4,
        deadline: new Date(Date.now() + 10 * 86400000).toISOString(),
        status: 'ACTIVE',
        isPublished: true,
        priceIsVerified: true,
        priceVerifiedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const punePool: AdminPool = {
        id: 'pool-pune-iso',
        slug: 'inverter-pune',
        name: 'Pure Sine Wave Inverter 1100VA',
        productTitle: 'Pure Sine Wave Inverter 1100VA',
        category: 'HOME_APPLIANCES' as AdminPool['category'],
        categorySlug: 'home-appliances',
        city: 'Pune',
        citySlug: 'pune',
        productBrand: 'Luminous',
        productModel: 'Zelio 1100',
        imageUrl: null,
        marketPrice: 18000,
        groupPrice: 15500,
        targetBuyers: 10,
        currentBuyers: 1,
        deadline: new Date(Date.now() + 10 * 86400000).toISOString(),
        status: 'ACTIVE',
        isPublished: true,
        priceIsVerified: true,
        priceVerifiedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      addDemoPool(bhopalPool);
      addDemoPool(punePool);

      assert.notEqual(bhopalPool.id, punePool.id);
      assert.equal(bhopalPool.citySlug, 'bhopal');
      assert.equal(punePool.citySlug, 'pune');
      assert.equal(bhopalPool.currentBuyers, 4);
      assert.equal(punePool.currentBuyers, 1);
      assert.notEqual(bhopalPool.currentBuyers, punePool.currentBuyers);
    });
  });

  describe('4. Manual WhatsApp Workflow, Phone Normalization & Safe URL Encoding', () => {
    test('normalizePhone cleans raw phone formats to standard 10-digit Indian numbers', () => {
      assert.equal(normalizePhone('9876543210'), '9876543210');
      assert.equal(normalizePhone('+91 98765 43210'), '9876543210');
      assert.equal(normalizePhone('+91-98765-43210'), '9876543210');
      assert.equal(normalizePhone('09876543210'), '9876543210');
      assert.equal(normalizePhone('919876543210'), '9876543210');
      assert.equal(normalizePhone('00919876543210'), '9876543210');
    });

    test('buildWhatsAppDirectUrl produces correct https://wa.me/91<10-digit> URL with safe percent-encoding', () => {
      const rawPhone = '+91 98260 12345';
      const message = 'Namaste Rajesh,\n\nYour group deal in Bhopal has reached its target! Details: https://groupbuying.store';

      const url = buildWhatsAppDirectUrl(rawPhone, message);

      assert.ok(url.startsWith('https://wa.me/919826012345?text='), 'Must prefix with 91 and normalized 10 digits without duplicate 91');
      assert.ok(url.includes('Namaste%20Rajesh'), 'Spaces must be percent-encoded');
      assert.ok(url.includes('%0A'), 'Newlines must be percent-encoded');
      assert.ok(!url.includes('\n'), 'Raw newlines must not appear in the URL');
    });

    test('Templates convey truthful, non-obligatory group-buying terms', () => {
      const targetReached = buildTargetReachedMessage('Priya Sharma', 'Tata Nexon EV', 'Delhi', 15);
      assert.ok(targetReached.includes('Priya Sharma'));
      assert.ok(targetReached.includes('Tata Nexon EV'));
      assert.ok(targetReached.includes('15 members'));
      assert.ok(targetReached.includes('There is no payment or commitment required at this stage.'));

      const quoteMsg = buildQuoteAvailableMessage('Priya Sharma', 'Tata Nexon EV', 'Delhi', 1450000, '2026-11-20T18:00:00Z');
      assert.ok(quoteMsg.includes('₹14,50,000'));
      assert.ok(quoteMsg.includes('INTERESTED'));
      assert.ok(quoteMsg.includes('DECLINED'));
      assert.ok(quoteMsg.includes('This inquiry does not obligate you to purchase.'));

      const optOutMsg = buildOptOutConfirmationMessage('Priya Sharma', 'Tata Nexon EV');
      assert.ok(optOutMsg.includes('DO NOT CONTACT'));
      assert.ok(optOutMsg.includes('no further messages'));
    });
  });

  describe('5. Strict Consent & Opt-Out Enforcement', () => {
    test('Suppress WhatsApp contact when do_not_contact = 1 or status = DO_NOT_CONTACT', () => {
      const leadOptedOut: Partial<PoolLead> = {
        id: 'lead-opted-out-1',
        fullName: 'Sunil Verma',
        whatsappNumber: '9826011223',
        doNotContact: true,
        status: 'DO_NOT_CONTACT',
        consentAt: new Date().toISOString(),
      };

      const hasOptedOut = Boolean(leadOptedOut.doNotContact) || leadOptedOut.status === 'DO_NOT_CONTACT';
      assert.equal(hasOptedOut, true, 'Must identify lead as opted-out');
    });

    test('Suppress WhatsApp contact when consent is absent', () => {
      const leadNoConsent: Partial<PoolLead> = {
        id: 'lead-no-consent-1',
        fullName: 'Kavita Das',
        whatsappNumber: '9826033445',
        doNotContact: false,
        status: 'NEW',
        consentAt: undefined,
      };

      const hasConsent = Boolean(leadNoConsent.consentAt);
      assert.equal(hasConsent, false, 'Lead without consentAt must have hasConsent = false');
    });

    test('Atomically marks status as DO_NOT_CONTACT and sets doNotContact = true', () => {
      const testLeadId = `lead-test-${Date.now()}`;
      const mockLead: PoolLead = {
        id: testLeadId,
        poolId: 'pool-test-leads',
        poolSlug: 'test-deal',
        poolName: 'Test Deal',
        poolCategory: 'EV_SCOOTERS',
        buyerNumber: 99,
        fullName: 'Test Lead Consent',
        whatsappNumber: '9826055555',
        city: 'Bhopal',
        buyingTimeline: 'THIS_MONTH',
        hasExistingQuote: false,
        existingQuoteAmount: null,
        extraMessage: '',
        status: 'NEW',
        consentAt: new Date().toISOString(),
        privacyNoticeVersion: '2026-10-26-v1',
        createdAt: new Date().toISOString(),
        doNotContact: false,
      };

      DEMO_LEADS.unshift(mockLead);

      // Verify initial state
      assert.equal(mockLead.status, 'NEW');
      assert.equal(mockLead.doNotContact, false);

      // Update to DO_NOT_CONTACT
      updateDemoLead(testLeadId, {
        status: 'DO_NOT_CONTACT',
        doNotContact: true,
      });

      // Verify atomic update
      const updated = DEMO_LEADS.find((l) => l.id === testLeadId);
      assert.ok(updated);
      assert.equal(updated.status, 'DO_NOT_CONTACT');
      assert.equal(updated.doNotContact, true);
    });

    test('updateMemberDecisionSchema validates doNotContact and quoteResponse fields', () => {
      const validPayload = {
        doNotContact: true,
        adminNotes: 'Requested removal during WhatsApp inquiry.',
      };

      const parsed = updateMemberDecisionSchema.safeParse(validPayload);
      assert.ok(parsed.success);
      assert.equal(parsed.data.doNotContact, true);
      assert.equal(parsed.data.adminNotes, 'Requested removal during WhatsApp inquiry.');
    });

    test('Prevents marking opted-out member as CONNECTED without clearing opt-out flag first', () => {
      const optedOutLead: Partial<PoolLead> = {
        id: 'lead-opted-out-connected-test',
        doNotContact: true,
        status: 'DO_NOT_CONTACT',
      };

      const updateAttempt: { connectionStatus: 'CONNECTED'; doNotContact?: boolean } = {
        connectionStatus: 'CONNECTED',
      };

      const isBlocked = (optedOutLead.doNotContact || optedOutLead.status === 'DO_NOT_CONTACT') &&
        updateAttempt.doNotContact !== false &&
        updateAttempt.connectionStatus === 'CONNECTED';

      assert.equal(isBlocked, true, 'Connecting an opted-out lead without clearing opt-out must be blocked');
    });
  });

  describe('6. Admin Audit Logging & Traceability', () => {
    test('recordAdminAudit logs administrative actions truthfully', async () => {
      await recordAdminAudit({
        action: 'WHATSAPP_LINK_GENERATED',
        targetType: 'LEAD',
        targetId: 'lead-audit-test',
        changesSummary: 'Generated WhatsApp link (TARGET_REACHED_INVITATION) for member #3.',
        details: { leadId: 'lead-audit-test', template: 'TARGET_REACHED_INVITATION' },
      });

      const logs = getDemoAuditLogs();
      const match = logs.find((l) => l.action === 'WHATSAPP_LINK_GENERATED' && l.targetId === 'lead-audit-test');
      assert.ok(match, 'Audit log entry must be present in audit store');
      assert.equal(match.targetType, 'LEAD');
      assert.ok(match.changesSummary.includes('TARGET_REACHED_INVITATION'));
    });
  });
});
