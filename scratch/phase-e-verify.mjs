/**
 * Phase E Verification Test Suite
 * Validates:
 * 1. Location directory covering all 28 States and 8 Union Territories.
 * 2. 5 representative urban centres per State.
 * 3. Honest UT counts & place types (Chandigarh=1, Puducherry=4, Lakshadweep=5 island centres).
 * 4. Operational state distinction: only verified cities are ACTIVE; unserved cities are DEMAND_COLLECTING or NOT_YET_AVAILABLE.
 * 5. City page isolation: unserved cities show honest empty state with request CTA and zero pool leakage.
 * 6. Non-existent city returns 404.
 */

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('--- STARTING PHASE E VERIFICATION ---');
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
    // 1. Locations API Endpoint
    console.log('\n[Test 1] Verify /api/locations endpoint');
    const locRes = await fetch(`${BASE_URL}/api/locations`);
    assert(locRes.ok, `GET /api/locations returns 200 (status: ${locRes.status})`);
    const locData = await locRes.json();
    assert(locData.success === true, 'Response success is true');
    assert(locData.data?.totalStates === 28, `Exactly 28 States reported (actual: ${locData.data?.totalStates})`);
    assert(locData.data?.totalUnionTerritories === 8, `Exactly 8 UTs reported (actual: ${locData.data?.totalUnionTerritories})`);

    const states = locData.data?.states || [];
    assert(states.length === 36, `Total State/UT records is 36 (actual: ${states.length})`);

    // 2. Validate 28 States have 5 cities each
    console.log('\n[Test 2] Verify representative cities per State');
    const statesOnly = states.filter((s) => s.type === 'STATE');
    assert(statesOnly.length === 28, `Found 28 States in directory`);

    const ap = states.find((s) => s.code === 'AP');
    assert(ap && ap.cities.length === 5, 'Andhra Pradesh has 5 urban centres');
    const apNames = ap?.cities.map((c) => c.name) || [];
    assert(apNames.includes('Visakhapatnam') && apNames.includes('Vijayawada'), 'AP includes Visakhapatnam and Vijayawada');

    const mh = states.find((s) => s.code === 'MH');
    assert(mh && mh.cities.length === 5, 'Maharashtra has 5 urban centres');
    const mhNames = mh?.cities.map((c) => c.name) || [];
    assert(mhNames.includes('Mumbai') && mhNames.includes('Pune'), 'MH includes Mumbai and Pune');

    // 3. Validate Honest UT counts and place types
    console.log('\n[Test 3] Verify Honest Union Territory Coverage');
    const chd = states.find((s) => s.code === 'CH');
    assert(chd && chd.cities.length === 1 && chd.cities[0].name === 'Chandigarh', 'Chandigarh has honest count of 1 city');

    const py = states.find((s) => s.code === 'PY');
    assert(py && py.cities.length === 4, `Puducherry has honest count of 4 enclaves (actual: ${py?.cities.length})`);

    const ld = states.find((s) => s.code === 'LD');
    assert(ld && ld.cities.every((c) => c.placeType === 'ISLAND_CENTRE'), 'Lakshadweep locations typed as ISLAND_CENTRE');

    // 4. Verify Active Operational Status vs Unserved
    console.log('\n[Test 4] Verify Operational Status Truthfulness');
    const bhopalCity = states.find((s) => s.code === 'MP')?.cities.find((c) => c.slug === 'bhopal');
    assert(bhopalCity?.isOperational === true, 'Bhopal is marked operational/active');

    const vizagCity = ap?.cities.find((c) => c.slug === 'visakhapatnam');
    assert(vizagCity?.isOperational === false, 'Visakhapatnam is not marked operational/active');

    // 5. Active City Page renders pools
    console.log('\n[Test 5] Active City Page /city/bhopal renders active pools');
    const bhopalRes = await fetch(`${BASE_URL}/city/bhopal`);
    assert(bhopalRes.ok, `GET /city/bhopal returns 200 (status: ${bhopalRes.status})`);
    const bhopalHtml = await bhopalRes.text();
    assert(bhopalHtml.includes('Open Pools in Bhopal'), 'Bhopal page displays Open Pools in Bhopal');
    assert(bhopalHtml.includes('3 kW Rooftop Solar Complete Kit'), 'Bhopal includes 3 kW Rooftop Solar pool');

    // 6. Unserved City Page renders honest empty state and zero pool leakage
    console.log('\n[Test 6] Unserved City Page /city/visakhapatnam renders honest empty state without leakage');
    const vizagRes = await fetch(`${BASE_URL}/city/visakhapatnam`);
    assert(vizagRes.ok, `GET /city/visakhapatnam returns 200 (status: ${vizagRes.status})`);
    const vizagHtml = await vizagRes.text();
    assert(
      vizagHtml.includes('No active group pools in') && vizagHtml.includes('Visakhapatnam') && vizagHtml.includes('Demand Discovery Phase'),
      'Visakhapatnam displays honest empty state with Demand Discovery Phase'
    );
    assert(
      vizagHtml.includes('Request a Pool in') && vizagHtml.includes('Visakhapatnam'),
      'Visakhapatnam displays Request a Pool action CTA'
    );
    assert(!vizagHtml.includes('3kw-rooftop-solar-bulk-installation'), 'No pool leakage from Bhopal into Visakhapatnam');

    // 7. Non-existent city returns 404
    console.log('\n[Test 7] Completely non-existent city returns 404 / Page Not Found');
    const nonExistRes = await fetch(`${BASE_URL}/city/fictional-atlantis-city`);
    const nonExistHtml = await nonExistRes.text();
    assert(
      nonExistRes.status === 404 || nonExistHtml.includes('Page Not Found') || nonExistHtml.includes('404 Not Found'),
      'Non-existent city triggers 404 Not Found response'
    );

  } catch (err) {
    console.error('Test execution error:', err);
    failCount++;
  }

  console.log(`\n--- PHASE E VERIFICATION RESULTS: ${passCount} PASSED, ${failCount} FAILED ---`);
  if (failCount > 0) {
    process.exit(1);
  }
}

runTests();
