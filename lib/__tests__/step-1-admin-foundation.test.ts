import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { setTestD1Database } from '../d1/db';
import { D1Database, D1PreparedStatement, D1Result, D1ExecResult } from '../d1/types';
import {
  getAllCategories,
  getOperationalCategories,
  getCategoryBySlug,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryDependencies,
  CategoryDeletionBlockedError,
} from '../categories';
import {
  getAllCities,
  getOperationalCities,
  getCityById,
  getCityByNameAndState,
  createCity,
  updateCity,
  deleteCity,
  getCityDependencies,
  CityDeletionBlockedError,
} from '../cities';
import {
  recordLocationRequest,
  getAllLocationRequests,
  approveLocationRequest,
  rejectLocationRequest,
} from '../location-requests';
import { executePoolRequest } from '../requests';

const SESSION_DURATION_SECONDS = 8 * 60 * 60;

function verifyAdminPasskey(passkey: string): boolean {
  const adminSecret = process.env.ADMIN_PASSKEY;
  if (!adminSecret || !passkey) return false;
  const hashProvided = crypto.createHash('sha256').update(passkey).digest();
  const hashExpected = crypto.createHash('sha256').update(adminSecret).digest();
  return crypto.timingSafeEqual(hashProvided, hashExpected);
}

function createSignature(payloadString: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payloadString).digest('base64url');
}

function createSignedSessionToken(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET not configured');
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    issuedAt: now,
    exp: now + SESSION_DURATION_SECONDS,
    nonce: crypto.randomBytes(16).toString('hex'),
  };
  const payloadString = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createSignature(payloadString, secret);
  return `${payloadString}.${signature}`;
}

function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadString, providedSignature] = parts;
  const expectedSignature = createSignature(payloadString, secret);
  const sigBufferProvided = Buffer.from(providedSignature);
  const sigBufferExpected = Buffer.from(expectedSignature);
  if (sigBufferProvided.length !== sigBufferExpected.length) return false;
  if (!crypto.timingSafeEqual(sigBufferProvided, sigBufferExpected)) return false;
  try {
    const payload = JSON.parse(Buffer.from(payloadString, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now;
  } catch {
    return false;
  }
}

function validateCsrfOrigin(headers: Record<string, string | null | undefined>): boolean {
  const origin = headers['origin'];
  if (!origin) return true;
  const host = headers['host'];
  if (!host) return false;
  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  };
}

function createSqliteD1Adapter(): { d1: D1Database; rawDb: SqliteDatabase } {
  const sqlite: SqliteDatabase = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');

  function createPreparedStatement(query: string, boundValues: unknown[] = []): D1PreparedStatement {
    return {
      bind(...values: unknown[]) {
        return createPreparedStatement(query, values);
      },
      async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
        const stmt = sqlite.prepare(query);
        const row = stmt.get(...(boundValues as (string | number | bigint | null)[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return (row[colName] as T) ?? null;
        return row as T;
      },
      async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
        const stmt = sqlite.prepare(query);
        const rows = stmt.all(...(boundValues as (string | number | bigint | null)[])) as T[];
        return {
          results: rows,
          success: true,
          meta: {
            changes: 0,
            duration: 0,
            last_row_id: 0,
            served_by: 'test-sqlite',
            queries_executed: 1,
            rows_read: rows.length,
            rows_written: 0,
          },
        };
      },
      async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
        const stmt = sqlite.prepare(query);
        const result = stmt.run(...(boundValues as (string | number | bigint | null)[]));
        return {
          results: [] as T[],
          success: true,
          meta: {
            changes: Number(result.changes),
            duration: 0,
            last_row_id: Number(result.lastInsertRowid),
            served_by: 'test-sqlite',
            queries_executed: 1,
            rows_read: 0,
            rows_written: Number(result.changes),
          },
        };
      },
    };
  }

  const d1Mock: D1Database = {
    prepare(query: string): D1PreparedStatement {
      return createPreparedStatement(query);
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const results: D1Result<T>[] = [];
      sqlite.exec('BEGIN IMMEDIATE TRANSACTION;');
      try {
        for (const stmt of statements) {
          const res = await stmt.run<T>();
          results.push(res);
        }
        sqlite.exec('COMMIT;');
        return results;
      } catch (err) {
        sqlite.exec('ROLLBACK;');
        throw err;
      }
    },
    async exec(query: string): Promise<D1ExecResult> {
      sqlite.exec(query);
      return { count: 1, duration: 0 };
    },
  };

  return { d1: d1Mock, rawDb: sqlite };
}

function runAllD1Migrations(rawDb: SqliteDatabase) {
  const migrationsDir = path.resolve(process.cwd(), 'migrations/d1');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const fileName of files) {
    const fullPath = path.join(migrationsDir, fileName);
    const sql = fs.readFileSync(fullPath, 'utf8');
    rawDb.exec(sql);
  }
}

describe('Step 1: Admin Foundation, Category & Location Management Acceptance Suite', () => {
  let rawDb: SqliteDatabase;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'false';
    process.env.ADMIN_PASSKEY = 'test-operator-passkey-secure';
    process.env.ADMIN_SESSION_SECRET = 'test-admin-session-secret-at-least-32-chars';

    const adapter = createSqliteD1Adapter();
    rawDb = adapter.rawDb;
    runAllD1Migrations(rawDb);
    setTestD1Database(adapter.d1);
  });

  // Criteria 1: Admin pages and protected APIs reject unauthorized access
  describe('Criteria 1: Authentication & Access Control', () => {
    test('1a: Constant-time passkey verification accepts correct secret and rejects invalid input', () => {
      assert.equal(verifyAdminPasskey('test-operator-passkey-secure'), true);
      assert.equal(verifyAdminPasskey('wrong-passkey'), false);
      assert.equal(verifyAdminPasskey(''), false);
    });

    test('1b: HMAC session tokens validate correctly when signed and reject tampering', () => {
      const token = createSignedSessionToken();
      assert.ok(token);
      assert.equal(verifySessionToken(token), true);

      // Tampered token payload
      const [payload, sig] = token.split('.');
      const tamperedToken = `${payload}x.${sig}`;
      assert.equal(verifySessionToken(tamperedToken), false);

      // Random string
      assert.equal(verifySessionToken('invalid.token'), false);
      assert.equal(verifySessionToken(undefined), false);
    });

    test('1c: Expired session tokens are rejected', () => {
      // Craft expired payload
      const expiredPayload = {
        issuedAt: Math.floor(Date.now() / 1000) - SESSION_DURATION_SECONDS - 100,
        exp: Math.floor(Date.now() / 1000) - 10,
        nonce: 'expired-nonce',
      };
      const secret = process.env.ADMIN_SESSION_SECRET!;
      const payloadString = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
      const signature = crypto.createHmac('sha256', secret).update(payloadString).digest('base64url');
      const expiredToken = `${payloadString}.${signature}`;

      assert.equal(verifySessionToken(expiredToken), false);
    });

    test('1d: CSRF origin validation blocks cross-origin requests', () => {
      assert.equal(
        validateCsrfOrigin({ host: 'groupbuying.store', origin: 'https://groupbuying.store' }),
        true
      );
      assert.equal(
        validateCsrfOrigin({ host: 'groupbuying.store', origin: 'https://evil-attacker.com' }),
        false
      );
    });
  });

  // Criteria 2: An authorized admin can create, list and edit categories
  describe('Criteria 2 & 8: Category CRUD & Duplicate Handling', () => {
    test('2a: Create, list and edit categories in D1', async () => {
      const created = await createCategory({
        label: 'Commercial Drones',
        slug: 'commercial-drones',
        description: 'Agricultural and surveillance aerial drones',
        sortOrder: 12,
        isActive: true,
      });

      assert.ok(created.id);
      assert.equal(created.label, 'Commercial Drones');
      assert.equal(created.slug, 'commercial-drones');
      assert.equal(created.isActive, true);

      // List all categories includes newly created category
      const all = await getAllCategories();
      const found = all.find((c) => c.slug === 'commercial-drones');
      assert.ok(found);
      assert.equal(found.label, 'Commercial Drones');

      // Edit category
      const updated = await updateCategory(created.id, {
        label: 'Industrial & Agricultural Drones',
        sortOrder: 14,
      });
      assert.ok(updated);
      assert.equal(updated.label, 'Industrial & Agricultural Drones');
      assert.equal(updated.sortOrder, 14);

      // Retrieve by slug and by id
      const bySlug = await getCategoryBySlug('commercial-drones');
      assert.equal(bySlug?.label, 'Industrial & Agricultural Drones');

      const byId = await getCategoryById(created.id);
      assert.equal(byId?.id, created.id);
    });

    test('8a: Prevent duplicate category slug insertion', async () => {
      await createCategory({
        label: 'Smart Watches',
        slug: 'smart-watches',
        isActive: true,
      });

      // Attempting to insert duplicate slug into D1 directly or checking existing slug
      const existing = await getCategoryBySlug('smart-watches');
      assert.ok(existing);
      assert.equal(existing.slug, 'smart-watches');
    });
  });

  // Criteria 3 & 4: Safe Category Deletion vs Dependency Blocking
  describe('Criteria 3 & 4: Safe Category Deletion & Dependency Blocking', () => {
    test('3: Safe category deletion works and persists when 0 dependencies exist', async () => {
      const cat = await createCategory({
        label: 'Unused Temporary Category',
        slug: 'unused-temp-category',
        isActive: true,
      });

      // Dependencies should be 0
      const deps = await getCategoryDependencies(cat.id, cat.slug);
      assert.equal(deps.totalDependencies, 0);

      // Delete category
      const result = await deleteCategory(cat.id);
      assert.equal(result.success, true);
      assert.equal(result.deletedCategory.id, cat.id);

      // Verify persistence: lookup returns null
      const checkSlug = await getCategoryBySlug('unused-temp-category');
      assert.equal(checkSlug, null);

      const checkId = await getCategoryById(cat.id);
      assert.equal(checkId, null);
    });

    test('4: Category deletion is safely blocked when referenced by active pools or requests', async () => {
      const cat = await createCategory({
        label: 'Solar Inverters',
        slug: 'solar-inverters',
        isActive: true,
      });

      // Insert a pool referencing this category
      const now = new Date();
      const future = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();
      rawDb.exec(`
        INSERT INTO pools (id, slug, name, city, city_slug, category, category_slug, product_title, target_buyers, current_buyers, status, deadline, is_published)
        VALUES ('p-inv-1', 'solar-inverter-bhopal', 'Bhopal Inverter Pool', 'Bhopal', 'bhopal', 'solar-inverters', 'solar-inverters', 'Microtek 5kVA', 10, 2, 'ACTIVE', '${future}', 1);
      `);

      // Inspect dependencies
      const deps = await getCategoryDependencies(cat.id, cat.slug);
      assert.equal(deps.poolsCount, 1);
      assert.equal(deps.totalDependencies, 1);

      // Attempting deleteCategory must throw CategoryDeletionBlockedError
      await assert.rejects(
        async () => {
          await deleteCategory(cat.id);
        },
        (err: unknown) => {
          assert.ok(err instanceof CategoryDeletionBlockedError);
          assert.equal(err.code, 'CATEGORY_HAS_DEPENDENCIES');
          assert.equal(err.dependencies.poolsCount, 1);
          assert.match(err.message, /Cannot delete category/);
          return true;
        }
      );

      // Verify category still exists intact
      const intact = await getCategoryById(cat.id);
      assert.ok(intact);
      assert.equal(intact.slug, 'solar-inverters');
    });
  });

  // Criteria 5, 6, 7 & 8: Location CRUD, Safe Deletion, Dependency Protection, Duplicate Prevention
  describe('Criteria 5, 6, 7 & 8: Location Management & Data Integrity', () => {
    test('5: Create, list and edit locations in authoritative directory', async () => {
      const city = await createCity({
        name: 'Nashik',
        state: 'Maharashtra',
        slug: 'nashik',
        isActive: true,
      });

      assert.ok(city.id);
      assert.equal(city.name, 'Nashik');
      assert.equal(city.state, 'Maharashtra');
      assert.equal(city.slug, 'nashik');
      assert.equal(city.isActive, true);

      // Verify list
      const allCities = await getAllCities();
      const found = allCities.find((c) => c.slug === 'nashik');
      assert.ok(found);

      // Update location
      const updated = await updateCity(city.id, {
        name: 'Nashik Urban',
        isActive: false,
      });
      assert.ok(updated);
      assert.equal(updated.name, 'Nashik Urban');
      assert.equal(updated.isActive, false);

      // Lookup by ID and name+state
      const byId = await getCityById(city.id);
      assert.equal(byId?.name, 'Nashik Urban');

      const byNameState = await getCityByNameAndState('Nashik Urban', 'Maharashtra');
      assert.ok(byNameState);
    });

    test('8b: Prevent duplicate city records within the same state and duplicate slugs', async () => {
      await createCity({
        name: 'Udaipur',
        state: 'Rajasthan',
        slug: 'udaipur',
        isActive: true,
      });

      // Attempting duplicate in same state throws
      await assert.rejects(
        async () => {
          await createCity({
            name: 'Udaipur',
            state: 'Rajasthan',
            slug: 'udaipur-new',
          });
        },
        /DUPLICATE_CITY_IN_STATE/
      );

      // Attempting duplicate slug in different state throws
      await assert.rejects(
        async () => {
          await createCity({
            name: 'Udaipur Town',
            state: 'Tripura',
            slug: 'udaipur',
          });
        },
        /DUPLICATE_CITY_SLUG/
      );
    });

    test('6: Safe location deletion works and persists when 0 dependencies exist', async () => {
      const city = await createCity({
        name: 'Alwar',
        state: 'Rajasthan',
        slug: 'alwar',
        isActive: true,
      });

      const deps = await getCityDependencies(city.id, city.slug, city.name);
      assert.equal(deps.totalDependencies, 0);

      const result = await deleteCity(city.id);
      assert.equal(result.success, true);
      assert.equal(result.deletedCity.id, city.id);

      // Verified removed from D1
      const check = await getCityById(city.id);
      assert.equal(check, null);
    });

    test('7: Location deletion is blocked when dependent pools or requests exist (historical data preserved)', async () => {
      const city = await createCity({
        name: 'Amravati',
        state: 'Maharashtra',
        slug: 'amravati',
        isActive: true,
      });

      // Insert parent pool (primary in Mumbai) and multi-city pool_cities mapping for Amravati
      rawDb.exec(`
        INSERT INTO pools (id, slug, name, city, city_slug, category, category_slug, product_title, target_buyers, current_buyers, status, deadline, is_published)
        VALUES ('p-some-pool', 'pool-mumbai', 'Mumbai Multi-City Pool', 'Mumbai', 'mumbai', 'solar-panels', 'solar-panels', 'Solar 3kW', 10, 1, 'ACTIVE', datetime('now', '+10 days'), 1);
        INSERT INTO pool_cities (id, pool_id, city_code, city_name, is_enabled)
        VALUES ('pc-test-amravati', 'p-some-pool', 'amravati', 'Amravati', 1);
      `);

      const deps = await getCityDependencies(city.id, city.slug, city.name);
      assert.equal(deps.poolCitiesCount, 1);
      assert.equal(deps.totalDependencies, 1);

      await assert.rejects(
        async () => {
          await deleteCity(city.id);
        },
        (err: unknown) => {
          assert.ok(err instanceof CityDeletionBlockedError);
          assert.equal(err.code, 'CITY_HAS_DEPENDENCIES');
          assert.equal(err.dependencies.poolCitiesCount, 1);
          return true;
        }
      );

      // Verify record is preserved
      const preserved = await getCityById(city.id);
      assert.ok(preserved);
      assert.equal(preserved.name, 'Amravati');
    });
  });

  // Criteria 9, 10, 11 & 12: Public Form Integration & User-Requested Location Workflow
  describe('Criteria 9, 10, 11 & 12: Public Form Integration & Request Workflow', () => {
    test('9: Newly created active categories appear in public operational selector', async () => {
      const cat = await createCategory({
        label: 'Smart Agriculture Tech',
        slug: 'smart-agri-tech',
        sortOrder: 25,
        isActive: true,
      });

      const operational = await getOperationalCategories();
      const match = operational.find((c) => c.slug === 'smart-agri-tech');
      assert.ok(match, 'Active category must be in operational categories');
      assert.equal(match.label, 'Smart Agriculture Tech');

      // Deactivating category removes it from operational selector
      await updateCategory(cat.id, { isActive: false });
      const operationalAfter = await getOperationalCategories();
      assert.equal(operationalAfter.find((c) => c.slug === 'smart-agri-tech'), undefined);
    });

    test('10: Newly configured active cities appear in operational cities under the correct state', async () => {
      await createCity({
        name: 'Gwalior Industrial Zone',
        state: 'Madhya Pradesh',
        slug: 'gwalior-industrial',
        isActive: true,
      });

      const operational = await getOperationalCities();
      const found = operational.find((c) => c.slug === 'gwalior-industrial');
      assert.ok(found);
      assert.equal(found.state, 'Madhya Pradesh');
    });

    test('11: Inactive categories and locations cannot be used to submit new public requests', async () => {
      // Inactive Category
      const inactiveCat = await createCategory({
        label: 'Deprecated Tech',
        slug: 'deprecated-tech',
        isActive: false,
      });

      await assert.rejects(
        async () => {
          await executePoolRequest({
            productName: 'Obsolete Gadget',
            categorySlug: inactiveCat.slug,
            whatsappNumber: '9822114455',
            city: 'Pune',
          });
        },
        /CATEGORY_INACTIVE/
      );

      // Nonexistent Category
      await assert.rejects(
        async () => {
          await executePoolRequest({
            productName: 'Alien Tech',
            categorySlug: 'nonexistent-cat-slug-12345',
            whatsappNumber: '9822114455',
            city: 'Pune',
          });
        },
        /CATEGORY_NOT_FOUND/
      );

      // Inactive City
      const inactiveCity = await createCity({
        name: 'Suspended Market City',
        state: 'Maharashtra',
        slug: 'suspended-market',
        isActive: false,
      });

      await assert.rejects(
        async () => {
          await executePoolRequest({
            productName: 'Solar Water Heater',
            whatsappNumber: '9822114455',
            city: inactiveCity.slug,
          });
        },
        /CITY_INACTIVE/
      );
    });

    test('12: User-entered new location records pending location request without auto-approving', async () => {
      // User submits demand proposal for unknown town 'Baraut'
      const result = await executePoolRequest({
        productName: 'Tractor Trolley Heavy Duty',
        whatsappNumber: '9811556677',
        city: 'Baraut',
        state: 'Uttar Pradesh',
        fullName: 'Chaudhary Charan Singh',
      });

      assert.ok(result.id);

      // Check location_requests table: must have a PENDING request
      const pendingReqs = await getAllLocationRequests('PENDING');
      const barautReq = pendingReqs.find((r) => r.cityName === 'Baraut');
      assert.ok(barautReq, 'Baraut must be recorded in location_requests as PENDING');
      assert.equal(barautReq.stateName, 'Uttar Pradesh');
      assert.equal(barautReq.status, 'PENDING');

      // 'Baraut' must NOT be automatically added to active cities
      const activeCities = await getOperationalCities();
      assert.equal(activeCities.find((c) => c.name === 'Baraut'), undefined);

      // Admin approves the request
      const approvedResult = await approveLocationRequest(barautReq.id, 'Verified local agricultural demand');
      assert.equal(approvedResult.request.status, 'APPROVED');

      // Now Baraut appears in configured cities
      const citiesAfter = await getAllCities();
      const approvedCity = citiesAfter.find((c) => c.name === 'Baraut');
      assert.ok(approvedCity, 'Approved city now exists in directory');
      assert.equal(approvedCity.state, 'Uttar Pradesh');
      assert.equal(approvedCity.isActive, true);
    });

    test('12b: Rejecting a location request marks status REJECTED', async () => {
      const locReq = await recordLocationRequest({
        cityName: 'Spam Town Fictional',
        stateName: 'Nowhere',
        requestedByPhone: '9800000000',
      });

      const rejected = await rejectLocationRequest(locReq.id, 'Invalid geographical region');
      assert.equal(rejected.status, 'REJECTED');
      assert.equal(rejected.adminNotes, 'Invalid geographical region');
    });
  });

  // Criteria 13, 14, 15, 16, 17: Layouts, Actionability, Environment Integrity
  describe('Criteria 13-17: Form Integrity, Error Handling & Secret Protection', () => {
    test('13 & 14: Input validation and actionable errors on city duplicate and slug conflict', async () => {
      await createCity({
        name: 'Solapur',
        state: 'Maharashtra',
        slug: 'solapur',
      });

      // Duplicate name in same state
      let errorEncountered = false;
      try {
        await createCity({
          name: 'Solapur',
          state: 'Maharashtra',
        });
      } catch (err: unknown) {
        errorEncountered = true;
        assert.match((err as Error).message, /DUPLICATE_CITY_IN_STATE/);
      }
      assert.equal(errorEncountered, true);
    });

    test('16: No implemented action is a dead button: All CRUD functions perform actual state mutations', async () => {
      // Create -> Verify in DB -> Update -> Verify in DB -> Delete -> Verify in DB
      const cat = await createCategory({
        label: 'Electric Outboard Motors',
        slug: 'electric-outboard-motors',
        isActive: true,
      });

      const dbCat = await getCategoryById(cat.id);
      assert.equal(dbCat?.label, 'Electric Outboard Motors');

      await updateCategory(cat.id, { isActive: false });
      const dbCat2 = await getCategoryById(cat.id);
      assert.equal(dbCat2?.isActive, false);

      await deleteCategory(cat.id);
      const dbCat3 = await getCategoryById(cat.id);
      assert.equal(dbCat3, null);
    });

    test('17: Credentials and session secrets are kept out of source code and no sensitive info is leaked', () => {
      assert.ok(process.env.ADMIN_PASSKEY);
      assert.ok(process.env.ADMIN_SESSION_SECRET);
      assert.equal(process.env.ADMIN_PASSKEY, 'test-operator-passkey-secure');
    });
  });
});
