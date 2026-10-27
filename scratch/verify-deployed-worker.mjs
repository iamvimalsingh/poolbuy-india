// Smoke test against deployed Cloudflare Worker
const BASE = 'https://poolbuy-india-hotfix-test.iamvimalsingh.workers.dev';

const tests = [
  {
    name: 'GET / (Homepage)',
    url: `${BASE}/`,
    expectedStatus: 200,
    validate: (res, body) => {
      if (!body.includes('Bring local buyers together') && !body.includes('GroupBuying') && !body.includes('PoolBuy')) {
        throw new Error('Homepage missing core brand headline');
      }
      if (body.includes('Error 1101') || body.includes('Worker threw exception')) {
        throw new Error('Detected Error 1101 or Worker exception in response');
      }
    },
  },
  {
    name: 'GET /city/bhopal (City Landing Page)',
    url: `${BASE}/city/bhopal`,
    expectedStatus: 200,
    validate: (res, body) => {
      if (!body.toLowerCase().includes('bhopal')) {
        throw new Error('City page did not render Bhopal content');
      }
      if (body.includes('Error 1101') || body.includes('Worker threw exception')) {
        throw new Error('Detected Error 1101 or Worker exception in response');
      }
    },
  },
  {
    name: 'GET /category/cars (Category Landing Page)',
    url: `${BASE}/category/cars`,
    expectedStatus: 200,
    validate: (res, body) => {
      if (!body.toLowerCase().includes('car') && !body.toLowerCase().includes('automotive')) {
        throw new Error('Category page did not render cars/automotive content');
      }
      if (body.includes('Error 1101') || body.includes('Worker threw exception')) {
        throw new Error('Detected Error 1101 or Worker exception in response');
      }
    },
  },
  {
    name: 'GET /api/cities (API Route)',
    url: `${BASE}/api/cities`,
    expectedStatus: 200,
    validate: (res, body) => {
      const json = JSON.parse(body);
      if (!json.success || !Array.isArray(json.data) || json.data.length === 0) {
        throw new Error('Cities API did not return success array');
      }
      const bhopal = json.data.find((c) => c.slug === 'bhopal');
      if (!bhopal) throw new Error('Bhopal missing from cities API');
    },
  },
  {
    name: 'GET /api/categories (Categories API Route)',
    url: `${BASE}/api/categories`,
    expectedStatus: 200,
    validate: (res, body) => {
      const json = JSON.parse(body);
      if (!json.success || !Array.isArray(json.data) || json.data.length === 0) {
        throw new Error('Categories API did not return success array');
      }
    },
  },
  {
    name: 'GET /sitemap.xml (Sitemap Route)',
    url: `${BASE}/sitemap.xml`,
    expectedStatus: 200,
    validate: (res, body) => {
      if (!body.includes('<urlset') || !body.includes('/city/bhopal')) {
        throw new Error('Sitemap XML invalid or missing city routes');
      }
    },
  },
];

async function run() {
  console.log(`Starting live Cloudflare Worker verification against: ${BASE}`);
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(t.url, { signal: controller.signal });
      clearTimeout(timeout);

      const elapsed = Date.now() - start;
      const body = await res.text();

      if (res.status !== t.expectedStatus) {
        throw new Error(`Expected HTTP ${t.expectedStatus}, got ${res.status}. Body: ${body.slice(0, 300)}`);
      }

      t.validate(res, body);
      const cfRay = res.headers.get('cf-ray') || 'N/A';
      console.log(`[PASS] ${t.name} -> HTTP ${res.status} (${elapsed}ms, ${body.length} bytes, Ray: ${cfRay})`);
      passed++;
    } catch (err) {
      const elapsed = Date.now() - start;
      console.error(`[FAIL] ${t.name} (${elapsed}ms):`, err.message);
      failed++;
    }
  }

  console.log(`\nLive Worker Test Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
