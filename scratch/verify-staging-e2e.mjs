// Comprehensive Staging E2E Verification & Persistence Test
import { execSync } from 'node:child_process';

const BASE = 'https://poolbuy-india-hotfix-test.iamvimalsingh.workers.dev';

async function run() {
  console.log(`Starting comprehensive staging verification on: ${BASE}`);

  // 1. Check locations API
  console.log('\n--- 1. Testing GET /api/locations ---');
  const locRes = await fetch(`${BASE}/api/locations`);
  console.log(`HTTP ${locRes.status} (expected 200)`);
  if (locRes.status !== 200) throw new Error(`GET /api/locations failed: ${locRes.status}`);
  const locJson = await locRes.json();
  console.log(`Received ${locJson.data?.length || 0} locations`);

  // 2. Check Admin Login Page
  console.log('\n--- 2. Testing GET /admin/login ---');
  const loginRes = await fetch(`${BASE}/admin/login`);
  console.log(`HTTP ${loginRes.status} (expected 200)`);
  if (loginRes.status !== 200) throw new Error(`GET /admin/login failed: ${loginRes.status}`);
  const loginHtml = await loginRes.text();
  if (!loginHtml.includes('Passkey') && !loginHtml.includes('Admin')) {
    throw new Error('Admin login page missing expected fields');
  }

  // 3. Check unauthenticated Admin API protection (Fail Closed)
  console.log('\n--- 3. Testing Protected Admin API Security (Fail Closed) ---');
  const adminRes = await fetch(`${BASE}/api/admin/overview`);
  console.log(`HTTP ${adminRes.status} (expected 401 Unauthorized)`);
  if (adminRes.status !== 401) throw new Error(`Protected admin route did not return 401: got ${adminRes.status}`);

  // 4. Test public pool request mutation & remote D1 persistence
  console.log('\n--- 4. Testing Demand Discovery Request Mutation & D1 Persistence ---');
  const testReqId = `test-e2e-${Date.now()}`;
  const mutationPayload = {
    productName: 'E2E Staging Verification Bike',
    requestType: 'GROUP_PROPOSAL',
    category: 'EV_SCOOTERS',
    city: 'Bhopal',
    state: 'Madhya Pradesh',
    fullName: 'Test Staging Verifier',
    whatsappNumber: '9876543299',
    contactConsent: true,
    extraMessage: `Staging automated test run ${testReqId}`,
    targetBuyersRequested: 5,
  };

  const reqRes = await fetch(`${BASE}/api/pool-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mutationPayload),
  });
  console.log(`HTTP ${reqRes.status} (expected 200/201)`);
  if (reqRes.status !== 200 && reqRes.status !== 201) {
    const errText = await reqRes.text();
    throw new Error(`Public pool request creation failed (${reqRes.status}): ${errText}`);
  }
  const reqJson = await reqRes.json();
  const createdId = reqJson.data?.id;
  console.log(`Created request in D1 staging with ID: ${createdId}`);
  if (!createdId) throw new Error('No request ID returned from pool request mutation');

  // 5. Direct verification in remote groupbuying-staging database
  console.log('\n--- 5. Direct Database Verification in groupbuying-staging ---');
  const d1Query = `SELECT id, product_name, city, whatsapp_number, status FROM pool_requests WHERE id = '${createdId}';`;
  const d1Output = execSync(
    `npx wrangler d1 execute DB --config wrangler.staging.jsonc --remote --command "${d1Query}"`,
    { encoding: 'utf8' }
  );
  console.log(d1Output);
  if (!d1Output.includes('E2E Staging Verification Bike') || !d1Output.includes('Bhopal')) {
    throw new Error('Direct D1 database query failed to find persisted record!');
  }
  console.log('CONFIRMED: Mutation persisted truthfully into remote D1 groupbuying-staging database!');

  // 6. Cleanup synthetic test record
  console.log('\n--- 6. Cleaning Up Synthetic Staging Test Record ---');
  const cleanupSql = `DELETE FROM pool_requests WHERE id = '${createdId}';`;
  execSync(
    `npx wrangler d1 execute DB --config wrangler.staging.jsonc --remote --command "${cleanupSql}"`,
    { encoding: 'utf8' }
  );

  // Verify staging database is clean
  const verifyCleanSql = `SELECT COUNT(*) as remaining FROM pool_requests WHERE id = '${createdId}';`;
  const cleanOutput = execSync(
    `npx wrangler d1 execute DB --config wrangler.staging.jsonc --remote --command "${verifyCleanSql}"`,
    { encoding: 'utf8' }
  );
  if (!cleanOutput.includes('"remaining": 0') && !cleanOutput.includes('"remaining":0')) {
    throw new Error('Test fixture cleanup failed!');
  }
  console.log('CONFIRMED: Synthetic test fixture cleaned up. groupbuying-staging is clean.');

  console.log('\n=== ALL STAGING E2E & DATABASE PERSISTENCE TESTS PASSED ===\n');
}

run().catch((err) => {
  console.error('Staging verification error:', err);
  process.exit(1);
});
