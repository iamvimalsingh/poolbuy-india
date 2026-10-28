import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

describe('Phase 7: Security Remediation & Legacy Cleanup Suite', () => {
  const rootDir = process.cwd();

  describe('1. Verification Scripts Fail-Closed Security Behavior', () => {
    test('scripts/e2e-verification.mjs fails closed with exit code 1 when ADMIN_PASSKEY is missing', () => {
      const scriptPath = path.resolve(rootDir, 'scripts/e2e-verification.mjs');
      assert.ok(fs.existsSync(scriptPath), 'e2e-verification.mjs must exist');

      // Execute with env stripped of ADMIN_PASSKEY
      const res = spawnSync(process.execPath, [scriptPath], {
        env: { ...process.env, ADMIN_PASSKEY: '' },
        encoding: 'utf8',
      });

      assert.equal(res.status, 1, 'Script must exit with code 1 when ADMIN_PASSKEY is empty');
      assert.ok(
        res.stderr.includes('ADMIN_PASSKEY is not set') || res.stderr.includes('[SECURITY ERROR]'),
        'Script must emit security error message on stderr'
      );
    });

    test('scratch/mvp-community-verify.mjs fails closed when ADMIN_PASSKEY is missing', () => {
      const scriptPath = path.resolve(rootDir, 'scratch/mvp-community-verify.mjs');
      if (fs.existsSync(scriptPath)) {
        const res = spawnSync(process.execPath, [scriptPath], {
          env: { ...process.env, ADMIN_PASSKEY: '' },
          encoding: 'utf8',
        });
        assert.equal(res.status, 1, 'Must exit with code 1 when ADMIN_PASSKEY is empty');
        assert.ok(res.stderr.includes('ADMIN_PASSKEY is not set'));
      }
    });

    test('scratch/phase-f-verify.mjs fails closed when CRON_SECRET or ADMIN_PASSKEY is missing', () => {
      const scriptPath = path.resolve(rootDir, 'scratch/phase-f-verify.mjs');
      if (fs.existsSync(scriptPath)) {
        const res = spawnSync(process.execPath, [scriptPath], {
          env: { ...process.env, ADMIN_PASSKEY: '', CRON_SECRET: '' },
          encoding: 'utf8',
        });
        assert.equal(res.status, 1, 'Must exit with code 1 when credentials are empty');
        assert.ok(res.stderr.includes('not set'));
      }
    });

    test('scratch/phase-gh-verify.mjs fails closed when ADMIN_PASSKEY is missing', () => {
      const scriptPath = path.resolve(rootDir, 'scratch/phase-gh-verify.mjs');
      if (fs.existsSync(scriptPath)) {
        const res = spawnSync(process.execPath, [scriptPath], {
          env: { ...process.env, ADMIN_PASSKEY: '' },
          encoding: 'utf8',
        });
        assert.equal(res.status, 1, 'Must exit with code 1 when ADMIN_PASSKEY is empty');
        assert.ok(res.stderr.includes('ADMIN_PASSKEY is not set'));
      }
    });

    test('scratch/verify-admin-manual-ops.mjs fails closed when ADMIN_PASSKEY is missing', () => {
      const scriptPath = path.resolve(rootDir, 'scratch/verify-admin-manual-ops.mjs');
      if (fs.existsSync(scriptPath)) {
        const res = spawnSync(process.execPath, [scriptPath], {
          env: { ...process.env, ADMIN_PASSKEY: '' },
          encoding: 'utf8',
        });
        assert.equal(res.status, 1, 'Must exit with code 1 when ADMIN_PASSKEY is empty');
        assert.ok(res.stderr.includes('ADMIN_PASSKEY is not set'));
      }
    });
  });

  describe('2. Absence of Hardcoded Fallback Credentials', () => {
    test('No known former passkey literals exist in scripts/ or scratch/', () => {
      const targets = [
        'scripts/e2e-verification.mjs',
        'scratch/mvp-community-verify.mjs',
        'scratch/phase-f-verify.mjs',
        'scratch/phase-gh-verify.mjs',
        'scratch/verify-admin-manual-ops.mjs',
      ];

      const forbiddenLiterals = [
        'velvet-cobalt',
        'AdminPasskey_2026',
        'PoolBuy@India2026',
        'PB_Z0Mfc8c3',
        'PoolBuyCronSecret2026',
      ];

      for (const target of targets) {
        const fullPath = path.resolve(rootDir, target);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          for (const literal of forbiddenLiterals) {
            assert.ok(
              !content.includes(literal),
              `File ${target} must not contain former credential literal: ${literal}`
            );
          }
        }
      }
    });
  });

  describe('3. Legacy Module & Dependency Cleanup Verification', () => {
    test('@supabase/supabase-js is completely removed from package.json', () => {
      const pkg = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'package.json'), 'utf8'));
      assert.equal(
        pkg.dependencies?.['@supabase/supabase-js'],
        undefined,
        '@supabase/supabase-js must not exist in dependencies'
      );
      assert.equal(
        pkg.devDependencies?.['@supabase/supabase-js'],
        undefined,
        '@supabase/supabase-js must not exist in devDependencies'
      );
    });

    test('cloudflare REST client is completely removed from package.json dependencies', () => {
      const pkg = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'package.json'), 'utf8'));
      assert.equal(
        pkg.dependencies?.['cloudflare'],
        undefined,
        'cloudflare package must not exist in dependencies'
      );
    });

    test('Obsolete legacy directories lib/supabase/ and supabase/ do not exist', () => {
      assert.equal(
        fs.existsSync(path.resolve(rootDir, 'lib/supabase')),
        false,
        'lib/supabase directory must be removed'
      );
      assert.equal(
        fs.existsSync(path.resolve(rootDir, 'supabase')),
        false,
        'supabase directory must be removed'
      );
    });

    test('Obsolete lib/products.ts does not exist', () => {
      assert.equal(
        fs.existsSync(path.resolve(rootDir, 'lib/products.ts')),
        false,
        'lib/products.ts must be removed'
      );
    });
  });

  describe('4. Server-Side Authentication Fail-Closed Invariants', () => {
    test('isAdminConfigured and verifyAdminPasskey fail closed when ADMIN_PASSKEY is missing', () => {
      const inlineScript = `
        const { isAdminConfigured, verifyAdminPasskey } = await import('./lib/admin-auth.ts');
        delete process.env.ADMIN_PASSKEY;
        if (isAdminConfigured() !== false) {
          console.error('FAIL: isAdminConfigured must be false when ADMIN_PASSKEY is deleted');
          process.exit(1);
        }
        if (verifyAdminPasskey('any-candidate') !== false) {
          console.error('FAIL: verifyAdminPasskey must return false when ADMIN_PASSKEY is deleted');
          process.exit(1);
        }
        console.log('AUTH_FAIL_CLOSED_PASS');
      `;

      const res = spawnSync(
        process.execPath,
        ['--import', 'tsx', '--conditions', 'react-server', '-e', inlineScript],
        {
          cwd: rootDir,
          encoding: 'utf8',
        }
      );

      assert.equal(res.status, 0, `Subprocess failed with status ${res.status}: ${res.stderr}`);
      assert.ok(res.stdout.includes('AUTH_FAIL_CLOSED_PASS'), 'Expected AUTH_FAIL_CLOSED_PASS');
    });
  });
});

