# GROUPBUYING.STORE — CANONICAL PRODUCT CONTRACT

**Version:** 1.1.0  
**Effective Date:** 29 October 2026  
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

## 2. Historical Reconciliation & Superseded Specifications

1. **Historical "Shared Pool" Model (v7.3.0) — Superseded:**
   The legacy v7.3.0 experiment mapped multiple cities to a single shared pool cohort via `pool_cities`. This is **historical and superseded**. The canonical platform model is **1 Campaign &rarr; N Independent City Pools** (`campaigns` &rarr; `pools` with `campaign_id`). Each city pool has its own distinct capacity, confirmed member count, waitlist, lifecycle, and closure state.
2. **Historical Payment & Token Instructions — Superseded:**
   Legacy notification templates referencing token booking deposits (e.g., ₹499/₹999 refundable tokens, `PAYMENT_INSTRUCTIONS`, or payment links) are **superseded and prohibited** in the active MVP. All communications must reflect neutral, transparent coordination without collecting or demanding payment.
3. **All-India Discovery vs. Forced Gating:**
   The national All-India discovery view is the primary open catalog. City filters refine discovery but do not block visitors from exploring deals nationwide or submitting demand requests for any Indian locality.

---

## 3. Product, Campaign & City Model

1. **Natural Identity & Independence:**
   - A Pool represents an active interest cohort for a specific product offer in a specific city.
   - Natural Identity: `(city_slug, slug)`.
   - **Isolated Capacity Invariant:** Different cities, different products, and materially different variants have **completely independent capacities and member counts**. Joining a pool in Pune increments Pune's cohort only; it never leaks into or shares capacity with Mumbai, Bhopal, or Delhi.
   - A campaign may be created across multiple cities, but this generates separate, independent city pool records.
2. **Canonical 25 Solar Launch Cities:**
   The 25 canonical launch cities for the initial Solar rollout are:
   1. Delhi (`delhi`)
   2. Mumbai (`mumbai`)
   3. Bengaluru (`bengaluru`)
   4. Hyderabad (`hyderabad`)
   5. Chennai (`chennai`)
   6. Kolkata (`kolkata`)
   7. Pune (`pune`)
   8. Ahmedabad (`ahmedabad`)
   9. Surat (`surat`)
   10. Jaipur (`jaipur`)
   11. Lucknow (`lucknow`)
   12. Kanpur (`kanpur`)
   13. Nagpur (`nagpur`)
   14. Indore (`indore`)
   15. Bhopal (`bhopal`)
   16. Patna (`patna`)
   17. Vadodara (`vadodara`)
   18. Coimbatore (`coimbatore`)
   19. Kochi (`kochi`)
   20. Ludhiana (`ludhiana`)
   21. Chandigarh (`chandigarh`)
   22. Gurugram (`gurugram`)
   23. Noida (`noida`)
   24. Visakhapatnam (`visakhapatnam`)
   25. Bhubaneswar (`bhubaneswar`)
   *Note:* The authoritative directory of 28 States and 8 UTs (`INDIA_LOCATION_DIRECTORY`) remains available for public demand discovery and proposals.

---

## 4. Join Flow, City Mismatch & Cross-City Registration Invariants

1. **Target City Resolution:**
   - The target city is determined strictly from the canonical pool record server-side, never from an untrusted client label.
   - The join dialog must prominently display the target pool city (e.g., "Bhopal Pool").
2. **City Mismatch Handling:**
   - The join flow collects or confirms the user's city where applicable.
   - PIN code is validated strictly as a 6-digit string (`^[0-9]{6}$`), preserving leading zeros (e.g., `'011001'`). A PIN prefix alone is never used to infer a city or district.
   - If the user-selected city differs from the target pool city, an explicit warning must be presented:
     *"You are joining the [Target City] pool, not the [User Selected City] pool."*
   - Users are offered clear "Confirm & Continue" or "Cancel / Choose Different City" actions.
   - Server-side validation must re-verify city match and explicit continuation before persisting membership.
3. **Cross-City Duplicate Detection & Privacy Rules:**
   - Phone numbers are normalized to 10-digit Indian mobiles (`whatsapp_number`).
   - **Exact Pool Check First:** If the number already exists in the target pool:
     - Confirmed member: Idempotent return with `{ alreadyJoined: true, buyerNumber, status }` without count increment.
     - Waitlist applicant: Idempotent return with waitlist position.
   - **Cross-City Same-Category Detection:**
     - If the number has an active registration in another city within the same category, inform the user with a privacy-safe notification.
     - Privacy safeguard: Do not reveal private personal history to arbitrary third-party inputs. Only display existing registration notice in response to authenticated or safe self-submissions.
     - Following explicit confirmation, allow separate registration in the new city if that city's pool is active and eligible.
     - Never modify, cancel, or alter the previous city's registration or member count.
   - **Unrelated Categories:**
     - Registration in an unrelated category (e.g. EV Scooters) never blocks a new registration in Solar or Home Power Backup.

---

## 5. Capacity, Waitlist & Proposal Separation

1. **Confirmed Member Capacity:**
   - Each pool has a target capacity (`target_buyers`, typically 10).
   - Joins while `current_buyers < target_buyers` become **Confirmed Members** (`pool_leads`) and receive a sequential `buyer_number` (1 to `target_buyers`).
   - When `current_buyers == target_buyers`, the pool status transitions to `TARGET_REACHED` (or `UNLOCKED`).
2. **FIFO Waiting List (`pool_waitlist`):**
   - If a pool is full (`current_buyers >= target_buyers`), and `max_waitlist_size > 0`:
     - Subsequent joiners enter the **FIFO Waiting List** (`pool_waitlist`) with sequential `sequence_number` (1 to `max_waitlist_size`, `status: 'WAITING'`).
   - If both confirmed capacity and waitlist capacity are full, subsequent join attempts are rejected with **HTTP 409 Conflict** (`POOL_AND_WAITLIST_FULL`), inviting the user to submit a new pool request.
3. **Waitlist Promotion Integrity:**
   - Promoting a waitlisted buyer to confirmed member preserves all attributes: `pincode` (preserving leading zeros), `existing_quote`, timeline, and contact consent.
   - Waitlisted applicants are **never** counted in confirmed member metrics.
4. **Demand Proposals (`pool_requests`):**
   - Public pool requests create demand proposals (`status: 'REQUESTED'`), not active pools and not confirmed memberships.
   - Conversion to an official city pool requires explicit Admin action.

---

## 6. Supplier Quotations & Communication

1. **Quotation Truthfulness:**
   - **Verified Supplier Quotation:** Displayed only when an official quotation with vendor scope, inclusions/exclusions, and future `validUntil` date is verified by Admin.
   - **Customer-Reported Quote:** Displayed strictly with clear labeling: *"Customer Reported (Unverified)"*.
   - **Indicative Estimate:** Used for pools in aggregation phase prior to vendor quotes.
2. **Honest Manual WhatsApp Outreach:**
   - 100% manual `wa.me/91<phone>?text=...` deep links.
   - Zero automated bots, token requests, or fake discount urgency.
   - Strict respect for `do_not_contact = 1` and communication consent.

---

## 7. Administrative Security & Multi-City Bulk Rollout

1. **Session & Mutation Security:**
   - Timing-safe passkey comparison (`crypto.timingSafeEqual`).
   - Signed `HttpOnly`, `SameSite=Lax` HMAC-SHA256 session cookie.
   - Origin / CSRF validation on mutating endpoints.
   - Immutable audit logging in `admin_audit_logs`.
2. **Admin Multi-City Campaign Rollout Workflow:**
   - Admin creates a shared product campaign and selects $N$ cities from the canonical 25-city list.
   - Preview step shows selected cities, existing pool conflicts, and expected creations.
   - Atomic and idempotent execution: rerunning the bulk rollout creates only missing city pools without duplicating existing pools or corrupting member counts.
   - Independent capacities and lifecycles per city pool.

---

## 8. Acceptance Criteria for System Release

1. **Category-Agnostic Model:** Dynamic category records in D1; zero hardcoded assumptions.
2. **City Pool Independence:** Independent pool IDs, capacities, member counts, and waitlists per city.
3. **Zero-Payment MVP:** No payment gateways, no token deposits, no payment-gated memberships.
4. **City Mismatch Protection:** Explicit warning and confirmation when user city differs from target pool city; re-validated server-side.
5. **Cross-City Duplicate Handling:** Exact pool idempotency; cross-city same-category safe detection and explicit continuation; unrelated categories unblocked; zero PII leakage.
6. **Waitlist & Pincode Integrity:** Full FIFO waitlist promotion preserving 6-digit string pincode with leading zeros and existing quote data.
7. **25-City Solar Rollout Idempotency:** Admin bulk rollout previews, creates, and reports per-city status idempotently.
8. **Communication & Privacy:** PII protected on all public endpoints; WhatsApp manual links only; opt-out honored.
9. **Code & Build Quality:** 100% tests pass, 0 lint errors, 0 typecheck errors, clean Next.js and Cloudflare Worker builds.
