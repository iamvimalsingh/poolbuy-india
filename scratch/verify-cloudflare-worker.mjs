// Comprehensive smoke test against Cloudflare Worker local preview (http://127.0.0.1:8787)
const BASE = 'http://127.0.0.1:8787';

const tests = [
  {
    name: 'GET / (Homepage)',
    url: `${BASE}/`,
    method: 'GET',
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
    method: 'GET',
    expectedStatus: 200,
    validate: (res, body) => {
      if (!body.toLowerCase().includes('bhopal')) {
        throw new Error('City page did not render Bhopal content');
      }
    },
  },
  {
    name: 'GET /category/cars (Category Landing Page)',
    url: `${BASE}/category/cars`,
    method: 'GET',
    expectedStatus: 200,
    validate: (res, body) => {
      if (!body.toLowerCase().includes('car') && !body.toLowerCase().includes('automotive')) {
        throw new Error('Category page did not render cars/automotive content');
      }
    },
  },
  {
    name: 'GET /deals/bhopal/3kw-rooftop-solar-bulk-installation (Representative Deal Page)',
    url: `${BASE}/deals/bhopal/3kw-rooftop-solar-bulk-installation`,
    method: 'GET',
    expectedStatus: 200,
    validate: (res, body) => {
      if (!body.includes('3 kW Rooftop Solar Complete Kit')) {
        throw new Error('Deal page did not render pool title');
      }
    },
  },
  {
    name: 'GET /api/cities (API Route)',
    url: `${BASE}/api/cities`,
    method: 'GET',
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
    method: 'GET',
    expectedStatus: 200,
    validate: (res, body) => {
      const json = JSON.parse(body);
      if (!json.success || !Array.isArray(json.data) || json.data.length === 0) {
        throw new Error('Categories API did not return success array');
      }
    },
  },
  {
    name: 'GET /api/locations (Locations API Route)',
    url: `${BASE}/api/locations`,
    method: 'GET',
    expectedStatus: 200,
    validate: (res, body) => {
      const json = JSON.parse(body);
      if (!json.success || !Array.isArray(json.data?.states) || json.data.states.length === 0) {
        throw new Error('Locations API did not return states array');
      }
    },
  },
  {
    name: 'POST /api/pool-requests (Invalid Input Error Handling)',
    url: `${BASE}/api/pool-requests`,
    method: 'POST',
    body: JSON.stringify({ productName: '' }),
    expectedStatus: 400,
    validate: (res, body) => {
      const json = JSON.parse(body);
      if (json.success !== false || !json.error) {
        throw new Error('Expected structured validation error for empty product request');
      }
    },
  },
  {
    name: 'POST /api/pools/33333333-3333-4333-8333-333333333333/join (Invalid Input Error Handling)',
    url: `${BASE}/api/pools/33333333-3333-4333-8333-333333333333/join`,
    method: 'POST',
    body: JSON.stringify({ name: 'T', phone: '123' }),
    expectedStatus: 400,
    validate: (res, body) => {
      const json = JSON.parse(body);
      if (json.success !== false || !json.error) {
        throw new Error('Expected structured validation error for invalid join input');
      }
    },
  },
  {
    name: 'POST /api/pools/33333333-3333-4333-8333-333333333333/waitlist (Invalid Input Error Handling)',
    url: `${BASE}/api/pools/33333333-3333-4333-8333-333333333333/waitlist`,
    method: 'POST',
    body: JSON.stringify({ buyerName: '', buyerPhone: 'invalid' }),
    expectedStatus: 400,
    validate: (res, body) => {
      const json = JSON.parse(body);
      if (json.success !== false || !json.error) {
        throw new Error('Expected structured validation error for invalid waitlist input');
      }
    },
  },
  {
    name: 'GET /sitemap.xml (Sitemap Route)',
    url: `${BASE}/sitemap.xml`,
    method: 'GET',
    expectedStatus: 200,
    validate: (res, body) => {
      if (!body.includes('<urlset') || !body.includes('/city/bhopal')) {
        throw new Error('Sitemap XML invalid or missing city routes');
      }
    },
  },
];

async function run() {
  console.log(`Starting Cloudflare Worker smoke test against ${BASE}...`);
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout to detect hangs

      const options = {
        method: t.method || 'GET',
        headers: t.body ? { 'Content-Type': 'application/json' } : {},
        body: t.body,
        signal: controller.signal,
      };

      const res = await fetch(t.url, options);
      clearTimeout(timeout);

      const elapsed = Date.now() - start;
      const body = await res.text();

      if (res.status !== t.expectedStatus) {
        throw new Error(`Expected HTTP ${t.expectedStatus}, got ${res.status}. Body: ${body.slice(0, 200)}`);
      }

      t.validate(res, body);
      console.log(`[PASS] ${t.name} -> HTTP ${res.status} (${elapsed}ms, ${body.length} bytes)`);
      passed++;
    } catch (err) {
      const elapsed = Date.now() - start;
      console.error(`[FAIL] ${t.name} (${elapsed}ms):`, err.message);
      failed++;
    }
  }

  console.log(`\nSmoke Test Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
