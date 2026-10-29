import assert from 'node:assert/strict';

const BASE_URL = 'https://groupbuying.store';

async function runProdSmokeTests() {
  console.log(`=== Remote Production Smoke Tests against ${BASE_URL} ===\n`);
  const results = [];

  async function test(name, fn) {
    try {
      const detail = await fn();
      results.push({ name, status: 'PASS', detail });
      console.log(`✓ PASS: ${name} — ${detail}`);
    } catch (err) {
      results.push({ name, status: 'FAIL', detail: err.message });
      console.error(`✗ FAIL: ${name} — ${err.message}`);
    }
  }

  // 1. Homepage & Branding
  await test('1. Homepage & GroupBuying Branding', async () => {
    const res = await fetch(`${BASE_URL}/`);
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const html = await res.text();
    assert(html.includes('GroupBuying'), 'Missing GroupBuying brand text');
    assert(html.includes('groupbuying.store') || html.includes('GroupBuying.store'), 'Missing domain reference');
    return `HTTP 200, length: ${html.length} bytes, branding confirmed`;
  });

  // 2. Locations Reference API
  await test('2. Locations Reference API (/api/locations)', async () => {
    const res = await fetch(`${BASE_URL}/api/locations`);
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success, 'Expected success: true');
    assert.equal(data.data?.totalStates, 28, `Expected 28 states, got ${data.data?.totalStates}`);
    assert.equal(data.data?.totalUnionTerritories, 8, `Expected 8 UTs, got ${data.data?.totalUnionTerritories}`);
    return `HTTP 200, 28 States and 8 Union Territories returned`;
  });

  // 3. Categories Reference API
  await test('3. Dynamic Categories API (/api/categories)', async () => {
    const res = await fetch(`${BASE_URL}/api/categories`);
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success, 'Expected success: true');
    const count = data.data?.length || 0;
    assert.equal(count, 8, `Expected 8 categories, got ${count}`);
    return `HTTP 200, 8 operational categories returned from groupbuying-prod D1`;
  });

  // 4. Cities Reference API
  await test('4. Operational Cities API (/api/cities)', async () => {
    const res = await fetch(`${BASE_URL}/api/cities`);
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success, 'Expected success: true');
    const count = data.data?.length || 0;
    assert(count >= 10, `Expected >= 10 cities, got ${count}`);
    return `HTTP 200, ${count} cities returned`;
  });

  // 5. City Filter Page (/city/pune)
  await test('5. City-specific Page (/city/pune)', async () => {
    const res = await fetch(`${BASE_URL}/city/pune`);
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const html = await res.text();
    assert(html.includes('Pune'), 'City name Pune missing from page');
    return `HTTP 200, Pune page rendered`;
  });

  // 6. Category Page (/category/rooftop-solar)
  await test('6. Category-specific Page (/category/rooftop-solar)', async () => {
    const res = await fetch(`${BASE_URL}/category/rooftop-solar`);
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const html = await res.text();
    assert(html.includes('Solar'), 'Category title missing from page');
    return `HTTP 200, Rooftop Solar page rendered`;
  });

  // 7. Admin Login Page & Route Guard
  await test('7. Admin Login Page (/admin/login)', async () => {
    const res = await fetch(`${BASE_URL}/admin/login`);
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const html = await res.text();
    assert(html.includes('Passkey') || html.includes('Admin'), 'Missing passkey input');
    return `HTTP 200, Admin login form rendered`;
  });

  // 8. Protected Admin API Protection
  await test('8. Protected Admin API Protection (/api/admin/overview)', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/overview`);
    assert.equal(res.status, 401, `Expected 401 Unauthorized, got ${res.status}`);
    return `HTTP 401 strictly enforced without auth cookie`;
  });

  // 9. Demand Request Submission & Production D1 Persistence
  let createdRequestId = null;
  const uniqueSuffix = Date.now().toString().slice(-8);
  const testPhone = `99${uniqueSuffix}`;
  const testProduct = `Production 5kVA Solar Battery ${uniqueSuffix}`;

  await test('9. Public Demand Request Submission (/api/pool-requests)', async () => {
    const payload = {
      productName: testProduct,
      categorySlug: 'power-backup',
      city: 'Pune',
      cityText: 'Pune',
      name: 'Prod Verifier',
      fullName: 'Prod Verifier',
      whatsappNumber: testPhone,
      phone: testPhone,
      contactConsent: true,
      joinPoolConsent: true,
      targetBuyersRequested: 10,
    };
    const res = await fetch(`${BASE_URL}/api/pool-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const json = await res.json();
    assert(json.success, 'Expected success: true');
    assert(json.data?.id, 'Missing request ID in response');
    assert.equal(json.data.isDemo, false, 'Expected isDemo: false (live production D1 mode)');
    createdRequestId = json.data.id;
    return `HTTP 200, created request ${createdRequestId} with isDemo: false, joinPoolConsent: true`;
  });

  // 10. Duplicate Demand Request Prevention Check
  await test('10. Duplicate Demand Request Prevention (/api/pool-requests -> 409)', async () => {
    const payload = {
      productName: testProduct,
      categorySlug: 'power-backup',
      city: 'Pune',
      cityText: 'Pune',
      name: 'Prod Verifier',
      fullName: 'Prod Verifier',
      whatsappNumber: testPhone,
      phone: testPhone,
      contactConsent: true,
      joinPoolConsent: true,
      targetBuyersRequested: 10,
    };
    const res = await fetch(`${BASE_URL}/api/pool-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 409, `Expected 409 Conflict, got ${res.status}`);
    const json = await res.json();
    const errorCode = typeof json.error === 'object' ? json.error?.code : json.error;
    assert.equal(errorCode, 'DUPLICATE_ACTIVE_REQUEST', `Expected DUPLICATE_ACTIVE_REQUEST, got ${errorCode}`);
    const existingId = json.data?.existingRequestId || json.data?.id;
    assert(existingId, 'Expected existingRequestId or data.id in 409 payload');
    return `HTTP 409 DUPLICATE_ACTIVE_REQUEST verified with existingRequestId: ${existingId}`;
  });

  // 11. Public Catalog Request Isolation Check
  await test('11. Public Catalog Demand Request Isolation', async () => {
    assert(createdRequestId, 'No request ID available from previous test');
    const res = await fetch(`${BASE_URL}/`);
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const html = await res.text();
    assert(!html.includes(createdRequestId), 'Unconverted request ID leaked into public catalog!');
    assert(!html.includes(testProduct), 'Unconverted request product title leaked into public catalog!');
    return `Demand proposal strictly isolated from public catalog`;
  });

  // 12. Viewport Meta Tag for Mobile Verification
  await test('12. Viewport Meta Tag Check (Desktop & Mobile Readiness)', async () => {
    const res = await fetch(`${BASE_URL}/`);
    const html = await res.text();
    assert(html.includes('width=device-width'), 'Missing viewport width=device-width');
    assert(html.includes('initial-scale=1'), 'Missing initial-scale=1');
    return `Viewport meta tag verified: width=device-width, initial-scale=1`;
  });

  console.log('\n=== Summary of Remote Production Tests ===');
  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;
  console.log(`Passed: ${passCount} / ${results.length}`);
  console.log(`Failed: ${failCount} / ${results.length}`);
  if (failCount > 0) {
    process.exit(1);
  }
}

runProdSmokeTests().catch(console.error);
