# CHATGPT_HANDOFF.md — GROUPBUYING.STORE REPOSITORY & RELEASE HANDOFF

**Last Updated:** 29 October 2026
**Execution Stage:** Step 1 of 4 Complete — New Admin Foundation, Category Management & City/Location Management
**Status:** **STEP 1 VERIFIED & COMPLETE — READY FOR STEP 2 (CAMPAIGNS & POOLS REBUILD)**
**Canonical File:** `CHATGPT_HANDOFF.md` (Repository Root)
**Active Git Branch:** `feat/category-agnostic-platform`
**Starting HEAD Commit:** `9f6143b6bb560bd364b8098a5c1f30d6c3d5eb07`
**Recovery Checkpoint Tag:** `checkpoint/step1-admin-start` (at `9f6143b6bb560bd364b8098a5c1f30d6c3d5eb07`)
**Production Live URL:** `https://groupbuying.store`
**Production Worker URL:** `https://poolbuy-india.iamvimalsingh.workers.dev`
**Staging Live URL:** `https://poolbuy-india-hotfix-test.iamvimalsingh.workers.dev`
**Primary Brand Identity:** GroupBuying (`https://groupbuying.store`), retaining secondary `PoolBuy India` badge
**Runtime Architecture:** Next.js 16.4.3 App Router on Cloudflare Workers via OpenNext (`@opennextjs/cloudflare`) backed by Cloudflare D1 SQLite

---

## 1. Executive Summary & Step 1 Implementation

In accordance with `docs/PRODUCT_CONTRACT.md` and the Step 1 rebuild specification, the admin system foundation, secure operator authentication, category lifecycle management, authoritative city/location management, and public request form integration have been completely designed, implemented, and verified.

### Key Milestones Achieved:

1. **Clean Recovery Checkpoint Created:**
   - Tagged starting point as `checkpoint/step1-admin-start` before any code changes.
   - Preserved all existing production/staging configuration, environment variables, credentials, and Git history.

2. **New Admin Foundation & Navigation Hierarchy:**
   - Redesigned `components/admin-dashboard.tsx` with high contrast, responsive desktop/mobile layout, and clear operational tabs:
     1. **Overview** (`AdminOverviewTab`): Real-time metrics for categories, locations, and pending location requests with quick-action links.
     2. **Categories** (`AdminCategoriesTab`): Complete database-backed CRUD.
     3. **Locations** (`AdminLocationsTab`): Complete database-backed CRUD for configured cities + User Location Requests moderation queue.
     4. **Campaigns & Pools** (`AdminCampaignsPlaceholder`): Clearly identified placeholder explaining upcoming Step 2 capabilities (never a dead or broken link).
     5. **Members & Requests**: Clearly disabled, marked *"Reserved for Step 3"*.
     6. **Quotes & Messages**: Clearly disabled, marked *"Reserved for Step 3"*.
     7. **Activity Log**: Clearly disabled, marked *"Reserved for Step 4"*.

3. **Secure Admin Authentication Retained & Hardened:**
   - Strict admin-only session model using timing-safe passkey verification (`crypto.timingSafeEqual`).
   - Tamper-proof HMAC SHA-256 signed session tokens with nonce generation and 7-day expiration.
   - CSRF origin checking (`validateCsrfOrigin`) on all privileged API mutations.
   - Server-side guard (`requireAdminSession` / `getAdminSession`) enforced on all admin endpoints.
   - Zero public password registration or customer account requirements.

4. **Category Management — Fully Functional CRUD:**
   - List categories with instant client search and status filter (`All`, `Active`, `Inactive`).
   - Create category with auto-generated slug, sort order, and active state.
   - View Category Details modal with live dependency analysis (counting referencing pools and public requests).
   - Edit category modal updating label, sort order, and lifecycle status.
   - Activate / Deactivate toggles.
   - **Safe Category Deletion:**
     - Verified deletion if dependencies count is 0.
     - Hard deletion blocked with HTTP 409 and actionable explanation if referenced by pools or requests, prompting the administrator to deactivate instead.

5. **City and Location Management — Fully Functional CRUD:**
   - List configured operational cities with state filter, status filter, and keyword search.
   - Create city with normalized duplicate prevention (blocking duplicate city names within the same state with HTTP 409 `DUPLICATE_CITY_IN_STATE` and duplicate slugs with `DUPLICATE_CITY_SLUG`).
   - View Location Details modal with live dependency breakdown across primary pools, multi-city pool mappings (`pool_cities`), and public requests.
   - Edit city modal updating name, state, slug, and active status.
   - Activate / Deactivate toggles.
   - **Safe Location Deletion:**
     - Allowed only when 0 dependent pools, pool city mappings, or requests exist.
     - Blocked with HTTP 409 and actionable feedback when historical data references the city.

6. **Public Form Integration & User-Requested Location Workflow:**
   - Dynamic Category Selector in `components/pool-request-form.tsx`: Automatically renders all active categories configured in the database.
   - Dynamic State & City Selectors: State dropdown filters operational cities to only active cities within that state.
   - User-entered unknown locations: Users can select `+ Other City / Request a Town` and specify their custom location name.
   - Additive D1 Migration `migrations/d1/0006_location_requests.sql`: Creates `location_requests` table to store unconfigured town suggestions without auto-approving them.
   - Server-Side Guard: Rejects submissions attempting to use deactivated or non-existent categories (`CATEGORY_INACTIVE`, `CATEGORY_NOT_FOUND`) or cities (`CITY_INACTIVE`).
   - Admin Approval Workflow: Administrators review user location requests in the Locations tab. Approving creates or activates the city duplicate-safely; rejecting marks the request `REJECTED`.

---

## 2. Verification & Automated Test Evidence

### Test Suite Execution Summary:
1. **Dedicated Step 1 Acceptance Suite (`lib/__tests__/step-1-admin-foundation.test.ts`):**
   - **20 / 20 PASS across 7 suites**
   - Criteria 1: Authentication & Access Control (Constant-time passkey, HMAC signatures, Token expiry, CSRF validation) &rarr; PASS
   - Criteria 2 & 8: Category CRUD & Duplicate Slug Prevention &rarr; PASS
   - Criteria 3 & 4: Safe Category Deletion & Dependency Blocking &rarr; PASS
   - Criteria 5, 6, 7 & 8: Location Management, Same-State Duplicate Prevention & Safe Deletion Blocking &rarr; PASS
   - Criteria 9, 10, 11 & 12: Public Form Integration, Inactive Entity Rejection & User Location Request Workflow &rarr; PASS
   - Criteria 13-17: Form Integrity, Error Handling & Secret Protection &rarr; PASS

2. **Full Regression Suite (`npm test`):**
   - **235 / 235 tests PASS across 76 suites** (0 failures, 0 skipped, duration: ~3.7s).

3. **TypeScript Typecheck (`npx tsc --noEmit`):**
   - Exit code: 0 (Zero type errors).

4. **ESLint (`npm run lint`):**
   - Exit code: 0 (Zero errors, zero warnings).

5. **Next.js Production Build (`npm run build`):**
   - Exit code: 0 (43 routes compiled successfully with zero errors).

6. **OpenNext Cloudflare Worker Build (`npm run build:worker`):**
   - Exit code: 0 (`Worker saved in .open-next\worker.js 🚀`).

---

## 3. Database Migrations Added

- **Migration File:** `migrations/d1/0006_location_requests.sql`
- **Schema Impact:** Additive only.
- **Table:** `location_requests`
  ```sql
  CREATE TABLE IF NOT EXISTS location_requests (
    id TEXT PRIMARY KEY,
    city_name TEXT NOT NULL,
    state_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    requested_by_phone TEXT,
    pool_request_id TEXT REFERENCES pool_requests(id),
    admin_notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    reviewed_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_location_requests_status ON location_requests(status, created_at);
  CREATE INDEX IF NOT EXISTS idx_location_requests_lookup ON location_requests(state_name, city_name);
  ```

---

## 4. Guidance for Next Engineer / Agent (Step 2 Scope)

### Active Working Context:
- **Branch:** `feat/category-agnostic-platform`
- **Baseline Checkpoint for Step 1:** Tag `checkpoint/step1-admin-start` (commit `9f6143b`)
- **Node.js Environment:** Windows / Node v24.20.0
- **Dev Servers:** `npm run dev` (local Next.js dev server), `npm test` (tsx test runner)

### Step 2 Scope (Campaigns & Pools Rebuild):
1. **Target Component:** Replace `components/admin-campaigns-placeholder.tsx` with a fully featured, requirement-driven `AdminCampaignsTab`.
2. **Core Capabilities Required:**
   - Multi-category campaign and pool lifecycle management (Draft, Active, Unlocked, Closed, Archived).
   - Shared multi-city pool mapping (`pool_cities`) management with truthful city isolation.
   - Pricing configuration (market price vs verified group price, dealer quotes, margin, pricing tier verification).
   - Capacity controls (target buyers, maximum waitlist cap, deadline extensions, auto-expiry).
   - Proposal-to-pool conversion workflow respecting user consent (`joinPoolConsent`).
   - Clean dependency inspection before pool archiving or deletion.
3. **DO NOT:**
   - Do NOT run destructive migrations or wipe remote databases.
   - Do NOT commit environment files (`.env.local`, `.dev.vars`).
   - Do NOT break existing verified routes and public UI components.
