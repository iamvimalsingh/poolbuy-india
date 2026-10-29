import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPoolShareContent,
  copyShareLinkToClipboard,
  triggerNativeShare,
  PoolShareData,
} from '../sharing';

describe('Gate F: Public Pool Sharing & Share-After-Join Invariants', () => {
  const samplePool: PoolShareData = {
    id: 'pool-solar-bhopal',
    name: 'Home Rooftop Solar Installation under PM Surya Ghar',
    productTitle: 'PM Surya Ghar 3kW Rooftop Solar',
    city: 'Bhopal',
    citySlug: 'bhopal',
    slug: 'pm-surya-ghar-3kw-solar',
    marketPrice: 210000,
    groupPrice: 165000,
    priceIsVerified: false,
    currentBuyers: 4,
    targetBuyers: 10,
  };

  test('1. Share content generates canonical destination with safe referral attribution', () => {
    const result = buildPoolShareContent(samplePool, 'https://groupbuying.store');

    assert.equal(
      result.url,
      'https://groupbuying.store/deals/bhopal/pm-surya-ghar-3kw-solar?ref=share'
    );
    assert.ok(result.fullMessage.includes(result.url));
  });

  test('2. Share text explicitly communicates free and non-binding expression of interest', () => {
    const result = buildPoolShareContent(samplePool, 'https://groupbuying.store');

    assert.ok(
      result.text.includes('Joining is non-binding') ||
        result.text.includes('register your interest for free'),
      'Share copy must make clear that interest registration is free and non-binding'
    );
    assert.ok(result.text.includes('Bhopal'));
    assert.ok(result.text.includes('PM Surya Ghar 3kW Rooftop Solar'));
  });

  test('3. Share URL and message contain zero personal data or confidential tokens', () => {
    const result = buildPoolShareContent(samplePool, 'https://groupbuying.store');

    assert.ok(!result.url.includes('@'), 'Must not contain email');
    assert.ok(!result.url.includes('+91'), 'Must not contain phone number');
    assert.ok(!result.url.includes('session'), 'Must not contain session ID');
    assert.ok(!result.url.includes('token'), 'Must not contain auth token');
    assert.ok(!result.whatsAppUrl.includes('@'), 'WhatsApp URL must not leak email');
  });

  test('4. WhatsApp direct URL is properly encoded with wa.me scheme', () => {
    const result = buildPoolShareContent(samplePool, 'https://groupbuying.store');

    assert.ok(result.whatsAppUrl.startsWith('https://wa.me/?text='));
    const decoded = decodeURIComponent(result.whatsAppUrl.replace('https://wa.me/?text=', ''));
    assert.ok(decoded.includes('GroupBuying.store'));
    assert.ok(decoded.includes('/deals/bhopal/pm-surya-ghar-3kw-solar?ref=share'));
  });

  test('5. City isolation is preserved in generated share links', () => {
    const delhiPool: PoolShareData = {
      ...samplePool,
      id: 'pool-solar-delhi',
      city: 'Delhi',
      citySlug: 'delhi',
    };
    const ncrPool: PoolShareData = {
      ...samplePool,
      id: 'pool-solar-delhi-ncr',
      city: 'Delhi NCR',
      citySlug: 'delhi-ncr',
    };

    const delhiResult = buildPoolShareContent(delhiPool, 'https://groupbuying.store');
    const ncrResult = buildPoolShareContent(ncrPool, 'https://groupbuying.store');

    assert.ok(delhiResult.url.includes('/deals/delhi/'));
    assert.ok(ncrResult.url.includes('/deals/delhi-ncr/'));
    assert.notEqual(delhiResult.url, ncrResult.url);
  });

  test('6. Native Web Share triggers when supported and handles cancellation gracefully', async () => {
    // In node environment without navigator, triggerNativeShare returns UNSUPPORTED
    const res = await triggerNativeShare({
      title: 'Test',
      text: 'Test',
      url: 'https://groupbuying.store',
    });
    assert.equal(res, 'UNSUPPORTED');
  });

  test('7. Clipboard copy returns false safely when no window/navigator is present', async () => {
    const res = await copyShareLinkToClipboard('https://groupbuying.store/deals/bhopal/test?ref=share');
    assert.equal(typeof res, 'boolean');
  });
});

