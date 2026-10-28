/**
 * Phase G & Phase H Verification Script — PoolBuy India
 * Tests:
 * 1. National SEO architecture, canonical URLs, safe JSON-LD, and thin-city protection (Phase G)
 * 2. Dynamic Sitemap generation and robots.txt (Phase G)
 * 3. Protected Blog CMS API (listing, create, update, delete) (Phase H)
 * 4. Public /blog listing and /blog/[slug] reader with safe Markdown and Article JSON-LD (Phase H)
 * 5. Strict public exclusion of draft/archived blog posts (Phase H)
 * 6. RSS 2.0 XML feeds (/feed.xml and /blog/rss.xml) (Phase H)
 */

const BASE_URL = 'http://localhost:3000';
const ADMIN_PASSKEY = process.env.ADMIN_PASSKEY;

if (!ADMIN_PASSKEY) {
  console.error('[SECURITY ERROR] Required environment variable ADMIN_PASSKEY is not set. Failing closed.');
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
  console.log('--- STARTING PHASES G & H VERIFICATION ---\n');

  try {
    const adminToken = await loginAdmin();
    const adminHeaders = {
      'Content-Type': 'application/json',
      Cookie: `poolbuy-admin-session=${adminToken}`,
    };

    // ==========================================
    // PHASE G: SEO & SITEMAP ARCHITECTURE
    // ==========================================
    console.log('[Test 1] Verify Sitemap & Robots.txt Architecture');
    const sitemapRes = await fetch(`${BASE_URL}/sitemap.xml`);
    assert(sitemapRes.ok, `GET /sitemap.xml returns 200 (status: ${sitemapRes.status})`);
    const sitemapXml = await sitemapRes.text();
    assert(sitemapXml.includes('<loc>'), 'Sitemap contains <loc> entries');
    assert(sitemapXml.includes('/city/bhopal'), 'Sitemap includes active operational city Bhopal');
    assert(sitemapXml.includes('/deals/bhopal/3kw-rooftop-solar-bulk-installation'), 'Sitemap includes active solar deal');
    assert(sitemapXml.includes('/blog'), 'Sitemap includes /blog landing page');
    assert(sitemapXml.includes('/blog/pm-surya-ghar-muft-bijli-yojana-rooftop-solar-guide'), 'Sitemap includes published blog post');
    assert(!sitemapXml.includes('/city/visakhapatnam'), 'Sitemap strictly EXCLUDES unserved city Visakhapatnam (no thin city farm)');
    assert(!sitemapXml.includes('/draft-'), 'Sitemap strictly EXCLUDES draft blog posts');

    const robotsRes = await fetch(`${BASE_URL}/robots.txt`);
    assert(robotsRes.ok, `GET /robots.txt returns 200 (status: ${robotsRes.status})`);
    const robotsTxt = await robotsRes.text();
    assert(robotsTxt.includes('sitemap.xml'), 'Robots.txt references sitemap');

    console.log('\n[Test 2] Verify Safe Schema.org JSON-LD and Canonicals on Deals');
    const dealRes = await fetch(`${BASE_URL}/deals/bhopal/3kw-rooftop-solar-bulk-installation`);
    assert(dealRes.ok, `GET deal page returns 200 (status: ${dealRes.status})`);
    const dealHtml = await dealRes.text();
    assert(dealHtml.includes('canonical'), 'Deal page contains canonical link tag');
    assert(dealHtml.includes('application/ld+json'), 'Deal page embeds application/ld+json script');
    assert(dealHtml.includes('"@type":"Product"'), 'Deal JSON-LD contains Schema.org Product');

    // ==========================================
    // PHASE H: BLOG CMS & PUBLIC ARTICLES
    // ==========================================
    console.log('\n[Test 3] Verify Protected Blog CMS API');
    // 1. List posts
    const listRes = await fetch(`${BASE_URL}/api/admin/blog`, { headers: adminHeaders });
    assert(listRes.ok, `GET /api/admin/blog returns 200 (status: ${listRes.status})`);
    const listData = await listRes.json();
    assert(Array.isArray(listData.data), 'Blog posts list is an array');
    assert(listData.data.length >= 3, `Found ${listData.data.length} blog posts in CMS store`);

    // 2. Create a new test article
    const uniqueSlug = 'test-solar-maintenance-guide-' + Date.now();
    const createRes = await fetch(`${BASE_URL}/api/admin/blog`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'Residential Solar Panel Cleaning & Maintenance Best Practices',
        slug: uniqueSlug,
        topic: 'Solar Energy',
        author: 'PoolBuy Technical Team',
        excerpt: 'Standard operating procedures for cleaning rooftop solar panels in dusty Indian urban environments.',
        content: `# Solar Maintenance Guide\n\nRegular soft-water cleaning every 15 days ensures maximum generation.\n\n## Key Rules\n- Never use abrasive detergents\n- Clean early morning or late evening`,
        status: 'PUBLISHED',
        tags: ['Maintenance', 'Solar', 'Panels'],
      }),
    });
    assert(createRes.status === 201, `POST /api/admin/blog creates article (status: ${createRes.status})`);
    const createdData = await createRes.json();
    const createdId = createdData.data.id;
    assert(createdData.data.slug === uniqueSlug, 'Created article has expected slug');

    // 3. Update the article (change status to ARCHIVED)
    const updateRes = await fetch(`${BASE_URL}/api/admin/blog/${createdId}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({
        status: 'ARCHIVED',
      }),
    });
    assert(updateRes.ok, `PATCH /api/admin/blog/[id] archives article (status: ${updateRes.status})`);
    const updatedData = await updateRes.json();
    assert(updatedData.data.status === 'ARCHIVED', 'Article status updated to ARCHIVED');

    // 4. Delete the test article
    const deleteRes = await fetch(`${BASE_URL}/api/admin/blog/${createdId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    assert(deleteRes.ok, `DELETE /api/admin/blog/[id] deletes article (status: ${deleteRes.status})`);

    console.log('\n[Test 4] Verify Public /blog Directory');
    const blogIndexRes = await fetch(`${BASE_URL}/blog`);
    assert(blogIndexRes.ok, `GET /blog returns 200 (status: ${blogIndexRes.status})`);
    const blogIndexHtml = await blogIndexRes.text();
    assert(blogIndexHtml.includes('PM Surya Ghar Muft Bijli Yojana'), 'Blog index lists PM Surya Ghar guide');
    assert(blogIndexHtml.includes('Pure Sine Wave Inverter'), 'Blog index lists Inverter & Battery guide');
    assert(blogIndexHtml.includes('Whole-House Automatic Ion-Exchange Softener'), 'Blog index lists Water Softener guide');
    // Ensure draft is NOT displayed publicly
    assert(!blogIndexHtml.includes('2026-2027 EV Two-Wheeler Policy Outlook'), 'Draft post is NOT visible on public /blog index');

    console.log('\n[Test 5] Verify Public /blog/[slug] Reader & Safe Markdown');
    const postSlug = 'pm-surya-ghar-muft-bijli-yojana-rooftop-solar-guide';
    const postRes = await fetch(`${BASE_URL}/blog/${postSlug}`);
    assert(postRes.ok, `GET /blog/${postSlug} returns 200 (status: ${postRes.status})`);
    const postHtml = await postRes.text();
    assert(postHtml.includes('Central Subsidy Slabs Explained'), 'Rendered HTML contains section headings');
    assert(postHtml.includes('<table'), 'Rendered HTML contains formatted markdown table');
    assert(postHtml.includes('₹78,000'), 'Rendered table contains subsidy amounts');
    assert(postHtml.includes('"@type":"BlogPosting"'), 'Post embeds Schema.org BlogPosting structured data');
    assert(postHtml.includes('"@type":"BreadcrumbList"'), 'Post embeds Schema.org BreadcrumbList structured data');

    console.log('\n[Test 6] Verify Public Exclusion of Draft Article');
    const draftRes = await fetch(`${BASE_URL}/blog/draft-upcoming-ev-two-wheeler-subsidy-updates`);
    const draftHtml = await draftRes.text();
    assert(
      draftRes.status === 404 || draftHtml.includes('Page Not Found') || draftHtml.includes('404 Not Found'),
      'Public access to draft article returns 404 / Not Found'
    );

    console.log('\n[Test 7] Verify RSS 2.0 Feeds');
    const feedRes = await fetch(`${BASE_URL}/feed.xml`);
    assert(feedRes.ok, `GET /feed.xml returns 200 (status: ${feedRes.status})`);
    assert(
      feedRes.headers.get('content-type')?.includes('xml'),
      `Content-Type is XML (actual: ${feedRes.headers.get('content-type')})`
    );
    const feedXml = await feedRes.text();
    assert(feedXml.includes('<rss version="2.0"'), 'Feed contains valid RSS 2.0 root');
    assert(feedXml.includes('<title>PM Surya Ghar Muft Bijli Yojana'), 'Feed contains published solar guide');
    assert(!feedXml.includes('draft-upcoming-ev'), 'Feed excludes draft articles');

    const blogRssRes = await fetch(`${BASE_URL}/blog/rss.xml`);
    assert(blogRssRes.ok, `GET /blog/rss.xml returns 200 (status: ${blogRssRes.status})`);

  } catch (err) {
    console.error('Test execution error:', err);
    failCount++;
  }

  console.log(`\n--- PHASES G & H VERIFICATION RESULTS: ${passCount} PASSED, ${failCount} FAILED ---`);
  if (failCount > 0) {
    process.exit(1);
  }
}

runTests();
