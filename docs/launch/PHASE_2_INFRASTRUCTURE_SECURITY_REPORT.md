# POOLBUY INDIA — PHASE 2 REPORT
## INFRASTRUCTURE, SUPABASE PERSISTENCE & SECURITY HARDENING

**Report Reference:** `docs/launch/PHASE_2_INFRASTRUCTURE_SECURITY_REPORT.md`  
**Execution Date:** 27 October 2026  
**Auditor / Engineer:** Principal Full-Stack Architect, Supabase Migration Reviewer & Security Engineer  
**Phase Status:** **PARTIAL / BLOCKED ON REMOTE CREDENTIALS** (Local Infrastructure, Git, Security Hardening & Build Verification **COMPLETE**; Remote Supabase Staging Migrations & Remote Persistence **BLOCKED** awaiting owner-provided credentials)  
**Project Root:** `C:\Users\iamvi\OneDrive\Documents\poolbuy-india`  
**Repository Remote:** `https://github.com/iamvimalsingh/poolbuy-india` (Private)  

---

## 1. EXECUTIVE SUMMARY & VERIFICATION GATE STATUS

In Phase 2, critical infrastructure and security foundations were implemented, hardened, and verified:
1. **Git & GitHub Version Control:** Successfully initialized on branch `main`, verified zero credential leakage via automated regex scan, created the authoritative baseline commit, and connected to private remote repository `https://github.com/iamvimalsingh/poolbuy-india`.
2. **Security Hardening & Fail-Closed Protection:** Enhanced `lib/data-mode.ts` to strictly fail-closed in production (`NODE_ENV === 'production'`) if Supabase configuration is missing, preventing silent fallback to mock data; hardened `lib/env.ts` with `CRON_SECRET` typing and server-side assertions.
3. **Automated Scheduler Configuration:** Authored `vercel.json` defining an hourly cron trigger for `/api/cron/pool-lifecycle` with Bearer token authentication.
4. **Documentation & Runbooks:** Updated `README.md` with the 3-tier environment architecture, `CRON_SECRET` instructions, and the 6-step sequential migration runbook.
5. **Quality Assurance:** Re-executed complete test and build suites (`npm run lint`, `npx tsc --noEmit`, `npm test` [36 unit tests passed], 111 scenario integration tests passed, and `npm run build` [42 routes compiled]).
6. **Remote Supabase Staging Status:** **NOT VERIFIED / BLOCKED**. Neither local Supabase CLI/Docker nor remote Supabase staging project credentials (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are available in the local environment. No remote mutations were performed; zero remote database rows were touched.

---

## 2. GIT & GITHUB STATE AND COMMIT RESULT

### 2.1 Local Git Initialization
- **Branch:** `main` (configured as default production branch).
- **Git Version:** `2.55.0.windows.5`.
- **Local User Configuration:**
  - `user.name`: `iamvimalsingh` (resolved from authenticated GitHub CLI profile).
  - `user.email`: `iamvimalsingh@users.noreply.github.com` (privacy-protected GitHub noreply identity).

### 2.2 Pre-Commit Secret Scanning & `.gitignore` Audit
Before staging any files, `.gitignore` was audited:
- `.env*` is explicitly ignored, while `!.env.example` is retained.
- Verified via `git check-ignore -v .env.local`: matched rule line 34 (`.gitignore:34:.env*`).
- Verified that `node_modules/`, `/.next/`, `/coverage`, and `*.tsbuildinfo` are strictly ignored.
- Performed an automated regex scan across all candidate files for JWT tokens (`eyJ...`), Supabase tokens (`sbp_...`), GitHub personal access tokens (`ghp_...`), and Stripe/payment secret keys (`sk_live_...`). Zero leaked tokens detected.

### 2.3 Baseline Commit & Remote Synchronization
- **Baseline Commit Hash:** `522c656`
- **Commit Message:** `chore(baseline): initialize repository and baseline Phase 1 V3 codebase`
- **Tracked Files:** 121 files, 33,493 insertions.
- **GitHub CLI Integration:**
  - Authenticated user: `iamvimalsingh` (keyring).
  - Created private repository: `gh repo create poolbuy-india --private --source=. --remote=origin`.
  - Privacy Setting: Confirmed `isPrivate: true` via GitHub GraphQL API.
  - Remote Origin URL: `https://github.com/iamvimalsingh/poolbuy-india.git`.
  - Pushed to remote: `git push -u origin main` (tracked branch `main -> main`).

---

## 3. ACTUAL MIGRATION INVENTORY, COUNT & RECONCILIATION

### 3.1 Reconciliation of V3 Blueprint vs Repository Migrations
The Phase 1 audit and Section 18.12 of `PoolBuy_India_MASTER_BLUEPRINT_V3.md` referenced earlier hypothetical migrations (`20261025000001_initial_schema.sql` and `20261025000002_rls_and_rpc.sql`). An inspection of the actual physical files in `supabase/` reconciles this discrepancy:

1. **Baseline Reference Schema (`supabase/schema.sql` - 19.9 KB):**
   - Consolidates the complete initial V1 PostgreSQL database definition.
   - Defines custom enums (`pool_category`, `pool_status`, `buying_timeline`, `pool_request_status`, `lead_status`).
   - Defines initial tables: `pools`, `pool_leads`, `pool_requests`.
   - Establishes RLS, grants to `anon`/`authenticated`/`service_role`, and baseline security view `public_pools`.
   - Defines triggers: `assign_pool_buyer_number()` and `set_updated_at()`.
   - Defines base atomic RPCs: `join_pool()` and `submit_pool_request()`.
   - Provides 6 initial illustrative demo pools (`ON CONFLICT (slug) DO NOTHING`).

2. **Sequential Additive Migrations (`supabase/migrations/`):**
   There are exactly **6 additive migration files** in `supabase/migrations/`, executing in strict chronological order:

| Step | Migration Filename | Scope / Purpose | Key Tables & Columns Added |
| :---: | :--- | :--- | :--- |
| **1** | `20261026000001_cities_and_multicity_pools.sql` | Phase B: Multi-city architecture | Creates `cities` table; adds `city_id` FK and `city_slug` index on `pools`; backfills city data; adds RLS. |
| **2** | `20261026000002_dynamic_categories_and_pool_requests.sql` | Phase C: Dynamic category management | Creates `categories` table; adds `category_id` FK on `pools`; creates demand discovery review workflow; expands `submit_pool_request` RPC. |
| **3** | `20261026000003_fixed_kits_and_price_tiers.sql` | Phase D: Fixed kits & price management | Creates `pool_kit_offers`, `vendor_price_tiers`, and `price_history` tables; expands `buying_timeline` enum (`THIS_MONTH`, `WITHIN_1_3_MONTHS`, `WITHIN_3_6_MONTHS`, `JUST_EXPLORING`); updates `join_pool` RPC to accept `p_selected_kit_offer_id`. |
| **4** | `20261026000004_location_directory_states_and_cities.sql` | Phase E: National location directory | Creates `states` table (28 States + 8 UTs); adds `state_code`, `place_type`, `is_selectable`, `availability_state` on `cities`. |
| **5** | `20261026000005_pool_lifecycle_and_expiry.sql` | Phase F: Pool lifecycle & automated expiry | Adds `check_pool_hard_delete_allowed()` trigger (blocks deletion when leads exist); creates `process_pool_expiry()` RPC; rebuilds `public_pools` view with archive/soft-delete filtering. |
| **6** | `20261026000006_blog_cms.sql` | Phase H: Blog CMS publishing | Creates `blog_posts` table; creates `public_blog_posts` view (`WHERE status = 'PUBLISHED'`); enables RLS. |

### 3.2 Authoritative Staging / Production Execution Order
To provision any fresh remote Supabase instance:
```
supabase/schema.sql ──► 000001 ──► 000002 ──► 000003 ──► 000004 ──► 000005 ──► 000006
(Baseline V1 Schema)    (Cities)   (Categories)(Fixed Kits)(Directory)(Lifecycle) (Blog CMS)
```

---

## 4. STAGING SUPABASE STATUS & APPLIED MIGRATIONS

### 4.1 Staging Environment Assessment
- **Local Supabase CLI:** `NOT INSTALLED` on host machine.
- **Local Docker Engine:** `NOT RUNNING / NOT INSTALLED` on host machine.
- **Staging Project Reference:** `NOT CONFIGURED` (No remote staging credentials exist in local environment files).
- **Migrations Applied to Staging:** **NONE (0 of 6 applied)** due to lack of remote credentials.
- **Remote Durability Verification:** **NOT VERIFIED**.
- **Remote Row-Level Security (RLS) Verification:** **NOT VERIFIED**.

> [!WARNING]
> **Honest Verification Disclosure:** In strict compliance with Section 3 of the Phase 2 prompt, live remote results have **NOT been fabricated**. Because external cloud credentials were not provided in `.env.local` or environment variables, remote database persistence and remote RLS remain explicitly **NOT VERIFIED**.

---

## 5. DATABASE SECURITY & LOCAL PERSISTENCE VERIFICATION

While remote Supabase access is blocked, the SQL migration definitions and local mock persistence layers were verified against the authoritative security rules:

### 5.1 RLS & Access Control Design (SQL Migrations)
1. **Public Safe View (`public_pools`):**
   - Explicit column whitelist excludes `dealer_name`, `token_payment_url`, `dealer_offer_url`, `dealer_terms`, and private margins.
   - Filtered by `is_archived = false AND deleted_at IS NULL`.
2. **Anonymous Read Restrictions:**
   - Direct `SELECT`, `INSERT`, `UPDATE`, `DELETE` grants are revoked from `anon` on `pool_leads` and `pool_requests`.
   - Buyer contact PII (WhatsApp numbers, names) cannot be queried anonymously.
3. **RPC Boundary Security:**
   - Public role gets `EXECUTE` grant strictly for `join_pool` and `submit_pool_request`.
   - Both RPCs execute with `SECURITY DEFINER` and explicitly reset `search_path = public, pg_temp`.
   - `join_pool` acquires an exclusive row lock (`SELECT ... FOR UPDATE`) on the pool record to prevent race conditions during concurrent buyer registrations.
4. **Hard Delete Prevention Trigger (`check_pool_hard_delete_allowed`):**
   - Installed `BEFORE DELETE` on `pools`.
   - Aborts with exception `CANNOT_HARD_DELETE_POOL_WITH_LEADS` if `COUNT(pool_leads) > 0`, ensuring commercial lead history can never be wiped out accidentally.
5. **Scheduler Isolation:**
   - `process_pool_expiry()` RPC is restricted to `service_role` and authenticated cron calls.

### 5.2 Application Data Mode & Fail-Closed Hardening
In this phase, `lib/data-mode.ts` and `lib/env.ts` were hardened:
```typescript
// lib/data-mode.ts
export function isDemoMode(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return true;
  }
  // Fail-closed in production: never silently default to mock data!
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  const hasSupabaseUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasSupabaseKey = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  return !hasSupabaseUrl || !hasSupabaseKey;
}
```
- **Local Development:** When Supabase keys are missing and `NODE_ENV !== 'production'`, safely falls back to local demo mode with visible amber disclaimer.
- **Production Mode:** If deployed to production without Supabase keys, `isDemoMode()` returns `false`, causing unconfigured database operations to fail-closed with HTTP 500 rather than silently rendering fake inventory or claiming leads were saved.

---

## 6. SECRETS & CREDENTIAL ROTATION AUDIT

### 6.1 Credential State & Length Audit
Audited safely without printing sensitive plaintext values:

| Secret Identifier | Length | Security Purpose | Rotation State |
| :--- | :---: | :--- | :---: |
| `ADMIN_PASSKEY` | 32 chars | Operator passkey for `/admin/login` | **ROTATED** (Cryptographic randomness) |
| `ADMIN_SESSION_SECRET` | 64 chars | HMAC-SHA256 cookie signing key | **ROTATED** (Cryptographic randomness) |
| `CRON_SECRET` | 48 chars | Bearer token for `/api/cron/pool-lifecycle` | **ROTATED** (Cryptographic randomness) |
| `SUPABASE_SERVICE_ROLE_KEY`| 0 chars | Server-only Supabase bypass key | **UNSET** (Pending owner setup) |

### 6.2 Session Invalidation Verification
- In `lib/admin-auth.ts`, session verification calculates `crypto.createHmac('sha256', secret).update(payloadString).digest('base64url')`.
- When `ADMIN_SESSION_SECRET` is rotated, all pre-existing cookies fail the `crypto.timingSafeEqual` signature check immediately.
- Verification test suite confirmed: requests with invalid or expired session tokens are rejected with HTTP 401.

---

## 7. ENVIRONMENT CONFIGURATION MATRIX

Target three-tier configuration matrix (values omitted for security):

| Variable Name | Client / Server | Local Development | Preview / Staging | Production |
| :--- | :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SITE_URL` | Public / Browser | `http://localhost:3000` | `https://<preview>.vercel.app` | `https://poolbuy.in` |
| `NEXT_PUBLIC_DEMO_MODE` | Public / Browser | `true` | `false` | `false` |
| `NEXT_PUBLIC_SUPABASE_URL` | Public / Browser | Blank (or local Supabase) | `https://<staging-id>.supabase.co` | `https://<prod-id>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public / Browser | Blank (or local anon key) | Staging Publishable Key | Production Publishable Key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-Only** | Blank (or local service key) | Staging Service Role Secret | Production Service Role Secret |
| `ADMIN_PASSKEY` | **Server-Only** | Local Passkey (32 chars) | Staging Passkey (Unique) | Production Passkey (Unique) |
| `ADMIN_SESSION_SECRET` | **Server-Only** | Local Secret (64 chars) | Staging HMAC Key (64 chars) | Production HMAC Key (64 chars) |
| `CRON_SECRET` | **Server-Only** | Local Token (48 chars) | Staging Cron Token (48 chars) | Production Cron Token (48 chars) |

---

## 8. AUTOMATED VALIDATION RESULTS

All non-destructive validation commands were executed after Phase 2 modifications:

```bash
# 1. ESLint Check
$ npm run lint
> poolbuy-india@0.1.0 lint
> eslint
Status: PASS (0 errors, 0 warnings)

# 2. TypeScript Compilation Check
$ npx tsc --noEmit
Status: PASS (0 type errors)

# 3. Native Unit Test Suite
$ npm test
> poolbuy-india@0.1.0 test
> tsx --test "lib/__tests__/**/*.test.ts"
Status: PASS (36 tests passed, 19 suites, 0 failed, 0 skipped, 502ms)

# 4. Integration Scenario Suites (against localhost:3000 with .env.local)
$ node --env-file=.env.local scratch/phase-d-verify.mjs  -> 23 passed, 0 failed
$ node --env-file=.env.local scratch/phase-e-verify.mjs  -> 23 passed, 0 failed
$ node --env-file=.env.local scratch/phase-f-verify.mjs  -> 25 passed, 0 failed
$ node --env-file=.env.local scratch/phase-gh-verify.mjs -> 40 passed, 0 failed
Status: PASS (111 scenario tests passed, 0 failed)

# 5. Production Next.js Build
$ npm run build
> poolbuy-india@0.1.0 build
> next build
▲ Next.js 16.4.3 (Turbopack)
✓ Compiled successfully in 1473ms
✓ Generating static pages (42/42) in 1761ms
Finalizing page optimization ...
Status: PASS (Exit code 0, 42 routes compiled cleanly)
```

---

## 9. REQUIRED OWNER DASHBOARD ACTIONS

Because automated cloud provisioning is intentionally restricted to protect owner accounts and billing, the project owner must execute the following actions in their Supabase and Vercel dashboards:

### 9.1 Supabase Dashboard (Staging & Production)
1. Open [Supabase Dashboard](https://supabase.com/dashboard) and create project `poolbuy-staging`.
2. Under **Project Settings > API**, copy:
   - Project URL
   - Publishable API Key (`anon`/`public`)
   - Service Role Secret (`service_role` / server secret)
3. Under **SQL Editor**, execute the migration sequence in order:
   - First: `supabase/schema.sql`
   - Second: `supabase/migrations/20261026000001_cities_and_multicity_pools.sql`
   - Third: `supabase/migrations/20261026000002_dynamic_categories_and_pool_requests.sql`
   - Fourth: `supabase/migrations/20261026000003_fixed_kits_and_price_tiers.sql`
   - Fifth: `supabase/migrations/20261026000004_location_directory_states_and_cities.sql`
   - Sixth: `supabase/migrations/20261026000005_pool_lifecycle_and_expiry.sql`
   - Seventh: `supabase/migrations/20261026000006_blog_cms.sql`
4. Repeat the above for `poolbuy-production` when preparing for Phase 5.

### 9.2 Vercel Dashboard (Preview & Production Linking)
1. Open [Vercel Dashboard](https://vercel.com) and import `https://github.com/iamvimalsingh/poolbuy-india`.
2. Framework Preset: **Next.js**.
3. Under **Settings > Environment Variables**, add:
   - `NEXT_PUBLIC_SITE_URL`
   - `NEXT_PUBLIC_DEMO_MODE` = `false`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSKEY`
   - `ADMIN_SESSION_SECRET`
   - `CRON_SECRET`
4. Enable Vercel Cron: Vercel will automatically read `vercel.json` and invoke `/api/cron/pool-lifecycle` every hour with `Authorization: Bearer <CRON_SECRET>`.

---

## 10. PRODUCTION CHANGES & PHASE 3 HANDOFF

- **Production Database Modifications:** **NONE (0 database mutations)**.
- **Production Deployments:** **NONE (No production deployment was triggered)**.
- **Application Source Changes in Phase 2:** Strictly limited to infrastructure, fail-closed handling in `lib/data-mode.ts`, environment validation in `lib/env.ts`, `vercel.json`, and runbook updates in `README.md`.
- **Remaining Launch Blockers for Phase 3:**
  1. Broken image placeholder in `pool-default.svg` and missing category-specific fallback illustrations for Solar, Battery, and Softener.
  2. Homepage city isolation bypass (`selectedCity = 'all'`).
  3. Closed pool leakage in public queries and hardcoded `"Active Pool"` SSR string in `countdown.tsx`.
  4. Outdated category priority on homepage chips.

**GATE STOP: Phase 2 is complete within authorized local boundaries. Awaiting owner instruction before proceeding to Phase 3 (Modern UI, Mobile Compatibility & Screenshot Fixes).**
