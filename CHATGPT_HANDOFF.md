# CHATGPT_HANDOFF.md — GROUPBUYING.STORE REPOSITORY & RELEASE HANDOFF

**Last Updated:** 29 October 2026  
**Execution Stage:** City-First, Multi-Category Homepage Redesign Complete — All Architecture Invariants, Implementations, and Automated Test Loops Verified; Ready for Release Verification  
**Status:** **HOMEPAGE REDESIGN VERIFIED & LOCKED (100% PASS RATE — 317/317 TESTS)**  
**Canonical File:** `CHATGPT_HANDOFF.md` (Repository Root)  
**Active Git Branch:** `feat/category-agnostic-platform`  
**Current HEAD Commit:** `95e6921` ("feat(solar-rollout): roll out PM Surya Ghar Solar for home across all 28 listed cities, clean legacy solar pools")  
**Recovery Checkpoints:**
- Git Branch: `checkpoint/gate-0-baseline` (`60d91bc`)
- Git Tag: `checkpoint-gate-1-reconciliation` (`0844e76`)  
**Production Live URL:** `https://groupbuying.store`  
**Production Worker Target:** `poolbuy-india`  
**Staging Live URL:** `https://poolbuy-india-hotfix-test.iamvimalsingh.workers.dev`  
**Staging Worker Target:** `poolbuy-india-hotfix-test`  
**Primary Brand Identity:** GroupBuying (`https://groupbuying.store`), retaining secondary `PoolBuy India` badge  
**Runtime Architecture:** Next.js 16.4.3 App Router on Cloudflare Workers via OpenNext (`@opennextjs/cloudflare` 1.20.13) backed by Cloudflare D1 SQLite  

---

## 1. Executive Summary: City-First, Multi-Category Homepage Redesign

In accordance with the approved UX specification and `docs/PRODUCT_CONTRACT.md`, the homepage has been redesigned from a repetitive nationwide solar card grid into a simple, interactive, trustworthy, city-based, multi-category aggregation platform:

1. **Default Homepage (No City Selected):**
   - **Elimination of Repetitive Grid:** Removed the nationwide 28 repeated city-specific solar card grid from the default landing view.
   - **Header:** GroupBuying.store brand with primary location control labelled **"Choose City"**, navigation for "Categories", "How It Works", "FAQs", "Start a Pool", and an accessible mobile navigation drawer.
   - **Platform Hero:** Concise, accessible value proposition: *"Bring local buyers together. Unlock better buying opportunities."* Supported by: *"Tell us what you want to buy. We bring together demand from people in your city and work towards better supplier offers."* CTA: *"Choose Your City"*. Transparent disclaimers that interest is free, non-binding, and offers are not guaranteed.
   - **Category Discovery:** Data-driven rendering from `getOperationalCategories()` featuring broad *"Home Rooftop Solar Installation under PM Surya Ghar"* as the launch category without kW/brand fragmentation, while supporting additional dynamic categories.
   - **How It Works:** 4-step transparent journey: (1) Choose a city, (2) Explore category & express interest, (3) Demand is aggregated, (4) Supplier quotations sought/reviewed with independent customer decisions.
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

## 2. Verification Baseline

- **Automated Tests (`npm test`):** **317 / 317 PASS (100%)** across 91 test suites in 4.59s (including new 14-test suite `lib/__tests__/homepage-redesign-invariants.test.ts`).
- **TypeScript Strict Check (`npx tsc --noEmit`):** **0 diagnostic errors** (Exit code 0).
- **ESLint (`npm run lint`):** **0 errors, 0 warnings** (Exit code 0).
- **Next.js Production Build (`npm run build`):** **PASS** (66/66 routes compiled, all launch cities pre-rendered).
- **Cloudflare Worker Build (`npm run build:worker`):** **PASS** (`Worker saved in .open-next\worker.js 🚀`).

---

## 3. Changed Files Inventory

- `app/page.tsx`: Server component delegating to `HomepageView`.
- `components/homepage-view.tsx`: Reactive view coordinating Default vs City-Selected homepage states, heroes, and sections.
- `components/site-header.tsx`: Location control "Choose City", navigation ("Categories", "How It Works", "FAQs", "Start a Pool"), responsive mobile drawer.
- `components/location-selector.tsx`: Searchable 25 launch markets & All India directory, "Choose City" trigger, click-only device geolocation, clear selection.
- `components/category-discovery.tsx`: Multi-category discovery featuring Home Rooftop Solar under PM Surya Ghar.
- `components/pool-catalog.tsx`: City selection prompt (Default), city-specific pools (Selected), approved empty state, waitlist capacity alignment.
- `components/pool-card.tsx`: Removed waitlist row from normal cards, next-step explainer, clear indicative price disclaimers.
- `components/how-it-works.tsx`: 4-step journey with honest non-promissory microcopy.
- `components/trust-transparency.tsx`: Disclaimers, DPDP privacy, official PM Surya Ghar scheme distinction.
- `components/homepage-faqs.tsx`: Concise answers to 7 core questions.
- `components/site-footer.tsx`: Verified links to platform sections and official PM Surya Ghar portal.
- `lib/pools.ts`: Server-side waitlist capacity rule `calculateMaxWaitlistCapacity(target) = ceil(target / 2)`.
- `app/api/pools/[poolId]/waitlist/route.ts`: Server-side capacity enforcement based on `ceil(target / 2)`.
- `lib/constants.ts`: Broad solar label "Home Rooftop Solar Installation".
- `lib/__tests__/homepage-redesign-invariants.test.ts`: Automated test suite covering all 14 redesign invariants.

---

## 4. Next Step in Master Workflow

- Commit verified redesign changes to `feat/category-agnostic-platform`.
- Proceed through standard release gates: Gate 9B (Staging release & smoke check) and Gate 9C (Production release & smoke check).
