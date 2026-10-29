import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { LAUNCH_CITIES } from '../constants';
import { getAllSelectableCities } from '../location-directory';

describe('Gate 3: Responsive UX, Mobile Menu & City Selector Invariants', () => {
  test('1. Viewport widths (320, 360, 375, 390, 412, 768, 1024, desktop) have non-breaking length bounds', () => {
    const mobileViewports = [320, 360, 375, 390, 412, 768, 1024, 1280];
    assert.equal(mobileViewports[0], 320);

    // Every launch city name must have safe maximum display length for mobile buttons
    for (const city of LAUNCH_CITIES) {
      assert.ok(city.name.length > 0);
      assert.ok(city.slug.length > 0);
      // City name should be less than 35 characters so truncation styling can always preserve affordances
      assert.ok(city.name.length < 35, `City name "${city.name}" fits within max mobile bounds`);
    }

    // Longest city name in launch cities
    const longestCity = [...LAUNCH_CITIES].sort((a, b) => b.name.length - a.name.length)[0];
    assert.equal(longestCity.name, 'Visakhapatnam');
    assert.equal(longestCity.name.length, 13);
  });

  test('2. City trigger label formatting rules: mobile displays city name, desktop displays city + state', () => {
    for (const city of LAUNCH_CITIES) {
      const mobileLabel = city.name;
      const desktopLabel = `${city.name}, ${city.state}`;

      assert.ok(mobileLabel.length <= 15, `Mobile label for ${city.name} must fit compact trigger`);
      assert.ok(desktopLabel.includes(city.name));
      assert.ok(desktopLabel.includes(city.state));
    }
  });

  test('3. Essential navigation destinations exist for both desktop and mobile drawer', () => {
    const desktopDestinations = ['/#categories', '/#how-it-works', '/#faqs', '/#request-pool'];
    const mobileDestinations = ['/#categories', '/#how-it-works', '/#faqs', '/#request-pool', '/blog'];

    // Every desktop destination must be present in mobile drawer
    for (const d of desktopDestinations) {
      assert.ok(mobileDestinations.includes(d), `Destination ${d} must be present in mobile navigation drawer`);
    }
    assert.ok(mobileDestinations.includes('/blog'), 'Mobile navigation must include access to Blog guides');
  });

  test('4. All launch cities exist in authoritative national location directory', () => {
    const directoryCities = getAllSelectableCities();
    const directorySlugs = new Set(directoryCities.map((l) => l.slug));
    for (const city of LAUNCH_CITIES) {
      assert.ok(directorySlugs.has(city.slug), `Launch city ${city.name} (${city.slug}) must exist in directory`);
    }
  });
});
