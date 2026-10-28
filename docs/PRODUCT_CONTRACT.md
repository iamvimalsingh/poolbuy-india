# GROUPBUYING.STORE — CANONICAL PRODUCT CONTRACT

**Version:** 1.0.0  
**Effective Date:** 28 October 2026  
**Status:** Approved Canonical Specification  
**Primary Brand Identity:** GroupBuying (`https://groupbuying.store`)  
**Secondary / Historical Brand:** PoolBuy India  
**Target Runtime:** Next.js 16 App Router on Cloudflare Workers (via OpenNext) backed by Cloudflare D1 (SQLite)

---

## 1. Business Model & Core Philosophy

1. **Free Interest-First Aggregation:**
   GroupBuying.store aggregates free, non-binding expressions of interest in consumer and commercial products by city and relevant service area. Joining a pool registers buying intent; it is **not** a financial transaction or binding purchase contract.
2. **Category-Agnostic Extensibility:**
   The platform is fundamentally product- and category-agnostic. **Solar is one configurable category**, not the platform's exclusive category or permanent architecture. Active categories are governed by the database and admin configuration.
3. **Honest Demand Coordination:**
   The platform coordinates demand to negotiate transparent group pricing with authorized dealers and suppliers. We never invent supplier names, discount claims, fictitious member counts, countdown timers, or fake testimonials.
4. **Initial MVP Boundaries (Strictly No Payments):**
   The initial MVP contains **zero payment processing**. There are no token booking fees, platform charges, escrow funds, payment orders, or payment-gated membership states. Real commerce and installation contracts occur directly between the buyer and verified supplier.

---

## 2. Public User Experience

1. **Frictionless Zero-Login Access:**
   - No mandatory public user registration, passwords, or customer accounts.
   - No customer dashboard.
   - Public visitors can browse pools, select cities, filter categories, join existing pools, or submit demand proposals without logging in.
2. **Location & Service Area Discovery:**
   - National "All India" discovery view alongside city-specific filters.
   - Operational cities are backed by the canonical directory of 28 States and 8 Union Territories.
   - PIN codes are stored strictly as strings preserving leading zeros (e.g., `'011001'`). A PIN prefix alone is never used to assume an entire city or district boundary.
   - Unsupported locations have an open, honest demand-request path.
3. **Category & Pool Catalog:**
   - Visitors can browse active pools by category (e.g., Electric Vehicles, Rooftop Solar, Home Power Backup, Water Softeners, Appliances) and by city.
   - Every active pool honestly displays confirmed member count, target capacity, current waitlist count, deadline, and verified supplier offer details where applicable.
4. **Separation of Verified Offers vs. Indicative Estimates:**
   - If an official supplier quotation has been verified and published by Admin, the group price is labeled as **"Verified Supplier Quotation"** with vendor scope and validity.
   - If a pool is in demand-aggregation phase without a finalized supplier quote, prices are clearly labeled as **"Indicative Estimate"**.
5. **Private Contact Information:**
   - Buyer names and WhatsApp mobile numbers are strictly confidential and protected server-side.
   - Zero member PII is rendered on public HTML pages or returned in public API payloads.
6. **Honest Communication & WhatsApp Workflow:**
   - All WhatsApp outreach is **100% manual** using pre-composed, transparent `wa.me/91<phone>?text=...` deep links.
   - No automated third-party bot spam or unverified message receipts.
   - Explicit communication consent is required on join. If a lead exercises `do_not_contact = 1`, all WhatsApp communication links are immediately blocked.

---

## 3. Pool Identity, Capacity & Waitlist Invariants

1. **Independent City-Plus-Product Identity:**
   - A Pool represents an active interest cohort for a specific product offer in a specific city.
   - Natural Identity: `(city_slug, slug)`.
   - **Isolated Capacity Invariant:** Different cities, different products, and materially different variants have **completely independent capacities and member counts**. Joining a pool in Pune increments Pune's cohort only; it never leaks into or shares capacity with Mumbai, Bhopal, or Delhi.
2. **Confirmed Member Capacity:**
   - Each pool has a target capacity (`target_buyers`, typically 10).
   - Joins while `current_buyers < target_buyers` become **Confirmed Members** (`pool_leads`) and receive a sequential `buyer_number` (1 to `target_buyers`).
   - When `current_buyers == target_buyers`, the pool status transitions to `TARGET_REACHED` (or `UNLOCKED`).
3. **FIFO Waiting List:**
   - If a pool is full (`current_buyers >= target_buyers`), and `max_waitlist_size > 0`:
     - Subsequent joiners enter the **FIFO Waiting List** (`pool_waitlist`) with sequential `sequence_number` (1 to `max_waitlist_size`, `status: 'WAITING'`).
   - If both confirmed capacity and waitlist capacity are full, subsequent join attempts are rejected with **HTTP 409 Conflict** (`POOL_AND_WAITLIST_FULL`), inviting the user to submit a new pool request.
4. **Idempotent Joins:**
   - A buyer is identified by their normalized 10-digit Indian mobile number (`whatsapp_number`).
   - Submitting a join for an already-joined mobile number is idempotent: it returns HTTP 200 with `{ alreadyJoined: true, buyerNumber, status }` without incrementing counts or creating duplicate rows.
5. **Member Removal & FIFO Promotion:**
   - If an active member withdraws or is excluded by Admin (`status: 'EXCLUDED'`), `current_buyers` decrements by 1, reopening a slot.
   - Admin can trigger **Promote Next**: sequence 1 on the waitlist is promoted to confirmed member status, preserving strict FIFO ordering.

---

## 4. Public Demand Requests vs. Official Approved Pools

1. **Demand Requests (`pool_requests`):**
   - Any visitor from any town in India can submit a free-text pool request specifying what product they want, preferred brand/specifications, and location.
   - Stored in `pool_requests` with status `REQUESTED`.
   - **Strict Governance:** Public requests **never** automatically create or publish a pool. Requesters are interest-submitters, not pool owners.
2. **Admin Review & Conversion:**
   - Admin reviews submitted requests, standardizes product titles and specifications, assigns the category and operational city, and explicitly triggers pool conversion.
   - Upon conversion, an official pool record is created, and the source request is marked `APPROVED` with `resulting_pool_id`.

---

## 5. Administration & Security Infrastructure

1. **Passkey & HMAC Session Security:**
   - Single administrative passkey (`ADMIN_PASSKEY`) verified with timing-safe comparison (`crypto.timingSafeEqual`).
   - Issues signed `HttpOnly`, `SameSite=Lax` HMAC-SHA256 session cookie (`ADMIN_SESSION_SECRET`).
   - Route guard [`lib/require-admin.ts`](file:///c:/Users/iamvi/poolbuy-india/lib/require-admin.ts) protects all `/api/admin/*` routes.
2. **Immutable Audit Logging:**
   - All administrative actions (pool creation, status changes, deadline extensions, exclusions, promotions, quote updates, communication clicks) are recorded in `admin_audit_logs`.
3. **Rate Limiting & Input Validation:**
   - Public APIs protected by in-memory rate limiting and strict Zod validation schemas.
   - RFC-4180 CSV export with formula injection sanitization (`=`, `+`, `-`, `@`, tab).

---

## 6. Approved Core User Journeys

```mermaid
journey
    title Core User Journeys for GroupBuying.store MVP
    section Journey 1: Public Buyer Discovery
      Open GroupBuying.store homepage: 5: Visitor
      Select City & Filter Category: 5: Visitor
      Browse active pools with truthful counts: 5: Visitor
      Join pool with Name & WhatsApp mobile: 5: Visitor
      Receive instant confirmed Buyer # or Waitlist #: 5: Visitor
    section Journey 2: Demand Request
      Click "Start a Pool": 5: Visitor
      Type product need & city in free text: 5: Visitor
      Submit proposal without login: 5: Visitor
      Request stored for Admin review: 5: System
    section Journey 3: Admin Pool Governance
      Login to Admin Console with Passkey: 5: Admin
      Review incoming Pool Requests: 5: Admin
      Standardize specs & select Category/City: 5: Admin
      Create & Publish Official Pool: 5: Admin
    section Journey 4: Member & Quotation Ops
      Monitor confirmed buyers reaching target: 5: Admin
      Attach & verify supplier quotation: 5: Admin
      Click to open wa.me manual contact: 5: Admin
      Exclude withdrawn buyer & promote FIFO waitlist: 5: Admin
```

---

## 7. Acceptance Criteria for MVP Completion

1. Category-agnostic data model: categories are dynamic rows in D1; zero hardcoded category unions in core business logic.
2. Independent city pools: each city has separate records, separate capacity, and separate waitlists.
3. Zero-payment operation: joining is 100% free; zero gateway code or token fee demands.
4. Capacity integrity: atomic updates prevent oversubscription beyond target capacity; FIFO waitlist preserves queue order.
5. Administrative security: timing-safe passkey verification; immutable audit logging on all mutations.
6. Honest manual WhatsApp: wa.me links generated safely; opt-out strictly enforced; interaction logged.
7. Verification & build cleanliness: 100% test pass rate, 0 lint warnings, 0 type errors, clean Next.js and Cloudflare Worker builds.

