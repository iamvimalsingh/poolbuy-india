# GroupBuying / PoolBuy India — Master Product, System Architecture & Acceptance Blueprint

**Document ID:** PBI-MASTER-004  
**Version:** 4.0 (Consolidated after 28 October 2026 forensic audit)  
**Status:** Canonical implementation contract for the MVP  
**Primary visible brand:** GroupBuying  
**Legacy/continuity name:** PoolBuy India  
**Planned canonical origin:** `https://groupbuying.store` (not live until verified/configured)  
**Current implementation direction:** Existing Next.js + OpenNext + Cloudflare Workers + Cloudflare D1 architecture, subject to verification against the actual repository before implementation  
**Last updated:** 28 October 2026

---

## 0. Authority, precedence and operating rules

This file is the **single authoritative product and implementation specification** for PoolBuy India / GroupBuying MVP. `AGENTS.md` must be a short pointer to this file and must not maintain a second competing set of product rules. The current forensic audit is evidence about the inspected working tree as of its audit time, not a guarantee that the code has not changed since then.

Precedence rules:

1. This v4.0 blueprint contains the latest owner-approved business rules and overrides contradictory older specifications.
2. Actual repository files, Git state, package scripts, installed versions and configuration determine the implementation details. Re-inspect them; do not assume that the audit's branch or stack still matches the current workspace.
3. Existing working functionality and user changes must be preserved unless directly inconsistent with this blueprint or proven unsafe/incorrect.
4. Never blindly reinitialize the app, reset a database, rewrite Git history, force-push, or perform destructive production changes.
5. The implementation agent should progress through all phases in one autonomous task, without requesting user approval after every phase. Stop only for a hard blocker that cannot safely be resolved locally, a missing credential/external configuration, an irreversible operation outside the explicit authorization, or the bounded retry limit.
6. Do not fabricate PASS results. Every acceptance item must be PASS, FAIL, PARTIAL or NOT VERIFIED with evidence.

## 1. Product definition and boundaries

GroupBuying is a pan-India, city-aware demand aggregation and group-buy coordination platform. Customers express interest without creating an account. PoolBuy/GroupBuying aggregates demand, helps obtain and verify quotations, shares coordination updates, and connects interested customers with suppliers or other participants when the Admin approves the handoff.

The platform is a facilitator, not the product seller, manufacturer, payment escrow, lender, legal adviser, land/property broker, or guarantor of discount, stock, price, delivery, warranty, or vendor performance. Customers decide independently whether to buy from a PoolBuy-recommended supplier, use a customer-provided better quote, or purchase elsewhere.

Out of MVP scope: customer login/OTP/passwords/dashboard, vendor portal, wallet, escrow, in-app product checkout, product inventory, automated refund engine, automatic payment gateway, automatic WhatsApp sending, automatic WhatsApp group creation, and complex CRM/loyalty/referral features.

Admin access remains protected by the existing server-verified passkey/session design, subject to security verification and repair.

## 2. Brand and public messaging

- Primary visible brand, wordmark, organization name and structured site identity: **GroupBuying**.
- Preserve useful `PoolBuy India` references, existing stable URLs and relevant SEO context where natural. Do not use a blind global replace; do not make it look like a competing primary brand.
- Planned homepage title: `GroupBuying | Local Group Buying in India`.
- Planned homepage H1: `Bring local buyers together.`
- Supporting message: `Start or join a buying group in your city. Build collective demand, explore available quotations and decide together where to buy.`
- Primary CTA: `Start a Group Buy`; secondary CTA: `Explore Local Groups`; product request CTA: `Suggest a Product`.
- Joining/expressing interest is free before the post-target coordination stage. A target does not guarantee a discount or vendor quote.
- Do not claim verified savings, guaranteed availability, authorization, subsidy, warranty or seller status without evidence.

## 3. Authoritative architecture decision

The forensic audit found that the existing repository has active Cloudflare Workers/OpenNext/D1 implementation files, alongside legacy Supabase migrations/client files and a blueprint that still named Netlify + Supabase. The current intended direction for this MVP is:

- **Frontend/server application:** Keep the existing Next.js App Router, React, TypeScript and Tailwind CSS v4 setup. Preserve the installed versions and current root `app/` architecture.
- **Runtime/hosting:** Cloudflare Workers through the existing OpenNext adapter and configuration, if the current repository inspection confirms this is still the active intended runtime.
- **Persistence:** Cloudflare D1 SQLite as the one active application database for the MVP.
- **Demo mode:** The existing explicit local/demo mock store may remain for local development only and must be clearly labeled.
- **Supabase/Netlify:** Treat the existing Supabase migrations and client code as legacy/historical, not a second active data path. Do not connect to, migrate to, or deploy Supabase merely because old files exist. Before removing or archiving any legacy files, search all imports, scripts, documentation and tests. Preserve historical migration evidence when removing it would risk losing useful schema or data definitions.

This architecture decision does not mean that remote D1 persistence has already been verified. Use the configured D1 staging/production binding only where access and credentials exist. Until proven with real remote reads/writes in an authorized non-production/staging environment, remote persistence is **NOT VERIFIED**. Do not claim production persistence from an in-memory D1 proxy test.

Do not add a custom Express server, a second database, a new ORM or a large state-management library. Use existing code patterns unless a verified defect requires a minimal adjustment.

## 4. Customer website and public UX

### 4.1 Homepage and discovery

Required flow:
1. Compact header with GroupBuying, Explore Groups, How It Works, Blog/Guides if already implemented, Start a Group Buy, and one authoritative state/city selector.
2. General group-buying hero; don't narrow the entire business to solar, power backup or water softener products.
3. Configurable popular-city shortcuts. These indicate selectable cities, not evidence that a city has live groups.
4. Admin-managed product category grid.
5. Simple how-it-works section: select city/product → join/propose group → demand accumulates → review available quotations and choose whether/how to connect.
6. Current-city group list.
7. Start a Group Buy / Suggest a Product alternatives for unsupported products/cities.
8. Clear trust, fee, vendor and privacy disclosures.

The header selector, shortcuts and catalog filters must share one source of truth. Manual city selection must always work. Browser geolocation may be optional and permission-based; do not infer city invisibly from IP.

Show only published, eligible groups for the selected city. If a city has no eligible groups, show a truthful empty state. Never show mock data as real offers or mix other cities' pools into the selected city.

### 4.2 State, city and operational readiness

Keep a State/UT → City/Town directory with stable identifiers/slugs. A proposed “Other city/town” is reviewed by Admin and does not become operational automatically. A city being selectable does not assert that suppliers, delivery, installation or live groups exist there. Use an explicit operational readiness state such as `NOT_YET_AVAILABLE`, `DEMAND_COLLECTING`, `OPERATIONAL`, or an equivalent backward-compatible field.

The **national demand overview** is required in the Admin dashboard. It aggregates counts from actual city pools, without merging separate city pools into a fictitious single supplier order. Public pages remain city-first; any public national total must be based on real, non-demo records and be clearly defined. Do not invent counts.

### 4.3 Propose a group / suggest a product

A visitor may submit a group proposal without an account. Capture only sufficient fields: product/group title, State and City/Town, optional approved category or free-text “Other”, short requirements, bounded target size, optional requested timing/deadline, contact name/mobile where follow-up is needed, and clear contact/privacy consent.

A proposal enters `PENDING_REVIEW`; it is not public until Admin approves it, creates a draft pool and explicitly publishes that pool. Proposal acceptance and group publication are separate actions. Preserve the source-request link and review history. Reject or route ambiguous, unsafe, land/property and legal-service proposals to review; never force unrecognized free text into a fixed enum.

### 4.4 Join an existing pool

No customer account, OTP, login, password, logout or dashboard.

Simple customer interest fields:
- Name.
- Indian mobile/WhatsApp number.
- Product/pool is inherited from the selected pool.
- City is authoritative from that pool; do not allow a form field to override it. Show the city context to the customer.
- Capacity/variant selection if the pool offers multiple actual variants.
- The required communication/connection consent choices described in Section 10.
- Locality/PIN only when genuinely required for the particular product/service.

Do not require a long questionnaire. Existing quote information may be given to Admin later or shared in an opt-in connection; do not make it mandatory just to express interest.

On successful new interest, show a truthful success message. On duplicate, say the interest for this pool is already counted and do not create another record or increment any count. Customer cannot self-withdraw or edit after submission in the MVP; Admin can correct, exclude, archive/delete only under the controlled rules in the Admin section.

## 5. Product, pools, variants and demand model

A pool represents one product/group in one city. A pool may support multiple fixed or configured variants (e.g. solar 2 kW, 3 kW, 5 kW) without creating separate city pools just because variants differ.

Each pool needs:
- Product/category, State/City, title/slug and specification.
- Publication/lifecycle status.
- Admin-defined active capacity.
- Admin-defined combined demand target.
- Optional Admin-defined target per variant.
- Admin-defined maximum waitlist size.
- Created/published/deadline fields if used.
- Combined interest/active counts and variant-wise breakdown derived from reliable records.
- Separate connection/payment status; reaching a demand target never creates an order or payment by itself.

Separate the following counts in Admin reporting:
1. Total unique interest accepted.
2. Active pool participants occupying capacity.
3. Paid-ready participants (manual payment verified).
4. Waitlisted participants.
5. Excluded/closed/already-purchased records, counted separately and never included as active demand.

Counts must be derived consistently from source records or transactionally maintained. Prefer computed queries/views or existing reliable aggregate methods over duplicated counters that can drift. Never add an additional denormalized counter without tests and a transaction/update strategy.

Combined and per-variant demand targets are **signals**. When either target is reached, make an Admin alert/indicator available. Do not automatically approve an offer, collect a fee, mark a payment, select a supplier, connect customers or transmit customer details.

## 6. Duplicate prevention and participation policy

Normalize Indian mobile numbers consistently before any lookup/storage. Apply database-backed uniqueness for one active interest per normalized number per pool, using the existing compatible key where possible (expected logical key: `(pool_id, normalized_whatsapp_number)`). The selected variant is an attribute of this interest, not a second independent customer count. If the same person wishes to select another variant, Admin can safely update the existing record with history; do not let one mobile inflate the pool count by joining multiple variants.

Duplicate handling must be race-safe at the database/transaction boundary, not just a client-side pre-check. A duplicate returns the existing participation/buyer reference and current safe counts. Do not expose whether other people have registered.

The customer cannot self-withdraw or use a self-service account. Admin may mark `ALREADY_PURCHASED`, `EXCLUDED_BY_ADMIN`, `CLOSED`, or another approved status and may delete an invalid/duplicate record only where dependencies and retention requirements permit. `DO_NOT_CONTACT` is a communication preference, **not automatically a demand-exclusion status**. Do not decrement active demand merely because someone opts out of messages.

Re-registration policy for excluded people: retain the existing row/history and allow reactivation/update by Admin. If the system later needs to accept a fresh registration after a genuine exclusion, implement a tested reactivation policy without deleting audit evidence. Do not leave an accidental uniqueness constraint that creates an unexplained dead end.

## 7. Pool capacity and FIFO waitlist

- Admin defines active capacity and waitlist limit independently for every pool.
- When a pool reaches its active capacity, additional valid submissions may enter the FIFO waitlist only if the configured waitlist has room. If full, show an honest “pool and waitlist full” state.
- The waitlist stores creation time, position or stable FIFO ordering, pool link, selected variant and customer consent metadata.
- A waitlisted customer does not count toward active capacity or paid-ready total until promoted and accepted.
- If an active participant is excluded or marked already purchased, update the active count exactly once and record the transition. Do not decrement for `DO_NOT_CONTACT` alone.
- Admin can promote the next eligible waiter manually. Promotion must verify capacity in the same transaction/guard as the status change. Never increment above the configured capacity.
- Recalculate or safely update counts in the same transaction. Add regression tests for exclusion → promotion, repeated exclusion, repeated promotion, capacity full, waitlist full and duplicate joins.

## 8. Supplier quotes and customer-provided better quotes

Admin controls the quotations published as official offers. A quote is attached to the correct product/pool, city, variant/scope and supplier/reference, with issue date, validity/expiry, verification status, inclusions and exclusions.

Track price components as structured fields where practical: product amount, GST, delivery, installation, warranty/after-sales terms and other applicable charges. Unknown/unconfirmed amounts must be “not confirmed”, not zero. If migration to structured columns is expensive, use a typed, validated structured representation with adequate tests rather than an opaque text blob.

Price labels are driven by data/status:
- Unknown.
- Indicative estimate — final price may differ.
- Quote received; not yet verified.
- Verified supplier quotation (only with evidence, date, scope and valid expiry).
- Expired/withdrawn.

Do not display savings unless the market and offered prices are comparable, verified and approved for display. Never invent MRP, discounts, subsidy, stock, warranty, authorization or delivery availability. Do not expose private dealer notes, sensitive negotiation details or payment URLs in public API payloads.

If a customer says they have a better quotation, provide a simple manual path: they may share it with Admin, or share it with members only inside an opt-in connection group. Admin reviews any quote before the platform labels or promotes it as verified. PoolBuy does not force a supplier choice.

Every quote revision/approval/expiry creates history/audit evidence. Expired offers are not current and cannot be republished without reverification and approval.

## 9. Confirmation/coordination fee and manual payment

The owner-approved proposed MVP formula is:

`confirmationFee = max(round-to-nearest-rupee(0.001 × approvedPurchaseValue), ₹99)`

In ordinary terms: **0.1% of the Admin-approved purchase-value basis or ₹99, whichever is higher.** Display INR without paise unless a specific approved quote requires otherwise.

Rules:
- Do not request a fee for an initial interest submission.
- Request it only after the Admin-defined active pool capacity is reached and the coordination service/approved quotation workflow is ready.
- The purchase-value basis must be an explicitly saved value from the relevant Admin-approved quotation/terms and must be visible to the customer before requesting payment.
- No fallback basis such as an invented ₹130,000. If no approved basis exists, fee calculation/payment request is disabled and the Admin must complete the quotation terms first.
- Explain that the fee is for pool formation/coordination, not product payment, and does not force the customer to buy from any supplier or guarantee a discount.
- Payment is manual in the MVP: show Admin-approved payment instructions; Admin verifies the payment and records a reference/time/audit event before marking `PAID_READY`. A screenshot or customer assertion alone is not verified payment.
- Do not build an automatic payment gateway, wallet, escrow, card/UPI credential handling, or automatic refund system in this MVP.
- The intended service policy is a clearly disclosed non-refundable coordination fee once the disclosed coordination service is provided, only to the extent permitted by applicable law. Publish fee/service/cancellation terms before payment and block public fee collection until the operator's legal/trust review is complete. Honor any refund required by law or an approved exceptional resolution; never make an unsupported legal conclusion.
- A fee payment does not mean that the product has been purchased.

## 10. Consent, WhatsApp, privacy and supplier handoff

Collect separate, unambiguous choices for:
1. Contact needed to administer this pool/request.
2. Invitation to an opt-in WhatsApp group OR individual direct introduction (the customer can decline group participation).
3. Any necessary disclosure that selected contact information will be shared with a supplier/other opted-in participants for the stated purpose.

If a customer opts for a WhatsApp group, show an explicit warning before consent: **other group members may be able to see the customer's phone number/profile information**. Do not add a customer to a group by default. Keep consent type, timestamp/version and choice with the participation record. Do not infer vendor/member sharing consent from basic interest submission alone.

WhatsApp implementation is manual click-to-chat only:
- Construct validated `https://wa.me/<international-number>?text=<URL-encoded-message>` URLs from normalized stored numbers and safe templates.
- A human reviews and sends the message; do not claim automatic sending.
- Respect `DO_NOT_CONTACT`/opt-out in all contact actions.
- No automated bulk sends or programmatic WhatsApp group creation.
- For customers who decline the group, Admin can make a consented individual introduction.

Supplier handoff is explicitly Admin controlled. The recommended default is only relevant `PAID_READY` customers whose required data-sharing/connection consent exists. Admin must manually mark the pool Ready and approve handoff. Only share minimum necessary data for the selected pool; never export/send the entire database automatically. A target reached or paid status alone does not trigger a supplier transmission.

## 11. Customer/member lifecycle and status model

Do not overload a legacy status to mean multiple things. Maintain separate dimensions for pool lifecycle, member participation, communication preference, quote lifecycle and connection/payment lifecycle.

Pool/public lifecycle may include:
- `DRAFT`
- `ACTIVE` / accepting interest
- `TARGET_REACHED` as a recorded milestone (not automatic deal confirmation)
- `CLOSED` / expired
- `ARCHIVED`
- `SOFT_DELETED` / hidden from public listings

Proposal lifecycle may include:
- `PENDING_REVIEW`
- `NEEDS_INFORMATION`
- `APPROVED_TO_DRAFT`
- `REJECTED`
- `CONVERTED_TO_POOL`

Member/interest lifecycle may include existing equivalents for `INTERESTED/ACTIVE`, `WAITLISTED`, `OFFER_SENT`, `PAYMENT_PENDING`, `PAID_READY`, `CONNECTED`, `ALREADY_PURCHASED`, `EXCLUDED_BY_ADMIN`, `CLOSED`. Preserve backwards compatibility with current enums/status values through an explicit mapping. `DO_NOT_CONTACT` is separate preference, not a substitute for status.

Connection/payment lifecycle is separate from pool publication and may include `NOT_READY`, `ADMIN_REVIEW_PENDING`, `TERMS_READY`, `PAYMENT_PENDING`, `PAID_READY`, `READY_TO_CONNECT`, `CONNECTED`, `COMPLETED`, `CANCELLED`, `DISABLED_NOT_CONFIGURED`, or equivalent compatible fields.

## 12. Admin console — complete MVP requirements

### 12.1 Security and overview

- Preserve and verify the existing passkey + signed HTTP-only session design. Every `/api/admin/**` read, write, export, WhatsApp URL, quote, payment and handoff action independently checks the server-side session.
- Verify CSRF/Origin for mutations, use no-store for private responses, validate input and rate-limit login/public submissions using a solution suitable for the active platform. Do not call an in-memory rate limiter production-grade on a distributed/serverless runtime.
- No development default admin passkey. Missing secrets must fail closed.
- Dashboard uses live repository-derived metrics for active pools, proposals pending review, target-reached, connection pending, paid-ready, waitlist and closed/archived. Include national overview with city-wise drill-down. Clearly show demo/live mode.

### 12.2 Pool manager

Create/edit draft, view detail, publish/unpublish, close, extend deadline with reason, clone to a different city as an independent pool, configure capacities/targets/waitlist, manage variants, archive/restore/soft-delete, view history and target alerts. Changing city must never move existing customer records into a different city. Clone creates independent counts, variants, quotes, deadlines and cohort data.

Permanent delete only for an unused dependency-free draft/test record after two-step confirmation and a server-side dependency recheck. If members, waitlist, quote history, fee/payment, request or audit dependencies exist, block permanent deletion and use archive/soft-delete.

### 12.3 Members/lead management

Search/filter/paginate by pool, city, variant, status, join date and consent. Show buyer reference, name, authorized phone details, join date, selected variant, consent preferences and safe Admin notes. PII is visible only to authorized Admin. Admin can correct statuses, exclude invalid records, mark already purchased, manage contact eligibility, verify fee payment and promote eligible waitlisted customers. Each material action has an audit record.

### 12.4 Requests, categories and location

Review proposals, request more information, approve/reject, create a draft pool and explicitly publish. Manage States/UTs, cities/towns, operational readiness, popular city shortcuts, approved categories and category visuals. Directory presence must not imply live availability.

### 12.5 Quote, fee and handoff control

Manage quote status/source/date/scope/cost breakdown/validity/history. Approve the fee basis and preview the exact customer disclosure. Disable payment request without approved basis/terms. Manually record payment reference and verified timestamp. Admin explicitly marks pool Ready and approves the consent-filtered individual/group connection/supplier handoff.

### 12.6 Audit and exports

Record pool creation/edit/publish/close/archive/restore/delete, capacity/target/variant changes, member status/consent updates, quote changes, fee basis and payment verification, exports and supplier-handoff decisions. Include actor, timestamp, relevant IDs, reason and safe before/after values; never log secrets or unnecessary full phone lists.

CSV export is admin-only, honors filters, uses UTF-8/RFC-4180 escaping and neutralizes spreadsheet formula injection. Never put secrets or PII into logs.

## 13. Database and API requirements

The active runtime database is D1, if verified during workspace preflight. Use additive, versioned SQLite migrations. Do not reset, drop or recreate an existing database as a shortcut. Inspect existing D1 migrations and data access before making schema changes.

D1 must persist:
- Pools, product/category/city data and operational status.
- Pool variants/fixed kit offers and the selected variant on each unique lead.
- Leads/interest, explicit consent/preferences, lifecycle statuses, waitlist.
- Supplier quotes and price components/validity/history.
- Connection/fee configuration and manually reconciled payment status/reference.
- Audit history.

The audit found D1 missing `pool_kit_offers`/`vendor_price_tiers` tables found in legacy Supabase migrations. Add the D1 tables/mappings only if verified to be required by the final model; tier discounts are not essential to the simplified MVP unless current approved product requirements use them. Variant persistence is required.

All persistence mutations must be transactionally safe. Public joins never write from browser code directly to D1; they go through validated server routes. Public API payloads must exclude Admin notes, private vendor offers, payment references/links and PII not necessary for the public user.

Preserve existing logical routes where possible. Adapt the current API rather than creating duplicate competing handlers. Every route validates shape, length, enum, number range and allowed URL scheme, returns consistent safe errors/statuses and applies cache rules. Never return stack traces or SQL errors.

## 14. Security blocker: secrets and dependency integrity

The 28 October audit reports actual secret-looking values in the unstaged `.env.example`, while `.gitignore` deliberately allows `.env.example` to be committed. Treat the values as sensitive and do **not** print or copy them into reports, command output, commit messages, generated docs, test snapshots or chat transcripts.

Before any Git push:
- Inspect secret files without echoing values.
- Ensure `.env.example` contains placeholders only.
- Ensure local secret files such as `.dev.vars` / `.env.local` are ignored and never staged.
- Search staged files and diffs using a redacting secret scan.
- Determine whether the reported values were ever pushed to a remote; if they were exposed, require rotation/revocation before production launch.
- Do not attempt to “fix” this by merely hiding the file or disabling all ignore rules.
- If credentials are only present in `.env.example`, do not silently destroy the only working runtime configuration: verify the actual local/deployment secret store first, preserve local operation in an ignored secret location without printing values, sanitize the template, and require rotated production secrets before live release.

The audit reports 28 TypeScript TS7016 errors due to missing declarations for `lucide-react@1.61.0`. Diagnose the installed package, lockfile, resolution and type entry point. Fix the root cause while preserving correct types. Do not paper over it with a blanket `declare module` returning `any`, `skipLibCheck`, or an arbitrary dependency upgrade without inspection.

## 15. Demo/live and environment rules

- Demo/mock data must visibly say `Demo data — not a live dealer offer` and must not be described as real leads, real quotations or remote persistence.
- In configured live mode, database/API failure must return an honest error; never silently substitute demo data or claim that a write succeeded.
- Production mode with missing D1 binding/secrets must fail closed for writes and admin actions.
- Never expose Admin passkey/session secret, Cloudflare credentials, service credentials or private quote/payment fields in client code.

## 16. Visual, responsive, accessibility and SEO requirements

- Professional, trustworthy light UI with readable typography, restrained accent colors, consistent spacing and real empty/loading/error/success states. Retain strong existing UI if it already meets the requirements; do not redesign needlessly.
- No horizontal overflow at 320, 360, 390, 430 and 1280+ px. Desktop uses available width sensibly. Mobile CTA/sticky elements do not cover form controls or safe areas.
- All inputs have visible labels, accessible validation messages, keyboard-operated dialogs, Escape/close/focus behavior, visible focus rings, sufficient contrast and descriptive alt text.
- All controls perform the advertised action or are disabled with an explanation. No dead links, fake saved states or TODO stubs in core paths.
- Only real, useful published groups can be indexable. Draft/request/admin/API/empty low-value city pages must not appear in sitemap as if they were offers.
- `GroupBuying` is the primary site identity; canonical origin uses `https://groupbuying.store` only after real deployment/domain configuration. Do not claim Search Console, analytics or domain setup is complete unless verified.

## 17. Acceptance test matrix

At minimum, automatically test and browser-verify:
1. New proposal → pending review → Admin approval → draft pool → explicit publish.
2. City selector and shortcuts synchronize; selected city never shows another city's pools.
3. New interest submission persists in real D1/staging mode; demo mode clearly states data is local.
4. Duplicate phone submission returns existing interest and does not increment any count.
5. Variant options persist through restart/refresh and combined/variant counts are correct.
6. Combined target and variant target produce Admin signals only; no automatic order/payment/handoff.
7. Pool active capacity reached → waitlist behavior; waitlist max blocks excess submissions honestly.
8. Excluding one active record updates counts once; `DO_NOT_CONTACT` alone does not reduce demand.
9. Exclusion → manual FIFO promotion returns count to correct capacity; repeat operations are idempotent.
10. Quote price/cost fields, verification/validity labels and expiry are truthful; no stale quote is shown as current.
11. Fee formula examples and no-approved-basis fail-closed behavior.
12. Manual payment verification requires Admin reference/explicit action and creates audit history.
13. WhatsApp group choice shows number-visibility disclosure; individual introduction works; no group consent means no group-handoff action.
14. Supplier handoff requires Admin approval and only includes relevant consenting paid-ready participants.
15. Admin API rejects unauthenticated reads/writes; public APIs never expose member/vendor/payment PII.
16. CSV filters/export and formula-injection tests; `DO_NOT_CONTACT` has no contact action.
17. Archive/delete dependency guards; audit history preserved.
18. Mobile responsive checks at 320, 360, 390, 430, 1280+ px.
19. Build, lint, TypeScript, all existing tests, and new regression tests.
20. Staging binding/migration dry-run or real staging verification where credentials/access exist. Production remote persistence remains NOT VERIFIED if no live authorized check is available.

## 18. Gate/priority rules

**P0 release blockers:** TypeScript/build failure; hardcoded secrets in any staged/template file; broken authentication/authorization; accidental PII exposure; failing production build; unverified configuration represented as live; unsafe destructive operation.

**P1 core workflow:** variant persistence; count/target/waitlist correctness; WhatsApp privacy/consent choice; obsolete fee/token copy; fee-basis fallback; correct manual payment/handoff statuses; city isolation.

**P2 hardening:** production-suitable rate limiting, structured quotation costs, query efficiency and non-critical admin UX.

**P3 polish:** nonessential visual/doc cleanup, only after the core gates pass.

No P0/P1 may be left FAIL at release. P2 items that materially affect authentication, customer data, abuse or pricing must also be fixed before production; purely non-blocking P2/P3 gaps may be documented with explicit reasons. Never call the MVP Ready if remote persistence, production secrets, or live deployment prerequisites are not verified.

## 19. One-shot autonomous execution protocol

The companion `ANTIGRAVITY_ONE_SHOT_LOOP_PROMPT.md` instructs the IDE agent to execute all phases in one task. The agent must maintain a progress/acceptance report in the workspace, continue without requesting per-phase approval, run targeted and full regression loops, and stop only at a hard blocker or retry limit. Do not deploy or push until the secret scan, build, tests, repository diff review, and the applicable staging/release gates pass.

### End-of-task report must include

- Actual chosen stack and current branch/commit.
- Changed files grouped by phase.
- Migrations applied locally/staging/production, stated separately.
- Every command actually run with exit status.
- Acceptance matrix PASS / PARTIAL / FAIL / NOT VERIFIED with evidence.
- Browser tests and viewports actually checked.
- Test/build/lint/type-check results.
- Secret scan result without exposing secret values.
- Git commit/push/deployment status, exact deployed target if verified, and limitations.
- A clear release verdict: `READY`, `READY WITH CONDITIONS`, or `NOT READY`.

**End of canonical blueprint v4.0.**
