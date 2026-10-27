// Complete Production Verification Script for https://groupbuying.store
import dns from 'node:dns';

dns.setDefaultResultOrder('ipv4first');

const PROD_BASE = 'https://groupbuying.store';

const routesToTest = [
  { path: '/', name: 'Production Homepage' },
  { path: '/city/bhopal', name: 'Bhopal City Landing Page' },
  { path: '/category/cars', name: 'Cars Category Landing Page' },
  { path: '/api/cities', name: 'Cities Public API' },
  { path: '/api/categories', name: 'Categories Public API' },
  { path: '/api/locations', name: 'Locations Public API' },
  { path: '/sitemap.xml', name: 'Sitemap XML' },
  { path: '/admin/login', name: 'Admin Login Page' },
];

async function runProductionTests() {
  console.log(`=== RUNNING PRODUCTION VERIFICATION AGAINST ${PROD_BASE} ===\n`);

  const results = [];

  for (const route of routesToTest) {
    const url = `${PROD_BASE}${route.path}`;
    const start = Date.now();
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'GroupBuying-ReleaseVerification/1.0' } });
      const duration = Date.now() - start;
      const text = await res.text();
      const ray = res.headers.get('cf-ray') || 'N/A';
      const openNext = res.headers.get('x-opennext') || 'N/A';

      const passed = res.status === 200 && !text.includes('Error 1101') && !text.includes('Worker threw exception');

      console.log(`[${passed ? 'PASS' : 'FAIL'}] ${route.name} (${route.path})`);
      console.log(`       Status: HTTP ${res.status} | Time: ${duration}ms | Size: ${text.length} bytes`);
      console.log(`       CF-Ray: ${ray} | OpenNext: ${openNext}`);

      if (!passed) {
        console.error(`       ERROR: Response failed validation! Preview:\n${text.slice(0, 300)}`);
      }

      results.push({ ...route, status: res.status, ray, passed, duration, size: text.length });
    } catch (err) {
      console.error(`[FAIL] ${route.name} (${route.path}) -> Network error:`, err.message);
      results.push({ ...route, status: 0, passed: false, error: err.message });
    }
  }

  // Security checks: Unauthenticated Admin APIs
  console.log('\n=== SECURITY & FAIL-CLOSED CHECKS ===');
  const adminEndpoints = [
    '/api/admin/overview',
    '/api/admin/pools',
    '/api/admin/leads',
    '/api/admin/audit-logs',
  ];

  for (const ep of adminEndpoints) {
    const url = `${PROD_BASE}${ep}`;
    const res = await fetch(url);
    const ray = res.headers.get('cf-ray') || 'N/A';
    const isProtected = res.status === 401;
    console.log(`[${isProtected ? 'PASS' : 'FAIL'}] Protected API ${ep} -> HTTP ${res.status} (expected 401 Unauthorized) | CF-Ray: ${ray}`);
    results.push({ name: `Protected API ${ep}`, path: ep, status: res.status, passed: isProtected, ray });
  }

  // Verify real D1 data returned by /api/cities
  console.log('\n=== DATA INTEGRITY CHECKS ===');
  const citiesRes = await fetch(`${PROD_BASE}/api/cities`);
  const citiesJson = await citiesRes.json();
  const hasCities = citiesJson.success && Array.isArray(citiesJson.data) && citiesJson.data.length === 10;
  console.log(`[${hasCities ? 'PASS' : 'FAIL'}] D1 Production Operational Cities: ${citiesJson.data?.length || 0}/10 verified`);

  const categoriesRes = await fetch(`${PROD_BASE}/api/categories`);
  const categoriesJson = await categoriesRes.json();
  const hasCategories = categoriesJson.success && Array.isArray(categoriesJson.data) && categoriesJson.data.length === 8;
  console.log(`[${hasCategories ? 'PASS' : 'FAIL'}] D1 Production Verified Categories: ${categoriesJson.data?.length || 0}/8 verified`);

  const allPassed = results.every((r) => r.passed) && hasCities && hasCategories;
  console.log(`\nOVERALL PRODUCTION VERIFICATION RESULT: ${allPassed ? 'ALL TESTS PASSED SUCCESSFULLY' : 'FAILURES DETECTED'}`);

  if (!allPassed) {
    process.exit(1);
  }
}

runProductionTests().catch((err) => {
  console.error('Production test execution failed:', err);
  process.exit(1);
});
