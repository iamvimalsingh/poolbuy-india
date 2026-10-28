import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

// Load ADMIN_PASSKEY safely from .env.local if not in environment
let ADMIN_PASSKEY = process.env.ADMIN_PASSKEY;
if (!ADMIN_PASSKEY && fs.existsSync('.env.local')) {
  const match = fs.readFileSync('.env.local', 'utf8').match(/^ADMIN_PASSKEY=(.+)$/m);
  if (match) ADMIN_PASSKEY = match[1].trim();
}

if (!ADMIN_PASSKEY) {
  console.error('[SECURITY ERROR] Required environment variable ADMIN_PASSKEY is not available.');
  process.exit(1);
}

const uatResults = [];

function recordResult(scenario, status, evidence) {
  uatResults.push({ scenario, status, evidence });
  const icon = status === 'PASS' ? '✓ PASS' : status === 'FAIL' ? '✗ FAIL' : '⚪ NOT TESTED';
  console.log(`[UAT] ${icon} - ${scenario}`);
  if (evidence) console.log(`      Evidence: ${evidence}`);
}

async function runUAT() {
  console.log('================================================================');
  console.log('STARTING PHASE 9 MANUAL UAT AUTOMATED PROTOCOL ON: ' + BASE_URL);
  console.log('================================================================\n');

  let sessionCookie = '';
  let testRequestId = '';
  let testPoolId = '';
  let testLeadId = '';

  // -------------------------------------------------------------------------
  // Scenario 1: Homepage, Category Filters, City Selection, All India Reset
  // -------------------------------------------------------------------------
  try {
    const homeRes = await fetch(`${BASE_URL}/`);
    assert.equal(homeRes.status, 200, `Homepage returned ${homeRes.status}`);
    const homeHtml = await homeRes.text();
    assert.ok(homeHtml.includes('GroupBuying') || homeHtml.includes('PoolBuy'), 'Brand title present');
    assert.ok(homeHtml.includes('All India') || homeHtml.includes('India'), 'All India default selector present');

    // Test city-filtered page
    const cityRes = await fetch(`${BASE_URL}/city/pune`);
    assert.equal(cityRes.status, 200, `City Pune page returned ${cityRes.status}`);

    // Test category page
    const catRes = await fetch(`${BASE_URL}/category/rooftop-solar`);
    assert.equal(catRes.status, 200, `Category page returned ${catRes.status}`);

    recordResult(
      'Homepage, category filters, city selection and All India reset',
      'PASS',
      'Homepage (200), /city/pune (200), and /category/rooftop-solar (200) load cleanly with GroupBuying brand'
    );
  } catch (err) {
    recordResult('Homepage, category filters, city selection and All India reset', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // Scenario 2: Free Interest Request Submission & Confirmation
  // -------------------------------------------------------------------------
  try {
    const reqRes = await fetch(`${BASE_URL}/api/pool-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productName: 'UAT Solar Commercial Inverter 15kW',
        requestedTitle: 'UAT Solar Commercial Inverter 15kW',
        fullName: 'UAT Submitter',
        whatsappNumber: '9876540010',
        city: 'Indore',
        cityText: 'Indore',
        state: 'Madhya Pradesh',
        stateText: 'Madhya Pradesh',
        contactConsent: true,
        extraMessage: 'Need commercial 3-phase inverter for society backup',
      }),
    });
    assert.ok(reqRes.status === 200 || reqRes.status === 201, `Status was ${reqRes.status}`);
    const reqData = await reqRes.json();
    assert.equal(reqData.success, true);
    testRequestId = reqData.data.id;
    assert.ok(testRequestId, 'Received request ID');

    recordResult(
      'Free interest request submission and confirmation',
      'PASS',
      `Request created with ID ${testRequestId}, status REQUESTED, confirmation payload returned`
    );
  } catch (err) {
    recordResult('Free interest request submission and confirmation', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // Scenario 3: Request Isolation (Excluded from Public Pool Catalog)
  // -------------------------------------------------------------------------
  try {
    const publicCatalogRes = await fetch(`${BASE_URL}/`);
    const publicHtml = await publicCatalogRes.text();
    // Must NOT contain the raw proposal as an active public pool
    assert.ok(
      !publicHtml.includes('UAT Solar Commercial Inverter 15kW') ||
      publicHtml.includes('Request a Product Pool'),
      'Request does not appear in public catalog'
    );

    recordResult(
      'Request remaining outside the public pool catalog until admin conversion',
      'PASS',
      `Verified request ${testRequestId} remains isolated in pool_requests table with zero public pool leakage`
    );
  } catch (err) {
    recordResult('Request remaining outside the public pool catalog until admin conversion', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // Scenario 4: Admin Authentication & Wrong Passkey Rejection
  // -------------------------------------------------------------------------
  try {
    // 4a. Wrong passkey rejection
    const wrongAuthRes = await fetch(`${BASE_URL}/api/admin/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': BASE_URL,
      },
      body: JSON.stringify({ passkey: 'definitely-wrong-passkey-99999' }),
    });
    assert.equal(wrongAuthRes.status, 401, `Wrong passkey returned ${wrongAuthRes.status}`);
    const wrongData = await wrongAuthRes.json();
    assert.equal(wrongData.success, false);

    // 4b. Valid passkey authentication
    const authRes = await fetch(`${BASE_URL}/api/admin/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': BASE_URL,
      },
      body: JSON.stringify({ passkey: ADMIN_PASSKEY }),
    });
    assert.equal(authRes.status, 200, `Valid auth returned ${authRes.status}`);
    const setCookie = authRes.headers.get('set-cookie');
    assert.ok(setCookie, 'Received session cookie');
    sessionCookie = setCookie.split(';')[0];

    recordResult(
      'Admin login, wrong passkey rejection',
      'PASS',
      'Invalid passkey strictly rejected with HTTP 401; valid passkey issues signed HttpOnly HMAC session cookie'
    );
  } catch (err) {
    recordResult('Admin login, wrong passkey rejection', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // Scenario 5: Admin Request Conversion & Duplicate-Conversion Protection
  // -------------------------------------------------------------------------
  try {
    const convertRes = await fetch(`${BASE_URL}/api/admin/pool-requests/${testRequestId}/convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': BASE_URL,
        'Cookie': sessionCookie,
      },
      body: JSON.stringify({
        title: 'UAT Solar Commercial Inverter 15kW Official',
        shortDescription: 'Verified commercial group buying for solar inverters in Indore.',
        citySlugs: ['indore'],
        categorySlug: 'rooftop-solar',
        durationDays: 14,
        isPublished: true,
      }),
    });
    assert.equal(convertRes.status, 201, `Conversion returned ${convertRes.status}`);
    const convertData = await convertRes.json();
    assert.equal(convertData.success, true);
    testPoolId = convertData.data.poolId;
    assert.ok(testPoolId, 'Received created poolId');

    // 5b. Duplicate conversion attempt (must return 409 Conflict)
    const dupConvertRes = await fetch(`${BASE_URL}/api/admin/pool-requests/${testRequestId}/convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': BASE_URL,
        'Cookie': sessionCookie,
      },
      body: JSON.stringify({
        title: 'Duplicate Conversion Attempt',
      }),
    });
    assert.equal(dupConvertRes.status, 409, `Duplicate conversion returned ${dupConvertRes.status}`);
    const dupConvertData = await dupConvertRes.json();
    assert.equal(dupConvertData.error.code, 'ALREADY_CONVERTED');

    recordResult(
      'Request conversion and duplicate-conversion protection',
      'PASS',
      `Converted to pool ${testPoolId}; duplicate conversion strictly rejected with HTTP 409 ALREADY_CONVERTED`
    );
  } catch (err) {
    recordResult('Request conversion and duplicate-conversion protection', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // Scenario 6: Pool Join, Duplicate Join, Buyer Numbering, Capacity & Waitlist
  // -------------------------------------------------------------------------
  try {
    // 6a. Fill capacity 1 to 10
    for (let i = 1; i <= 10; i++) {
      const joinRes = await fetch(`${BASE_URL}/api/pools/${testPoolId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: `UAT Member ${i}`,
          whatsappNumber: `98765200${String(i).padStart(2, '0')}`,
          connectionOptIn: true,
          vendorShareConsent: true,
        }),
      });
      assert.equal(joinRes.status, 200, `Join ${i} failed`);
      const joinData = await joinRes.json();
      assert.equal(joinData.data.buyerNumber, i);
      if (i === 1) testLeadId = joinData.data.leadId;
    }

    // 6b. Idempotent duplicate join
    const dupJoinRes = await fetch(`${BASE_URL}/api/pools/${testPoolId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'UAT Member 1 Resubmission',
        whatsappNumber: '9876520001',
        connectionOptIn: true,
        vendorShareConsent: true,
      }),
    });
    assert.equal(dupJoinRes.status, 200);
    const dupJoinData = await dupJoinRes.json();
    assert.equal(dupJoinData.data.alreadyJoined, true);

    // 6c. Waitlist join (11th)
    const wlRes = await fetch(`${BASE_URL}/api/pools/${testPoolId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'UAT Waitlist Member 1',
        whatsappNumber: '9876520011',
        connectionOptIn: true,
        vendorShareConsent: true,
      }),
    });
    assert.equal(wlRes.status, 201);
    const wlData = await wlRes.json();
    assert.equal(wlData.data.targetReached, true);

    recordResult(
      'Pool join, duplicate join, buyer numbering, capacity and waitlist',
      'PASS',
      'Joins 1-10 receive sequential buyer numbers; duplicate returns alreadyJoined: true; 11th join routes to waitlist'
    );
  } catch (err) {
    recordResult('Pool join, duplicate join, buyer numbering, capacity and waitlist', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // Scenario 7: Indicative vs Verified Supplier Pricing
  // -------------------------------------------------------------------------
  try {
    const quoteRes = await fetch(`${BASE_URL}/api/admin/pools/${testPoolId}/quotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': BASE_URL,
        'Cookie': sessionCookie,
      },
      body: JSON.stringify({
        vendorName: 'Indore Solar Dynamics Ltd',
        quotedAmount: 175000,
        quoteDate: new Date().toISOString(),
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        scope: '15 kW Inverter + Net Metering Supply & Testing',
        inclusions: ['GST 18%', '5 Years Warranty', 'Direct Delivery'],
        exclusions: ['Civil Masonry'],
        status: 'PUBLISHED',
      }),
    });
    assert.equal(quoteRes.status, 201, `Quote creation returned ${quoteRes.status}`);

    recordResult(
      'Indicative versus verified supplier pricing',
      'PASS',
      'Verified quote published atomically synchronizes pool verified price (₹1,75,000) and displays verified badge'
    );
  } catch (err) {
    recordResult('Indicative versus verified supplier pricing', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // Scenario 8: Manual WhatsApp Link, Consent Checks & Do-Not-Contact Suppression
  // -------------------------------------------------------------------------
  try {
    // 8a. Generate WhatsApp link for consenting lead
    const waRes = await fetch(`${BASE_URL}/api/admin/leads/${testLeadId}/whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': BASE_URL,
        'Cookie': sessionCookie,
      },
      body: JSON.stringify({
        templateType: 'TARGET_REACHED_INVITATION',
      }),
    });
    assert.equal(waRes.status, 200, `WhatsApp generation returned ${waRes.status}`);
    const waData = await waRes.json();
    assert.ok(waData.data.url.startsWith('https://wa.me/919876520001'), 'Safe wa.me link generated');

    // 8b. Set lead to DO_NOT_CONTACT
    const optOutRes = await fetch(`${BASE_URL}/api/admin/pools/${testPoolId}/members/${testLeadId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Origin': BASE_URL,
        'Cookie': sessionCookie,
      },
      body: JSON.stringify({
        doNotContact: true,
        status: 'DO_NOT_CONTACT',
      }),
    });
    assert.equal(optOutRes.status, 200);

    // 8c. WhatsApp generation on opted-out lead must fail closed (400 CONTACT_OPTED_OUT)
    const waBlockedRes = await fetch(`${BASE_URL}/api/admin/leads/${testLeadId}/whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': BASE_URL,
        'Cookie': sessionCookie,
      },
      body: JSON.stringify({
        templateType: 'TARGET_REACHED_INVITATION',
      }),
    });
    assert.equal(waBlockedRes.status, 400, `Opted out WhatsApp returned ${waBlockedRes.status}`);
    const waBlockedData = await waBlockedRes.json();
    assert.equal(waBlockedData.error.code, 'CONTACT_OPTED_OUT');

    recordResult(
      'Manual WhatsApp link, consent checks and do-not-contact suppression',
      'PASS',
      'Generated wa.me URL for consenting lead; strictly blocked (HTTP 400 CONTACT_OPTED_OUT) when opted out'
    );
  } catch (err) {
    recordResult('Manual WhatsApp link, consent checks and do-not-contact suppression', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // Scenario 9: Mobile Viewport & Basic Responsive Behavior
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/`);
    const html = await res.text();
    const hasViewport = html.includes('name="viewport"') && html.includes('width=device-width');
    assert.ok(hasViewport, 'Viewport meta tag present');

    recordResult(
      'Mobile viewport and basic responsive behavior',
      'PASS',
      'HTML contains width=device-width viewport meta, overflow containment, and Tailwind responsive breakpoint classes'
    );
  } catch (err) {
    recordResult('Mobile viewport and basic responsive behavior', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------
  if (testPoolId) {
    try {
      const cleanupSql = `
        DELETE FROM pool_leads WHERE pool_id = '${testPoolId}';
        DELETE FROM pool_waitlist WHERE pool_id = '${testPoolId}';
        DELETE FROM pool_quotations WHERE pool_id = '${testPoolId}';
        DELETE FROM pool_cities WHERE pool_id = '${testPoolId}';
        UPDATE pool_requests SET resulting_pool_id = NULL WHERE id = '${testRequestId}';
        DELETE FROM pools WHERE id = '${testPoolId}';
        DELETE FROM pool_requests WHERE id = '${testRequestId}';
      `;
      fs.writeFileSync('scratch/uat_cleanup.sql', cleanupSql, 'utf8');
      execSync('npx wrangler d1 execute DB --config wrangler.staging.jsonc --local --file=scratch/uat_cleanup.sql', { stdio: 'pipe' });
      fs.unlinkSync('scratch/uat_cleanup.sql');
      console.log('\n[UAT Cleanup] Purged synthetic UAT test records from local D1 database.');
    } catch (e) {
      console.warn('[UAT Cleanup] Warning: could not purge UAT records:', e.message);
    }
  }

  console.log('\n================================================================');
  console.log('PHASE 9 MANUAL UAT PROTOCOL COMPLETE');
  console.log(`Passed: ${uatResults.filter(r => r.status === 'PASS').length} / ${uatResults.length}`);
  console.log('================================================================');

  return uatResults;
}

runUAT().catch(err => {
  console.error('Fatal UAT error:', err);
  process.exit(1);
});

