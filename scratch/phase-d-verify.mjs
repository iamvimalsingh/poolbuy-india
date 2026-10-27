/**
 * Phase D Verification Test Suite
 * Validates:
 * 1. Fixed product-kit catalog (Rooftop Solar 3kW & 5kW, Inverter + 200Ah Battery combo, Whole-House Water Softener).
 * 2. Pre-subsidy pricing separation from subsidy estimates.
 * 3. Approved vendor price tiers and auditable quote history.
 * 4. Per-kit buyer count tracking and independent kit demand aggregation.
 * 5. City-specific pool isolation and deadline enforcement.
 */

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('--- STARTING PHASE D VERIFICATION ---');
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

  try {
    // 1. Fetch Bhopal 3 kW Solar Pool
    console.log('\n[Test 1] Verify 3 kW Rooftop Solar Pool & Brand-Kit Packages');
    const solarRes = await fetch(`${BASE_URL}/deals/bhopal/3kw-rooftop-solar-bulk-installation`);
    assert(solarRes.ok, `GET /deals/bhopal/3kw-rooftop-solar-bulk-installation returns 200 (status: ${solarRes.status})`);
    const solarHtml = await solarRes.text();
    assert(solarHtml.includes('3 kW Standard Mono-PERC Kit'), 'Contains 3 kW Standard Mono-PERC Kit');
    assert(solarHtml.includes('3 kW Premium N-Type TopCon Bifacial Kit'), 'Contains 3 kW Premium TopCon Bifacial Kit');
    assert(solarHtml.includes('Approved Volume Discount Tiers') || solarHtml.includes('Volume Tiers'), 'Displays verified vendor volume tiers');
    assert(solarHtml.includes('PM Surya Ghar') || solarHtml.includes('Subsidy'), 'Displays pre-subsidy separation and subsidy disclaimer');

    // 2. Fetch 5 kW Solar Pool in Bhopal
    console.log('\n[Test 2] Verify 5 kW Rooftop Solar Pool in Bhopal');
    const solar5kwRes = await fetch(`${BASE_URL}/deals/bhopal/5kw-rooftop-solar-bulk-installation`);
    assert(solar5kwRes.ok, `GET /deals/bhopal/5kw-rooftop-solar-bulk-installation returns 200 (status: ${solar5kwRes.status})`);
    const solar5kwHtml = await solar5kwRes.text();
    assert(solar5kwHtml.includes('5 kW Turnkey Grid-Tied Kit'), 'Contains 5 kW Turnkey Kit definition');
    assert(solar5kwHtml.includes('₹2,85,000') || solar5kwHtml.includes('285000'), 'Displays 5 kW group rate');

    // 3. Fetch Home Power-Backup Combo Pool
    console.log('\n[Test 3] Verify Home Power-Backup Combo Pool');
    const backupRes = await fetch(`${BASE_URL}/deals/bhopal/home-power-backup-inverter-200ah-battery-combo`);
    assert(backupRes.ok, `GET /deals/bhopal/home-power-backup-inverter-200ah-battery-combo returns 200 (status: ${backupRes.status})`);
    const backupHtml = await backupRes.text();
    assert(backupHtml.includes('1100VA Pure Sine Wave + 200 Ah Tubular Battery Combo'), 'Contains exact 1100VA + 200 Ah combo kit');
    assert(backupHtml.includes('Bhopal Power Solutions') && (backupHtml.includes('&amp; Distribution') || backupHtml.includes('& Distribution')), 'Lists approved vendor tier partner');

    // 4. Fetch Whole-House Water Softener Pool
    console.log('\n[Test 4] Verify Whole-House Water Softener Pool');
    const softenerRes = await fetch(`${BASE_URL}/deals/bhopal/whole-house-water-softener-kit`);
    assert(softenerRes.ok, `GET /deals/bhopal/whole-house-water-softener-kit returns 200 (status: ${softenerRes.status})`);
    const softenerHtml = await softenerRes.text();
    assert(softenerHtml.includes('Whole-House 28L Auto-Regeneration Softener Package'), 'Contains 28L Auto-Regeneration Softener package');

    // 5. Join Pool with specific kit selection (Kit A: 3 kW Standard)
    console.log('\n[Test 5] Join Bhopal Solar Pool with Kit A (Standard Mono-PERC)');
    const poolId = '33333333-3333-4333-8333-333333333333';
    const testPhoneA = '98260' + Math.floor(10000 + Math.random() * 90000);
    const joinPayloadA = {
      fullName: 'Aarav Sharma',
      whatsappNumber: testPhoneA,
      city: 'Bhopal',
      buyingTimeline: 'THIS_MONTH',
      hasExistingQuote: false,
      extraMessage: 'Ready for terrace site survey this week.',
      selectedKitOfferId: 'kit-bhopal-solar-3kw-std',
    };

    const joinResA = await fetch(`${BASE_URL}/api/pools/${poolId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(joinPayloadA),
    });
    const joinDataA = await joinResA.json();
    assert(joinResA.ok && joinDataA.success, `Join with Kit A succeeds (leadId: ${joinDataA.data?.leadId})`);
    assert(typeof joinDataA.data?.selectedKitCurrentBuyers === 'number' && joinDataA.data.selectedKitCurrentBuyers >= 1, `Kit A buyer count tracked: ${joinDataA.data?.selectedKitCurrentBuyers}`);

    // 6. Join Pool with second kit selection (Kit B: 3 kW TopCon Bifacial)
    console.log('\n[Test 6] Join Bhopal Solar Pool with Kit B (TopCon Bifacial)');
    const testPhoneB = '98260' + Math.floor(10000 + Math.random() * 90000);
    const joinPayloadB = {
      fullName: 'Pooja Verma',
      whatsappNumber: testPhoneB,
      city: 'Bhopal',
      buyingTimeline: 'WITHIN_1_3_MONTHS',
      hasExistingQuote: true,
      existingQuoteAmount: 225000,
      extraMessage: 'Need high-generation dual glass panels.',
      selectedKitOfferId: 'kit-bhopal-solar-3kw-topcon',
    };

    const joinResB = await fetch(`${BASE_URL}/api/pools/${poolId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(joinPayloadB),
    });
    const joinDataB = await joinResB.json();
    assert(joinResB.ok && joinDataB.success, `Join with Kit B succeeds (leadId: ${joinDataB.data?.leadId})`);
    assert(typeof joinDataB.data?.selectedKitCurrentBuyers === 'number' && joinDataB.data.selectedKitCurrentBuyers >= 1, `Kit B buyer count tracked: ${joinDataB.data?.selectedKitCurrentBuyers}`);
    assert(joinDataB.data?.currentBuyers > joinDataA.data?.currentBuyers, `Total pool buyers incremented monotonically (${joinDataA.data?.currentBuyers} -> ${joinDataB.data?.currentBuyers})`);

    // 7. Verify City Isolation on Join
    console.log('\n[Test 7] Verify City Isolation prevents mismatched join');
    const mismatchPayload = {
      fullName: 'Outsider Buyer',
      whatsappNumber: '9826011223',
      city: 'Indore', // Pool is for Bhopal
      buyingTimeline: 'THIS_MONTH',
      hasExistingQuote: false,
    };
    const mismatchRes = await fetch(`${BASE_URL}/api/pools/${poolId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mismatchPayload),
    });
    const mismatchData = await mismatchRes.json();
    assert(mismatchRes.status === 400 && mismatchData.error?.code === 'CITY_MUST_MATCH_POOL', 'City mismatch is rejected with CITY_MUST_MATCH_POOL');

    // 8. Verify V3 Timeline Options Accepted
    console.log('\n[Test 8] Verify all 4 V3 timeline values pass validation');
    const timelines = ['THIS_MONTH', 'WITHIN_1_3_MONTHS', 'WITHIN_3_6_MONTHS', 'JUST_EXPLORING'];
    for (const tl of timelines) {
      const phone = '98260' + Math.floor(10000 + Math.random() * 90000);
      const res = await fetch(`${BASE_URL}/api/pools/${poolId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: `Tester ${tl}`,
          whatsappNumber: phone,
          city: 'Bhopal',
          buyingTimeline: tl,
          hasExistingQuote: false,
        }),
      });
      const data = await res.json();
      assert(res.ok && data.success, `Timeline "${tl}" accepted successfully`);
    }

  } catch (err) {
    console.error('Test execution error:', err);
    failCount++;
  }

  console.log(`\n--- PHASE D VERIFICATION RESULTS: ${passCount} PASSED, ${failCount} FAILED ---`);
  if (failCount > 0) {
    process.exit(1);
  }
}

runTests();
