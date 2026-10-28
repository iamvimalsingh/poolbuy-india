// ==============================================================================
// GroupBuying / PoolBuy India — Full MVP Community Workflow Verification
// scratch/mvp-community-verify.mjs
// ==============================================================================

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const ADMIN_PASSKEY = process.env.ADMIN_PASSKEY;

if (!ADMIN_PASSKEY) {
  console.error('[SECURITY ERROR] Required environment variable ADMIN_PASSKEY is not set. Failing closed.');
  process.exit(1);
}

let adminCookie = '';
let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedCount++;
  }
}

async function loginAdmin() {
  const res = await fetch(`${BASE_URL}/api/admin/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passkey: ADMIN_PASSKEY }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(`Admin login failed: ${JSON.stringify(data)}`);
  }
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    adminCookie = setCookie.split(';')[0];
  }
  return true;
}

async function run() {
  console.log('--- STARTING GROUPBUYING MVP FULL VERIFICATION ---\n');

  try {
    await loginAdmin();
    console.log('[Setup] Admin session authenticated.\n');
  } catch (err) {
    console.error('Failed to initialize admin session:', err.message);
    process.exit(1);
  }

  // --------------------------------------------------------------------------
  // TEST 1: Public Proposal Workflow (Start a Group Buy)
  // --------------------------------------------------------------------------
  console.log('[Test 1] Public Proposal Workflow (Start a Group Buy)');
  let createdRequestId = '';
  const proposalPayload = {
    productName: 'Ather 450X Gen 4 Electric Scooter',
    city: 'Bhopal',
    state: 'Madhya Pradesh',
    category: 'EV_SCOOTERS',
    brandPreference: 'Ather Energy',
    modelPreference: '450X 3.7kWh',
    fullName: 'Rahul Sharma',
    whatsappNumber: '9826012345',
    extraMessage: 'Looking for 10 buyers for group discount on Ather 450X',
    requestType: 'GROUP_PROPOSAL',
    targetBuyersRequested: 5,
    requestedDeadline: new Date(Date.now() + 14 * 86400000).toISOString(),
    locality: 'MP Nagar Zone 2',
    pinCode: '462011',
    requirementsSummary: 'Need standard charger and comprehensive insurance included',
    contactConsent: true,
  };

  const reqRes = await fetch(`${BASE_URL}/api/pool-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(proposalPayload),
  });
  const reqData = await reqRes.json();

  assert(reqRes.ok && reqData.success === true, 'Public proposal submitted successfully (status: 200/201)');
  assert(reqData.data && (reqData.data.id || reqData.data.requestId), 'Returned id in response payload');
  createdRequestId = reqData.data?.id || reqData.data?.requestId;

  // --------------------------------------------------------------------------
  // TEST 2: Admin Proposal Review & Status Transitions
  // --------------------------------------------------------------------------
  console.log('\n[Test 2] Admin Proposal Review & Status Transitions');
  const adminReqsRes = await fetch(`${BASE_URL}/api/admin/pool-requests`, {
    headers: { Cookie: adminCookie },
  });
  const adminReqsData = await adminReqsRes.json();
  assert(adminReqsRes.ok && adminReqsData.success === true, 'Admin pool requests endpoint returns 200');

  const foundProposal = (adminReqsData.data || []).find((r) => r.id === createdRequestId);
  console.log('DEBUG foundProposal:', JSON.stringify(foundProposal, null, 2));
  assert(Boolean(foundProposal), 'Created proposal appears in admin demand discovery list');
  assert(foundProposal?.requestType === 'GROUP_PROPOSAL', 'Proposal retains requestType GROUP_PROPOSAL');
  assert(foundProposal?.targetBuyersRequested === 5, 'Proposal retains requested target buyers (5)');

  // Update status to NEEDS_INFO
  const patchInfoRes = await fetch(`${BASE_URL}/api/admin/pool-requests/${createdRequestId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: BASE_URL },
    body: JSON.stringify({ status: 'NEEDS_INFO', adminNotes: 'Contacting buyer for dealer quotes' }),
  });
  const patchInfoData = await patchInfoRes.json();
  console.log('DEBUG patchInfo:', patchInfoRes.status, patchInfoData);
  assert(patchInfoRes.ok && patchInfoData.success === true, 'Admin status update to NEEDS_INFO succeeds');

  // Convert proposal to draft group
  console.log('\n[Test 3] Proposal Conversion into Draft Group');
  const convertRes = await fetch(`${BASE_URL}/api/admin/pool-requests/${createdRequestId}/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: BASE_URL },
    body: JSON.stringify({
      citySlug: 'bhopal',
      productName: 'Ather 450X Bhopal Community Pool',
      productSlug: `ather-450x-bhopal-${Date.now().toString(36)}`,
      categorySlug: 'ev-scooters',
      productBrand: 'Ather Energy',
      productModel: '450X 3.7kWh',
      marketPrice: 155000,
      groupPrice: 142000,
      targetBuyers: 5,
      durationDays: 14,
      dealerName: 'Ather Space MP Nagar',
    }),
  });
  const convertData = await convertRes.json();
  assert(convertRes.ok && convertData.success === true, 'Proposal conversion succeeds (status: 200/201)');
  const convertedPoolId = convertData.data?.poolId;
  const poolSlug = convertData.data?.poolSlug;
  const citySlug = convertData.data?.citySlug || 'bhopal';
  assert(Boolean(convertedPoolId), 'Conversion returns created poolId');

  // --------------------------------------------------------------------------
  // TEST 4: Draft Protection vs Publish Action
  // --------------------------------------------------------------------------
  console.log('\n[Test 4] Draft Protection & Publish Toggle');
  // Check public deal page - draft must NOT be visible (404)
  const publicDealRes1 = await fetch(`${BASE_URL}/deals/${citySlug}/${poolSlug}`);
  const publicDealText1 = await publicDealRes1.text();
  const isHiddenOr404 =
    publicDealRes1.status === 404 ||
    publicDealText1.includes('404') ||
    publicDealText1.includes('Page Not Found');
  assert(isHiddenOr404, 'Un-published draft pool deal page returns 404 (hidden publicly)');

  // Admin publishes pool
  const publishRes = await fetch(`${BASE_URL}/api/admin/pools/${convertedPoolId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: BASE_URL },
    body: JSON.stringify({ isPublished: true }),
  });
  const publishData = await publishRes.json();
  assert(publishRes.ok && publishData.success === true, 'Admin publish action succeeds');

  // Now verify deal page is visible publicly (200)
  const publicDealRes2 = await fetch(`${BASE_URL}/deals/${citySlug}/${poolSlug}`);
  assert(publicDealRes2.status === 200, 'Published pool deal page is now accessible publicly (status 200)');

  // --------------------------------------------------------------------------
  // TEST 5: Public Join & Duplicate Prevention
  // --------------------------------------------------------------------------
  console.log('\n[Test 5] Public Join & Duplicate Prevention');
  const phoneBase = '98260' + String(Date.now()).slice(-5);
  const joinPayload1 = {
    fullName: 'Ananya Verma',
    whatsappNumber: phoneBase,
    locality: 'Arera Colony',
    pinCode: '462016',
    consentToContact: true,
    connectionOptIn: true,
  };

  const joinRes1 = await fetch(`${BASE_URL}/api/pools/${convertedPoolId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(joinPayload1),
  });
  const joinData1 = await joinRes1.json();
  assert(joinRes1.ok && joinData1.success === true, 'First join registration succeeds (status: 200)');
  assert(joinData1.data?.buyerNumber === 1, 'First buyer receives buyerNumber: 1');
  assert(joinData1.data?.alreadyJoined === false, 'alreadyJoined flag is false');

  // Duplicate join attempt with same phone
  const joinRes2 = await fetch(`${BASE_URL}/api/pools/${convertedPoolId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Ananya V (Duplicate)',
      whatsappNumber: phoneBase,
      consentToContact: true,
    }),
  });
  const joinData2 = await joinRes2.json();
  assert(joinRes2.ok && joinData2.success === true, 'Duplicate join returns 200 idempotently');
  assert(joinData2.data?.alreadyJoined === true, 'Duplicate join flagged as alreadyJoined: true');
  assert(joinData2.data?.buyerNumber === 1, 'Duplicate join retains original buyerNumber: 1');

  // --------------------------------------------------------------------------
  // TEST 6: Target Milestone & Post-Target Connection State
  // --------------------------------------------------------------------------
  console.log('\n[Test 6] Target Milestone & Post-Target Connection Readiness');
  // Join 4 more unique members to reach target of 5
  for (let i = 2; i <= 5; i++) {
    await fetch(`${BASE_URL}/api/pools/${convertedPoolId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: `Buyer Member ${i}`,
        whatsappNumber: '9827' + String(Date.now() + i).slice(-6),
        consentToContact: true,
        connectionOptIn: true,
      }),
    });
  }

  // Inspect pool state via admin
  const adminPoolsRes = await fetch(`${BASE_URL}/api/admin/pools`, {
    headers: { Cookie: adminCookie },
  });
  const adminPoolsData = await adminPoolsRes.json();
  const updatedPool = (adminPoolsData.data || []).find((p) => p.id === convertedPoolId);

  assert(updatedPool?.currentBuyers >= 5, `Pool reached target count (${updatedPool?.currentBuyers}/5)`);
  assert(updatedPool?.status === 'UNLOCKED', 'Pool status transitioned to UNLOCKED');
  assert(updatedPool?.connectionStatus === 'ADMIN_REVIEW_PENDING', 'connectionStatus transitioned to ADMIN_REVIEW_PENDING');
  assert(updatedPool?.paymentConfigState === 'DISABLED', 'paymentConfigState remains DISABLED (no fees collected)');

  // --------------------------------------------------------------------------
  // TEST 7: Member CRM & WhatsApp Click-to-Chat Action
  // --------------------------------------------------------------------------
  console.log('\n[Test 7] Member CRM & WhatsApp Click-to-Chat Action');
  const leadsRes = await fetch(`${BASE_URL}/api/admin/leads?poolId=${convertedPoolId}`, {
    headers: { Cookie: adminCookie },
  });
  const leadsData = await leadsRes.json();
  assert(leadsRes.ok && leadsData.success === true, 'Admin leads endpoint returns 200');
  const leadList = leadsData.data?.leads || leadsData.data || [];
  assert(leadList.length === 5, `Expected 5 leads, found ${leadList.length}`);

  const firstLead = leadList[0];
  // Generate WhatsApp message for target reached invitation
  const waRes = await fetch(`${BASE_URL}/api/admin/leads/${firstLead.id}/whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: BASE_URL },
    body: JSON.stringify({ template: 'TARGET_REACHED_INVITATION' }),
  });
  const waData = await waRes.json();
  assert(waRes.ok && waData.success === true, 'WhatsApp click-to-chat URL generated successfully');
  assert(waData.data?.whatsappUrl?.startsWith('https://wa.me/91'), 'URL formatted as https://wa.me/91...');
  assert(waData.data?.whatsappUrl?.includes('GroupBuying'), 'Message body mentions GroupBuying brand');

  // Test opt-out guard
  const optOutRes = await fetch(`${BASE_URL}/api/admin/leads`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: BASE_URL },
    body: JSON.stringify({ leadId: firstLead.id, status: 'DO_NOT_CONTACT' }),
  });
  assert(optOutRes.ok, 'Lead updated to DO_NOT_CONTACT');

  const waOptOutRes = await fetch(`${BASE_URL}/api/admin/leads/${firstLead.id}/whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: BASE_URL },
    body: JSON.stringify({ template: 'TARGET_REACHED_INVITATION' }),
  });
  const waOptOutData = await waOptOutRes.json();
  assert(waOptOutRes.status === 400, 'WhatsApp generation blocked with 400 for opted-out lead');
  assert(waOptOutData.error?.code === 'CONTACT_OPTED_OUT', 'Error code is CONTACT_OPTED_OUT');

  // --------------------------------------------------------------------------
  // TEST 8: Hard Delete Dependency Guard & Clone / Extend Actions
  // --------------------------------------------------------------------------
  console.log('\n[Test 8] Hard Delete Dependency Guard & Clone / Extend Actions');
  // Attempt hard delete on pool with 5 leads
  const hardDeleteRes = await fetch(`${BASE_URL}/api/admin/pools/${convertedPoolId}?hard=true`, {
    method: 'DELETE',
    headers: { Cookie: adminCookie, Origin: BASE_URL },
  });
  const hardDeleteData = await hardDeleteRes.json();
  assert(hardDeleteRes.status === 400, 'Hard delete blocked on pool with members (returns 400)');
  assert(hardDeleteData.error?.code === 'CANNOT_HARD_DELETE', 'Error code is CANNOT_HARD_DELETE');

  // Clone pool to Indore as independent pool
  const cloneRes = await fetch(`${BASE_URL}/api/admin/pools/${convertedPoolId}/clone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: BASE_URL },
    body: JSON.stringify({ targetCity: 'Indore', durationDays: 21 }),
  });
  const cloneData = await cloneRes.json();
  assert(cloneRes.ok && cloneData.success === true, 'Clone pool to Indore succeeds');
  const clonedPool = cloneData.data;
  assert(clonedPool?.city === 'Indore', 'Cloned pool city is Indore');
  assert(clonedPool?.currentBuyers === 0, 'Cloned pool has 0 buyers (leads not moved)');
  assert(clonedPool?.isPublished === false, 'Cloned pool starts as un-published draft');

  // Extend deadline with commercial justification
  const extendRes = await fetch(`${BASE_URL}/api/admin/pools/${convertedPoolId}/extend-deadline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: BASE_URL },
    body: JSON.stringify({
      newDeadline: new Date(Date.now() + 30 * 86400000).toISOString(),
      reason: 'Dealer requested 15 additional days for battery stock allocation',
    }),
  });
  const extendData = await extendRes.json();
  assert(extendRes.ok && extendData.success === true, 'Extend deadline succeeds with logged reason');

  // --------------------------------------------------------------------------
  // TEST 9: Admin Audit Log
  // --------------------------------------------------------------------------
  console.log('\n[Test 9] Admin Audit Log Verification');
  const auditRes = await fetch(`${BASE_URL}/api/admin/audit-logs`, {
    headers: { Cookie: adminCookie },
  });
  const auditData = await auditRes.json();
  assert(auditRes.ok && auditData.success === true, 'Admin audit logs endpoint returns 200');
  const logs = auditData.data || [];
  const hasPoolCreated = logs.some((l) => l.action === 'POOL_CONVERTED' || l.action === 'POOL_CREATED');
  const hasPoolCloned = logs.some((l) => l.action === 'POOL_CLONED');
  const hasDeadlineExtended = logs.some((l) => l.action === 'DEADLINE_EXTENDED' || l.action === 'POOL_DEADLINE_EXTENDED');
  assert(hasPoolCreated, 'Audit log records pool creation/conversion');
  assert(hasPoolCloned, 'Audit log records pool cloning');
  assert(hasDeadlineExtended, 'Audit log records deadline extension');

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log(`\n--- GROUPBUYING MVP FULL VERIFICATION RESULTS: ${passedCount} PASSED, ${failedCount} FAILED ---`);
  if (failedCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
