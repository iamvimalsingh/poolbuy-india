# CHATGPT_HANDOFF.md — GROUPBUYING.STORE REPOSITORY & RELEASE HANDOFF

**Last Updated:** 29 October 2026  
**Execution Stage:** City-First, Multi-Category Homepage Redesign Released & Verified on Live Production  
**Status:** **LIVE PRODUCTION RELEASE VERIFIED & OPERATIONAL (317/317 TESTS PASS — STAGING & PRODUCTION SMOKE PASSED)**  
**Canonical File:** `CHATGPT_HANDOFF.md` (Repository Root)  
**Active Git Branch:** `feat/category-agnostic-platform`  
**Latest Commit on Remote:** `b6aa7d2` ("feat(homepage): city-first, multi-category homepage redesign and waitlist capacity invariant")  
**Configured Remote:** `origin` (`https://github.com/iamvimalsingh/poolbuy-india.git`)  
**Recovery Checkpoints:**
- Git Branch: `checkpoint/gate-0-baseline` (`60d91bc`)
- Git Tag: `checkpoint-gate-1-reconciliation` (`0844e76`)  
**Production Live URL:** `https://groupbuying.store`  
**Production Worker Target:** `poolbuy-india`  
**Production Deployment Version ID:** `580e8016-6faf-41b3-b7c9-a08d4a0788c1`  
**Production D1 Database:** `groupbuying-prod` (`a9cd4321-e07b-4244-8a9d-a610e38a9957`)  
**Staging Live URL:** `https://poolbuy-india-hotfix-test.iamvimalsingh.workers.dev`  
**Staging Worker Target:** `poolbuy-india-hotfix-test`  
**Staging Deployment Version ID:** `7cdb9b02-26e7-4fee-a565-4d3701ebe3e3`  
**Staging D1 Database:** `groupbuying-staging` (`daa09ed6-b75d-4c16-89f7-156d69cec7e5`)  
**Primary Brand Identity:** GroupBuying (`https://groupbuying.store`), retaining secondary `PoolBuy India` badge  
**Runtime Architecture:** Next.js 16.4.3 App Router on Cloudflare Workers via OpenNext (`@opennextjs/cloudflare` 1.20.13) backed by Cloudflare D1 SQLite  

---

## 1. Executive Summary: Production Release Overview

The approved City-First, Multi-Category Homepage Redesign has been pushed to GitHub (`feat/category-agnostic-platform` @ `b6aa7d2`), verified through all local gates (317 tests, TypeScript strict, ESLint, Next.js build, OpenNext Cloudflare worker build), deployed and verified on staging (`poolbuy-india-hotfix-test`), and deployed and verified on live production (`poolbuy-india` on `https://groupbuying.store`).

### Summary of Live Changes:
1. **Default Homepage (No City Selected):**
   - **Elimination of Repetitive Grid:** Removed the nationwide 28 repeated city-specific solar card grid from the default landing view (`selectedCity === null`).
   - **Header:** GroupBuying.store brand with primary location control labelled **"Choose City"**, navigation for "Categories", "How It Works", "FAQs", "Start a Pool", and an accessible mobile navigation drawer.
   - **Platform Hero:** Concise, accessible value proposition: *"Bring local buyers together. Unlock better buying opportunities."* Supported by: *"Tell us what you want to buy. We bring together demand from people in your city and work towards better supplier offers."* Primary CTA: *"Choose Your City"*. Transparent disclaimers that interest is free, non-binding, and offers are not guaranteed.
   - **Category Discovery:** Data-driven rendering from `getOperationalCategories()` featuring broad *"Home Rooftop Solar Installation under PM Surya Ghar"* as the launch category without kW/brand fragmentation, while supporting additional dynamic categories.
   - **How It Works:** 4-step transparent journey: (1) Choose a city, (2) Explore category & express interest, (3) Demand aggregated, (4) Supplier quotations sought/reviewed with independent customer decisions.
   - **Trust & Transparency:** Dedicated section clarifying 100% free interest, indicative estimates vs. verified quotes, DPDP compliance, and official PM Surya Ghar scheme distinction (GroupBuying.store is not the government subsidy portal; CFA eligibility follows official guidelines).
   - **Comprehensive FAQs:** 7 transparent Q&As addressing how group buying works, zero costs, non-binding intent, price setting, unserved cities, contact consent, and supported updates.
   - **Footer:** Verified links to How It Works, Categories, FAQs, Start a Pool, Blog, PM Surya Ghar Portal (`pmsuryaghar.gov.in`), and DPDP norms.

2. **City Selection (`LocationSelector`):**
   - Replaced "All India (Default)" trigger with "Choose City".
   - Searchable directory clearly distinguishing configured 25 launch markets from broader directory locations.
   - "Use device location" permission requested strictly upon explicit click with graceful error fallbacks.
   - When a city is selected, header updates to `[City Name], [State]` with a prominent "Change" affordance.

3. **City-Selected Homepage:**
   - City-specific hero: *"Buying groups in [City]"* + *"Explore products and services with collective local demand."*
   - City-isolated pool filtering: strictly pools where `pool.citySlug === selectedCity`.
   - Approved Empty State for categories/cities without active pools:
     - *"No active buying group yet"*
     - *"There isn't an active group for this category in your city right now. You can submit a demand proposal for our team to review."*
     - Direct CTA: *"Start a Pool for [City]"* routing to demand proposal review flow (`PoolRequestForm`).

4. **Pool Card Design & Waitlist Capacity:**
   - Compact, truthful design with broad product title, city badge, confirmed members progress bar, and genuine status.
   - **FIFO Waitlist Row Elimination:** Confusing "FIFO Waitlist 0/50" row removed from ordinary cards; shown ONLY when confirmed capacity is full (`currentBuyers >= targetBuyers`) AND waitlist is permitted.
   - **Approved Waitlist Capacity Rule:** Enforced server-side and in UI: `maximum waitlist capacity = ceil(pool target / 2)` (e.g. Target 10 &rarr; Max Waitlist 5; Target 20 &rarr; Max Waitlist 10).
   - **Pricing Disclaimers:** Distinct labeling for *"Indicative target price — subject to supplier confirmation"*, *"Estimated group discount — not guaranteed"*, *"Discount being negotiated"*, and *"Verified Supplier Quote"*.

---

## 2. Verification Baseline & Deployment Results

| Check / Gate | Result | Command / Details |
|---|---|---|
| **Unit & Integration Tests** | **317 / 317 PASS (100%)** | `npm test` (91 suites in 4.62s) |
| **TypeScript Strict** | **0 Errors** | `npx tsc --noEmit` |
| **ESLint** | **0 Errors, 0 Warnings** | `npm run lint` |
| **Next.js Production Build** | **PASS** | `npm run build` (66/66 routes compiled) |
| **OpenNext Worker Build** | **PASS** | `npm run build:worker` (`.open-next/worker.js`) |
| **Git Push to Remote** | **PASS** | Commit `b6aa7d2` pushed to `origin/feat/category-agnostic-platform` |
| **Staging D1 Migrations** | **Up-to-Date** | 0001–0009 applied (`groupbuying-staging`) |
| **Staging Worker Deploy** | **PASS** | Version ID: `7cdb9b02-26e7-4fee-a565-4d3701ebe3e3` |
| **Staging Live Smoke Tests** | **PASS** | HTTP 200 on `/`, `/api/cities`, `/api/categories`, `/city/bhopal` |
| **Production Migration Preflight** | **Up-to-Date** | 0001–0009 applied (`groupbuying-prod`), 0 pending |
| **Production Worker Deploy** | **PASS** | Version ID: `580e8016-6faf-41b3-b7c9-a08d4a0788c1` |
| **Production Live Smoke Tests** | **PASS** | HTTP 200 on `/`, `/api/cities`, `/api/categories`, `/city/bhopal`, `/admin` |

---

## 3. Production Smoke Verification Evidence

Live curl/HTTP verification against `https://groupbuying.store` (Production Version ID: `580e8016-6faf-41b3-b7c9-a08d4a0788c1`):

- `GET https://groupbuying.store/`: **Status 200 OK**
  - Brand: `GroupBuying` + `PoolBuy India` badge present.
  - Location Control: Displays `"Choose City"`.
  - Hero Headline: `"Bring local buyers together. Unlock better buying opportunities."`
  - Hero Subtext: `"Tell us what you want to buy. We bring together demand from people in your city and work towards better supplier offers."`
  - Launch Category: `"Home Rooftop Solar Installation under PM Surya Ghar"` rendered as featured launch category; Solar is not hardcoded as permanent platform identity.
  - Nationwide 28-card repetitive grid: **ELIMINATED** from default view (`selectedCity === null`).
  - How It Works: 4-step journey present.
  - Trust, Disclaimers & Transparency: Present.
  - FAQs: 7 comprehensive questions and answers present.
- `GET https://groupbuying.store/api/cities`: **Status 200 OK** (28 operational cities returned).
- `GET https://groupbuying.store/api/categories`: **Status 200 OK** (8 dynamic categories returned).
- `GET https://groupbuying.store/city/bhopal`: **Status 200 OK** (City-specific pool catalog rendered).
- `GET https://groupbuying.store/admin`: **Status 200 OK** (Admin authentication gate rendered without 500 crashes).

---

## 4. Database Migrations Status

Both staging (`groupbuying-staging`) and production (`groupbuying-prod`) have identical schemas with all 9 canonical migrations applied:
1. `0001_initial_schema.sql`
2. `0002_fix_pool_categories.sql`
3. `0003_solar_category.sql`
4. `0004_fix_categories.sql`
5. `0005_fix_supplier_quotes_column.sql`
6. `0006_location_requests.sql`
7. `0007_campaigns_and_city_pools.sql`
8. `0008_lead_pincode_and_existing_quote.sql`
9. `0009_canonical_25_launch_cities.sql`

No pending migrations exist.

---

## 5. What Works & Non-Negotiable Domain Rules

1. **City-First Architecture:** Demand cohorts are strictly bounded by city. Pools in different cities have independent memberships, target capacities, waitlists, and statuses.
2. **Category Agnostic Design:** Solar is the initial category under the broad label "Home Rooftop Solar Installation under PM Surya Ghar". The system does not create sub-pools for 2 kW / 3 kW / 5 kW or specific inverter brands. Future categories (EVs, home power backup, etc.) plug directly into category configurations.
3. **Waitlist Capacity Invariant:** `maxWaitlist = Math.ceil(targetBuyers / 2)`. Waitlist row is hidden from active pool cards unless confirmed capacity is full.
4. **Demand Proposal Workflow:** Users can propose new pools in unserved categories or cities via `PoolRequestForm` (`/api/requests`). Submissions are saved as proposals and require Admin approval before public pool activation.
5. **Zero Customer Payments:** 100% free interest registration in MVP. Zero payment gateways, zero token fees, zero financial commitments.
6. **Data Truthfulness:** Public counts reflect actual validated leads in D1 SQLite; no fictitious counters, countdown timers, fake discounts, or fabricated testimonials.

---

## 6. Exact Instructions for Next Agent / Operator

1. **Working Tree:**
   - Current branch: `feat/category-agnostic-platform`.
   - The repository is completely clean and aligned with `origin/feat/category-agnostic-platform`.
2. **Deployment Commands:**
   - Staging: `npm run build && npm run build:worker && npx wrangler deploy --config wrangler.staging.jsonc`
   - Production: `npm run build && npm run build:worker && npx wrangler deploy --config wrangler.jsonc`
3. **Database Checks:**
   - Staging: `npx wrangler d1 migrations list DB --config wrangler.staging.jsonc --remote`
   - Production: `npx wrangler d1 migrations list DB --config wrangler.jsonc --remote`
4. **Running Tests:**
   - `npm test` (Runs all 317 tests via Node.js native test runner and tsx)
   - `npx tsc --noEmit` (TypeScript strict check)
   - `npm run lint` (ESLint 9)
