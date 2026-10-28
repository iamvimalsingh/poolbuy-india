/**
 * Phase F Verification Script — PoolBuy India
 * Tests:
 * 1. Buying timelines validation (THIS_MONTH, WITHIN_1_3_MONTHS, WITHIN_3_6_MONTHS, JUST_EXPLORING)
 * 2. Join rejection on expired/closed pools (POOL_NOT_OPEN, status 409)
 * 3. Scheduler endpoint protection (/api/cron/pool-lifecycle with CRON_SECRET)
 * 4. Scheduler idempotent expiry execution
 * 5. Admin soft delete, hard delete prevention when leads exist, and restore
 * 6. Archive and unarchive controls
 * 7. Public pool filtering excludes soft-deleted and archived pools
 */

const BASE_URL = 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET;
const ADMIN_PASSKEY = process.env.ADMIN_PASSKEY;

if (!CRON_SECRET || !ADMIN_PASSKEY) {
  console.error('[SECURITY ERROR] Required environment variables CRON_SECRET and/or ADMIN_PASSKEY are not set. Failing closed.');
  process.exit(1);
}

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failCount++;
  }
}

async function loginAdmin() {
  const loginRes = await fetch(`${BASE_URL}/api/admin/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passkey: ADMIN_PASSKEY }),
  });
  if (!loginRes.ok) throw new Error('Admin login failed');
  const setCookie = loginRes.headers.get('set-cookie') || '';
  const match = setCookie.match(/poolbuy-admin-session=([^;]+)/);
  if (!match) throw new Error('Could not extract admin session cookie');
  return match[1];
}

async function runTests() {
  console.log('--- STARTING PHASE F VERIFICATION ---\n');

  try {
    const adminToken = await loginAdmin();
    const adminHeaders = {
      'Content-Type': 'application/json',
      Cookie: `poolbuy-admin-session=${adminToken}`,
    };

    // 1. Verify Buying Timeline Validation
    console.log('[Test 1] Verify V3 Buying Timeline Validation');
    
    // Fetch an active Bhopal pool
    const activePoolId = '33333333-3333-4333-8333-333333333333'; // 3 kW Solar in Bhopal
    
    // Join with valid timeline
    const validJoinRes = await fetch(`${BASE_URL}/api/pools/${activePoolId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Timeline Tester',
        whatsappNumber: '9826011223',
        city: 'Bhopal',
        buyingTimeline: 'THIS_MONTH',
        hasExistingQuote: false,
      }),
    });
    assert(validJoinRes.ok, `Join with valid timeline THIS_MONTH succeeds (status: ${validJoinRes.status})`);

    // Join with invalid timeline
    const invalidJoinRes = await fetch(`${BASE_URL}/api/pools/${activePoolId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Invalid Tester',
        whatsappNumber: '9826011224',
        city: 'Bhopal',
        buyingTimeline: 'INVALID_TIMELINE_YEAR_2030',
        hasExistingQuote: false,
      }),
    });
    assert(invalidJoinRes.status === 400, `Join with invalid timeline rejected with 400 (actual: ${invalidJoinRes.status})`);

    // 2. Verify Scheduler Security
    console.log('\n[Test 2] Verify Protected Scheduler Endpoint Security');
    const unauthorizedRes = await fetch(`${BASE_URL}/api/cron/pool-lifecycle`, { method: 'POST' });
    assert(unauthorizedRes.status === 401, `Unauthorized request to scheduler returns 401 (actual: ${unauthorizedRes.status})`);

    const bearerAuthRes = await fetch(`${BASE_URL}/api/cron/pool-lifecycle`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    assert(bearerAuthRes.ok, `Bearer token CRON_SECRET succeeds (status: ${bearerAuthRes.status})`);
    const bearerData = await bearerAuthRes.json();
    assert(bearerData.success === true, 'Scheduler returns success: true');

    const queryAuthRes = await fetch(`${BASE_URL}/api/cron/pool-lifecycle?secret=${encodeURIComponent(CRON_SECRET)}`);
    assert(queryAuthRes.ok, `Query parameter ?secret=... succeeds (status: ${queryAuthRes.status})`);

    // 3. Create a test pool with an expired deadline and test automated expiry
    console.log('\n[Test 3] Verify Automatic Pool Expiry');
    const uniqueExpiryName = 'Auto-Expire Test Solar Package ' + Date.now();
    const createExpiredRes = await fetch(`${BASE_URL}/api/admin/pools`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: uniqueExpiryName,
        category: 'ROOFTOP_SOLAR',
        city: 'Bhopal',
        productBrand: 'ExpiredBrand',
        productModel: 'ModelX',
        targetBuyers: 5,
        deadline: new Date(Date.now() - 3600 * 1000).toISOString(), // 1 hour in past
        status: 'ACTIVE',
      }),
    });
    assert(createExpiredRes.ok, `Created pool with past deadline for expiry test (status: ${createExpiredRes.status})`);
    const expiredPoolData = await createExpiredRes.json();
    const expiredPoolId = expiredPoolData.data.id;

    // Trigger cron scheduler
    const cronRunRes = await fetch(`${BASE_URL}/api/cron/pool-lifecycle`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    const cronRunData = await cronRunRes.json();
    assert(cronRunData.data.totalClosedCount >= 1, `Cron scheduler closed past-deadline pool (count: ${cronRunData.data.totalClosedCount})`);

    // Attempt to join the expired pool - must be rejected
    const joinExpiredRes = await fetch(`${BASE_URL}/api/pools/${expiredPoolId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Late Buyer',
        whatsappNumber: '9826099887',
        city: 'Bhopal',
        buyingTimeline: 'THIS_MONTH',
        hasExistingQuote: false,
      }),
    });
    assert(joinExpiredRes.status === 409, `Join on expired pool rejected with 409 POOL_NOT_OPEN (actual: ${joinExpiredRes.status})`);

    // 4. Test Soft-Delete, Hard Delete Protection, and Restore
    console.log('\n[Test 4] Verify Soft-Delete, Hard Delete Protection, and Restore');
    // Pool with existing leads (activePoolId has leads from Test 1)
    const hardDeleteWithLeadsRes = await fetch(`${BASE_URL}/api/admin/pools/${activePoolId}?hard=true`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    assert(hardDeleteWithLeadsRes.status === 400, `Hard delete blocked on pool with leads (actual: ${hardDeleteWithLeadsRes.status})`);
    const hardDelErr = await hardDeleteWithLeadsRes.json();
    assert(hardDelErr.error.code === 'CANNOT_HARD_DELETE', 'Error code is CANNOT_HARD_DELETE');

    // Create a disposable pool for soft-delete & restore testing
    const uniqueDispName = 'Disposable Soft-Delete Test Pool ' + Date.now();
    const createDispRes = await fetch(`${BASE_URL}/api/admin/pools`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: uniqueDispName,
        category: 'ROOFTOP_SOLAR',
        city: 'Bhopal',
        productBrand: 'TestBrand',
        productModel: 'SoftDelModel',
        targetBuyers: 10,
        deadline: new Date(Date.now() + 86400 * 1000 * 10).toISOString(),
        status: 'ACTIVE',
      }),
    });
    const dispData = await createDispRes.json();
    const dispId = dispData.data.id;
    const dispSlug = dispData.data.slug;

    // Verify it appears in public deals
    const pubCheck1 = await fetch(`${BASE_URL}/deals/bhopal/${dispSlug}`);
    assert(pubCheck1.ok, `Disposable pool exists publicly before deletion (status: ${pubCheck1.status})`);

    // Soft-delete the pool
    const softDelRes = await fetch(`${BASE_URL}/api/admin/pools/${dispId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    assert(softDelRes.ok, `Soft-delete succeeds (status: ${softDelRes.status})`);
    const softDelData = await softDelRes.json();
    assert(softDelData.data.action === 'soft_deleted', 'Action reported as soft_deleted');

    // Verify it is excluded from public deal page
    const pubCheck2 = await fetch(`${BASE_URL}/deals/bhopal/${dispSlug}`);
    const pubCheck2Html = await pubCheck2.text();
    assert(
      pubCheck2.status === 404 || pubCheck2Html.includes('Page Not Found') || pubCheck2Html.includes('404 Not Found'),
      'Soft-deleted pool is no longer publicly accessible (returns 404 / Not Found)'
    );

    // Restore the pool
    const restoreRes = await fetch(`${BASE_URL}/api/admin/pools/${dispId}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({
        deletedAt: null,
        isArchived: false,
        status: 'ACTIVE',
        closureReason: null,
      }),
    });
    assert(restoreRes.ok, `Restore succeeds (status: ${restoreRes.status})`);
    const restoredData = await restoreRes.json();
    assert(restoredData.data.status === 'ACTIVE', 'Restored pool status is ACTIVE');
    assert(restoredData.data.deletedAt === null, 'Restored pool deletedAt is null');

    // Verify it is accessible again publicly
    const pubCheck3 = await fetch(`${BASE_URL}/deals/bhopal/${dispSlug}`);
    assert(pubCheck3.ok, `Restored pool is publicly accessible again (status: ${pubCheck3.status})`);

    // 5. Test Archive Controls
    console.log('\n[Test 5] Verify Archive and Unarchive Controls');
    // Archive pool
    const archiveRes = await fetch(`${BASE_URL}/api/admin/pools/${dispId}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ isArchived: true }),
    });
    assert(archiveRes.ok, `Archive pool succeeds (status: ${archiveRes.status})`);

    // Verify it is excluded from public listing
    const pubCheckArchive = await fetch(`${BASE_URL}/deals/bhopal/${dispSlug}`);
    const pubArchiveHtml = await pubCheckArchive.text();
    assert(
      pubCheckArchive.status === 404 || pubArchiveHtml.includes('Page Not Found') || pubArchiveHtml.includes('404 Not Found'),
      'Archived pool is hidden from public view'
    );

    // Unarchive pool
    const unarchiveRes = await fetch(`${BASE_URL}/api/admin/pools/${dispId}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ isArchived: false }),
    });
    assert(unarchiveRes.ok, `Unarchive pool succeeds (status: ${unarchiveRes.status})`);

    // 6. Test Admin Immediate Expiry
    console.log('\n[Test 6] Verify Admin Immediate Expiry');
    const expireNowRes = await fetch(`${BASE_URL}/api/admin/pools/${dispId}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'CLOSED', closureReason: 'ADMIN_EXPIRED' }),
    });
    assert(expireNowRes.ok, `Admin Expire Now succeeds (status: ${expireNowRes.status})`);
    const expiredData = await expireNowRes.json();
    assert(expiredData.data.status === 'CLOSED', 'Pool status is CLOSED');
    assert(expiredData.data.closureReason === 'ADMIN_EXPIRED', 'Closure reason is ADMIN_EXPIRED');

  } catch (err) {
    console.error('Test execution error:', err);
    failCount++;
  }

  console.log(`\n--- PHASE F VERIFICATION RESULTS: ${passCount} PASSED, ${failCount} FAILED ---`);
  if (failCount > 0) {
    process.exit(1);
  }
}

runTests();
