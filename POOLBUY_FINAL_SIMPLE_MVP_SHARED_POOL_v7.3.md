# PoolBuy India — Final Simple MVP, Shared Pool Model, Browser Acceptance, Git & Cloudflare Release Prompt v7.3.0

**Run this entire prompt ONCE in the existing Antigravity session for `iamvimalsingh/poolbuy-india`.** Continue in the current repository and project. Do not create a new app, do not ask the owner for separate prompts per phase, and do not add customer login/OTP complexity.

This version supersedes the earlier per-city-count model. **ONE pool = ONE shared member count, ONE active capacity of 10, and ONE FIFO waitlist of maximum 5 across every city where that pool is displayed.** City is a discovery/visibility label only. Never calculate separate counts or capacities for Delhi, Mumbai, Pune, or any other city for the same pool ID.

---

## 0. Mission and definition of success

Build a reliable GroupBuying / PoolBuy India MVP that captures demand and lets the Admin approve it. It is not a full marketplace or community network.

A customer can do only two things:

1. **Join an existing pool** with a minimal form.
2. **Request a pool** by typing what they want in ordinary language, e.g. “2 kW rooftop solar for my home”. Requests can come from anywhere in India.

The Admin reviews a request, chooses the final public title, optionally creates/selects an internal category, selects one or more supported launch-city visibility labels, then explicitly creates/publishes a pool. A public request must never create a live pool automatically.

### Non-negotiable business rules

- One pool master may be shown in one or more of the top 25 initial launch cities.
- The same pool ID has **one shared capacity**: maximum **10 ACTIVE members across all cities combined**.
- The same pool ID has **one shared FIFO waitlist**: maximum **5 WAITLISTED members across all cities combined**.
- The same person joining the same pool from another city view is still the same pool membership, not a second city-specific membership.
- All cards, including cards viewed under different city filters, must show the same authoritative `ACTIVE N/10` and `WAITLIST N/5` for that pool.
- Joining through a city-filtered page does not assign that member to a city-specific cohort and does not create a city count.
- A city's label determines where a pool is discoverable, not where its count resets.
- Requests can be submitted from any Indian city/town using optional free-text location fields. The public request form has no category/product dropdown and no mandatory city selector.
- Admin approves/creates pools manually. Categories are internal Admin metadata, not a customer concern.
- Request approval, request delete/archive, pool join, waitlist, removal and promotion must work through the real UI → API → auth/validation → database → response → refreshed UI path.
- After building, run the complete test suite and an actual browser-driven end-to-end journey against a real local/staging database. Test data must then be safely cleaned and the final state verified.
- Push the verified code to Git and deploy to Cloudflare when credentials, secret rotation, D1 migration safety, build and runtime verification gates pass. Never fake a deployment result.

### One critical product boundary

If Admin needs genuinely different pricing, supplier/installer, availability terms or fulfilment for a particular city, that must be a separate pool master with a separate pool ID, title and explicit Admin decision. Do not silently make city-specific sub-counts inside one pool. This exception is a separate pool, not a city rollout or duplicate hidden counter.

---

## 1. Repository authority, safety and permanent Master Blueprint

1. Work only in the existing repository. Before editing, check current branch, full HEAD SHA, remotes, `git status --short`, recent commits, package scripts, runtime routes/components, tests, schema, migrations, Wrangler configuration, D1 bindings and deployment URLs.
2. Historical reports mentioned commits `c107b5a` and `3504487`, 114 tests, local D1 setup and missing Cloudflare authentication. Treat them as stale until verified from the current repository/runtime.
3. Preserve local and remote user work. Never use `git reset --hard`, `git clean`, force-push, blind revert, destructive database reset, `DROP TABLE`, broad delete, or bulk rewrite of production data.
4. Retain the actual working stack. The expected architecture is Next.js App Router + TypeScript + Tailwind + OpenNext + Cloudflare Workers + Cloudflare D1, but verify the checked-out project rather than assuming.
5. `MASTER_BLUEPRINT.md` is the single permanent source of truth. Update its normative scope to **v7.3.0 Simple MVP — Shared Pool Count**. Integrate all requirements from this prompt into the relevant existing master sections. Mark superseded per-city capacity/count logic, public category selection, mandatory public city directory, community features, login, quote/payment/fee systems and other excluded workflows as `OUT OF MVP / DEFERRED`; do not let old documents override this scope. Do not create a competing master/subsystem-spec document.
6. Preserve the existing Master Blueprint structure/history where practical. Update its current implementation/as-built record (Section 30 if present) before code edits and after each phase, test gate, Git action and deployment attempt. Record actual facts, commands, exit codes, environment, commit/deployment evidence and blockers. Never rewrite a requirement as PASS merely because the code differs.
7. If `docs/IMPLEMENTATION_PROGRESS.md` already exists and is maintained, keep it consistent; the Master Blueprint remains definitive.
8. Never print secret values, customer phone numbers, session cookies, tokens or credentials in terminal output, screenshots, logs, test artifacts or this report. Redact PII in evidence.
9. Do not report unverified claims. A successful build is not proof of DB persistence, and a successful deploy command is not proof of healthy production.

---

## 2. Reference website: https://poolbuy.app/

Attempt to open `https://poolbuy.app/` in the available browser and inspect the actual page if it loads. Use it only as a reference for simple discovery, concise pool cards, clear status/counts and low-friction join flow. Do not copy its brand/content/code or import login, OTP, dashboards, payment or advanced community features.

If it cannot be fetched or browsed, record `REFERENCE NOT ACCESSIBLE`; continue from this spec. Do not substitute unrelated search results or invent what the requested reference contains.

---

## 3. Exact MVP scope

### Included

- Public homepage and a basic pool catalogue.
- Exactly one simple public location filter: `All India` plus the fixed 25 launch-city labels below. All India is the first-visit default.
- A pool master that can be labelled as live/available in one or more of these cities.
- One shared membership list, one shared active count and one shared waitlist for each pool master.
- Minimal public `Join Pool` form; no customer login or OTP.
- Free-text `Request a Pool` form available from anywhere in India.
- Admin-only request review, reject, safe archive/delete, optional internal category, create/publish pool, edit title/details/city visibility labels, pause/close/archive, review members/waitlist, remove member and manually promote next.
- Server-side Admin authorization; validation and safe error handling; persistent database records; migrations only when required.
- Regression tests, actual browser-driven end-to-end verification, exact test-data cleanup, Git push and Cloudflare deployment where safe and authorized by existing release configuration.

### Explicitly out of MVP / deferred

- Different counts/capacities/waitlists per city for one pool.
- Public category selector, product catalogue selector or public product master creation.
- Customer login, account, OTP, password, dashboard or self-service account features.
- A customer request automatically becoming a live pool.
- Community/society networking, member-visible phone lists, automatic WhatsApp group creation or automated messaging.
- Quotes, coordination fees, deposits, payment gateways, checkout, refunds, supplier marketplace or fee calculation.
- Automatic waitlist promotion; promotion stays an explicit Admin action.
- Huge national city directory, cascading State→City selectors, geolocation prompts, maps, postcode lookup or multiple independent city selectors.
- Elaborate CRM pipeline, marketing automation or features not required for request, join, waitlist, Admin review and release safety.

If excluded features already exist, disable/hide them from this MVP only when safe. Preserve data and any compatibility needed by the current app. Do not casually delete tables or unrelated routes.

---

## 4. Initial launch cities — exactly 25

Use this fixed, canonical list in one shared code/config source. These are the initial priority launch markets, not a claim of an official population ranking.

1. Delhi — Delhi
2. Mumbai — Maharashtra
3. Bengaluru — Karnataka
4. Hyderabad — Telangana
5. Chennai — Tamil Nadu
6. Kolkata — West Bengal
7. Pune — Maharashtra
8. Ahmedabad — Gujarat
9. Surat — Gujarat
10. Jaipur — Rajasthan
11. Lucknow — Uttar Pradesh
12. Kanpur — Uttar Pradesh
13. Nagpur — Maharashtra
14. Indore — Madhya Pradesh
15. Bhopal — Madhya Pradesh
16. Patna — Bihar
17. Vadodara — Gujarat
18. Coimbatore — Tamil Nadu
19. Kochi — Kerala
20. Ludhiana — Punjab
21. Chandigarh — Chandigarh
22. Gurugram — Haryana
23. Noida — Uttar Pradesh
24. Visakhapatnam — Andhra Pradesh
25. Bhubaneswar — Odisha

### City behaviour

- The homepage starts at `All India`; never silently select Bhopal or another city.
- The header has the only authoritative city selector. Do not add a second independent dropdown elsewhere.
- City chips/quick links may exist only if they update the same shared filter state.
- A pool can be tagged for any subset of the 25 markets. The Admin chooses these labels during creation/editing. Do not create a pool duplicate for each chosen city.
- All India shows each published pool master once, with all its enabled city labels.
- A city filter shows a pool if that city is in its visibility labels. The pool card must still show the pool-wide counts; these counts do not change with the filter.
- A visitor who opens the pool in Mumbai and a visitor who opens it in Pune both join the same pool ID and count toward the same 10 active + 5 waitlist limit.
- Do not claim that a pool is fulfilled by a verified installer/supplier in all tagged cities. City labels mean public discovery/target rollout only unless operational readiness is separately evidenced.
- Request form location is optional free text (town/city/state); requests outside the 25 cities are still accepted and shown to Admin. Admin can defer/reject them or deliberately select one or more supported labels for the resulting pool.

---

## 5. Canonical data model — one pool, one cohort, city labels only

Inspect existing schema first and adapt the minimum necessary. Do not blindly replace tables or IDs.

### Pool master

One canonical pool record with stable ID and at least:
- `id`
- `title` (final Admin-approved public name)
- `description` (optional)
- `internal_category_id` (optional; Admin-only)
- `status` (`DRAFT`, `PUBLISHED`, `PAUSED`, `CLOSED`, `ARCHIVED`, or an existing equivalent with documented mapping)
- `source_request_id` (nullable; linked request if created from a request)
- `created_at`, `updated_at`, and existing audit metadata as available.

### Pool city visibility

Use a simple many-to-many mapping such as `pool_cities(pool_id, city_code, is_enabled, created_at)` or adapt the repository's existing equivalent. It is **not** a city pool/rollout and must not carry its own active count, waitlist, capacity, member list or waitlist state.

- Unique constraint on `(pool_id, city_code)`.
- The same pool master can have multiple city labels.
- Removing a city label removes that pool from that city's public-filter results, but does not remove member records, change counts, reset capacity or alter membership/waitlist status.
- Archiving/closing the pool master affects the entire shared pool, not one city count.

### Membership / join record

Every join references the single `pool_id`, never a city rollout ID. Store:
- membership ID, `pool_id`, customer name, normalized phone, contact consent, status, server timestamp, and minimal optional note/location only when actually needed.
- Statuses: at minimum `ACTIVE`, `WAITLISTED`, `REMOVED/WITHDRAWN`; use consistent existing names and document mapping.
- One membership per normalized phone per pool for current ACTIVE/WAITLISTED records. A repeat join from another city view of the same pool must resolve to the existing membership rather than creating a second row.
- Public API never returns membership names, phone numbers or row-level PII.

### Pool request

Store free-text requested title/item, requester name, normalized phone, optional city/state free text, optional notes, explicit consent, status, `linked_pool_id` after conversion, timestamps, and archive/soft-delete fields if supported.

Use a small status set: `PENDING`, `CONVERTED`, `REJECTED`, `ARCHIVED/DELETED` or existing equivalent. A request remains pending if pool creation fails.

### Categories

Category is optional Admin-only metadata. Customers never choose or need it. Admin may choose an existing category or create one while reviewing a request. The pool must still be creatable without a category.

### Database migration and old city-rollout schema

- Inspect actual D1 tables, schema, foreign keys, migrations and current member data before changing the model.
- If a prior version stores `pool_rollouts` and has city-specific member foreign keys/counters, do not drop it or reset the DB. Create the minimum additive migration to establish an authoritative membership-to-`pool_id` relationship and a simple `pool_cities` visibility map, then backfill using real foreign-key relationships.
- Preserve member/request/pool IDs, timestamps, statuses and history. Deduplicate only proven duplicates by a documented rule; never arbitrarily discard conflicts.
- If historical members from multiple city rollouts point to the same pool master, migrate them into the one shared cohort and recalculate authoritative ACTIVE and WAITLISTED records globally for that pool. Do not silently promote more than 10 or keep more than 5 waitlisted: flag overflow for Admin review and preserve excess rows as historical/needs-review records with explicit statuses rather than deleting them.
- Keep legacy columns/tables until compatibility and data integrity are proven. Do not use `DROP TABLE`, broad delete or reset.
- Apply migrations locally first. Use the repository's supported D1 migration command and verify local schema after applying. Remote production migration is a separate release gate.

---

## 6. Public homepage and pool discovery

### Homepage

- Keep the existing brand and acceptable styling. Avoid unrelated visual redesign.
- Header: brand, one `All India + 25 cities` selector, and a simple `Admin` link only if the current site already exposes one appropriately.
- Hero: plain explanation that visitors can join an existing pool or request something not listed.
- Two primary actions: `Explore Pools` and `Request a Pool`.
- No public category filter or required product-selection flow.
- Show only real `PUBLISHED` pools. No fake metrics, fabricated savings, invented testimonials, dummy active counts or unverified vendor availability.
- In All India view, show each pool exactly once with its live city labels.
- Under a city filter, show the same pool only if that city is an enabled label. The membership counts displayed are global for that pool ID and remain identical under every city filter.
- No pool results: show a clear empty state and `Request a Pool` action.
- Cards and forms must have working loading, empty, validation error, database error, success, full, waitlist-full, paused and closed states.

### Pool card/detail

Each card shows:
- Admin-approved title and optional short description.
- City visibility labels (not a promise of supplier installation coverage).
- Single global status and global counts: `Active N/10` and `Waitlist N/5`.
- One truthful action: `Join Pool`, `Join Waitlist`, `Waitlist Full`, or unavailable/closed explanation.
- Never show names, phone numbers or member-level information.

### Exact join location semantics

There is no city selection step in the join form. The city filter is only for discovery, and all city views of the same pool submit the same `poolId`. Don't store a join city merely to split counters. If an optional customer location is collected for contact purposes, store it as a note/text separate from pool membership identity and never use it to create a separate count.

---

## 7. Customer Join flow — shared count across all cities

### Minimal form

Required:
- Name.
- Indian mobile/WhatsApp number.
- Explicit consent to be contacted about this pool.

Optional: a short note only if the present UI genuinely needs it. Avoid new fields that add friction. Do not ask for category, product ID, variant, city dropdown, account, password, OTP, address verification or login.

### Server-side atomic join decision

For `POST` join to one `poolId`:

1. Verify pool exists and is `PUBLISHED`; reject paused/closed/archived pool.
2. Validate name, phone, and explicit consent server-side. Normalize accepted Indian phone representations to one canonical format; reject invalid numbers. Never log the full phone.
3. Check the same normalized phone against current ACTIVE/WAITLISTED membership for this pool. A duplicate retry or join from another city view must return the existing status/reference safely and must not create another membership or increment counts.
4. Apply a database-safe atomic insert/guard so concurrent submissions cannot exceed the limits. Do not rely on browser count or separate unprotected read-then-write logic.
5. If active membership count is below 10, add one `ACTIVE` membership.
6. Else, if there are already 10 ACTIVE and fewer than 5 WAITLISTED, add one `WAITLISTED` record with a FIFO timestamp and stable ID tie-breaker.
7. Else (10 ACTIVE and 5 WAITLISTED), reject with a truthful `POOL_AND_WAITLIST_FULL` conflict (HTTP 409 or documented equivalent) and do not create a current membership row.
8. Return only saved result ID/reference, current status, global count summary and waitlist position if relevant. Never return any other member's PII.
9. Show success only after the database mutation has committed.

Use the platform's supported D1 transaction/batch/conditional-write pattern and database uniqueness constraints. If a safe atomic implementation is not possible with current helpers, design and test a correct serialized write/conditional insert strategy for Cloudflare D1; do not pretend application-level UI disabling prevents races.

### Exact shared capacity rules

- `ACTIVE` capacity: 10 per pool ID across all cities combined.
- `WAITLISTED` capacity: maximum 5 per pool ID across all cities combined.
- Maximum current cohort: 15 (10 active + 5 waitlisted) per pool ID, regardless of how many city labels are enabled.
- Joins from Delhi, Mumbai, Pune or any other enabled city all use the same pool ID and global counts.
- All cards/pages/API responses for this pool show identical counts under all city filters.
- Duplicate current membership for the same normalized phone + pool is prevented.
- `REMOVED/WITHDRAWN` does not count against current active/waitlist capacity. Preserve historical rows.
- Contact consent/opt-out is a separate dimension. An opt-out alone must not silently remove a member or change counters.

### User messages

- `ACTIVE`: “You have joined this pool. This records your interest; it is not a purchase or installation confirmation.”
- `WAITLISTED`: “This pool has 10 active places. You are on the shared waitlist at position N. Your place is not confirmed; the team may contact you if a place opens.”
- `POOL_AND_WAITLIST_FULL`: “This pool has 10 active members and 5 people on the waitlist. Request a new pool for your requirement.”
- Never say “city is full” because there is no city-specific cohort.

### Admin removal and manual promotion

- Admin can search/view memberships and their consent/status in protected Admin UI.
- Removing an ACTIVE member frees one slot exactly once. Removing a WAITLISTED member removes them from the current waitlist exactly once. Keep historical status/timestamp.
- If one active slot is free and the shared waitlist is non-empty, Admin has `Promote Next`. It promotes exactly the earliest eligible waitlisted record, atomically, only when ACTIVE count is below 10. Do not auto-promote or auto-message.
- Promotion from waitlist to active moves the person from WAITLISTED to ACTIVE; it does not increase total current cohort size.
- Duplicate/concurrent promotion must not promote two people into one slot.
- Recompute waitlist order from authoritative rows; avoid fragile stored position counters if possible.

---

## 8. Request a Pool — free text, from anywhere in India

### Public request form

CTA label: `Request a Pool` or `Request a New Pool`. Never `Suggest a Product`.

Required:
- “What do you want to buy or install?” — free text, e.g. `2 kW rooftop solar for my home`.
- Name.
- Indian phone/WhatsApp number.
- Explicit consent to be contacted about this request.

Optional:
- City/town free text.
- State free text.
- Notes.

No public category/product picker, required city/state dropdown, approved product selector, community/society field, supplier selector, capacity setting or login/OTP. The form accepts a request from any Indian location, including outside the 25 launch markets.

### Public request API

Use existing canonical route, expected `POST /api/pool-requests`:
- Validate and persist a `PENDING` request to the real configured DB.
- Do not create a category or pool automatically.
- Return a real saved request ID/reference after commit.
- Failed persistence must return a clear non-2xx error and must not show success.
- Add bounded input lengths and normal rate limiting/abuse controls.
- Handle double-submit/retry safely without blocking a person from making a legitimate separate future request.
- Public response must not disclose existing request records or any other person's PII.

### Request states and Admin review

Keep only necessary states such as `PENDING`, `CONVERTED`, `REJECTED`, `ARCHIVED/DELETED` (map to current equivalent if consistent).

Admin request row displays request text, name, phone, optional location, note, consent, creation time and status. This information is Admin-only.

Actions:
1. `Create Pool` from request.
2. `Reject` with optional internal reason.
3. `Archive/Delete` safely.
4. Leave pending.

`Create Pool` uses a small form with:
- Final public pool title (required, editable).
- Description (optional).
- Internal category (optional: choose/create for Admin only).
- `Live in cities` — a simple multi-select of the fixed 25 cities. At least one city label is required to publish. These labels all point to the same pool master and share one count.
- `Save as Draft` or `Create & Publish`.

The customer's free-text location is informative only; it does not create a new city automatically and does not split the pool's count.

### Atomic conversion contract

- Pool master creation, mapping selected city labels, and request linkage/status update must succeed together using the actual safe D1 batch/transaction pattern, or using a documented idempotent compensation strategy where the DB layer requires it.
- Exactly one pool master is created for a successful conversion. City labels are mapping rows, not duplicate pools.
- Do not mark request `CONVERTED` until the real pool exists and all requested visibility labels have been saved.
- Conversion failure leaves request `PENDING`, with no orphan/duplicate pool or misleading success screen.
- Double-click/retry/concurrent conversion cannot create a second pool from the same request.
- Admin explicitly chooses `Create & Publish`; no implicit live publication from public request submission.
- Store `source_request_id`/`linked_pool_id` or the repository's equivalent. Preserve original request text and full history.

---

## 9. Simple Admin MVP

Keep existing sound Admin login/session. The customer side remains login-free. Fix broken Admin auth rather than adding another auth scheme.

### Required sections

1. **Overview:** true DB-derived pending requests, published pools, active members and waitlist counts.
2. **Pool Requests:** list/filter `PENDING`, view details, Create Pool, Reject, Archive/Delete, and clear result/error state.
3. **Pools:** list pool masters, title/status, visible city labels, single global count `ACTIVE N/10`, single global waitlist `WAITLIST N/5`; edit/publish/pause/close/archive.
4. **Members & Waitlist:** pool selector, search, consent/status, remove/withdraw, FIFO `Promote Next`, no public PII leakage.
5. **Internal Categories:** optional Admin-only category management; never required to create a pool.
6. **Launch cities:** static canonical 25-city list with optional enabled/paused flag if current model requires it. Do not create a huge location directory.
7. **Audit/Diagnostics:** use existing audit system if available; record important request, pool, member, status, archive and promote actions.

### Admin auth/security

- Every protected route/API checks a valid Admin session server-side.
- Keep cookies/secrets server-only and HTTP-only/secure according to environment.
- Apply existing CSRF/Origin/rate protection where appropriate.
- Hidden UI controls are not authorization. Test direct unauthenticated API calls.

---

## 10. Request and pool delete/archive — repair actual bug

The existing delete button is reported broken. Reproduce and fix the root cause, not just its styling.

### Request archive/delete

- Default safe behavior: soft-delete/archive with audit/history preserved.
- On successful server confirmation, remove the item from the default pending view and show success.
- On failure, leave the row visible and show an actionable error.
- Confirm before action; use the real request ID, correct method, current Admin session and server-side status check.
- Never delete a pool or memberships as a side effect of deleting/archiving a request.

### Pool archive/delete

- Any pool with members, waitlisted records, source request linkage, city labels or audit/dependent history should normally be closed/archived, not hard-deleted.
- Hard delete only a dependency-free draft/test record after a server-side dependency recheck and explicit confirmation.
- Archiving a shared pool affects that pool ID everywhere it is shown. It does not erase history.

### Mandatory trace

For conversion, reject, archive/delete, join, remove and promote, trace:
`UI button → handler → URL/method/body → session/auth → validation → ID lookup → D1 read/write/batch → HTTP status + JSON → UI state refresh`.

Inspect wrong IDs, incorrect route method, missing route export, stale enums/field names, missing columns, wrong D1 binding, foreign-key errors, swallowed non-2xx responses, optimistic row removal before success, filters hiding records, disabled controls that never re-enable, session/CSRF failure and partial transaction writes. Fix the actual cause and add a regression test.

---

## 11. Internal API contract — reuse existing route patterns

Inspect the repository first. Repair existing canonical routes where possible; do not create duplicate endpoints for the same operation. Update the Master Blueprint with the exact actual endpoint/component mapping.

### Public APIs

**Create request** — expected `POST /api/pool-requests` (or existing canonical equivalent).

Logical payload:
```json
{
  "requestedTitle": "2 kW rooftop solar for my home",
  "name": "Synthetic E2E Customer",
  "phone": "9876543210",
  "cityText": "Baraut",
  "stateText": "Uttar Pradesh",
  "notes": "Optional details",
  "contactConsent": true
}
```

No `categoryId`, `productId`, `variantId`, `cityId`, state ID, user ID or auth token is required from a public customer.

**List pools** — existing public pool API with optional simple `city` filter, `ALL` by default. Return each published pool master once in All India view, its actual city visibility labels, global status/counts and no PII.

**Join pool** — expected `POST /api/pools/{poolId}/join` or existing equivalent. Must use `poolId` only; do not require a rollout/city instance ID. It returns persisted `ACTIVE`, `WAITLISTED` or `POOL_AND_WAITLIST_FULL` behavior based on global pool counts.

### Admin APIs

Reuse existing equivalents or implement the smallest consistent set:
- `GET /api/admin/pool-requests?status=PENDING`
- `GET /api/admin/pool-requests/{requestId}` if detail view needs it
- `POST /api/admin/pool-requests/{requestId}/convert`
- `POST /api/admin/pool-requests/{requestId}/reject`
- `DELETE /api/admin/pool-requests/{requestId}` or existing documented archive action
- `GET /api/admin/pools`
- existing create/update/publish/pause/close/archive pool routes
- `GET /api/admin/pools/{poolId}/members` (both ACTIVE and WAITLISTED statuses, with filters)
- `POST /api/admin/pools/{poolId}/members/{memberId}/remove` or existing equivalent
- `POST /api/admin/pools/{poolId}/promote-next` or existing equivalent.

### Response rules

Follow the repository's established response convention if consistent. Otherwise use:
```json
{ "success": true, "data": { "id": "...", "status": "PENDING" } }
```
```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Please check the required fields." } }
```

Use meaningful status codes: `201` for created records; `400/422` for invalid inputs; `401/403` for unauthorized/forbidden; `404` missing record; `409` full/duplicate/conflicting state; `500` unexpected server fault. Idempotent duplicate response may be 200 when it explicitly returns the pre-existing membership. Never return HTTP 200 for a failed DB write.

Public routes must never return SQL text, stack traces, secret config or other users' PII. Safe logs can include request IDs and error classes, not full phone numbers.

---

## 12. Validation, count invariants and concurrency

- Validate/trim title, name, normalized Indian mobile, consent and length server-side.
- Store one canonical phone representation; prevent same normalized phone from creating multiple active/waitlisted memberships for the same pool across city views.
- Enforce global pool-level caps in the database-safe write path: no more than 10 ACTIVE + no more than 5 WAITLISTED per pool.
- Counts must be derived from real authoritative membership rows or rigorously maintained counters with tested invariants. No client-supplied counters and no fake defaults.
- All city labels for a pool read the same count query and same pool-level status.
- Removing a city visibility label does not affect counts/memberships.
- A paused/closed pool cannot accept joins regardless of the city filter used.
- A removed member frees capacity exactly once; duplicate removals do not decrement twice.
- `Promote Next` atomically changes exactly one oldest WAITLISTED to ACTIVE only when active count < 10; no two concurrent actions can fill one available slot twice.
- A waitlisted person never appears as an active/confirmed member.
- Conversion and request retry must be idempotent.
- Use D1-supported atomic/conditional write or batch semantics appropriate to the installed Wrangler/Workers versions. Verify the actual behavior with concurrency tests, rather than assuming sequential application code is enough.

---

## 13. Mandatory diagnosis of current approval/delete failures

### Approval/conversion

Reproduce the current browser error and capture sanitized network/API evidence. Compare the form payload to the API schema, route method, authorization/session behavior, optional category handling, pool-city mapping write and request-status update. Determine whether the failure comes from missing table/column, wrong binding, stale status, FK mismatch, wrong request ID, partial batch behavior or UI parsing. Ensure request is not marked `CONVERTED` before the pool and city labels actually persist.

### Delete/archive

Test a real E2E pending request in local/staging. Verify correct ID/method, auth, SQL affected-row count, archive status, list query filter and page refresh. Test a simulated failure as well; the row must remain visible and error text must be truthful.

### D1 environment

Verify the local D1 binding and schema; do not assume successful local migration proves production schema. Use the supported local migration workflow, not a database reset. Missing tables and SQLite lock failures must be diagnosed, not hidden by fake data or generic empty states. A required mutation failure must fail clearly.

---

## 14. Required automated regression matrix

Add to the existing test style and use the real script names from `package.json`.

### Request form/API

1. Valid arbitrary free-text request with no category/product/city ID saves to real local/staging D1.
2. Request from an Indian town outside the 25 launch cities is accepted and retained as PENDING.
3. Missing title/name, invalid phone or missing consent returns 4xx and creates no record.
4. Retry/double-click is handled safely; no accidental duplicate for the same request operation.
5. Database failure shows an error, never false success.
6. Public API never returns another person's PII.

### Admin approval/delete

7. Unauthenticated request list/convert/reject/delete/archive is denied server-side.
8. Pending request remains visible after reload and is returned from Admin API.
9. Admin creates a pool with no category.
10. Admin can create/select an optional category.
11. Admin selects 2+ city labels but only one pool master is created and city mapping rows are unique.
12. Conversion links request only after pool, city mappings and status update succeed.
13. Simulated conversion failure leaves request pending and no orphan/duplicate pool.
14. Repeated conversion cannot create duplicate pool.
15. Reject persists rejected status and creates no pool.
16. Request archive removes it from Pending only after success and preserves history.
17. Failed archive/delete leaves the row visible and shows an error.
18. Request archive/delete never cascades into a linked pool or its memberships.
19. Pool archive preserves memberships and historical records.

### Shared pool count across city views

20. All India is the default and no city is silently preselected.
21. Exactly one authoritative public city filter exists; no conflicting dropdown.
22. Canonical configuration has exactly the 25 listed city labels.
23. One pool master with Delhi/Mumbai/Pune labels appears once in All India view and appears under each selected label.
24. The active/waitlist counts displayed for that pool are identical in All India, Delhi, Mumbai and Pune views.
25. Joining from different city-filter entry points uses the same `poolId` and global membership set.
26. Removing a city label affects visibility only, not count/membership.
27. Paused/closed pool cannot be joined from any city filter.

### Global capacity and waitlist

28. First 10 unique valid joins across any mix of city entry points become ACTIVE.
29. 11th–15th unique valid joins become WAITLISTED in FIFO order.
30. 16th current join is rejected with `POOL_AND_WAITLIST_FULL`; no 16th current membership is created.
31. Same phone joining the same pool through another city view returns existing status and does not add a row.
32. Concurrent joins racing for active slot 10 or waitlist slot 5 do not overbook.
33. Remove one active membership frees one slot exactly once.
34. `Promote Next` activates the earliest eligible waiting member only when a slot exists.
35. Duplicate/concurrent promote cannot activate two members for one slot.
36. At 10 active + 5 waiting, every city view shows the same full state and the same Request a Pool fallback.
37. Waitlisted people are never counted as ACTIVE.

### Build/security/data integrity

38. Run the actual lint, strict TypeScript, test suite, Next production build and OpenNext/Cloudflare Worker build.
39. Verify D1 migration from fresh local state and existing local data snapshot when feasible, preserving IDs.
40. Verify actual disk-backed local/staging D1 persistence; clearly label mock-based tests as mocks.
41. Check rate limits, server-side auth, no PII leaks, safe CSV/log handling if existing export features remain, and secret hygiene.
42. Validate responsive behavior at 320, 360, 390, 430, 768, 1024 and 1280+ widths.

Do not lower assertions or remove tests just to get a green suite.

---

## 15. Mandatory actual browser acceptance after build

**Unit/API tests are not enough.** Use Playwright or the browser automation actually available in this project/environment. First inspect `package.json`, installed browser tooling and available authenticated Admin test setup. Do not invent test commands or claim a browser run that did not execute.

### Safe test environment

- Run mutation E2E against local D1 or a dedicated staging database and a local/staging app URL.
- Do not create fake leads/members or destructive test records in production. If only production is accessible, perform read-only smoke checks and mark mutation E2E `BLOCKED`; do not claim the release gate passed.
- Use synthetic names/phone numbers reserved for test fixtures, not real people's contact details. Never print full phone data in reports/screenshots.
- At test start, create an E2E run ID and a manifest that tracks exact pool/request/member/category IDs created by this run. Tag test objects using a supported test marker/source field or an unambiguous title prefix; never rely on title prefix alone when IDs are available.

### Browser journey A — request → Admin → shared multi-city pool

1. Open the public homepage in a browser viewport and verify the initial location state is All India.
2. Open `Request a Pool`; enter synthetic requirement `E2E v7.3 <runId> — 2 kW rooftop solar`, synthetic name/phone, optional location text, consent; submit.
3. Verify success only after the API returns success. Inspect network request/status/response and query local/staging D1 to verify the saved `PENDING` request exists.
4. Refresh the public page and Admin session; verify the request remains persisted and appears in the pending list.
5. Attempt Admin request list/conversion via direct unauthenticated API as negative control; confirm 401/403 without exposing data.
6. In the actual Admin UI, review the request. Choose final title, no category (then repeat optional category path if practical), select at least Delhi + Mumbai + Pune labels, and explicitly `Create & Publish`.
7. Verify a single pool master ID exists, correct city visibility mappings exist, source request links to it and request status is `CONVERTED`. Verify no duplicate master or orphan mappings.
8. Reload Admin and public pages. Find the same pool under All India, Delhi, Mumbai and Pune; in All India, confirm it appears only once. Confirm city filtering only changes visibility, not counts.
9. Verify same published pool is joinable from city-tag views and each action submits the same pool ID.

### Browser journey B — global active capacity and FIFO waitlist

1. Through the real public join form/browser, submit 10 unique synthetic customers against the same pool, varying entry city view among Delhi, Mumbai and Pune. Verify all 10 become ACTIVE globally.
2. Verify all three city-filter pages and All India show the identical `10/10 active` count and `0/5 waitlist` before further joins.
3. Submit synthetic customers 11–15 through the public join form; verify each is WAITLISTED in server-time FIFO order.
4. Verify every city view shows the identical `10/10 active`, `5/5 waitlist` count.
5. Submit customer 16; verify truthful full response/UI, no membership row, and Request a Pool fallback. Inspect API/network result and database.
6. Retry one existing customer's join via a different city-filter view; verify it returns the existing membership and does not create a duplicate or change counts.
7. In Admin, remove one ACTIVE customer. Verify exactly one ACTIVE slot is freed and history is preserved.
8. Click `Promote Next` once; verify the oldest WAITLISTED member becomes ACTIVE, the next waiting person becomes first in FIFO order, active count returns to 10, waitlist count is 4, and global counts update identically in every city view. Re-click when active count is full and verify no extra promotion occurs.
9. Verify no phone/name information is present on public cards or public list API.

### Browser journey C — request/admin failure handling and deletion

1. Create another synthetic pending request through the public form.
2. In Admin, reject it and verify database/UI state after reload; test on a separate request so approval journey remains intact.
3. Create a disposable pending test request and use Admin `Archive/Delete`. Verify it leaves Pending only after successful server response and persists the correct archived/deleted state.
4. Exercise an invalid/nonexistent request ID and a simulated API/database failure if test injection exists. Confirm Admin does not show false success, the row is not optimistically removed, and errors are actionable without SQL/secret details.
5. Verify unauthenticated archive/delete and convert requests are blocked server-side.

### Browser evidence and pass requirements

Record environment URL (local/staging only), browser/tool and version if available, viewport sizes, exact test run ID, sanitized network statuses, returned IDs, database query results/row counts, screenshots without PII, and test command outputs. The browser gate passes only when UI, API and database agree on all critical outcomes. If browser automation cannot run, mark `NOT VERIFIED/BLOCKED`; do not substitute a screenshot of a static page or unit tests.

---

## 16. Post-test cleanup and fresh-state verification

“Fresh system” means no leftover synthetic E2E records from this run and a clean, honest public test environment. It does **not** mean erasing legitimate data.

### Before tests

- Capture a baseline of relevant local/staging pool/request/member IDs and safe record counts.
- Create the current run ID and write the exact IDs of every created request, pool, mapping, member, optional category and test-only audit row to an ephemeral test manifest. Keep it outside production artifacts and never include credentials/PII.

### Cleanup

- Always run cleanup, even when a browser scenario fails midway.
- Clean only the exact synthetic records from the current run, in dependency-safe order: current test memberships/waitlist records, test-only city mappings, test pool, test request, optional test category/test-only logs. Use the project's safe cleanup helper or exact-ID parameterized queries in a local/staging database.
- Check affected row counts. If an item has unexpected dependencies, belongs to pre-existing data or cannot be proven to be from this run, do not hard-delete it; isolate/archive and report the blocker.
- Never delete real requests/leads, pre-existing pools, membership history, production audit records or production data to make a fresh demo.
- Never reset D1, drop tables or run a broad `DELETE`.

### Verify clean state

- Re-query every ID in the manifest. Disposable E2E records must be absent or in an explicitly safe retained test-history state.
- Compare baseline vs post-cleanup. Pre-existing IDs and relevant counts must be unchanged; explain any exception with evidence.
- Run a read-only final browser smoke test: homepage, one city filter, request form load, Admin pending list, public pool listing, truthful global count state. Do not submit a real request in this cleanup smoke test.
- Run focused persistence tests after cleanup if cleanup might affect the test state.
- Remove temporary browser profiles, screenshots or manifests containing any sensitive details.
- If prior demo/sample records are found, delete only when positively identified as synthetic, environment is non-production, and deletion is safe. Otherwise preserve and report them.

---

## 17. Implementation and release phases — one autonomous run

Execute in order. Do safe work autonomously; do not stop after planning. If a gate is blocked after three targeted attempts, record exact evidence and continue independent safe work. Never claim a blocked gate passed.

### Phase 0 — Read-only preflight

- Verify repository/branch/HEAD/remote/working tree, project scripts and diff.
- Inspect current UI, route/API map, auth, D1 binding, migrations, tables, member/request relations and current live URL.
- Inspect `poolbuy.app` in browser if available; otherwise record reference as inaccessible.
- Record baseline data IDs/counts for local/staging and update Master Blueprint as-built status.

### Phase 1 — Master/spec reconciliation

- Update `MASTER_BLUEPRINT.md` to v7.3.0 shared-pool rules.
- Mark old per-city count/capacity logic and superseded community/category/login/payment features as deferred.
- Map existing screen/button → handler → API → table → status fields.
- Do not create a competing spec or erase historical facts.

### Phase 2 — Schema and safe migration

- Determine how existing memberships map to pool masters and how existing city rollouts were stored.
- Implement the smallest additive migration to `pool_id`-level membership and city visibility labels; backfill safely and preserve history.
- Reconcile possible over-limit historical memberships with explicit needs-review/history statuses; do not delete them or overstate current ACTIVE counts.
- Run local migrations and verify tables/indexes/foreign keys and real disk persistence.

### Phase 3 — Fix approval and delete bugs first

- Reproduce current approval/conversion error and request delete/archive failure.
- Fix the actual route/ID/auth/payload/schema/transaction/UI refresh root cause.
- Add regression tests before broad UI work.

### Phase 4 — Shared pool count and capacity logic

- Implement one pool master, many city visibility labels, one global membership set, one global ACTIVE count and one global waitlist.
- Ensure no code path counts memberships per city filter or uses city rollout IDs to join.
- Enforce 10 active + maximum 5 waitlisted across all city entry points; unique phone+pool current membership; FIFO manual promotion and correct removal.

### Phase 5 — Simple public/Admin UX

- Implement/repair one city selector with All India default, public pool cards, minimal Join Pool, free-text Request a Pool and empty/full/waitlist states.
- Admin can review request, reject, archive/delete, create pool with optional internal category, select multiple city labels, publish/pause/close/archive pool and manage the one shared member/waitlist list.
- No public category selector, city-specific counters, customer login, auto-created pool or complex location flow.

### Phase 6 — Automated test/build gates

Run actual configured scripts from the repository. At minimum, where available:
- tests (e.g. `npm test` or package.json equivalent)
- lint (e.g. `npm run lint`)
- strict TypeScript (e.g. `npx tsc --noEmit` if correct)
- Next production build (e.g. `npm run build`)
- OpenNext/Worker build (e.g. `npm run build:worker`)

Record exact commands, exit codes, counts and environment. Never assume names; inspect scripts first. Fix root causes, not tests. Run relevant checks after each meaningful fix.

### Phase 7 — Mandatory actual-browser acceptance

Execute Browser Journeys A, B and C in Section 15 against local/staging with actual persisted D1. Inspect UI, network and DB evidence. If a test fails, fix the root cause, rerun it and adjacent regression tests, then rerun the relevant full gate. Maximum three focused attempts for the same failure; then mark blocked.

### Phase 8 — Cleanup and final-state check

Execute Section 16 exact-ID cleanup regardless of whether all E2E checks passed. Verify real/pre-existing rows preserved and no synthetic E2E pools/leads remain in the public test environment. Run final read-only smoke test.

### Phase 9 — Git commit and push

Only after code review, tests and safe diff checks:

1. Recheck `git status`, full diff, `git diff --check`, staged changes and generated artifacts.
2. Scan staged/committed diff for secrets without printing values. Confirm `.env.local`, `.dev.vars`, tokens, credentials, local DB files, test manifests/screenshots and `.open-next` outputs are not accidentally committed unless the repo explicitly tracks a supported build artifact.
3. Preserve unrelated user changes; stage only coherent files for this task.
4. Confirm correct branch and remote; fetch remote state before pushing. Verify remote has not diverged.
5. Commit the coherent implementation with a clear message (do not amend unrelated commits), then push using a normal non-force push to the configured branch (expected `main` only if verified appropriate).
6. Verify remote contains the intended full SHA and report push result. If auth/protected branch/divergence blocks push, do not force; report exact blocker. It is acceptable to complete local safe work while Git push remains blocked.

### Phase 10 — Cloudflare migration and production deploy

Deployment is required when the repository/operator environment has valid authorized access, but it must obey these gates:

1. Verify Cloudflare identity using `npx wrangler whoami`; if not authenticated, run the documented local login flow or stop at the blocker. Never ask the user to paste tokens into chat or print tokens.
2. Inspect actual `wrangler.jsonc`/`wrangler.toml`, account/environment, Worker name, routes/domains, D1 binding and database IDs. Confirm the exact target is the intended production environment; don't infer from a database name alone.
3. Prior repository logs indicated historical credential exposure and required rotation. Confirm the owner/operator has rotated exposed Cloudflare/API/JWT secrets through official dashboards and the currently configured secrets are the replacements. Do not claim rotation without evidence. If this prerequisite is unverified, do not deploy production.
4. Inspect remote migration state read-only. Review every pending migration against actual production schema/data. No reset/drop/seed/bulk rewrite. Apply only reviewed additive, backward-compatible required migrations to the verified target using the project's supported Wrangler D1 migration command; if the migration could destroy/rewrite data or target identity is uncertain, stop and report.
5. Run the release build again from the exact commit intended to deploy. Ensure OpenNext output is fresh and generated successfully before `wrangler deploy` or the project's configured deploy script. Never deploy missing/stale `.open-next` output.
6. Deploy through the actual repository's configured Cloudflare process. Do not invent an account, Worker, domain or route. Capture real Worker deployment version/revision and URL from command output/dashboard/known configuration.
7. Verify deployed revision matches the pushed commit as far as the platform/build metadata allows. Check actual runtime health and public routes, request form loading, public pool listing and protected Admin auth boundary. Run safe read-only smoke checks against production. Mutation journeys stay on staging/local; never create synthetic leads or fill the live waitlist in production.
8. Verify D1 binding/schema and key reads against the correct deployed environment. A successful CLI deploy is not proof the Worker serves healthy routes.
9. If any credential, migration, target, build or runtime gate fails, do not call production ready. Keep the pushed code if that push was safe, document deployment as blocked, and give the precise next operator action. No unapproved DNS cutover, destructive migration, real customer messages or real money operation.

### Phase 11 — Master record and final report

- Update `MASTER_BLUEPRINT.md` as-built record after each phase and at completion.
- Report local/staging test state separately from production deployment state.
- Mark every requirement `PASS`, `PARTIAL`, `FAIL`, `BLOCKED` or `NOT VERIFIED` with evidence.

---

## 18. Final acceptance checklist

The MVP is complete only when every item below passes or a blocker is explicitly reported:

- [ ] Customer can submit free-text request from anywhere in India without category/product dropdown, mandatory city directory, login or OTP.
- [ ] Admin sees the saved request after refresh, can reject/archive it, and can convert it into a pool only through explicit Create & Publish.
- [ ] Conversion creates exactly one pool master; multi-city selection adds visibility labels only, not duplicate pools or separate counts.
- [ ] The pool appears once in All India and under every selected city filter.
- [ ] The same pool count is identical in every city view and API response.
- [ ] Any 10 unique current members across all cities become ACTIVE; the next 5 become WAITLISTED; the 16th is rejected without a row.
- [ ] Duplicate phone joins from another city view return existing status and do not increment counts.
- [ ] Remove/withdraw frees capacity exactly once; manual Promote Next follows FIFO and does not overfill.
- [ ] Request approval, request delete/archive, pool archive, join and promotion work via UI/API/database with honest errors.
- [ ] Automated tests pass; lint, strict typecheck, Next build and Worker/OpenNext build have actual evidence.
- [ ] Actual browser journeys A/B/C pass against local/staging and DB queries corroborate network/UI outcomes.
- [ ] All E2E-created records are safely cleaned by exact IDs; pre-existing data remains unchanged; no test artifacts remain in public test listings.
- [ ] Secrets scan passes; Git commit/push is verified or the blocker is reported.
- [ ] Production D1 migrations and Cloudflare deploy are verified, or correctly marked blocked because auth/rotation/migration/runtime prerequisites are not met.
- [ ] `MASTER_BLUEPRINT.md` documents the v7.3.0 intended scope and evidence-based as-built status.

### Final report must include

1. Actual branch, full HEAD SHA, working-tree state, remote sync and push result.
2. Files/functions changed and migration names/schema backfill summary.
3. Exact test/build commands, exit codes, test/suite counts and environment.
4. Browser tool/browser version if available, local/staging URL, run ID, journeys passed/failed and sanitized evidence.
5. Real database persistence proof and confirmation that all city views show one global count.
6. Join results: 10 ACTIVE, 5 WAITLISTED, 16th rejected, duplicate cross-city join blocked, FIFO promotion result.
7. Request conversion/delete/archive API status and persisted DB outcomes.
8. E2E cleanup manifest summary, pre/post baseline comparison and confirmation that real/pre-existing rows were preserved.
9. Secret scan result and credential rotation status (never include secrets).
10. Remote D1 migration status, deployed Worker revision/URL only if verified, runtime checks and remaining blockers.
11. Confirmation that `MASTER_BLUEPRINT.md` implementation record was updated.
12. One honest final verdict:
   - `READY FOR PRODUCTION`
   - `READY FOR LOCAL/STAGING VERIFICATION`
   - `NOT READY / BLOCKED`

**Start with Phase 0 now. Execute all safe phases autonomously. Do not request a new prompt for each phase. Do not claim browser, database, Git push or production deployment success unless actual evidence proves it.**
