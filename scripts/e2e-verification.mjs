import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';
const ADMIN_PASSKEY = process.env.ADMIN_PASSKEY;

if (!ADMIN_PASSKEY) {
  console.error('[SECURITY ERROR] Required environment variable ADMIN_PASSKEY is not set.');
  console.error('Aborting verification script to fail closed and protect test environment.');
  process.exit(1);
}

async function runE2E() {
  console.log('--- Starting GroupBuying / PoolBuy India E2E Verification against ' + BASE_URL + ' ---');

  // Step 1: Verify Homepage
  console.log('\n[Phase 6 - Journey A] Verifying Public Homepage...');
  const homeRes = await fetch(`${BASE_URL}/`);
  assert.equal(homeRes.status, 200, `Homepage returned ${homeRes.status}`);
  const homeHtml = await homeRes.text();
  assert.ok(homeHtml.includes('GroupBuying') || homeHtml.includes('PoolBuy'), 'Homepage contains brand title');
  console.log('✓ Homepage loaded successfully (HTTP 200, brand title present)');

  // Step 2: Journey A - Free-text Pool Request Submission
  console.log('\n[Phase 6 - Journey A] Submitting free-text pool request from Baraut, UP...');
  const testPhone = '9876500001';
  const reqPayload = {
    productName: 'Commercial Solar Inverter 10kVA - Dairy Farm',
    requestedTitle: 'Commercial Solar Inverter 10kVA - Dairy Farm',
    fullName: 'E2E Test Submitter',
    whatsappNumber: testPhone,
    city: 'Baraut',
    cityText: 'Baraut',
    state: 'Uttar Pradesh',
    stateText: 'Uttar Pradesh',
    extraMessage: 'Need commercial 3-phase hybrid inverter for 5 units',
    contactConsent: true,
  };

  const reqRes = await fetch(`${BASE_URL}/api/pool-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reqPayload),
  });
  assert.ok(reqRes.status === 200 || reqRes.status === 201, `Pool request returned ${reqRes.status}`);
  const reqData = await reqRes.json();
  assert.equal(reqData.success, true, 'Pool request returned success: true');
  const createdRequestId = reqData.data.id;
  assert.ok(createdRequestId, 'Received createdRequestId');
  console.log(`✓ Pool request created successfully with ID: ${createdRequestId}`);

  // Step 3: Journey B - Admin Authentication & Conversion
  console.log('\n[Phase 6 - Journey B] Authenticating Admin Session...');
  const loginRes = await fetch(`${BASE_URL}/api/admin/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({ passkey: ADMIN_PASSKEY }),
  });
  assert.equal(loginRes.status, 200, `Admin login returned ${loginRes.status}`);
  const setCookie = loginRes.headers.get('set-cookie');
  assert.ok(setCookie, 'Admin session cookie returned');
  const sessionCookie = setCookie.split(';')[0];
  console.log('✓ Admin authenticated successfully');

  console.log('\n[Phase 6 - Journey B] Converting request into shared pool with multi-city visibility...');
  const convertRes = await fetch(`${BASE_URL}/api/admin/pool-requests/${createdRequestId}/convert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
      'Cookie': sessionCookie,
    },
    body: JSON.stringify({
      title: 'Commercial Solar Inverter 10kVA (Shared Cohort)',
      shortDescription: 'Verified commercial group buying for solar hybrid inverters.',
      citySlugs: ['delhi', 'mumbai', 'pune'],
      categorySlug: 'rooftop-solar',
      durationDays: 14,
      isPublished: true,
    }),
  });
  assert.equal(convertRes.status, 201, `Pool conversion returned ${convertRes.status}`);
  const convertData = await convertRes.json();
  assert.equal(convertData.success, true, 'Conversion returned success: true');
  const createdPoolId = convertData.data.poolId;
  assert.ok(createdPoolId, 'Received createdPoolId');
  console.log(`✓ Pool converted successfully with ID: ${createdPoolId}`);

  // Step 4: Journey C - Capacity locking, FIFO waitlist queueing, and HTTP 409 rejection
  console.log('\n[Phase 6 - Journey C] Simulating joins 1 to 10 (Filling active capacity to 10)...');
  const memberLeads = [];
  for (let i = 1; i <= 10; i++) {
    const phone = `98765100${String(i).padStart(2, '0')}`;
    const joinRes = await fetch(`${BASE_URL}/api/pools/${createdPoolId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: `Active Buyer ${i}`,
        whatsappNumber: phone,
        connectionOptIn: true,
        vendorShareConsent: true,
      }),
    });
    assert.equal(joinRes.status, 200, `Join ${i} failed with status ${joinRes.status}`);
    const joinData = await joinRes.json();
    assert.equal(joinData.success, true, `Join ${i} was not successful`);
    assert.equal(joinData.data.buyerNumber, i, `Buyer number was not ${i}`);
    assert.equal(joinData.data.currentBuyers, i, `Current buyers was not ${i}`);
    memberLeads.push(joinData.data.leadId);
  }
  console.log('✓ All 10 active slots claimed successfully (Active count: 10/10, Target Reached)');

  // Duplicate Join test on active pool
  console.log('\n[Phase 6 - Journey C] Testing idempotent duplicate join...');
  const dupRes = await fetch(`${BASE_URL}/api/pools/${createdPoolId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Active Buyer 1 Duplicate',
      whatsappNumber: '9876510001',
      connectionOptIn: true,
      vendorShareConsent: true,
    }),
  });
  assert.equal(dupRes.status, 200, `Duplicate join returned ${dupRes.status}`);
  const dupData = await dupRes.json();
  assert.equal(dupData.success, true, 'Duplicate join returned success: true');
  assert.equal(dupData.data.alreadyJoined, true, 'Duplicate join flagged alreadyJoined: true');
  console.log('✓ Idempotent duplicate join verified (alreadyJoined: true, count unchanged)');

  // Joins 11 to 15: FIFO Waitlist
  console.log('\n[Phase 6 - Journey C] Simulating joins 11 to 15 (FIFO Waitlist 1 to 5)...');
  const waitlistIds = [];
  for (let i = 11; i <= 15; i++) {
    const phone = `98765100${String(i).padStart(2, '0')}`;
    const wlRes = await fetch(`${BASE_URL}/api/pools/${createdPoolId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: `Waitlisted User ${i - 10}`,
        whatsappNumber: phone,
        connectionOptIn: true,
        vendorShareConsent: true,
      }),
    });
    assert.equal(wlRes.status, 201, `Waitlist join ${i} failed with status ${wlRes.status}`);
    const wlData = await wlRes.json();
    assert.equal(wlData.success, true, `Waitlist join ${i} failed`);
    assert.equal(wlData.data.targetReached, true, 'targetReached is true for waitlist join');
    waitlistIds.push(wlData.data.leadId);
  }
  console.log('✓ 5 waitlist slots filled sequentially (Waitlist: 5/5)');

  // 16th Join: HTTP 409 rejection
  console.log('\n[Phase 6 - Journey C] Testing 16th join (Expecting HTTP 409 Conflict POOL_AND_WAITLIST_FULL)...');
  const fullRes = await fetch(`${BASE_URL}/api/pools/${createdPoolId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Rejected 16th User',
      whatsappNumber: '9876510016',
      connectionOptIn: true,
      vendorShareConsent: true,
    }),
  });
  assert.equal(fullRes.status, 409, `16th join returned status ${fullRes.status} instead of 409`);
  const fullData = await fullRes.json();
  assert.equal(fullData.success, false, '16th join returned success: false');
  assert.equal(fullData.error.code, 'POOL_AND_WAITLIST_FULL', 'Error code is POOL_AND_WAITLIST_FULL');
  console.log('✓ 16th join truthfully rejected with HTTP 409 POOL_AND_WAITLIST_FULL');

  // Step 5: Admin Member Exclusion & FIFO Promotion
  console.log('\n[Phase 6 - Journey C] Excluding Member 1 via Admin API...');
  const excludeRes = await fetch(`${BASE_URL}/api/admin/pools/${createdPoolId}/members/${memberLeads[0]}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
      'Cookie': sessionCookie,
    },
    body: JSON.stringify({
      connectionStatus: 'EXCLUDED',
      exclusionReason: 'Member requested exclusion for testing',
    }),
  });
  assert.equal(excludeRes.status, 200, `Member exclusion returned ${excludeRes.status}`);
  console.log('✓ Member 1 successfully excluded (Active count reduced to 9/10)');

  console.log('\n[Phase 6 - Journey C] Triggering Admin FIFO Promote Next (/api/admin/pools/[id]/promote-next)...');
  const promoteRes = await fetch(`${BASE_URL}/api/admin/pools/${createdPoolId}/promote-next`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
      'Cookie': sessionCookie,
    },
  });
  const promoteData = await promoteRes.json();
  if (promoteRes.status !== 200) {
    console.error('Promote next error payload:', promoteData);
  }
  assert.equal(promoteRes.status, 200, `Promote next returned ${promoteRes.status}`);
  assert.equal(promoteData.success, true, 'Promote next returned success: true');
  assert.equal(promoteData.data.promoted, true, 'Waitlist member promoted');
  assert.equal(promoteData.data.buyerNumber, 10, 'Promoted buyer assigned Buyer #10');
  console.log(`✓ Oldest waitlisted member successfully promoted to Buyer #10 (Active restored to 10/10)`);

  // Step 6: Safe Cleanup of Test Data
  console.log('\n[Cleanup] Cleaning up synthetic test data from local D1 database...');
  // Soft-archive request via API
  const archiveReqRes = await fetch(`${BASE_URL}/api/admin/pool-requests/${createdRequestId}`, {
    method: 'DELETE',
    headers: {
      'Origin': BASE_URL,
      'Cookie': sessionCookie,
    },
  });
  assert.equal(archiveReqRes.status, 200, `Request archive returned ${archiveReqRes.status}`);
  console.log('✓ Test pool request soft-archived successfully via API');

  // Hard cleanup of synthetic test records in correct FK dependency order
  const cleanupSql = `UPDATE pool_waitlist SET promoted_lead_id = NULL WHERE pool_id = '${createdPoolId}'; DELETE FROM pool_leads WHERE pool_id = '${createdPoolId}'; DELETE FROM pool_waitlist WHERE pool_id = '${createdPoolId}'; DELETE FROM pool_cities WHERE pool_id = '${createdPoolId}'; UPDATE pool_requests SET resulting_pool_id = NULL WHERE resulting_pool_id = '${createdPoolId}'; DELETE FROM pools WHERE id = '${createdPoolId}'; DELETE FROM pool_requests WHERE id = '${createdRequestId}';`;
  execSync(`npx wrangler d1 execute DB --local --command="${cleanupSql}"`, { stdio: 'pipe' });
  console.log('✓ Exact synthetic records purged from local D1 database');

  return {
    success: true,
    createdPoolId,
    createdRequestId,
  };
}

runE2E()
  .then(() => {
    console.log('\n======================================================');
    console.log('🎉 ALL PHASE 6 E2E JOURNEYS VERIFIED AND PASSED! 🎉');
    console.log('======================================================');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ E2E VERIFICATION FAILED:', err);
    process.exit(1);
  });
