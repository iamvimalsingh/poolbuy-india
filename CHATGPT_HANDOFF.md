# CHATGPT_HANDOFF.md — GROUPBUYING.STORE REPOSITORY & RELEASE HANDOFF

**Last Updated:** 29 October 2026
**Execution Stage:** Step 2 of 4 Complete — Campaigns, Multi-City Pools, Lead Schema & Admin Integration
**Status:** **STEP 2 VERIFIED & COMPLETE — READY FOR STEP 3 (MEMBERS, REQUESTS & QUOTE OPS)**
**Canonical File:** `CHATGPT_HANDOFF.md` (Repository Root)
**Active Git Branch:** `feat/category-agnostic-platform`
**Starting HEAD Commit:** `337a1db` ("feat(admin): complete step 1 admin foundation, category and location management")
**Production Live URL:** `https://groupbuying.store`
**Production Worker URL:** `https://poolbuy-india.iamvimalsingh.workers.dev`
**Staging Live URL:** `https://poolbuy-india-hotfix-test.iamvimalsingh.workers.dev`
**Primary Brand Identity:** GroupBuying (`https://groupbuying.store`), retaining secondary `PoolBuy India` badge
**Runtime Architecture:** Next.js 16.4.3 App Router on Cloudflare Workers via OpenNext (`@opennextjs/cloudflare`) backed by Cloudflare D1 SQLite

---

## 1. Executive Summary & Step 2 Implementation

In accordance with `docs/PRODUCT_CONTRACT.md` and the Step 2 rebuild specification, the complete Campaign Management system, Multi-City Independent Pool architecture, Lead/Interest schema upgrade (`pincode` and `existing_quote`), Join Pool API validation, Admin Lead Management dashboard, and responsive mobile bottom sheet drawer have been designed, implemented, and verified.

### Key Milestones Achieved:

1. **One Campaign &rarr; Multiple Independent City Pools:**
   - Multi-city campaign creation workflow: An administrator creates 1 shared campaign/product record and selects $N$ operational cities in a single atomic/idempotent operation.
   - Generates $N$ distinct city-specific pools, each with its own stable ID, city slug, status, target capacity, current buyer count, waitlist, and lifecycle.
   - Strict capacity isolation: A join or request in one city never increments counts or impacts capacity in another city.
   - Shared edits update product specs without corrupting city-specific targets or closing dates.
   - City pool settings can be updated individually without altering other city cohorts.

2. **Campaign & Pool Admin Dashboard (`components/admin-campaigns-tab.tsx`):**
   - Sub-tab navigation: *Multi-City Campaigns* and *City Pools Dashboard*.
   - Multi-City Campaigns: Search by title/brand/model, category filter, status filter, Create Campaign modal with multi-city picker, View Campaign Details with attached city pools, Edit Campaign modal, Add City Pool modal, and safe archive/delete.
   - City Pools Dashboard: Filter by city, category, campaign, and pool status. Displays live authoritative metrics (target/capacity, active confirmed members, waitlist count, pending requests count, latest quote metadata, and timestamps).
   - Safe Deletion & Dependency Blocking: Hard deletion is allowed only when 0 dependent records (leads, waitlist, requests, quotes) exist. Blocked with HTTP 409 and actionable dependency breakdown otherwise, offering the archive/close path.

3. **Lead/Interest Schema Upgrade (`pincode` & `existing_quote`):**
   - Additive D1 Migration `0008_lead_pincode_and_existing_quote.sql`:
     - Added `pincode TEXT` and `existing_quote TEXT` to `pool_leads` and `pool_waitlist`.
     - Nullable storage for legacy rows ensures zero historical data corruption.
     - Automatically backfills `pincode` from legacy `pin_code` where present.
   - Strict Application-Level Validation for All New Submissions:
     - `pincode`: Stored as a string, preserving leading zeros (e.g., `"011001"`). Strictly validates `^[0-9]{6}$`. Rejects missing, malformed, 5-digit, 7-digit, non-numeric, or whitespace-containing inputs with HTTP 400.
     - `existing_quote`: Optional text/string field, trimmed, enforced to maximum 500 characters.

4. **Join Pool POST API Contract (`app/api/pools/[poolId]/join/route.ts`):**
   - Validates pool existence, publication, active status, and non-expired deadline.
   - Atomically claims active slot below target capacity; routes excess joins (11–15) to FIFO waitlist; rejects 16th with HTTP 409 `POOL_AND_WAITLIST_FULL`.
   - Full idempotent recovery: Duplicate submissions return existing `buyerNumber` without count increment.
   - Persists `pincode` and `existing_quote` in authoritative D1 storage.

   #### Complete Request Payload Contract:
   ```json
   POST /api/pools/{poolId}/join
   Content-Type: application/json

   {
     "fullName": "Vikram Sharma",
     "whatsappNumber": "9876543210",
     "city": "Bhopal",
     "pincode": "462001",
     "existing_quote": "₹1,45,000 including fast charger",
     "buyingTimeline": "THIS_MONTH",
     "hasExistingQuote": true,
     "extraMessage": "Need dual battery configuration",
     "connectionOptIn": true,
     "vendorShareConsent": true
   }
   ```

5. **Admin Lead Management (`components/admin-leads-tab.tsx`):**
   - Added dedicated **Pincode** column displaying 6-digit postal code or graceful legacy indicator (`Legacy (No Pincode)`).
   - Added **Existing Quote** column displaying customer-reported quote with clear *"Customer Reported (Unverified)"* indicator.
   - Added **Lead Details Modal** showing comprehensive buyer information, postal pincode, reported quotation, timeline, and an explicit disclaimer (*"Customer-reported quote. This is not a verified supplier quotation"*).
   - Search filter upgraded to search across full name, phone number, notes, pincode, and reported quote text.

6. **Responsive Mobile Bottom Sheet Drawer (`components/join-pool-modal.tsx`):**
   - On Desktop (`md` and above): Centered modal dialog with backdrop blur (`backdrop-blur-sm bg-black/40`).
   - On Mobile (below `md`): Responsive bottom sheet drawer sliding up smoothly from the bottom edge (`rounded-t-3xl`, `max-h-[85vh] overflow-y-auto`).
   - Visual swipe-indicator pill (`w-12 h-1.5 bg-gray-300 rounded-full mx-auto`) on mobile.
   - Integrated 6-digit Pincode input and optional Existing Quote input.

---

## 2. Verification & Automated Test Evidence

### Test Suite Execution Summary:
1. **Dedicated Step 2 Acceptance Suite (`lib/__tests__/step-2-campaign-pools.test.ts`):**
   - **18 / 18 PASS across 8 suites**
   - Criteria 1, 2 & 3: Multi-City Creation Behavior (1 campaign &rarr; 3 independent pools with capacity isolation) &rarr; PASS
   - Criteria 4, 5 & 6: Idempotency, Partial Recovery & Adding City Pools &rarr; PASS
   - Criteria 7 & 8: Edit Isolation (Shared specs update without corrupting city settings; single city edits isolate) &rarr; PASS
   - Criteria 9, 10, 11 & 12: Safe Deletion & Dependency Blocking (HTTP 409 on active leads, safe delete on 0 deps, archive preserves history) &rarr; PASS
   - Criteria 13, 14 & 15: Public Catalog & City Filtering &rarr; PASS
   - Criteria 18: Step 1 Foundation Stability &rarr; PASS
   - Criteria 14–25: Pincode & Quote Persistence, Leading Zero Preservation (`011001`), Legacy Null Row Support, Duplicate Protections &rarr; PASS

2. **Validation Unit Tests (`lib/__tests__/validation.test.ts`):**
   - **17 / 17 PASS across 5 suites**
   - 6-digit pincode validation, leading zero preservation, rejection of 5/7 digits, whitespace rejection, optional existing_quote, max 500 chars &rarr; PASS

3. **Frontend UAT Matrix (`lib/__tests__/step-2-frontend-uat-matrix.test.ts`):**
   - **7 / 7 PASS across 1 suite**

4. **Step 1 Admin Foundation Tests (`lib/__tests__/step-1-admin-foundation.test.ts`):**
   - **20 / 20 PASS across 7 suites**

5. **Full Regression Suite (`npm test`):**
   - **259 / 259 tests PASS across 84 suites** (0 failures, 0 skipped, duration: ~8.5s).

6. **TypeScript Typecheck (`npx tsc --noEmit`):**
   - Exit code: 0 (Zero type errors).

7. **ESLint (`npm run lint`):**
   - Exit code: 0 (Zero errors, zero warnings).

8. **Next.js Production Build (`npm run build`):**
   - Exit code: 0 (47 routes compiled and generated successfully).

9. **OpenNext Cloudflare Worker Build (`npm run build:worker`):**
   - Exit code: 0 (`Worker saved in .open-next\worker.js 🚀`).

---

## 3. Database Migrations Added in Step 2

### Migration 0007: Campaigns and City Pools
- **File:** `migrations/d1/0007_campaigns_and_city_pools.sql`
- **Schema Additions:**
  - `CREATE TABLE IF NOT EXISTS campaigns`
  - `ALTER TABLE pools ADD COLUMN campaign_id TEXT REFERENCES campaigns(id);`
  - Index `idx_pools_campaign_id ON pools(campaign_id);`

### Migration 0008: Lead Pincode and Existing Quote
- **File:** `migrations/d1/0008_lead_pincode_and_existing_quote.sql`
- **Schema Additions:**
  - `ALTER TABLE pool_leads ADD COLUMN existing_quote TEXT;`
  - `ALTER TABLE pool_leads ADD COLUMN pincode TEXT;`
  - `UPDATE pool_leads SET pincode = pin_code WHERE pincode IS NULL AND pin_code IS NOT NULL;`
  - `ALTER TABLE pool_waitlist ADD COLUMN existing_quote TEXT;`
  - `ALTER TABLE pool_waitlist ADD COLUMN pincode TEXT;`
  - `UPDATE pool_waitlist SET pincode = pin_code WHERE pincode IS NULL AND pin_code IS NOT NULL;`
  - Index `idx_pool_leads_pincode ON pool_leads(pincode);`

---

## 4. Guidance for Next Engineer / Agent (Step 3 Scope)

### Active Working Context:
- **Branch:** `feat/category-agnostic-platform`
- **Baseline Checkpoint for Step 2:** Commit `337a1db`
- **Node.js Environment:** Windows / Node v24.20.0
- **Build Commands:** `npm test` (259 tests), `npm run build`, `npm run build:worker`

### Step 3 Scope (Members, Requests & Quotation Operations):
1. **Target Admin Modules to Activate:**
   - **Members & Requests Tab**: Manage confirmed pool members, demand discovery proposals, user conversion workflows, and connection statuses (`NOT_READY`, `OPTED_IN`, `ELIGIBLE_TO_CONNECT`, `CONNECTED`, `EXCLUDED`).
   - **FIFO Waitlist Operations**: Promotion workflow when an active member drops out or capacity is increased.
   - **Quotes & Messages Tab**:
     - Verified supplier quotation recording with truthfulness requirements (valid until future date, scope of supply, itemized inclusions/exclusions).
     - Operational WhatsApp notification composer utilizing standard templates without customer login or password requirements.
2. **DO NOT:**
   - Do NOT run destructive migrations or wipe remote databases.
   - Do NOT commit environment files (`.env.local`, `.dev.vars`).
   - Do NOT treat customer-reported quote text as a verified supplier quote.
