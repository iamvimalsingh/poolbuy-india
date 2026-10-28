# GroupBuying — MVP Scope, Product Rules & Acceptance Plan

**Document:** `MVP.md`  
**Version:** 1.0 — owner-approved product direction, 27 October 2026  
**Primary brand:** GroupBuying  
**Canonical host planned:** `https://groupbuying.store` (domain setup deferred until launch)  
**Legacy term:** PoolBuy India may remain in existing URLs and natural, relevant content for continuity/search intent. Do not erase it globally.  
**Planned hosting:** Netlify + Supabase; neither production deployment nor a Supabase project exists yet.  
**Companion specification:** `MASTER_BLUEPRINT.md` Section 19 (V3.1 amendment) is authoritative if this document conflicts with older Sections 1–18.

---

## 1. MVP outcome

Build and verify a complete local-first MVP for community-led local group buying. Visitors can choose a State/City, discover groups in that city, start a group-buy proposal, join an approved published group without creating an account, and understand what happens when the target is reached. The admin can review proposals, create/edit/publish/manage groups, inspect all members per group, contact opted-in members through manual WhatsApp click-to-chat, manage pricing/quotes, and safely close/archive/delete records according to dependencies.

This MVP coordinates buyer interest. It does **not** guarantee discounts, act as a seller/escrow or legal adviser, force a vendor, or process product transactions. Participants choose whether to use a vendor quotation or negotiate independently.

## 2. Current starting facts

According to the latest local preflight report:

- Branch `phase-4-staging-brand-seo` was clean and pushed at commit `a605cdd`.
- Local lint, TypeScript, 68 unit tests, 111 scenario checks, and build were reported passing.
- The current app uses Next.js 16 App Router, TypeScript, Tailwind CSS v4, and Supabase-ready client/repository/RPC/migration code.
- Local demo/mock mode is active without credentials. Mock submissions are not real leads and do not represent remote persistence.
- The seven local versioned migrations are `20261026000000` through `20261026000006`.
- No Supabase account/project or remote credentials exist. No Vercel/Netlify production deployment or domain configuration exists.

These are the report's assertions, not a guarantee that the latest live working tree still matches them. The execution prompt requires the IDE to re-check actual Git state, files, scripts, and branch before edits.

## 3. Brand and content rules

- Primary visible brand: **GroupBuying**. The logo/wordmark must not be dominated by `.store` or by a product category.
- The URL/canonical host is planned to be `https://groupbuying.store`, but do not add DNS/deployment settings until release is authorized.
- Retain useful existing `PoolBuy India` references and stable URLs where they support continuity/search relevance. Do not run blind find-and-replace. It must not appear to be a competing primary brand.
- Homepage H1: **Bring local buyers together.**
- Supporting copy: **Start or join a buying group in your city. Build collective demand, explore available quotations and decide together where to buy.**
- Primary CTA: **Start a Group Buy**. Secondary CTA: **Explore Local Groups**. Secondary product discovery CTA: **Suggest a Product**.
- Avoid narrowing the brand to solar, power backup, or water softeners only.

## 4. Public customer journey

### 4.1 City-first discovery

- Header has one authoritative state/city selector. Any popular city chips and the catalog filter stay synchronized with it.
- Popular-city shortcuts may include Bhopal, Indore, Delhi NCR, Mumbai, Pune, Jaipur, Bengaluru, Hyderabad, Chennai, Kolkata, and Lucknow, but their order and values must be data-driven and must not imply operational groups exist.
- Users can select any valid State/UT and City/Town directory entry. The directory can also accept an `Other city/town` proposal that is reviewed before becoming operational.
- Show only published, eligible groups for the selected city. If Bhopal is selected, never intermingle Banda, Indore, or other-city groups.
- If no eligible group exists, show an honest empty state and CTAs to start a group or suggest a product. Do not display made-up active group cards.
- Browser geolocation is optional and requires permission; manual city selection always remains available.

### 4.2 Start a Group Buy

Visitors can submit a proposed group without an account. Capture product/group title, State, City/Town, optional category or free-text category, short requirements, group target (bounded), optional deadline, contact name and WhatsApp number when needed for review, and clear consent to be contacted about the proposal. Collect locality/PIN only when relevant.

A submission goes to an admin review queue. It is not public until an authorized admin reviews it and explicitly publishes the new group. Approval of a proposal and publication of a group are separate actions. The admin records the original request ID on the resulting group.

Reject or route for review land/property deals, legal services, and other out-of-scope/high-risk categories. Do not accept a free-text category by casting it into a legacy database enum.

### 4.3 Join a group

No customer login/password/OTP. Require only the name, normalized valid Indian mobile/WhatsApp number, applicable privacy/communication consent, optional selected kit only when the group actually offers multiple fixed choices, and locality/PIN only when needed for fulfilment. The selected group's city is authoritative.

A database-backed join creates one persistent member/lead linked to the exact group and assigns a unique buyer number. Enforce uniqueness of `(pool_id, normalized_whatsapp_number)` at the database layer. A duplicate response returns the original result without adding a second lead or incrementing group count.

Mock mode must visibly disclose demo behavior and never claim remote persistence. In production/live mode, missing credentials or DB failure must fail closed with an honest error—not silently report success or switch to fake data.

## 5. Group lifecycle

Separate core group publication/status from post-target connection and fee workflow.

| Stage | Meaning | User-facing behavior |
|---|---|---|
| Proposal pending review | User submitted a request | Not public; status can be checked by admin |
| Draft | Admin has created a group but not published | Not public |
| Active | Published and accepting unique joins before deadline/target | Join CTA visible |
| Target reached | Database target reached and timestamp recorded | Stop new joins or place on explicitly supported waitlist; say no discount is guaranteed |
| Connection pending | Admin decides whether opted-in members can be connected | Explain next step; no claim of payment or connection completed |
| Ready to connect | Approved connection terms and eligible participants are ready | Invite only opted-in participants using the approved process |
| Closed/expired | No new joins | Not shown among active offers |
| Archived/soft-deleted | Removed from public listings but history preserved | Admin can restore when safe |

Retain legacy status values/fields for compatibility, but do not misuse legacy `UNLOCKED` to mean a community connection is ready. Implement new lifecycle semantics through reviewed, additive schema changes. Target reached does not by itself verify a vendor quote, mark payment as paid, or connect members.

## 6. Price and quote rules

Admin can enter market/reference price and group price separately. Each must have a type/status/source/date:

- Market/reference: unknown, estimate, sourced reference, or verified comparable price.
- Group price: unknown, indicative estimate, vendor quote received, vendor quote verified, expired/withdrawn.

Public labels are derived from saved status. An estimate is labeled **“Indicative estimate — final price may differ.”** “Vendor quoted” requires a real quote source/date and valid scope/expiry. Do not show savings unless market and group prices are comparable, verified and approved for display. No fabricated MRP, discount, warranty, subsidy, vendor authorization, or stock availability.

Admin-entered internal quote notes, dealer contact, dealer terms, exact cost details and payment URLs are never part of public JSON/API responses. Quote changes create history entries; an expired quote is not presented as current.

## 7. Post-target connection and fee

Joining is free before target reached. The owner has mentioned a possible minimal service fee after the target is reached; the proposed 0.10% is not an approved calculation or public promise.

- Do not show the proposed percentage or a connection charge on ordinary pre-target cards/hero.
- Do not charge before target reached.
- Before a payment action, disclose the actual amount, who pays, what service is being provided, recipient, and applicable cancellation/refund terms. Do not make payment mandatory without an approved and disclosed policy.
- If fee basis, payment provider, or legal/accounting configuration is not approved, payment remains disabled. An admin may use a clearly labeled manual/no-charge workflow for testing.
- Store external payment-link data only after business terms are approved. Payment must never be claimed as verified from opening a URL alone; admin reconciliation needs an audit record unless a trusted provider integration confirms it.
- There is no wallet, escrow, in-app product checkout, or automatic refund system in this MVP.

## 8. Admin console — required capabilities

### 8.1 Access and security

- Existing passkey + signed HTTP-only session; no buyer account system.
- Every `/api/admin/**` read/write/export/message action independently verifies the session.
- Verify request origin on mutations; use no-store cache headers for private responses; apply payload validation and sensible rate limits.
- Public users cannot read member PII, private quotes/vendor notes, payment links, internal notes, audit data, or exports.

### 8.2 Group manager

Create draft; view details; edit; save; publish/unpublish; clone/duplicate to a different city as a new independent group; close; extend deadline with reason; mark/inspect target reached; archive; restore; soft-delete; view change history.

Permanent delete is allowed only for an unused dependency-free draft/test record after two-step confirmation and a server-side dependency recheck. If a group has members, requests, quotes, fee/payment references, or audit dependencies, permanent deletion must be blocked and archive/soft-delete used instead.

Changing city must never move existing members into another city pool. Clone-to-city creates a new pool with independent counts, deadline, quotes and member list.

### 8.3 Member/lead mapping

From each group, admin can open a member list with buyer number, name, WhatsApp contact, joined-at timestamp, consent/opt-in state, member status, selected kit if relevant, optional locality/PIN, and admin notes. Search, filter, paginate, mark contacted/qualified/do-not-contact, correct data safely, and export filtered CSV with UTF-8 escaping and spreadsheet-formula neutralization.

All member entries must remain linked to the correct group. Admin-created pools and join submissions must survive refresh/restart in configured live mode. In demo mode only, show that data is local/temporary demonstration data.

### 8.4 WhatsApp actions

Each authorized admin member row has a WhatsApp action that builds a correctly encoded `https://wa.me/<international-number>?text=<url-encoded-message>` URL using the saved number and a safe template. It opens WhatsApp/WhatsApp Web for human review; it does not automatically send messages.

Templates include group title/city and truthful stage. Do not insert unverified savings or say the deal is final. Do not generate connection/vendor-sharing messages unless the member has the relevant consent. A `DO_NOT_CONTACT` record must not have a send-link action. Do not expose member contact details to other members. Automated bulk sends and programmatic WhatsApp group creation are out of scope.

### 8.5 Request review, location, categories and quote admin

- Requests: search/filter/view; duplicate-demand clues; review notes; approve/reject/request information; convert to product/category and a draft group; explicit publish action; source-request linkage.
- Locations: manage States/UTs, cities/towns, operational status and popular city shortcuts.
- Categories: create/edit/deactivate, display icon/image mapping.
- Quotes: edit estimated market/group amounts, type, source, date, validity, verified status, notes and history.
- Connection stage: target-reached admin alert, opted-in cohort, fee configuration/payment-disabled state, link/reconciliation status, ready-to-connect/completed status.
- Audit: record group create/edit/publish/close/archive/restore/delete, quote changes, member status/consent edits, exports and connection/payment transitions.

## 9. API coverage

Adapt existing paths and avoid duplicate route handlers. Required logical surface:

- Public group reads; `POST /api/pools/[poolId]/join`; `POST /api/pool-requests` or `/api/group-proposals`.
- Admin session create/delete.
- Admin groups `GET/POST /api/admin/pools`, `GET/PATCH/DELETE /api/admin/pools/[poolId]`, plus lifecycle/clone action routes where appropriate.
- Per-group members or filtered `/api/admin/leads`; `PATCH` lead status/corrections; authenticated CSV export; WhatsApp link generation.
- Requests `GET /api/admin/pool-requests`, `PATCH /api/admin/pool-requests/[requestId]`, explicit conversion to draft group.
- Admin States/UTs/cities and categories CRUD.
- Quote history, connection stage and audit APIs where necessary.

Every endpoint needs validation, stable safe error codes, correct HTTP status, auth review, cache policy, and tests. No browser code may invoke a privileged Supabase client or access service-role keys.

## 10. Data model and migration policy

- PostgreSQL/Supabase is the intended persistent database; demo/local mode remains available for development.
- Before changing schema, inspect all existing migrations and app code. Use additive, versioned migrations and preserve current rows/IDs/URLs. Never reset/drop/recreate the whole database as a shortcut.
- Review `supabase/migrations/20261026000000_baseline_schema.sql` through `20261026000006_blog_cms.sql` for correct ordering and conflicts. Existing local files do not mean remote migrations ran.
- No Supabase account/project/credentials exist yet; local SQL review and code can be completed, but remote migration/RLS/persistence is NOT VERIFIED until owner setup.
- Keep service-role key, admin passkey/session secret and cron secret server-only; check `.env*` ignored and inspect diffs/logs before commit.

## 11. Visual and accessibility requirements

- Light, clear responsive UI; warm neutral surfaces and restrained green accent as appropriate. Professional, trustworthy—not a generic “AI generated template” look.
- Desktop layout uses available width without excessive right-side whitespace; sensible grid of 3–4 columns where space permits. Mobile layout has no horizontal overflow.
- Category icons and labels, one synchronized city selection state, clear empty/loading/error/success states.
- Every control works or is disabled with an explanation. Accessible labels, keyboard-operable modal, Escape/close/focus handling, visible focus ring and descriptive image alt text.
- Test viewports 320, 360, 390, 430 and 1280+ pixels.
- Verify the screenshot-identified priorities: legacy categories must not dominate the catalogue; active city filters are exclusive; demo pricing/counts are truthful; badges such as “verified”, “zero-risk”, “100%”, and savings only appear with actual evidence.

## 12. SEO requirements

- GroupBuying is the primary visible/structured site identity; canonical origin is `https://groupbuying.store` once production is configured.
- Keep PoolBuy India in natural relevant existing content and stable URLs where useful; avoid blind global replacement. Avoid conflicting primary Organization/WebSite names.
- Only useful content/real published groups are indexable. No demo, draft, request, admin, API, empty/low-value city pages in sitemap or index.
- Safe `WebSite`, `Organization`, `BreadcrumbList`, `Product`/`Offer` only where supported by actual visible verified content, plus blog posting schema if published blog exists.
- Correct robots, sitemap, canonical, metadata, social graph and internal links. Do not claim Search Console or analytics are configured unless verified.

## 13. Definition of Done — local code completion

Local implementation is not complete until:

- Full frontend flow, admin console, APIs, data-mode logic and the schema/migration set have been inspected and implemented against this MVP.
- Every required action is wired end-to-end or explicitly disabled with a clear reason.
- Unit, API, validation, status/lifecycle, authorization, no-PII, CSV, WhatsApp link, city isolation and quote-label tests pass.
- Existing and new test suites, lint, strict TypeScript and production build pass.
- Browser verification covers start proposal → admin review → create/publish → join → duplicate join → admin sees the same member → WhatsApp click-to-chat → target reached → connection pending/disabled payment path → archive/restore/delete guard.
- Git feature branch is committed and pushed; working tree is clean and remote branch synced.
- All local-only and remote-not-verified limitations are listed honestly.

## 14. Definition of Done — remote/live readiness (requires owner setup)

The MVP is not production-ready until owner has created Supabase staging and later production projects, configured environment variables, applied reviewed migrations, proven real persistence/RLS/authorization, and chosen/configured the actual hosting plan. Netlify + Supabase is the intended plan; deployment/domain setup is a later authorized phase. Do not mark these remote gates PASS without evidence.

## 15. Launch legal/trust gate

The operator must confirm business identity/contact details, a privacy and grievance contact/process, consent language, fee disclosure, vendor/connection terms, cancellation/refund handling if applicable, and seller/platform role before accepting fees or launching publicly. The Government of India reported that the Consumer Protection (E-Commerce) (Amendment) Rules, 2026 take effect on 1 January 2027; verify the current official rules before a launch on or after that date. See the official government announcement: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2308759 . This document is a product/engineering plan, not legal advice.
