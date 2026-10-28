// ==============================================================================
// GroupBuying India — Admin Manual Operations Scenario Test Suite
// scratch/verify-admin-manual-ops.mjs
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
  console.log('--- STARTING ADMIN & MANUAL OPERATIONS SCENARIO VERIFICATION ---\n');

  try {
    await loginAdmin();
    console.log('[Setup] Admin session authenticated.\n');
  } catch (err) {
    console.error('Failed to initialize admin session:', err.message);
    process.exit(1);
  }

  // --------------------------------------------------------------------------
  // TEST 1: Overview Action Queues Metrics
  // --------------------------------------------------------------------------
  console.log('[Test 1] Overview Action Queues Metrics');
  const overviewRes = await fetch(`${BASE_URL}/api/admin/overview`, {
    headers: { Cookie: adminCookie },
  });
  const overviewData = await overviewRes.json();
  assert(overviewRes.ok && overviewData.success, 'Overview metrics endpoint returns success');
  assert(typeof overviewData.data.totalOpenGroups === 'number', 'totalOpenGroups is returned');
  assert(typeof overviewData.data.totalTargetReached === 'number', 'totalTargetReached is returned');
  assert(typeof overviewData.data.totalWaitlistPending === 'number', 'totalWaitlistPending is returned');
  assert(typeof overviewData.data.totalQuotesAwaitingReview === 'number', 'totalQuotesAwaitingReview is returned');

  // --------------------------------------------------------------------------
  // TEST 2: Group Pools Listing & Seeded Pools
  // --------------------------------------------------------------------------
  console.log('\n[Test 2] Group Pools Listing & Seeded Pools');
  const poolsRes = await fetch(`${BASE_URL}/api/admin/pools`, {
    headers: { Cookie: adminCookie },
  });
  const poolsData = await poolsRes.json();
  assert(poolsRes.ok && poolsData.success && Array.isArray(poolsData.data), 'Pools endpoint returns pool list');
  const activePool = poolsData.data.find((p) => p.status === 'ACTIVE' && p.isPublished !== false);
  assert(Boolean(activePool), `Active published pool found: ${activePool?.id}`);

  // --------------------------------------------------------------------------
  // TEST 3: Group-wise Member Listing & Filtering
  // --------------------------------------------------------------------------
  console.log('\n[Test 3] Group-wise Member Listing & Filtering');
  const membersRes = await fetch(`${BASE_URL}/api/admin/pools/${activePool.id}/members`, {
    headers: { Cookie: adminCookie },
  });
  const membersData = await membersRes.json();
  assert(membersRes.ok && membersData.success, 'Pool members endpoint returns success');
  assert(Array.isArray(membersData.data.members), 'Members list is an array');

  let testLead = membersData.data.members[0];
  if (!testLead) {
    // Join a member to test with
    const joinRes = await fetch(`${BASE_URL}/api/pools/${activePool.id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Admin Test Lead',
        whatsappNumber: '9876543210',
        city: activePool.city,
        buyingTimeline: 'THIS_MONTH',
        consentToContact: true,
      }),
    });
    const joinData = await joinRes.json();
    assert(joinRes.ok && joinData.success, 'Successfully registered test lead');
    testLead = { id: joinData.data.leadId };
  }
  assert(Boolean(testLead?.id), `Working test lead identified: ${testLead?.id}`);

  // --------------------------------------------------------------------------
  // TEST 4: Manually Recorded Member Decision & Reason History
  // --------------------------------------------------------------------------
  console.log('\n[Test 4] Manually Recorded Member Decision & Reason History');
  const decisionRes = await fetch(`${BASE_URL}/api/admin/pools/${activePool.id}/members/${testLead.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: 'http://localhost:3000' },
    body: JSON.stringify({
      quoteResponse: 'INTERESTED',
      quoteResponseNotes: 'Customer confirmed via WhatsApp voice call that they accept quoted terms',
    }),
  });
  const decisionData = await decisionRes.json();
  if (!decisionRes.ok || !decisionData.success) {
    console.error('Decision failure:', JSON.stringify(decisionData));
  }
  assert(decisionRes.ok && decisionData.success, 'Member decision updated to INTERESTED');
  assert(decisionData.data?.quoteResponse === 'INTERESTED', 'Response reflects INTERESTED decision');

  // --------------------------------------------------------------------------
  // TEST 5: Manual Connection Fee Calculation & Payment Verification
  // --------------------------------------------------------------------------
  console.log('\n[Test 5] Manual Connection Fee Calculation & Payment Verification');
  const feeRes = await fetch(`${BASE_URL}/api/admin/pools/${activePool.id}/members/${testLead.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: 'http://localhost:3000' },
    body: JSON.stringify({
      feeStatus: 'PAID_VERIFIED',
      feeApprovedBasis: 125000,
      feeDisclosedAmount: 125,
      paymentReference: 'UPI-REF-20261027-12345',
      connectionStatus: 'ELIGIBLE_TO_CONNECT',
    }),
  });
  const feeData = await feeRes.json();
  assert(feeRes.ok && feeData.success, 'Fee status updated to PAID_VERIFIED');
  assert(feeData.data?.feeStatus === 'PAID_VERIFIED', 'Lead reflects PAID_VERIFIED fee status');
  assert(feeData.data?.paymentReference === 'UPI-REF-20261027-12345', 'Payment reference recorded');
  assert(feeData.data?.connectionStatus === 'ELIGIBLE_TO_CONNECT', 'Connection status updated to ELIGIBLE_TO_CONNECT');

  // --------------------------------------------------------------------------
  // TEST 6: FIFO Waitlist Management (Join, Queue Number, Invite, Promote)
  // --------------------------------------------------------------------------
  console.log('\n[Test 6] FIFO Waitlist Management (Join, Queue Number, Invite, Promote)');
  const waitlistJoinRes = await fetch(`${BASE_URL}/api/pools/${activePool.id}/waitlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Waitlist Candidate One',
      whatsappNumber: '9123456789',
      locality: 'Indiranagar',
      buyingTimeline: 'WITHIN_7_DAYS',
      extraMessage: 'Ready to buy immediately if a spot opens',
    }),
  });
  const waitlistJoinData = await waitlistJoinRes.json();
  if (!waitlistJoinRes.ok || !waitlistJoinData.success) {
    console.error('Waitlist join failure:', JSON.stringify(waitlistJoinData));
  }
  assert(waitlistJoinRes.ok && waitlistJoinData.success, 'Public waitlist join succeeded');
  assert(typeof waitlistJoinData.data.sequenceNumber === 'number', `Waitlist assigned sequence number #${waitlistJoinData.data.sequenceNumber}`);

  const waitlistEntryId = waitlistJoinData.data.waitlistId;

  // Admin inspects waitlist
  const adminWaitlistRes = await fetch(`${BASE_URL}/api/admin/pools/${activePool.id}/waitlist`, {
    headers: { Cookie: adminCookie },
  });
  const adminWaitlistData = await adminWaitlistRes.json();
  assert(adminWaitlistRes.ok && adminWaitlistData.success, 'Admin waitlist list retrieved');
  const foundEntry = adminWaitlistData.data.find((w) => w.id === waitlistEntryId);
  assert(Boolean(foundEntry), 'Waitlist entry is visible in admin queue');

  // Admin invites waitlist candidate
  const inviteRes = await fetch(`${BASE_URL}/api/admin/pools/${activePool.id}/waitlist/${waitlistEntryId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: 'http://localhost:3000' },
    body: JSON.stringify({ status: 'INVITED' }),
  });
  const inviteData = await inviteRes.json();
  assert(inviteRes.ok && inviteData.success && inviteData.data?.status === 'INVITED', 'Waitlist status updated to INVITED');

  // Admin promotes waitlist candidate
  const promoteRes = await fetch(`${BASE_URL}/api/admin/pools/${activePool.id}/waitlist/${waitlistEntryId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: 'http://localhost:3000' },
    body: JSON.stringify({ status: 'PROMOTED' }),
  });
  const promoteData = await promoteRes.json();
  const isPromoted = promoteData.data?.status === 'PROMOTED' || promoteData.data?.waitlist?.status === 'PROMOTED';
  assert(promoteRes.ok && promoteData.success && isPromoted, 'Waitlist status updated to PROMOTED');

  // --------------------------------------------------------------------------
  // TEST 7: Quotation Lifecycle & Publication Controls
  // --------------------------------------------------------------------------
  console.log('\n[Test 7] Quotation Lifecycle & Publication Controls');
  const newQuoteRes = await fetch(`${BASE_URL}/api/admin/pools/${activePool.id}/quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: 'http://localhost:3000' },
    body: JSON.stringify({
      vendorName: 'Ather Space Prime Hub',
      quotedAmount: 124999,
      quoteDate: new Date().toISOString(),
      validUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
      scope: 'Ex-showroom price + comprehensive insurance + home charging dock + 3-year battery warranty',
      inclusions: ['Home Charger Dock', 'Comprehensive Insurance', '3Y Extended Warranty'],
      priceType: 'VENDOR_QUOTED',
      status: 'RECEIVED',
    }),
  });
  const newQuoteData = await newQuoteRes.json();
  assert(newQuoteRes.ok && newQuoteData.success, 'New vendor quotation created successfully');
  const createdQuoteId = newQuoteData.data?.id;

  // Publish the quote to the group
  const publishQuoteRes = await fetch(`${BASE_URL}/api/admin/pools/${activePool.id}/quotes/${createdQuoteId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: 'http://localhost:3000' },
    body: JSON.stringify({
      isCurrentPublished: true,
      status: 'PUBLISHED',
    }),
  });
  const publishQuoteData = await publishQuoteRes.json();
  assert(publishQuoteRes.ok && publishQuoteData.success && publishQuoteData.data?.isCurrentPublished === true, 'Quote published to group');

  // --------------------------------------------------------------------------
  // TEST 8: WhatsApp Template Generation & Manual Sent Status Recording
  // --------------------------------------------------------------------------
  console.log('\n[Test 8] WhatsApp Template Generation & Manual Sent Status Recording');
  const waGenRes = await fetch(`${BASE_URL}/api/admin/leads/${testLead.id}/whatsapp?template=QUOTE_AVAILABLE`, {
    headers: { Cookie: adminCookie },
  });
  const waGenData = await waGenRes.json();
  assert(waGenRes.ok && waGenData.success, 'WhatsApp message generated with valid wa.me URL');
  assert(waGenData.data.url.startsWith('https://wa.me/91'), 'URL uses safe https://wa.me/91 prefix');

  // Explicitly record sent status
  const waSentRes = await fetch(`${BASE_URL}/api/admin/leads/${testLead.id}/whatsapp/sent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: 'http://localhost:3000' },
    body: JSON.stringify({
      templateType: 'QUOTE_AVAILABLE',
      note: 'Operator manually dispatched message via WhatsApp desktop client',
    }),
  });
  const waSentData = await waSentRes.json();
  assert(waSentRes.ok && waSentData.success, 'Manual WhatsApp SENT status recorded successfully');
  assert(waSentData.data?.lastContactStatus === 'SENT', 'Lead reflects lastContactStatus: SENT');

  // --------------------------------------------------------------------------
  // TEST 9: Group Lifecycle Guards (Complete, Archive, Restore Safety)
  // --------------------------------------------------------------------------
  console.log('\n[Test 9] Group Lifecycle Guards (Complete, Archive, Restore Safety)');
  // Mark pool as completed
  const completeRes = await fetch(`${BASE_URL}/api/admin/pools/${activePool.id}/complete`, {
    method: 'POST',
    headers: { Cookie: adminCookie, Origin: 'http://localhost:3000' },
  });
  const completeData = await completeRes.json();
  const isCompleted = completeData.data?.connectionStatus === 'COMPLETED' || completeData.data?.status === 'COMPLETED';
  assert(completeRes.ok && completeData.success && isCompleted, 'Pool marked as COMPLETED (connectionStatus: COMPLETED)');

  // Archive pool
  const archiveRes = await fetch(`${BASE_URL}/api/admin/pools/${activePool.id}/archive`, {
    method: 'POST',
    headers: { Cookie: adminCookie, Origin: 'http://localhost:3000' },
  });
  const archiveData = await archiveRes.json();
  assert(archiveRes.ok && archiveData.success && archiveData.data?.isArchived === true, 'Pool status set to isArchived: true');

  // Restore pool — MUST NOT AUTO-PUBLISH (isPublished remains false)
  const restoreRes = await fetch(`${BASE_URL}/api/admin/pools/${activePool.id}/restore`, {
    method: 'POST',
    headers: { Cookie: adminCookie, Origin: 'http://localhost:3000' },
  });
  const restoreData = await restoreRes.json();
  assert(restoreRes.ok && restoreData.success, 'Pool restored successfully');
  assert(restoreData.data?.isArchived === false, 'Restored pool is no longer archived');
  assert(restoreData.data?.deletedAt === null, 'Restored pool has null deletedAt');
  assert(restoreData.data.isPublished === false, 'SAFETY CHECK PASSED: Restored pool is NOT automatically published (isPublished is false)');

  // --------------------------------------------------------------------------
  // TEST 10: Audit Log Trail
  // --------------------------------------------------------------------------
  console.log('\n[Test 10] Audit Log Trail');
  const auditRes = await fetch(`${BASE_URL}/api/admin/audit-logs?targetType=POOL&targetId=${activePool.id}`, {
    headers: { Cookie: adminCookie },
  });
  const auditData = await auditRes.json();
  assert(auditRes.ok && auditData.success && Array.isArray(auditData.data), 'Audit logs retrieved for pool');
  assert(auditData.data.length > 0, `Recorded ${auditData.data.length} audit events for pool actions`);

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`VERIFICATION SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
