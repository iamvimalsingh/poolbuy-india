import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

describe('Gate C: API Route Authorization & Contract Verification', () => {
  const rootDir = process.cwd();

  test('1. Unauthenticated request without admin session returns HTTP 401 or 503', () => {
    const inlineScript = `
      import { NextRequest } from 'next/server';
      import { requireAdminSession } from './lib/require-admin.ts';

      const req = new NextRequest('http://localhost:3000/api/admin/overview', {
        method: 'GET',
      });

      const res = await requireAdminSession(req);
      if (!res) {
        console.error('FAIL: res must not be null');
        process.exit(1);
      }
      if (res.status !== 401 && res.status !== 503) {
        console.error('FAIL: status must be 401 or 503, got ' + res.status);
        process.exit(1);
      }
      const body = await res.json();
      if (body.success !== false) {
        console.error('FAIL: body.success must be false');
        process.exit(1);
      }
      console.log('UNAUTH_GUARD_PASS');
    `;

    const res = spawnSync(
      process.execPath,
      ['--import', 'tsx', '--conditions', 'react-server', '-e', inlineScript],
      { cwd: rootDir, encoding: 'utf8' }
    );

    assert.equal(res.status, 0, `Subprocess failed: ${res.stderr}`);
    assert.ok(res.stdout.includes('UNAUTH_GUARD_PASS'), 'Expected UNAUTH_GUARD_PASS');
  });

  test('2. CSRF Origin validation allows matching Host or same-origin requests', () => {
    const inlineScript = `
      import { NextRequest } from 'next/server';
      import { validateCsrfOrigin } from './lib/require-admin.ts';

      const validReq = new NextRequest('http://localhost:3000/api/admin/campaigns', {
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          origin: 'http://localhost:3000',
        },
      });

      if (!validateCsrfOrigin(validReq)) {
        console.error('FAIL: validateCsrfOrigin must allow same-origin');
        process.exit(1);
      }
      console.log('CSRF_ALLOW_PASS');
    `;

    const res = spawnSync(
      process.execPath,
      ['--import', 'tsx', '--conditions', 'react-server', '-e', inlineScript],
      { cwd: rootDir, encoding: 'utf8' }
    );

    assert.equal(res.status, 0, `Subprocess failed: ${res.stderr}`);
    assert.ok(res.stdout.includes('CSRF_ALLOW_PASS'));
  });

  test('3. CSRF Origin validation blocks cross-origin requests strictly', () => {
    const inlineScript = `
      import { NextRequest } from 'next/server';
      import { validateCsrfOrigin } from './lib/require-admin.ts';

      const evilReq = new NextRequest('http://localhost:3000/api/admin/campaigns', {
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          origin: 'http://evil-attacker-site.com',
        },
      });

      if (validateCsrfOrigin(evilReq)) {
        console.error('FAIL: validateCsrfOrigin must block cross-origin');
        process.exit(1);
      }
      console.log('CSRF_BLOCK_PASS');
    `;

    const res = spawnSync(
      process.execPath,
      ['--import', 'tsx', '--conditions', 'react-server', '-e', inlineScript],
      { cwd: rootDir, encoding: 'utf8' }
    );

    assert.equal(res.status, 0, `Subprocess failed: ${res.stderr}`);
    assert.ok(res.stdout.includes('CSRF_BLOCK_PASS'));
  });

  test('4. CSRF enforcement in requireAdminSession returns HTTP 403 Forbidden', () => {
    const inlineScript = `
      import { NextRequest } from 'next/server';
      import { requireAdminSession } from './lib/require-admin.ts';

      process.env.ADMIN_PASSKEY = 'test_passkey';
      process.env.ADMIN_SESSION_SECRET = 'test_session_secret_32_characters_long!';

      const evilReq = new NextRequest('http://localhost:3000/api/admin/pools/pool-1', {
        method: 'PATCH',
        headers: {
          host: 'localhost:3000',
          origin: 'http://malicious-site.com',
        },
      });

      const res = await requireAdminSession(evilReq, { checkCsrf: true });
      if (!res || res.status !== 403) {
        console.error('FAIL: expected 403 Forbidden, got ' + res?.status);
        process.exit(1);
      }
      const body = await res.json();
      if (body.error?.code !== 'ADMIN_FORBIDDEN') {
        console.error('FAIL: expected ADMIN_FORBIDDEN code');
        process.exit(1);
      }
      console.log('CSRF_FORBIDDEN_PASS');
    `;

    const res = spawnSync(
      process.execPath,
      ['--import', 'tsx', '--conditions', 'react-server', '-e', inlineScript],
      { cwd: rootDir, encoding: 'utf8' }
    );

    assert.equal(res.status, 0, `Subprocess failed: ${res.stderr}`);
    assert.ok(res.stdout.includes('CSRF_FORBIDDEN_PASS'));
  });
});
