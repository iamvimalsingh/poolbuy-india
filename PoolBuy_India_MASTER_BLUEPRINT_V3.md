# PoolBuy India — Master Specification & Implementation Blueprint

**Document ID:** PBI-MASTER-001  
**Version:** 3.0 (V1 baseline + V2 implementation amendment + V3 owner-approved requirements)  
**Last updated:** 26 October 2026  
**Status:** Authoritative implementation contract; Section 18 V3 supersedes all conflicting earlier requirements  
**Target IDE:** Antigravity IDE (AI coding agent)  
**Project root:** `C:\Users\iamvi\OneDrive\Documents\poolbuy-india`  
**Application:** Next.js 16.4+ App Router, TypeScript, Tailwind CSS v4 (`app-tw` starter), Supabase PostgreSQL, serverless Route Handlers  

> **Single source of truth:** This file is the product and implementation specification. `AGENTS.md` must instruct the coding agent to read this file before changing code and must not duplicate or contradict its requirements. If the repository's current code differs from this blueprint, inspect it, preserve working setup, and reconcile deliberately; do not blindly overwrite working configuration.

> **Current execution directive (V3.0):** The original Phase 1–6 and updated Phases A–C are reported complete in local/demo mode. Do not reinitialize or rebuild the baseline. The owner is working locally at `http://localhost:3000`. Section 18 is the latest owner-approved specification and execution plan; it supersedes conflicting requirements in Sections 1–17. No production deployment or destructive database reset is authorized.

---

## 0. Instructions to the IDE Agent

Treat the requirements in this document as acceptance criteria, not suggestions. Work in the existing project directory. The app has already been initialized with `create-next-app@latest .` using the `app-tw` template. The repository has a root-level `app/` directory and **does not have a `src/` directory**.

Before implementation:

1. Read `AGENTS.md`, `package.json`, `tsconfig.json`, `eslint.config.mjs`, `next.config.*`, `postcss.config.*`, and the current files under `app/`.
2. Confirm installed versions and the existing Tailwind v4 setup. Do not downgrade Next.js, replace the package manager, move `app/` into `src/`, or reinitialize the project.
3. Make a short implementation checklist for the current phase only. Implement that phase, run its verification commands, report exact results, and stop at the phase gate. Do not silently implement later phases.
4. Prefer small, typed modules and native React/Next.js capabilities. Do not add Redux, Zustand, MobX, a large component library, an ORM, a custom Express server, or a separate backend service.
5. Do not leave `TODO`, placeholder click handlers, fake “saved” states, dead links, or code that claims a database write succeeded when it did not.
6. Never expose `ADMIN_PASSKEY`, `ADMIN_SESSION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, dealer offers, or token-payment URLs to client bundles, public JSON, public pool queries, logs, or metadata.
7. Keep production mode fail-closed. Mock data is a local-development aid, not production inventory and not real buyer demand. All mock mode UI must visibly say **“Demo data — not a live dealer offer”** and must not claim that real leads were saved or forwarded.
8. At the end of each phase, report changed files, commands run, pass/fail results, any known limitation, and the exact browser checks performed. Do not report a command as passed unless it actually ran successfully.

### Definition of done for the entire project

- `npm run lint` passes.
- `npx tsc --noEmit` passes.
- `npm run build` passes against the current installed Next.js 16.4+ setup.
- The app renders and is usable without Supabase environment variables in local development, using clearly labeled mock data.
- With Supabase configured, pool browsing, unique interest submission, counter updates, admin pool management, lead filtering/export, and pool requests use persistent server-side data.
- Admin access is verified on the server for every protected read/write request; hiding the admin UI alone is not security.
- No anonymous user can query lead PII or private dealer/payment fields.
- Public SEO pages produce correct canonical URLs, useful metadata, FAQ content, and valid JSON-LD without asserting unverified prices as real offers.
- Phone numbers are validated and normalized consistently; duplicate submissions for the same pool and WhatsApp number do not increment the counter twice.
- Every form, button, filter, navigation item, WhatsApp action, and export action performs its advertised behavior or is explicitly disabled with a reason.

---

## 1. Product Overview and Product Rules

### 1.1 Product definition

**PoolBuy India** is an interest-based group-buying and high-intent local buyer lead platform for high-ticket products in India. Buyers express interest for free; they do not create passwords or accounts. Each pool is specific to a product, city, buyer target, and deadline.

Two monetization paths exist:

- **Engine A — Group-buy execution:** An admin confirms that the pool has met the agreed buyer threshold and has verified the dealer terms, changes the pool status to `UNLOCKED`, and sends interested buyers a WhatsApp message containing the genuine refundable commitment-token payment link and terms. Payment processing and refunds are outside the initial MVP: PoolBuy stores the verified payment URL and sends the user to the provider's hosted payment page; it must not collect card/UPI credentials or claim it has processed a payment.
- **Engine B — Lead-generation fallback:** If a pool expires below the target, or the admin chooses to engage leads before expiry, an admin can change its status to `LEAD_FALLBACK`, filter/export its leads, and contact a partnered dealer. Leads are never shared automatically merely because a user submitted a form. The admin is responsible for the applicable privacy notice, consent, and the dealer-sharing decision.

The product is not a marketplace checkout, escrow provider, lender, dealer, or manufacturer. Do not imply that PoolBuy is an authorized seller or guarantees a price. Price values in the seeded data are illustrative until manually verified by the operator.

### 1.2 Buyers: no account and no password — current V2 rules

The buyer's primary identity key for duplicate prevention is the normalized 10-digit Indian WhatsApp/mobile number, unique within one operational pool:

`UNIQUE(pool_id, normalized_whatsapp_number)`

The V1 form included a mandatory buying timeline and existing-quote questions. These are legacy data fields, not required inputs in the current V2 join flow. Follow Section 17 if any older text or code conflicts.

**Required for a standard pool join:**

1. `full_name` — required, trimmed, 2–100 characters.
2. `whatsapp_number` — required, exactly 10 digits matching `^[6-9][0-9]{9}$` after permitted digit normalization.
3. `selected_pool_kit_offer_id` — required only if the pool contains more than one active fixed-kit offer. The customer selects from pre-defined kits; they cannot customize individual components.
4. Applicable privacy/communication consent shown clearly before submission.

**Locality/area/PIN code:** Collect only when needed for local installation/delivery coverage. If needed for a particular installation pool, make it required for that pool and explain why. The city is inherited from the pool; do not ask the customer to select a different city inside the join form or allow the submitted city to override the pool's city.

Do not require a password, buying timeline, a separate waiting-period preference, an existing dealer quote, an exact budget, or a long technical questionnaire to join. An optional short note may be retained if useful, but should not increase join friction.

Keep the historic `buying_timeline`, `has_existing_quote`, `existing_quote_amount` and `extra_message` fields where they already exist so old records and the admin CRM are not destroyed. In V2, timeline/quote fields are optional legacy/secondary fields; do not invent values for old records or make users answer those questions as a condition of joining.

The form must show a concise privacy statement explaining that details are used to manage the selected pool and contact the buyer about the request. Sharing buyer contact details with a vendor requires the appropriate notice/consent and must not happen automatically merely because a form was submitted. Final legal wording must be reviewed by the operator/legal adviser; do not claim that review has occurred.

### 1.3 Pool status lifecycle

Use exactly these database/application statuses:

- `ACTIVE` — the pool is open and its deadline is in the future. A new interest can be submitted while this state is valid.
- `UNLOCKED` — the target has been met and an admin has confirmed dealer terms. Buyers can be sent the verified refundable-token link.
- `LEAD_FALLBACK` — the admin has chosen the lead-generation route. The pool is not advertised as an available group-buy offer.
- `CLOSED` — no further activity; public pages may be noindexed or redirected according to the SEO rules.

The database does not auto-change status merely because a count reaches the target or a deadline passes. The count/deadline can create an admin warning, but status changes that have business implications require an authorized admin action. Joining must fail at the database level when the pool is not `ACTIVE` or its deadline has passed.

### 1.4 Count, buyer number and duplicate submissions

- `current_buyers` is an aggregate counter of unique accepted lead rows for that pool, not a browser-side optimistic guess.
- A database trigger assigns the `buyer_number` and increments `current_buyers` in the same transaction as a successful new lead insert.
- The RPC locks the pool row and checks for an existing `(pool_id, whatsapp_number)` before inserting. A duplicate returns the original buyer number and current count, with `already_joined = true`; it does not increment the count.
- Show remaining seats as `max(target_buyers - current_buyers, 0)`. It is acceptable for the count to exceed target briefly while an admin reviews and unlocks the pool; the UI must never show a negative remaining count.
- Counts and urgency messages must be computed from the currently loaded data. Do not fabricate “4 buyers joined this week” unless an actual query supports that claim. If weekly count is not implemented, omit that line.

### 1.5 Truthful urgency and price display

- Show the deadline as a formatted local date/time or a client-side countdown derived from the stored ISO timestamp. Do not hardcode a countdown string in a pool record.
- If there are remaining target places, a truthful message may say `Only N more buyers needed to reach the target`.
- Once target is reached, say `Target reached — dealer confirmation pending` until an admin marks the pool `UNLOCKED` and verifies the terms.
- Savings are computed as `market_price - group_price`; do not display a savings badge if either amount is missing, if `group_price >= market_price`, or if the figure is not approved for display. Use Indian formatting, for example `₹15,000`.
- Seeded prices are **illustrative demonstration estimates** and must carry `price_is_verified = false`. In mock mode, every deal must be marked as demo. Do not label an indicative group price as an authorized dealer quote.

---

## 2. Architecture Rules

### 2.1 Required local foundation

The current project is already initialized:

- Project root: `C:\Users\iamvi\OneDrive\Documents\poolbuy-india`
- Next.js: 16.4+ (keep the installed compatible stable version)
- React and TypeScript: use the existing `package.json` versions
- Tailwind CSS v4 via the existing `app-tw` template and current PostCSS/Turbopack configuration
- App Router at root `app/`; **no `src/` directory**
- ESLint is already configured
- `AGENTS.md` is present
- Deployment: Vercel or Netlify using supported Next.js deployments; no custom Express server or long-running backend

Do not convert the app to Pages Router, do not add `src/`, do not replace `app/globals.css` with a Tailwind v3 setup, and do not introduce a second root layout.

### 2.2 Component boundaries

Use Server Components by default. Add `'use client'` only where browser state, browser APIs, interactive controls, localStorage mock persistence, or form state is needed.

**Server-only responsibilities:**

- Supabase server reads.
- Admin session verification and signing.
- Mutating pools, reading leads, CSV generation, generating WhatsApp target URLs.
- SEO metadata and sitemap generation.
- JSON-LD construction from validated domain objects.
- Never import a service-role Supabase client into any module used by a Client Component.

**Client responsibilities:**

- City/category filters and lightweight local UI state.
- Join modal, client-side field validation, and success display.
- Live countdown presentation (timer only; server deadline is authoritative).
- WhatsApp link opening via a standard anchor with a validated `https://wa.me/91...` URL.
- Admin table interactions; the browser calls protected same-origin Route Handlers and does not call Supabase with a service-role key.
- Mock data localStorage behavior only when `NEXT_PUBLIC_DEMO_MODE=true` or explicit local mock configuration is active. Do not use localStorage for production persistence.

### 2.3 Data mode contract: Supabase versus mock

Implement a single explicit mode resolver, for example `lib/data-mode.ts`:

- **Local mock mode:** If Supabase public environment values are absent and `NODE_ENV !== 'production'`, server pages can render typed mock pools and use a client-side demo store for joins/request submissions. Show a consistent, visible `Demo data — not a live dealer offer` banner. Client localStorage may keep the demo experience coherent in the same browser, but the UI must explicitly say that these submissions are local demonstrations, not saved to a production database.
- **Explicit demo mode:** `NEXT_PUBLIC_DEMO_MODE=true` may enable the same visible demo experience if the operator explicitly chooses it. Do not treat this flag as an authorization credential.
- **Configured Supabase mode:** Use the database as the source of truth. If a live DB request fails, return a clear error/empty state and log a sanitized server-side error. Do not silently replace a production query failure with demo deals or claim that a lead was stored.
- **Production with missing Supabase configuration:** fail closed for pool/lead writes. Show a setup error or empty state; do not expose unlabelled mock inventory as real offers.

The public site should still compile and render locally without Supabase keys. `npm run build` should not require successful live Supabase calls at build time. Prefer dynamic server reads or static mock data that does not perform network requests during compilation.

### 2.4 Supabase client design

Use `@supabase/supabase-js` with two distinct server helpers:

- **Public client** — uses `NEXT_PUBLIC_SUPABASE_URL` plus `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (accept `NEXT_PUBLIC_SUPABASE_ANON_KEY` as a documented compatibility fallback if the installed Supabase project still exposes the legacy anon key). Read only the safe `public_pools` view and call the narrowly scoped public RPCs.
- **Admin client** — uses `SUPABASE_SERVICE_ROLE_KEY` server-side only, configured with session persistence and token refresh disabled. Import it only from server-only modules. Authenticate admin access separately using the signed HTTP-only passkey session described below. Supabase's service-role key bypasses RLS; therefore it must never be returned to the browser, put in a `NEXT_PUBLIC_` variable, or used by an unprotected route.

A service-role admin client is acceptable for this passkey-based MVP only because every admin Route Handler verifies the server-signed admin session before invoking it. An alternative is Supabase Auth with an allow-listed admin user; do not implement both methods simultaneously unless the project owner explicitly changes this spec.

### 2.5 API and mutation conventions

Use Route Handlers under `app/api/**/route.ts`, running in the Node.js runtime where crypto or Supabase requirements demand it. Each handler must:

- Validate the HTTP method, `Content-Type`, JSON shape, required fields, string lengths, enum values, numeric bounds and URL schemes.
- Return correct HTTP status codes and a consistent JSON envelope such as `{ "success": true, "data": ... }` or `{ "success": false, "error": { "code": "...", "message": "..." } }`.
- Never return stack traces, SQL errors, secrets, service keys, full request headers or raw phone lists in unneeded responses.
- Use `Cache-Control: no-store` on admin responses and lead data.
- Authenticate admin on **every** `/api/admin/**` request, including exports and WhatsApp target construction.
- Avoid caching user-specific API responses or admin pages in the CDN.
- Avoid `NEXT_PUBLIC_` variables for secrets.

Public API surface for the initial MVP:

- `POST /api/pools/[poolId]/join` — validate and call the `join_pool` RPC; never write straight to `pool_leads` from the browser.
- `POST /api/pool-requests` — validate and call `submit_pool_request` RPC.
- `POST /api/admin/session` — verify `ADMIN_PASSKEY` and issue a signed HTTP-only cookie.
- `DELETE /api/admin/session` — clear admin cookie.
- `GET/POST /api/admin/pools` — list/create pools.
- `PATCH /api/admin/pools/[poolId]` — edit supported pool fields/status.
- `GET /api/admin/leads` — filter/paginate leads. Return PII only to the authenticated admin.
- `GET /api/admin/leads/export` — stream a CSV of matching leads.
- `POST /api/admin/leads/[leadId]/whatsapp` — create a validated WhatsApp URL for a selected message template. Alternatively, the client can receive a safe `wa.me` URL from an authenticated server response. Do not send automated WhatsApp messages without a separately configured official messaging provider and explicit consent.
- `GET /api/admin/pool-requests` and `PATCH /api/admin/pool-requests/[requestId]` — demand discovery list/status management.

### 2.6 Admin passkey session security

Required environment variables:

- `ADMIN_PASSKEY` — long, unique operator secret; never commit it.
- `ADMIN_SESSION_SECRET` — separate random secret used to HMAC-sign the session cookie; at least 32 random bytes/characters.

Required behavior:

1. `POST /api/admin/session` compares the submitted passkey to `ADMIN_PASSKEY` in constant time (use `crypto.timingSafeEqual` after ensuring equal buffer lengths). Do not place the passkey in a URL or return it to the client.
2. On success, set a signed session cookie such as `__Host-poolbuy-admin`. Cookie settings: `HttpOnly`, `Secure` in production, `SameSite=Strict`, `Path=/`, no `Domain`, short bounded lifetime (e.g. 8 hours). The signed payload includes expiry and an unguessable nonce; HMAC covers the serialized payload. Validate signature and expiry on every protected request.
3. Logout clears the cookie with the same attributes.
4. If `ADMIN_PASSKEY` or `ADMIN_SESSION_SECRET` is missing, admin login and protected operations are disabled with a clear server setup error; no development default password is allowed.
5. Protect mutations against cross-site request forgery: SameSite cookies, JSON content type, and Origin/host validation for state-changing admin routes. Validate `Origin` when present and reject a foreign origin.
6. Rate-limit repeated login attempts using a production-suitable mechanism when available at the edge/platform. Do not claim a per-instance in-memory rate limiter is production-grade on a serverless platform.
7. The `/admin` page may initially render a login state, but every data request must independently revalidate the cookie. Never rely on React state or middleware-only hiding for authorization.

### 2.7 Realtime and refresh

Supabase Realtime is optional in the first six phases. The first production-ready pass can refresh pool counts after a join and use a manual/refetch mechanism for admin views. Add Realtime only in a later enhancement if needed, with explicit channel cleanup and proper authorization. Do not block MVP on Realtime.

### 2.8 UI and accessibility baseline

- Mobile-first layout, good contrast, visible focus rings, semantic landmarks, keyboard-operable dialogs and forms.
- Build a professional, trustworthy Indian commerce experience: light surfaces, clear product pricing, readable typography, restrained accent colors, no fake manufacturer endorsement or misleading “guaranteed savings” language.
- Sticky primary CTA may be used on mobile but must not cover content, forms, browser safe areas, or the submit button.
- Modal must close via close button and Escape; set focus inside when opened, return focus after close, and prevent interaction with background while open.
- Every input has a visible label; validation messages are associated with the relevant input; do not communicate status by color alone.
- Images use responsive sizing and descriptive `alt` text. Use a local category fallback if `image_url` is absent or invalid.
- Prices use `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })` unless a displayed quote explicitly needs paise.

---

## 3. Exact Directory and File Structure

Keep the existing root configuration and add/modify files as required. This is the target project tree for phases 1–6; if a file already exists, adapt it instead of duplicating it.

```text
poolbuy-india/
├── AGENTS.md
├── MASTER_BLUEPRINT.md
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json                 # or the lockfile already used; do not replace package managers
├── next.config.ts                    # preserve existing config extension if .mjs is already used
├── tsconfig.json
├── eslint.config.mjs
├── postcss.config.mjs                # preserve the generated Tailwind v4 setup
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx                       # home: active pools + city/category filtering
│   ├── loading.tsx
│   ├── error.tsx
│   ├── not-found.tsx
│   ├── robots.ts                      # metadata route
│   ├── sitemap.ts                     # metadata route
│   ├── city/
│   │   └── [citySlug]/
│   │       └── page.tsx               # programmatic city SEO landing page
│   ├── category/
│   │   └── [categorySlug]/
│   │       └── page.tsx               # category SEO landing page
│   ├── deals/
│   │   └── [citySlug]/
│   │       └── [poolSlug]/
│   │           ├── page.tsx           # deal details, FAQs, JSON-LD, join CTA
│   │           └── opengraph-image.tsx # optional dynamic social preview; only if implemented cleanly
│   ├── admin/
│   │   ├── page.tsx                   # protected admin console shell
│   │   └── login/
│   │       └── page.tsx               # passkey entry UI
│   └── api/
│       ├── pools/
│       │   └── [poolId]/
│       │       └── join/
│       │           └── route.ts
│       ├── pool-requests/
│       │   └── route.ts
│       └── admin/
│           ├── session/
│           │   └── route.ts           # POST login, DELETE logout
│           ├── pools/
│           │   ├── route.ts           # GET list, POST create
│           │   └── [poolId]/
│           │       └── route.ts       # PATCH update
│           ├── leads/
│           │   ├── route.ts           # GET filtered/paginated lead table
│           │   ├── export/
│           │   │   └── route.ts       # GET CSV export with same filters
│           │   └── [leadId]/
│           │       └── whatsapp/
│           │           └── route.ts   # POST message-template URL
│           └── pool-requests/
│               ├── route.ts           # GET list
│               └── [requestId]/
│                   └── route.ts       # PATCH review status
├── components/
│   ├── site-header.tsx
│   ├── site-footer.tsx
│   ├── demo-banner.tsx
│   ├── pool-catalog.tsx               # client filters and join modal coordination
│   ├── pool-card.tsx
│   ├── pool-progress.tsx
│   ├── countdown.tsx                  # client-only timer presentation
│   ├── join-pool-modal.tsx
│   ├── join-success.tsx
│   ├── pool-request-form.tsx
│   ├── faq-accordion.tsx
│   ├── json-ld.tsx                    # safe JSON-LD serialization helper, if needed
│   ├── admin-login-form.tsx
│   ├── admin-dashboard.tsx
│   ├── admin-pools-tab.tsx
│   ├── admin-leads-tab.tsx
│   ├── admin-requests-tab.tsx
│   └── empty-state.tsx
├── lib/
│   ├── constants.ts                   # cities, labels, category slug mapping
│   ├── data-mode.ts                   # single source for demo/live mode resolution
│   ├── env.ts                         # validated environment parsing and clear setup errors
│   ├── format.ts                      # currency, dates, slug, phone, countdown helpers
│   ├── validation.ts                  # Zod or typed validation schemas; keep validation server-side too
│   ├── mock-data.ts                   # clearly illustrative pools and no synthetic real PII
│   ├── demo-store.client.ts           # localStorage-only demo submissions, guarded for browser use
│   ├── pools.ts                       # public pool repository and mapping layer
│   ├── leads.ts                       # server-only lead queries/filter mapping
│   ├── requests.ts                    # pool-request repository
│   ├── supabase/
│   │   ├── public.ts                  # public server/browser-safe Supabase client
│   │   └── admin.ts                   # server-only service-role client
│   ├── admin-auth.ts                  # HMAC cookie create/verify/clear utilities
│   ├── require-admin.ts               # server guard for Route Handlers and page reads
│   ├── whatsapp.ts                    # encoded templates and URL generation
│   ├── csv.ts                         # RFC 4180-style escaping and CSV response helpers
│   └── seo.ts                         # canonical URL, metadata and JSON-LD helpers
├── types/
│   └── index.ts                       # shared domain types and API contracts
├── supabase/
│   └── schema.sql                     # authoritative schema, RLS, functions, trigger, indexes, seeds
└── public/
    ├── favicon.ico                    # keep generated file if present
    ├── images/
    │   ├── pool-default.svg            # local generic fallback visual
    │   └── category-default.svg        # local generic category visual
    └── og-default.png                 # optional branded social fallback if supplied/created

# Phase 6 may add focused tests under lib/__tests__/ and an optional Playwright config.
```

### Directory rules

- Do not add `src/`, a second `app/`, `pages/`, a custom server entry point, or a separate backend project.
- Do not put server-only helpers in the `components/` directory.
- Do not use a generic `lib/supabase.ts` that can accidentally bundle a service-role key into client code. Keep public and admin clients in separate modules and add `import 'server-only'` to the admin module.
- `app/robots.ts` and `app/sitemap.ts` are Next.js metadata routes. Keep their exported types compatible with the installed Next.js version.
- In Next.js 16 App Router, dynamic route `params` are asynchronous. Use `params: Promise<{ citySlug: string }>` and `const { citySlug } = await params` in pages and `generateMetadata` (same principle for `[categorySlug]`, `[poolSlug]`, `[poolId]`, and `[requestId]`). Do not use examples written for older synchronous params without verifying compatibility.
- Keep existing config filenames (`next.config.mjs` versus `next.config.ts`, for example) unless there is a specific reason to change them.

---

## 4. Database Specification — `supabase/schema.sql`

> **V2 migration warning:** This section documents the original V1 baseline schema. The current application has reportedly already been initialized. Do not run this whole script destructively against an existing database and do not reset tables. Before V2 implementation, inspect the actual schema; update the clean-install schema and create additive, data-preserving migrations according to Section 17. The V2 dynamic taxonomy and city-specific kit-offer model supersede the V1 fixed category enum where they conflict.

### 4.1 Database invariants

1. The database is the source of truth in live mode.
2. `pool_leads` PII is inaccessible to anonymous/public roles. Anonymous buyers can join only through `join_pool()` and can submit product demand only through `submit_pool_request()`.
3. Anonymous/public pool listing reads the `public_pools` view. The view deliberately omits private dealer/payment fields.
4. Direct `INSERT` on `pool_leads` and `pool_requests` is not granted to `anon` or `authenticated` roles; the narrowly scoped `SECURITY DEFINER` RPCs perform validated writes.
5. All trigger/function SQL sets a restricted `search_path` and uses fully qualified table names where practical.
6. `current_buyers` and `buyer_number` are assigned transactionally in the database. Do not calculate these values only in JavaScript.
7. Seed price figures are clearly marked unverified. No payment links are seeded.
8. Schema installation may be run once in a fresh Supabase project. Seed inserts use `ON CONFLICT DO NOTHING` so rerunning the seed section does not overwrite pools edited later by the admin.

### 4.2 Complete schema SQL

Create `supabase/schema.sql` with the following complete script. If Supabase has already applied part of this schema, reconcile with migrations or inspect the existing objects first rather than dropping live data.

```sql
-- PoolBuy India — initial schema for a fresh Supabase PostgreSQL project.
-- Price values in the seed section are illustrative only and are not dealer quotations.

create extension if not exists pgcrypto;

do $$ begin
  create type public.pool_category as enum (
    'EV_SCOOTERS',
    'CARS',
    'ROOFTOP_SOLAR',
    'LAPTOPS',
    'SMART_TVS',
    'TRACTORS_COMMERCIAL'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pool_status as enum (
    'ACTIVE',
    'UNLOCKED',
    'LEAD_FALLBACK',
    'CLOSED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.buying_timeline as enum (
    'WITHIN_7_DAYS',
    'WITHIN_15_DAYS',
    'WITHIN_30_45_DAYS'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pool_request_status as enum (
    'REQUESTED',
    'REVIEWING',
    'APPROVED',
    'REJECTED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_status as enum (
    'NEW',
    'CONTACTED',
    'QUALIFIED',
    'CONVERTED',
    'DO_NOT_CONTACT'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.pools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(trim(name)) between 3 and 180),
  short_description text not null default '' check (char_length(short_description) <= 300),
  long_description text not null default '' check (char_length(long_description) <= 10000),
  category public.pool_category not null,
  city text not null check (char_length(trim(city)) between 2 and 80),
  city_slug text not null check (city_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  product_brand text not null default '' check (char_length(product_brand) <= 100),
  product_model text not null default '' check (char_length(product_model) <= 150),
  image_url text,
  market_price numeric(12,2) check (market_price is null or market_price >= 0),
  group_price numeric(12,2) check (group_price is null or group_price >= 0),
  target_buyers integer not null default 10 check (target_buyers between 2 and 10000),
  current_buyers integer not null default 0 check (current_buyers >= 0),
  deadline timestamptz not null,
  status public.pool_status not null default 'ACTIVE',
  price_is_verified boolean not null default false,
  price_verified_at timestamptz,
  dealer_name text check (dealer_name is null or char_length(dealer_name) <= 180),
  token_amount numeric(8,2) check (token_amount is null or token_amount between 499 and 999),
  token_payment_url text,
  dealer_offer_url text,
  dealer_terms text check (dealer_terms is null or char_length(dealer_terms) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pool_group_price_not_above_market check (
    market_price is null or group_price is null or group_price <= market_price
  ),
  constraint verified_price_has_timestamp check (
    price_is_verified = false or price_verified_at is not null
  ),
  constraint token_link_requires_unlocked_pool check (
    token_payment_url is null or status = 'UNLOCKED'
  )
);

create table if not exists public.pool_leads (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete restrict,
  buyer_number integer not null check (buyer_number >= 1),
  full_name text not null check (char_length(trim(full_name)) between 2 and 100),
  whatsapp_number text not null check (whatsapp_number ~ '^[6-9][0-9]{9}$'),
  city text not null check (char_length(trim(city)) between 2 and 80),
  buying_timeline public.buying_timeline not null,
  has_existing_quote boolean not null default false,
  existing_quote_amount numeric(12,2) check (existing_quote_amount is null or existing_quote_amount >= 0),
  extra_message text not null default '' check (char_length(extra_message) <= 1000),
  status public.lead_status not null default 'NEW',
  consent_at timestamptz not null default now(),
  privacy_notice_version text not null default '2026-10-26-v1' check (char_length(privacy_notice_version) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_pool_whatsapp unique (pool_id, whatsapp_number),
  constraint unique_pool_buyer_number unique (pool_id, buyer_number)
);

create table if not exists public.pool_requests (
  id uuid primary key default gen_random_uuid(),
  product_name text not null check (char_length(trim(product_name)) between 2 and 180),
  category public.pool_category,
  city text not null check (char_length(trim(city)) between 2 and 80),
  full_name text check (full_name is null or char_length(trim(full_name)) between 2 and 100),
  whatsapp_number text check (
    whatsapp_number is null or whatsapp_number = '' or whatsapp_number ~ '^[6-9][0-9]{9}$'
  ),
  extra_message text not null default '' check (char_length(extra_message) <= 1000),
  status public.pool_request_status not null default 'REQUESTED',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pools_public_listing_idx
  on public.pools (status, city_slug, category, deadline);
create index if not exists pools_city_status_idx
  on public.pools (city_slug, status, deadline);
create index if not exists pools_category_status_idx
  on public.pools (category, status, deadline);
create index if not exists pools_deadline_idx
  on public.pools (deadline) where status = 'ACTIVE';
create index if not exists pool_leads_pool_created_idx
  on public.pool_leads (pool_id, created_at desc);
create index if not exists pool_leads_city_timeline_idx
  on public.pool_leads (city, buying_timeline, has_existing_quote);
create index if not exists pool_leads_status_created_idx
  on public.pool_leads (status, created_at desc);
create index if not exists pool_requests_status_created_idx
  on public.pool_requests (status, created_at desc);
create index if not exists pool_requests_city_idx
  on public.pool_requests (city);

-- Keep updated_at consistent for administrative edits.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists pools_set_updated_at on public.pools;
create trigger pools_set_updated_at before update on public.pools
for each row execute function public.set_updated_at();

drop trigger if exists pool_leads_set_updated_at on public.pool_leads;
create trigger pool_leads_set_updated_at before update on public.pool_leads
for each row execute function public.set_updated_at();

drop trigger if exists pool_requests_set_updated_at on public.pool_requests;
create trigger pool_requests_set_updated_at before update on public.pool_requests
for each row execute function public.set_updated_at();

-- Assign buyer_number and increment the aggregate counter in the same transaction as the insert.
-- The join RPC locks/checks the pool before inserting, which prevents duplicate requests from
-- incrementing this count twice. Do not grant direct anonymous INSERT access to pool_leads.
create or replace function public.assign_pool_buyer_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next_count integer;
begin
  update public.pools
     set current_buyers = current_buyers + 1,
         updated_at = now()
   where id = new.pool_id
     and status = 'ACTIVE'
     and deadline > now()
  returning current_buyers into v_next_count;

  if not found then
    raise exception 'POOL_NOT_OPEN' using errcode = 'P0001';
  end if;

  new.buyer_number := v_next_count;
  return new;
end;
$$;

drop trigger if exists pool_leads_assign_buyer_number on public.pool_leads;
create trigger pool_leads_assign_buyer_number
before insert on public.pool_leads
for each row execute function public.assign_pool_buyer_number();

-- Expose safe columns only. Never include token_payment_url, dealer_offer_url, dealer_terms,
-- or other admin-only fields in this view.
create or replace view public.public_pools
with (security_invoker = true)
as
select
  id, slug, name, short_description, long_description, category,
  city, city_slug, product_brand, product_model, image_url,
  market_price, group_price, target_buyers, current_buyers,
  deadline, status, price_is_verified, price_verified_at,
  created_at, updated_at
from public.pools
where status in ('ACTIVE', 'UNLOCKED');

-- Explicit schema usage keeps the required public RPC/view surface available on fresh projects.
grant usage on schema public to anon, authenticated, service_role;

-- RLS is enabled on every table. Public users can read only the safe pool columns above.
alter table public.pools enable row level security;
alter table public.pool_leads enable row level security;
alter table public.pool_requests enable row level security;

drop policy if exists pools_public_read on public.pools;
create policy pools_public_read on public.pools
for select to anon, authenticated
using (status in ('ACTIVE', 'UNLOCKED'));

-- No anon/authenticated SELECT, INSERT, UPDATE or DELETE policies for pool_leads or pool_requests.
-- Admin access is server-mediated after a signed passkey session, through service-role helpers.

-- Column-level grants prevent a direct table query from revealing dealer/token private fields.
revoke all on public.pools from anon, authenticated;
grant select (
  id, slug, name, short_description, long_description, category,
  city, city_slug, product_brand, product_model, image_url,
  market_price, group_price, target_buyers, current_buyers,
  deadline, status, price_is_verified, price_verified_at,
  created_at, updated_at
) on public.pools to anon, authenticated;
grant select on public.public_pools to anon, authenticated;

revoke all on public.pool_leads from anon, authenticated;
revoke all on public.pool_requests from anon, authenticated;

-- RPC: validated, idempotent buyer interest submission. The result includes no buyer PII.
create or replace function public.join_pool(
  p_pool_id uuid,
  p_full_name text,
  p_whatsapp_number text,
  p_city text,
  p_buying_timeline text,
  p_has_existing_quote boolean default false,
  p_existing_quote_amount numeric default null,
  p_extra_message text default ''
)
returns table (
  lead_id uuid,
  buyer_number integer,
  current_buyers integer,
  target_buyers integer,
  remaining_buyers integer,
  already_joined boolean,
  pool_status public.pool_status
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pool public.pools%rowtype;
  v_existing public.pool_leads%rowtype;
  v_new_lead_id uuid;
  v_buyer_number integer;
  v_current_buyers integer;
begin
  if p_pool_id is null then
    raise exception 'INVALID_POOL' using errcode = '22023';
  end if;
  if p_full_name is null or char_length(trim(p_full_name)) not between 2 and 100 then
    raise exception 'INVALID_NAME' using errcode = '22023';
  end if;
  if p_whatsapp_number is null or p_whatsapp_number !~ '^[6-9][0-9]{9}$' then
    raise exception 'INVALID_INDIAN_MOBILE' using errcode = '22023';
  end if;
  if p_city is null or char_length(trim(p_city)) not between 2 and 80 then
    raise exception 'INVALID_CITY' using errcode = '22023';
  end if;
  if p_buying_timeline is null or p_buying_timeline not in ('WITHIN_7_DAYS', 'WITHIN_15_DAYS', 'WITHIN_30_45_DAYS') then
    raise exception 'INVALID_BUYING_TIMELINE' using errcode = '22023';
  end if;
  if p_existing_quote_amount is not null and p_existing_quote_amount < 0 then
    raise exception 'INVALID_QUOTE_AMOUNT' using errcode = '22023';
  end if;
  if coalesce(char_length(p_extra_message), 0) > 1000 then
    raise exception 'MESSAGE_TOO_LONG' using errcode = '22023';
  end if;
  if coalesce(p_has_existing_quote, false) = false and p_existing_quote_amount is not null then
    raise exception 'QUOTE_AMOUNT_REQUIRES_QUOTE_FLAG' using errcode = '22023';
  end if;

  -- Serializes joins for a given pool before the duplicate check and trigger increment.
  select * into v_pool
    from public.pools
   where id = p_pool_id
   for update;

  if not found then
    raise exception 'POOL_NOT_FOUND' using errcode = 'P0002';
  end if;

  if lower(trim(p_city)) <> lower(trim(v_pool.city)) then
    raise exception 'CITY_MUST_MATCH_POOL' using errcode = '22023';
  end if;

  select * into v_existing
    from public.pool_leads l
   where l.pool_id = p_pool_id
     and l.whatsapp_number = p_whatsapp_number;

  if found then
    return query
      select v_existing.id, v_existing.buyer_number, v_pool.current_buyers,
             v_pool.target_buyers,
             greatest(v_pool.target_buyers - v_pool.current_buyers, 0),
             true, v_pool.status;
    return;
  end if;

  if v_pool.status <> 'ACTIVE' or v_pool.deadline <= now() then
    raise exception 'POOL_NOT_OPEN' using errcode = 'P0001';
  end if;

  insert into public.pool_leads as inserted (
    pool_id, buyer_number, full_name, whatsapp_number, city,
    buying_timeline, has_existing_quote, existing_quote_amount,
    extra_message, consent_at
  ) values (
    p_pool_id, 1, trim(p_full_name), p_whatsapp_number, trim(p_city),
    p_buying_timeline::public.buying_timeline,
    coalesce(p_has_existing_quote, false), p_existing_quote_amount,
    coalesce(trim(p_extra_message), ''), now()
  ) returning inserted.id, inserted.buyer_number
    into v_new_lead_id, v_buyer_number;

  select p.current_buyers, p.target_buyers, p.status
    into v_current_buyers, v_pool.target_buyers, v_pool.status
    from public.pools p
   where p.id = p_pool_id;

  return query
    select v_new_lead_id, v_buyer_number, v_current_buyers,
           v_pool.target_buyers,
           greatest(v_pool.target_buyers - v_current_buyers, 0),
           false, v_pool.status;
end;
$$;

-- RPC: a public demand-discovery submission. It returns only the new request UUID.
create or replace function public.submit_pool_request(
  p_product_name text,
  p_city text,
  p_category text default null,
  p_full_name text default null,
  p_whatsapp_number text default null,
  p_extra_message text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_category public.pool_category;
  v_phone text := nullif(trim(coalesce(p_whatsapp_number, '')), '');
begin
  if p_product_name is null or char_length(trim(p_product_name)) not between 2 and 180 then
    raise exception 'INVALID_PRODUCT_NAME' using errcode = '22023';
  end if;
  if p_city is null or char_length(trim(p_city)) not between 2 and 80 then
    raise exception 'INVALID_CITY' using errcode = '22023';
  end if;
  if p_full_name is not null and trim(p_full_name) <> '' and char_length(trim(p_full_name)) not between 2 and 100 then
    raise exception 'INVALID_NAME' using errcode = '22023';
  end if;
  if v_phone is not null and v_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'INVALID_INDIAN_MOBILE' using errcode = '22023';
  end if;
  if coalesce(char_length(p_extra_message), 0) > 1000 then
    raise exception 'MESSAGE_TOO_LONG' using errcode = '22023';
  end if;

  if p_category is not null and trim(p_category) <> '' then
    begin
      v_category := trim(p_category)::public.pool_category;
    exception when invalid_text_representation then
      raise exception 'INVALID_CATEGORY' using errcode = '22023';
    end;
  end if;

  insert into public.pool_requests (
    product_name, category, city, full_name, whatsapp_number, extra_message
  ) values (
    trim(p_product_name), v_category, trim(p_city), nullif(trim(p_full_name), ''),
    v_phone, coalesce(trim(p_extra_message), '')
  ) returning id into v_id;

  return v_id;
end;
$$;

-- Public role gets execute access only to these validated RPCs.
revoke all on function public.join_pool(uuid, text, text, text, text, boolean, numeric, text) from public;
revoke all on function public.submit_pool_request(text, text, text, text, text, text) from public;
grant execute on function public.join_pool(uuid, text, text, text, text, boolean, numeric, text) to anon, authenticated;
grant execute on function public.submit_pool_request(text, text, text, text, text, text) to anon, authenticated;

-- Service-role access is used exclusively from authenticated server Route Handlers.
grant all on public.pools to service_role;
grant all on public.pool_leads to service_role;
grant all on public.pool_requests to service_role;
grant select on public.public_pools to service_role;

-- Six illustrative demo pools. These are NOT live, validated dealer offers.
-- current_buyers starts at zero to keep it consistent with the real lead table.
insert into public.pools (
  slug, name, short_description, long_description, category, city, city_slug,
  product_brand, product_model, image_url, market_price, group_price,
  target_buyers, current_buyers, deadline, status, price_is_verified
) values
(
  'tvs-iqube-electric-scooter-bulk-deal', 'TVS iQube Electric Scooter',
  'Explore a possible city-level bulk-buy price for an electric scooter.',
  'Illustrative demo estimate only. Final on-road price, variant, insurance, registration, subsidy eligibility, dealer stock and any discount must be confirmed in writing by an authorized dealer.',
  'EV_SCOOTERS', 'Bhopal', 'bhopal', 'TVS', 'iQube', null,
  145000, 130000, 10, 0, now() + interval '10 days', 'ACTIVE', false
),
(
  'hyundai-exter-city-group-deal', 'Hyundai Exter — City Group Deal',
  'Register interest in a city-level group quotation for a compact SUV.',
  'Illustrative demo estimate only. Variant, fuel type, model year, registration, insurance, accessories and dealer terms determine the final quotation.',
  'CARS', 'Indore', 'indore', 'Hyundai', 'Exter', null,
  875000, 825000, 15, 0, now() + interval '12 days', 'ACTIVE', false
),
(
  '3kw-rooftop-solar-bulk-installation', '3 kW Rooftop Solar System',
  'Aggregate local interest for a residential rooftop solar installation quote.',
  'Illustrative demo estimate only. Actual system design, panels, inverter, structure, installation, net-metering, DISCOM rules and subsidy eligibility require survey and written quotation.',
  'ROOFTOP_SOLAR', 'Bhopal', 'bhopal', 'Multiple brands', '3 kW residential system', null,
  210000, 185000, 10, 0, now() + interval '14 days', 'ACTIVE', false
),
(
  'macbook-air-laptop-group-buy', 'MacBook Air — Laptop Group Buy',
  'Collect purchase intent for a bulk laptop quotation.',
  'Illustrative demo estimate only. Confirm exact model, chip, memory, storage, tax invoice, warranty and authorized reseller terms before relying on any price.',
  'LAPTOPS', 'Pune', 'pune', 'Apple', 'MacBook Air', null,
  104900, 96000, 15, 0, now() + interval '9 days', 'ACTIVE', false
),
(
  '55-inch-qled-smart-tv-group-deal', '55-inch QLED Smart TV',
  'Gather local demand for a 55-inch QLED television group quotation.',
  'Illustrative demo estimate only. Brand, model, refresh rate, panel specifications, installation and warranty vary; final dealer quotation is required.',
  'SMART_TVS', 'Delhi', 'delhi', 'Multiple brands', '55-inch QLED', null,
  72990, 64990, 10, 0, now() + interval '11 days', 'ACTIVE', false
),
(
  'mahindra-tractor-commercial-group-buy', 'Mahindra 575 DI XP Plus Tractor',
  'Explore bulk-buy demand for a farm tractor in the Banda region.',
  'Illustrative demo estimate only. Horsepower class, variant, implements, delivery, taxes, finance and dealer stock can change the final price. Do not advertise this estimate as an authorized quote.',
  'TRACTORS_COMMERCIAL', 'Banda', 'banda', 'Mahindra', '575 DI XP Plus', null,
  840000, 790000, 5, 0, now() + interval '15 days', 'ACTIVE', false
)
on conflict (slug) do nothing;
```

### 4.3 Required SQL validation after applying schema

Run the following from the Supabase SQL Editor after applying `supabase/schema.sql`:

```sql
select slug, city, category, status, current_buyers, target_buyers, price_is_verified
from public.public_pools
order by city_slug, category;

select has_table_privilege('anon', 'public.pool_leads', 'select') as anon_can_read_leads;
select has_table_privilege('anon', 'public.pool_requests', 'select') as anon_can_read_requests;
select has_column_privilege('anon', 'public.pools', 'token_payment_url', 'select') as anon_can_read_token_url;
```

Expected results: six demo pools; `anon_can_read_leads = false`; `anon_can_read_requests = false`; `anon_can_read_token_url = false`. A successful `join_pool()` invocation should create exactly one lead row and increment the pool count once. Repeating the same call with the same pool/number should return `already_joined = true` and leave the count unchanged. The agent should test this against a disposable development project or rollback a test transaction; do not submit fabricated buyer PII to the production project.

### 4.4 Important database implementation notes

- Do not expose the base `pools` table's private fields to the public client. Use `public_pools` for listing/detail page queries.
- Keep the admin service-role client in a `server-only` module.
- Do not call `join_pool()` with unchecked client payloads; validate at the Route Handler and again inside SQL.
- `token_payment_url` must be HTTPS and belong to an operator-approved payment provider/link domain before it is saved. Validate the allowed URL policy when creating/updating a pool. Never accept a client-supplied payment URL from a buyer.
- `dealer_offer_url` is private admin data. A public deal URL is not the same thing as a dealer payment URL.
- The `assign_pool_buyer_number` trigger applies to any inserted lead and increments the count. Do not insert mock seed leads just to create attractive counters. The initial pool seeds use zero buyers to avoid orphan/fabricated leads.
- If future requirements include deleting leads, add a formally tested archival/anonymization/count-reconciliation policy. Do not casually delete records and decrement `current_buyers` without preserving the uniqueness/sequence invariants.

---

## 5. TypeScript Data Models — `types/index.ts`

> **V2 model note:** Existing V1 unions and interfaces are the baseline contracts for compatibility, not a requirement to hardcode a closed category list forever. Section 17 requires dynamic, admin-managed categories and cities, reusable product/kit definitions, city-specific pool offers, and a minimal join flow without mandatory timeline fields. Update types/repositories together and retain compatibility for historical data.

Use a single shared type module for domain shapes and API contracts. Keep database snake_case row types distinct from app-facing camelCase types. All external/API data is untrusted and must be validated before casting.

Required types (names may be refined without changing meanings):

```ts
/** Category/city options are database-managed in V2, not a closed compile-time union. */
export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

export interface CitySummary {
  id: string;
  name: string;
  slug: string;
  state: string;
  isActive: boolean;
  hasOperationalCoverage: boolean;
}

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  installationRequired: boolean;
  isStandardized: boolean;
}

export interface ProductKitSummary {
  id: string;
  productId: string;
  brand: string;
  modelSku: string;
  displayName: string;
  specifications: string;
  inclusions: string[];
  exclusions: string[];
  warrantySummary: string | null;
}

export interface PublicPoolKitOffer {
  id: string;
  kit: ProductKitSummary;
  referencePrice: number | null;
  currentVerifiedPrice: number | null;
  conditionalTargetPrice: number | null;
  priceIsVerified: boolean;
  quoteValidUntil: string | null;
  selectionCount: number;
  installationScope: string | null;
}

export type PoolStatus = 'ACTIVE' | 'UNLOCKED' | 'LEAD_FALLBACK' | 'CLOSED';

export type BuyingTimeline =
  | 'WITHIN_7_DAYS'
  | 'WITHIN_15_DAYS'
  | 'WITHIN_30_45_DAYS';

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'CONVERTED'
  | 'DO_NOT_CONTACT';

export type PoolRequestStatus = 'REQUESTED' | 'REVIEWING' | 'APPROVED' | 'REJECTED';

/** Fields allowed in public home/category/city/deal views. Never add payment URLs here. */
export interface PublicPool {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  category: CategorySummary;
  city: string;
  citySlug: string;
  cityId: string;
  productId: string;
  installationRequired: boolean;
  kitOffers: PublicPoolKitOffer[];
  productBrand: string;
  productModel: string;
  imageUrl: string | null;
  marketPrice: number | null;
  groupPrice: number | null;
  targetBuyers: number;
  currentBuyers: number;
  deadline: string; // ISO-8601 timestamp
  status: PoolStatus;
  priceIsVerified: boolean;
  priceVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Private server-only shape. Never serialize this to a public page or public API. */
export interface AdminPool extends PublicPool {
  dealerName: string | null;
  tokenAmount: number | null;
  tokenPaymentUrl: string | null;
  dealerOfferUrl: string | null;
  dealerTerms: string | null;
}

export interface JoinPoolInput {
  fullName: string;
  whatsappNumber: string;
  selectedPoolKitOfferId?: string | null;
  locality?: string | null;
  pincode?: string | null;
  extraMessage?: string;
  consentAccepted: true;
  // City comes from the server-resolved pool; it is never trusted from the client.
  // Legacy timeline/quote data are not required in the V2 primary join flow.
}

export interface JoinPoolResult {
  leadId: string;
  buyerNumber: number;
  currentBuyers: number;
  targetBuyers: number;
  remainingBuyers: number;
  alreadyJoined: boolean;
  poolStatus: PoolStatus;
}

export interface PoolLead {
  id: string;
  poolId: string;
  poolSlug: string;
  poolName: string;
  poolCategory: CategorySummary;
  fullName: string;
  whatsappNumber: string;
  city: string;
  buyingTimeline: BuyingTimeline | null;
  hasExistingQuote: boolean;
  existingQuoteAmount: number | null;
  extraMessage: string;
  status: LeadStatus;
  consentAt: string;
  privacyNoticeVersion: string;
  createdAt: string;
  buyerNumber: number;
}

export interface PoolRequest {
  id: string;
  productName: string;
  category: CategorySummary | null;
  requestedCategoryText?: string | null;
  requestedBrandModel?: string | null;
  locality?: string | null;
  pincode?: string | null;
  consentAt?: string | null;
  resultingPoolId?: string | null;
  city: string;
  fullName: string | null;
  whatsappNumber: string | null;
  extraMessage: string;
  status: PoolRequestStatus;
  createdAt: string;
  reviewedAt: string | null;
}

export interface PoolFilters {
  citySlug: string | 'all';
  categorySlug: string | 'all';
  search?: string;
}

export interface AdminLeadFilters {
  poolId?: string;
  city?: string;
  buyingTimeline?: BuyingTimeline;
  hasExistingQuote?: boolean;
  status?: LeadStatus;
  search?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: { code: string; message: string };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
```

### Type and mapping rules

- Store timestamps as ISO strings in TypeScript and `timestamptz` in PostgreSQL.
- Convert Postgres numeric values to JavaScript numbers at the repository boundary; Supabase may return numerics as strings depending on column/client typing.
- Define category and timeline label maps in `lib/constants.ts`; do not repeat hand-written display labels across the app.
- Define a category slug mapping that covers:

| Route slug | Database category / mapping |
|---|---|
| `ev-scooters` | `EV_SCOOTERS` |
| `cars` | `CARS` |
| `rooftop-solar` | `ROOFTOP_SOLAR` |
| `laptops` | `LAPTOPS` |
| `smart-tvs` | `SMART_TVS` |
| `tractors-commercial` | `TRACTORS_COMMERCIAL` |
| `electronics` | aggregate alias for `LAPTOPS` and `SMART_TVS` |

- `LEAD_FALLBACK` and `CLOSED` pools must not appear as active buying opportunities in public listing cards. The admin may still access them.
- Keep private types in server-only code paths. Public `PublicPool` must not have `tokenPaymentUrl`, `dealerOfferUrl`, `dealerTerms`, or a service-role field.

---

## 6. Page and Component Requirements

### 6.1 Global layout — `app/layout.tsx`

- Set `metadataBase` from a validated absolute `NEXT_PUBLIC_SITE_URL`; use `http://localhost:3000` only for local development.
- Add default title template, description, OpenGraph default, theme color and favicon metadata.
- Render `SiteHeader`, the demo banner when enabled, `main`, and `SiteFooter`.
- Do not fetch live pools globally in the root layout; fetch at the page/repository layer.
- Avoid putting client state in the root layout.

### 6.2 Home page — `app/page.tsx`

Render:

1. Clear primary message explaining free interest registration and that discounts depend on pool size and dealer verification.
2. City and category filters. Cities must come from `lib/constants.ts` and/or current database values; include at least Bhopal, Indore, Pune, Delhi, Mumbai and Banda to match seed data.
3. Responsive grid of active public pools.
4. Pool cards with image/fallback, name, category, city, market price, group-price estimate, savings (when valid), joined/target count, progress bar, deadline and a truthful urgency message.
5. Primary “Join Pool for Free” CTA opens `JoinPoolModal`; a secondary action links to the deal SEO URL.
6. Product request banner with `PoolRequestForm`.
7. Short “How it works” trust flow: `1. Express free interest → 2. Pool reaches target and dealer terms are verified → 3. Receive the refundable-token link and buy directly from the dealer`.

Filtering can happen in a client `PoolCatalog` initialized with a typed safe pool list, or via search params/server navigation. Filters must be usable by keyboard and not require a full-page reload for every simple selection. Ensure crawlable links to city/category/deal pages remain ordinary anchors.

### 6.3 Pool card and progress — `components/pool-card.tsx`, `pool-progress.tsx`, `countdown.tsx`

- Progress width is `min(currentBuyers / targetBuyers, 1) * 100`; clamp to 0–100 for the visual bar.
- Text may show `N / target buyers` and a remaining value clamped at zero.
- `ACTIVE`, `UNLOCKED`, `LEAD_FALLBACK`, and `CLOSED` each have distinct, plain-language labels. Public cards normally show only `ACTIVE` and `UNLOCKED` as described above.
- Deadline timer uses an ISO timestamp and updates in the client at a sensible interval (e.g. once per minute); clean up intervals on unmount. Server/database deadline is authoritative.
- If a deadline has passed but status is still `ACTIVE`, disable join and show `Pool deadline passed — awaiting admin review`. Do not pretend the backend will accept the join.
- The savings badge is hidden unless both prices exist and `marketPrice > groupPrice`. In demo mode display the demo label adjacent to the prices.

### 6.4 Join interest modal — `components/join-pool-modal.tsx`

- Controlled fields and robust loading/error states; accessible modal behavior as listed above.
- Client checks required values for user convenience; server Route Handler and database RPC validate again.
- Phone rule: `^[6-9]\d{9}$` after digit normalization. Do not silently prepend `+91` in stored values; store ten digits, format `+91` only in WhatsApp links.
- Quote amount is disabled/cleared unless `hasExistingQuote` is true; input must be non-negative and within the supported numeric bounds.
- Prevent double submissions while the request is in flight. Retry should not create a second lead because the database has a unique constraint and idempotent RPC.
- On successful live insert, show `You are Buyer #N` and the refreshed live count. If the same number already joined, say `This number is already registered for this pool` and display the existing buyer number without implying a second lead was created.
- On successful demo submission, show `Demo only — this interest is stored in this browser, not sent to a dealer`.
- Generate the share message after success. It should be Hinglish/English, e.g. `Maine PoolBuy par [Product] ke group-buy pool mein interest register kiya hai. Jitne zyada log judenge, utna better bulk price negotiate karne ka mauka ho sakta hai. Latest verified offer aur pool details: [production deal URL]. Aap bhi interest register kar sakte hain.` Use gender-neutral wording; never use `chuka/chuki`. The V2 minimal join form and canonical URL rules in Section 17 supersede earlier wording. If savings/price is not verified, do not claim a guaranteed ₹ amount. If an illustrative amount is used in local demo, the demo label must be present and the message should call it an estimate.
- Open WhatsApp with `https://wa.me/?text=${encodeURIComponent(message)}` for sharing; do not insert buyer phone details into the share text.

### 6.5 Demand discovery form — `components/pool-request-form.tsx`

- Required: product name and city.
- Optional: category, name, WhatsApp number and note.
- Show validation, loading, success and failure states. Never report a successful live submission if Supabase/RPC failed.
- Include a short consent/privacy statement if a phone number is requested.
- Mock submissions may be stored only in the local demo store and must show the demo notice.

### 6.6 City landing — `app/city/[citySlug]/page.tsx`

- Resolve the city slug from `lib/constants.ts` or the DB-backed city index; call `notFound()` for unsupported city slugs.
- H1: `Active Group Buying Pools & Bulk Discounts in {City}`.
- Include a unique, useful introduction for the city, current pool cards for that city, category links, a how-it-works section and city-specific FAQs.
- Do not produce hundreds of nearly identical pages from arbitrary URL parameters. Only permit known city slugs with meaningful inventory or a useful editorial landing page.
- Add canonical metadata and crawlable internal links to each deal.

### 6.7 Category landing — `app/category/[categorySlug]/page.tsx`

- Resolve from the approved category slug mapping. Support the `electronics` aggregate alias and six category-specific pages.
- H1 example: `Group Buying Deals on Electric Scooters in India` or `Rooftop Solar Group Buying in India`.
- Include the relevant active public pools, explanatory category copy, clear city links, and FAQs relevant to the product type.
- Invalid category slug => `notFound()`.

### 6.8 Deal detail SEO page — `app/deals/[citySlug]/[poolSlug]/page.tsx`

- Match both `citySlug` and `poolSlug`; do not return a pool under an incorrect city slug.
- Render product name, city, image, description, target/count, deadline, pricing with verification disclaimer, dealer terms only if deliberately approved for public display, join CTA, and FAQ accordion.
- Add trust information: interest is free; no payment is collected during interest registration; token is requested only after admin confirms an unlocked pool; actual terms are supplied by the dealer/operator.
- If status is `LEAD_FALLBACK` or `CLOSED`, do not present the pool as active. Either show an accurate closed-state page with `noindex` or use a deliberate redirect/404 policy. Do not silently relabel it `ACTIVE`.
- Deal FAQs should naturally target search intents such as “How can I get a better [Product] price in [City]?”, “Is joining PoolBuy free?”, “Is the group price guaranteed?”, “When is a token required?”, and “Who sells/delivers the product?”. Answers must not guarantee an unverified discount.

---

## 7. SEO, Metadata, JSON-LD and URL Architecture

### 7.1 Canonical route structure

| Page | URL | Purpose |
|---|---|---|
| Home | `/` | Browse all active pools |
| City | `/city/[citySlug]` | Local intent page, e.g. `/city/bhopal` |
| Category | `/category/[categorySlug]` | Category intent page, e.g. `/category/ev-scooters` |
| Deal | `/deals/[citySlug]/[poolSlug]` | Product/city-specific detail, e.g. `/deals/bhopal/tvs-iqube-electric-scooter-bulk-deal` |
| Admin | `/admin` | Passkey-protected command center; noindex |
| Admin login | `/admin/login` | Passkey entry; noindex |

Build URLs from a centralized helper so internal links, canonical URLs, sitemap entries, share links and OpenGraph URLs are identical. Avoid duplicate trailing slash and mixed-host URLs.

### 7.2 `generateMetadata()` contract

Use Next.js `Metadata` and asynchronous params. Deal page signature should use the installed Next.js 16 style, such as:

```ts
type DealPageProps = {
  params: Promise<{ citySlug: string; poolSlug: string }>;
};

export async function generateMetadata({ params }: DealPageProps): Promise<Metadata> {
  const { citySlug, poolSlug } = await params;
  // Load only the public pool; return not-found metadata if it does not match.
  // Construct title, description, canonical and OpenGraph with validated absolute URLs.
}
```

Metadata templates:

- **Home title:** `PoolBuy India | Group Buying & Bulk Discounts`
- **City title:** `Group Buying Pools in {City} | PoolBuy India`
- **Category title:** `{Category Name} Group Buying Deals in India | PoolBuy India`
- **Deal title:** `{Product Name} Group Deal in {City} | PoolBuy India`
- **Descriptions:** unique and useful, generally 140–165 characters, accurately explaining that users can register free interest and the final dealer price is conditional/subject to confirmation.
- **Canonical:** absolute URL from `NEXT_PUBLIC_SITE_URL` using the approved path. Validate host/protocol; do not canonicalize to localhost in a production deployment.
- **OpenGraph:** `type: 'website'` or product-suitable type supported by Next metadata, title, description, canonical URL, and an absolute image URL. Use `image_url` only if validated as HTTP(S); otherwise use a real local default image. WhatsApp previews consume OpenGraph metadata, so provide proper `og:image`, dimensions/alt when supported, and ensure the image is publicly reachable without authentication.
- **Twitter/X card:** `summary_large_image` when a suitable image is available.
- **Robots:** public, valid, active pages indexable; demo mode/no verified content should be noindex according to the rules below; admin and API routes noindex/disallowed.

Never insert buyer phone, name, extra message, token URL, or private dealer fields into metadata.

### 7.3 JSON-LD Product + Offer

Generate JSON-LD on the server from the validated public pool. Add a `Product` object with:

- `@context`: `https://schema.org`
- `@type`: `Product`
- `name`, `description`, `image` (valid absolute URL if present), `brand` as a schema `Brand` when `productBrand` is known and applicable, and `sku` only if a real identifier exists (do not fabricate one).

Include `offers` only if the page has an approved, verified price and the operator has confirmed the commercial terms. `Offer` must use `priceCurrency: 'INR'`, the actual verified `price`, actual `url`, and a valid `availability` value. `seller` must be the actual participating seller only if that name is approved and accurate. Use `priceValidUntil` only when the dealer has explicitly supplied a valid-through date; a pool deadline is **not automatically** the validity of a dealer price. If price is unverified, omit `offers` instead of presenting a guessed group price as a verified deal.

Serialize JSON-LD safely. Never concatenate raw user content into an HTML string. A helper should JSON.stringify the object and escape `<` to `\\u003c` before embedding so content cannot close a script element. Validate image and URL schemes. Use only the canonical public deal URL.

In mock mode, include no indexable Product/Offer markup for fictitious offers; either omit JSON-LD or render Product-only structured data while the page is noindex, and show the demo banner. Do not represent demo price estimates as a real `Offer`.

### 7.4 FAQ structure

Render a keyboard-accessible FAQ accordion. FAQs must be visible to the user, relevant to the specific deal/city, and consistent with page copy. FAQ structured data is optional; do not depend on FAQ rich results being shown by search engines. If FAQ JSON-LD is added, it must exactly reflect visible question/answer text and must not contain hidden promotional claims.

### 7.5 `app/sitemap.ts`

- Use `MetadataRoute.Sitemap`.
- Include `/`, approved city pages, approved category pages and public deal detail pages with `ACTIVE`/`UNLOCKED` status only.
- Do not include `/admin`, `/api`, `LEAD_FALLBACK`, `CLOSED`, test/preview URLs, or duplicate canonical URLs.
- Query the safe public repository at runtime; do not require database access during `next build`. If live data is unavailable in local development, provide a small mock sitemap for local testing. In production with missing DB configuration, return only safe static public routes or an empty deal list; never claim demo deals are live.
- Use the `lastModified` timestamp only when derived from actual `updated_at` or known content revision dates. Do not set a fake daily update time.

### 7.6 `app/robots.ts`

- Disallow `/admin` and `/api/` for all crawlers.
- Add the absolute sitemap URL from `NEXT_PUBLIC_SITE_URL`.
- On a deliberate demo deployment, `robots` should disallow indexing of the demo app; also set noindex metadata on pages. Robots disallow alone does not guarantee de-indexing.
- Do not block important public assets required to render/understand the public pages.

### 7.7 Internal linking and thin-page safeguards

- Home links to city/category pages and individual deal pages.
- City pages link to their active deals and relevant categories.
- Category pages link to their active deals and city pages.
- Deal pages link back to their city/category and to similar active pools.
- Never create a route for a random city/category slug just because a request exists. Keep the indexable set finite and useful.

---

## 8. Admin Command Center Specification

### 8.1 Authentication UI and route protection

`/admin` presents the admin dashboard only after a server-side session check. Without an authenticated session, redirect to `/admin/login` or show a login state. Ensure no lead data is rendered into unauthenticated HTML or RSC payloads.

`/admin/login` contains a passkey field and submit button; no signup, public accounts, passwords stored in Supabase, or default credentials. On successful `/api/admin/session` POST, the server sets the signed cookie; the browser must not receive a reusable token to store in localStorage.

Set `robots: { index: false, follow: false }` on admin pages. Never cache admin pages or API results publicly.

### 8.2 Pools tab

Admin can:

- List/search/filter pools by status, city and category.
- Create a pool with validated slug, name, category, city/city slug, prices, target, deadline, image, descriptive text and optional private dealer details.
- Edit supported fields and deadline/target.
- Transition status to `ACTIVE`, `UNLOCKED`, `LEAD_FALLBACK`, or `CLOSED` with confirmation when moving into an irreversible/business-significant state.
- When marking `UNLOCKED`, require: `current_buyers >= target_buyers`, a verified dealer name/terms, a verified price, a valid HTTPS token-payment URL, and token amount (₹499–₹999 if using the default policy). If the operator intentionally unlocks below target, require a clear override reason stored in the admin audit log if an audit table is added; otherwise do not offer the override in MVP.
- When marking `LEAD_FALLBACK`, ask for confirmation and do not delete or hide the leads from admin.
- Never automatically switch status from the UI based only on a client-supplied buyer count.

**Important schema fit:** all required fields are in `pools`; sensitive fields remain only in server/private table reads. A public `PublicPool` DTO must be constructed from safe columns, never by returning the full `pools` row.

### 8.3 Leads & Buyers CRM tab

Show a paginated table with server-side filtering. Required filters:

- Pool
- City
- Buying timeline (`WITHIN_7_DAYS`, `WITHIN_15_DAYS`, `WITHIN_30_45_DAYS`)
- Has existing quote (`Yes`, `No`, `Any`)
- Lead status
- Optional text search across name, phone and note only for admins

Columns: joined date, pool, buyer number, name, mobile, city, timeline, existing quote flag/amount, extra note, lead status and actions. On small screens use a deliberate stacked row or horizontally scrollable table with accessible labels; do not truncate the note without a way to inspect it.

- CSV export uses the **same filters currently active in the UI**, validated server-side, and exports only the selected filtered result set. CSV must include an explicit header row and quote/escape commas, double quotes, and newlines according to RFC 4180. Prevent spreadsheet formula injection: prefix cells starting with `=`, `+`, `-`, `@`, tab or carriage return with a safe apostrophe or equivalent neutralization before writing CSV. Do not put a JSON blob in a `.csv` file.
- Use a safe filename such as `poolbuy-leads-YYYY-MM-DD.csv`. Return `Content-Disposition: attachment` and `Cache-Control: no-store`.
- Do not put names/phone numbers in application logs or analytics events.

### 8.4 WhatsApp follow-up actions

Provide three explicit templates:

1. **Pool unlocked — refundable token:** only available when the pool is `UNLOCKED`, its dealer terms are verified, and a valid payment URL exists. Message explains token amount, refund conditions, final dealer terms and the payment link without implying payment has occurred.
2. **Lead fallback — dealer offer:** available when admin has decided to contact a lead under the site's stated consent terms. It uses an approved offer and the operator's real contact details; do not invent a dealer name, phone or price.
3. **Quotation follow-up:** asks whether the buyer can voluntarily share/confirm the existing quote; does not demand private documents or imply a guaranteed competing offer.

Construct `https://wa.me/91${phone}?text=${encodeURIComponent(message)}` only from a validated 10-digit number. Use a normal clickable link/button that opens WhatsApp in a new tab with `rel="noopener noreferrer"`. The action opens a prefilled message; **it does not send automatically**. Show an explicit note: `Review the message in WhatsApp and press Send.`

Never let a public request choose an arbitrary message template or payment URL. The template selection and private fields are determined server-side from the pool/lead records.

### 8.5 Demand Discovery tab

Show requests with product, city, category, optional name/phone/note, status, request date and `REQUESTED`/`REVIEWING`/`APPROVED`/`REJECTED` controls. Search/filter by city and status. Marking `APPROVED` means admin has accepted the idea for investigation, not that a pool is live. A separate explicit create-pool workflow is needed before it appears publicly.

---

## 9. Environment Variables — `.env.example`

Keep `.env.example` in the project root. Include empty or obviously fake values only; never put live secrets in this file.

```dotenv
# Public, canonical absolute URL. Use localhost only for local development.
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Supabase project URL and browser-safe publishable key.
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is preferred for modern projects.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
# Optional compatibility fallback for projects still using the legacy anon key:
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Server-only Supabase secret. NEVER prefix this with NEXT_PUBLIC_.
SUPABASE_SERVICE_ROLE_KEY=

# Admin passkey and separate HMAC cookie-signing secret.
ADMIN_PASSKEY=
ADMIN_SESSION_SECRET=

# Local-only/demo switch. Leave false or unset for production.
NEXT_PUBLIC_DEMO_MODE=false

# Optional operator contact values. Populate only with real, approved contact details.
NEXT_PUBLIC_SUPPORT_WHATSAPP=
NEXT_PUBLIC_SUPPORT_EMAIL=
```

### Environment handling requirements

- Parse/validate environment variables in `lib/env.ts` or equivalent. Required values should produce a clear server error, not an unexplained crash.
- Never fall back to `ADMIN_PASSKEY=admin`, hardcoded token secrets or a production default.
- `NEXT_PUBLIC_*` values are public and bundled into the client. Never store `ADMIN_PASSKEY`, `ADMIN_SESSION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, private token links, or dealer secrets there.
- `NEXT_PUBLIC_DEMO_MODE` may be used to display the demo mode, but server logic must also verify that any public write request is a permitted demo action. It does not bypass the need for server-side validation in live mode.
- `.env.local` belongs in `.gitignore`. Confirm it is not staged before any commit.

---

## 10. Validation, Errors, Privacy and Abuse Controls

### 10.1 Validation

Use Zod if already present or add it as a small, explicit dependency. Do not add a large validation framework. Every form has client validation for UX, Route Handler validation for request security, and SQL validation for public RPC calls. Trim strings; enforce maximum lengths; reject unexpected enum values; ensure numeric values are finite and in range.

For external URLs (`image_url`, `token_payment_url`, `dealer_offer_url`):

- Permit HTTPS in production.
- Permit local relative image paths only where expected, not payment/dealer links.
- Reject `javascript:`, `data:`, protocol-relative URLs and arbitrary non-web schemes.
- For payment URL, use an allow-list of accepted hosted-payment providers configured/approved by the operator. If no allow-list has been agreed, accept only manually reviewed URLs in the admin UI and show a warning; do not represent them as verified automatically.

### 10.2 Error contract

Use stable application error codes, for example:

- `INVALID_INPUT` — 400
- `INVALID_INDIAN_MOBILE` — 400
- `POOL_NOT_FOUND` — 404
- `POOL_NOT_OPEN` — 409
- `DUPLICATE_INTEREST` — not necessarily an error; return `alreadyJoined` result from the RPC
- `ADMIN_AUTH_REQUIRED` — 401
- `ADMIN_FORBIDDEN` — 403
- `CONFIG_MISSING` — 503
- `RATE_LIMITED` — 429 when an appropriate limiter is available
- `INTERNAL_ERROR` — 500 with generic public message

Map expected Postgres RPC errors to these codes. Do not leak raw SQL details to the browser.

### 10.3 Consent and data minimization

- Phone, name, quote details and extra notes are personal information. Collect only what is needed to manage the pool and respond to the stated request.
- Record `consent_at` and `privacy_notice_version`; show the applicable privacy notice at submission.
- No public lead directory or client-side query to `pool_leads`.
- Do not send full lead data to third-party analytics or write it to logs.
- Lead export and dealer sharing are admin actions; document that these actions are subject to the site's privacy terms and applicable law. Do not claim compliance certification.
- Provide a way for the operator to handle correction, unsubscribe/do-not-contact, and deletion/anonymization requests. An initial simple `DO_NOT_CONTACT` lead status is mandatory in MVP.
- Do not collect payment credentials in PoolBuy. Use a verified hosted payment page only after an admin has confirmed the terms.

### 10.4 Abuse controls

- Unique phone-per-pool constraint and server-side schema validation.
- Prevent repeated clicks/double submission in UI and use idempotent join RPC.
- Consider bot traps and a configurable edge/WAF rate limit before public launch. Do not depend on in-memory process state for rate limits on a serverless platform.
- Avoid exposing database UUIDs as authorization. UUIDs are identifiers, not secrets.
- Verify status and deadline inside the SQL RPC and again at the route boundary for clear errors.

---

## 11. Original Implementation Plan — Six Baseline Phases (Historical)

> The following Phase 1–6 prompts are retained as the original baseline record because the owner reports that all six phases have already been implemented. Do NOT run them again or reinitialize the project. For the current upgrade, the authoritative implementation sequence is Section 17.8, V2 Phases A–F. This is especially important because dynamic categories, minimal buyer forms and multi-city-but-city-specific pools supersede some original assumptions.

The IDE agent must execute phases in order. Each phase prompt below is intended to be copied into Antigravity IDE. Do not ask the agent to implement all six phases in one pass. After each phase, compare the output to the verification checklist before proceeding.

### Phase 1 — Repository Baseline, Design System and Mock-Mode Public Shell

**Goal:** Create a compiling mobile-first shell under the existing root `app/` directory, a coherent design system and clearly labeled mock pool cards, without requiring Supabase credentials.

**Files to create/modify:**

- Modify: `AGENTS.md` only if needed to make it point to this file as authoritative (preserve any useful existing instructions).
- Modify as needed: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`.
- Create: `app/loading.tsx`, `app/error.tsx`, `app/not-found.tsx`.
- Create: `components/site-header.tsx`, `components/site-footer.tsx`, `components/demo-banner.tsx`, `components/pool-card.tsx`, `components/pool-progress.tsx`, `components/empty-state.tsx`.
- Create: `lib/constants.ts`, `lib/format.ts`, `lib/mock-data.ts`, `lib/data-mode.ts`, `types/index.ts`.
- Create fallback assets under `public/images/` if necessary.
- Preserve the current `package.json`, lockfile, Tailwind v4 import pattern, Turbopack/PostCSS config and generated Next config unless an actual build error requires a minimal correction.

**Exact prompt for the IDE agent:**

```text
Read MASTER_BLUEPRINT.md and AGENTS.md completely before editing. Implement Phase 1 only: repository baseline, light mobile-first design system, root App Router shell, typed pool/category/status models, constants/formatting, and clearly labeled mock pool cards. The project already uses Next.js 16.4+ create-next-app app-tw, TypeScript, Tailwind v4, root app/ (no src/). Preserve current package/config versions and don't reinitialize or switch package managers. Do not add Supabase operations or admin features in this phase. Add six typed illustrative pools with price_is_verified=false, no fabricated lead PII, and a visible “Demo data — not a live dealer offer” banner whenever demo data is used. Build responsive header/footer, cards, clamped progress bars, Indian currency formatting, status labels and empty/loading/error UI. All visible CTAs must navigate or have a real disabled state; do not leave placeholder handlers. Make the home page render without any env variables and without network calls at build time. Then run npm run lint, npx tsc --noEmit and npm run build; fix actual errors and report exactly which files changed and which commands passed. Stop after Phase 1.
```

**Browser verification at `http://localhost:3000`:**

1. Run `npm run dev` and open `/`.
2. Confirm the app loads without `.env.local` or Supabase keys.
3. Confirm the demo banner is visible and does not look like a live dealer advertisement.
4. Check six pool cards; prices are formatted as INR and marked illustrative; no card promises a guaranteed discount.
5. Resize to 375px wide and desktop width: no horizontal page overflow, no overlapping header/CTA, readable card contents.
6. Check missing image fallback, zero progress, full progress clamping, missing price behavior and expired-deadline presentation using local mock fixtures.
7. Verify navigation/footer links are real links or intentionally disabled with an accessible reason.
8. Confirm lint, TypeScript check and production build all pass before Phase 2.

**Phase gate:** no Supabase keys required; no private key or fake buyer PII; clean build.

### Phase 2 — Supabase Schema, Safe Data Layer, Mock Persistence and Public RPCs

**Goal:** Implement the database schema and robust live/mock repository boundaries while preserving the Phase 1 UI.

**Files to create/modify:**

- Create: `supabase/schema.sql` using Section 4 as the authoritative schema.
- Create/modify: `.env.example`, `.gitignore`.
- Create: `lib/supabase/public.ts`, `lib/supabase/admin.ts`, `lib/pools.ts`, `lib/leads.ts`, `lib/requests.ts`, `lib/validation.ts`, `lib/demo-store.client.ts`.
- Create/modify: `app/api/pools/[poolId]/join/route.ts`, `app/api/pool-requests/route.ts`.
- Modify: `lib/data-mode.ts`, `lib/mock-data.ts`, `types/index.ts`, `app/page.tsx` only where needed to consume the repository.
- Add any small server-only env validation helper, e.g. `lib/env.ts`.

**Exact prompt for the IDE agent:**

```text
Read MASTER_BLUEPRINT.md. Implement Phase 2 only. Create the full idempotently seeded initial Supabase schema from Section 4, including enums, pools/pool_leads/pool_requests, constraints, indexes, public_pools safe view, RLS, column grants, updated_at triggers, the transactional buyer-number/current_buyers trigger, and validated join_pool and submit_pool_request RPCs. Use exactly the enum values and field names in the blueprint. Do not seed fabricated lead rows; start seeded current_buyers at zero. Split public and admin Supabase clients; mark the service-role module server-only and never import it in client code. Implement a typed repository that uses Supabase when configured and clearly labeled mock data in local development when keys are absent. Live production DB errors must not silently return mock data. Add public route handlers that validate payloads and map RPC errors into safe API error codes. In mock mode, persist only demo submissions in browser localStorage, never claim server persistence, and keep the demo banner visible. Add .env.example with placeholders only. Test database RPC/duplicate behavior against a development Supabase project if available; if not, report that DB execution remains unverified and verify SQL statically. Run lint, tsc and build. Do not implement admin features or SEO routes yet.
```

**Browser / database verification:**

1. No Supabase env: `/` still works and the demo banner stays visible.
2. In mock mode, join one pool; the success state says demo-only and a reload in the same browser preserves the demo submission/count if localStorage demo persistence was implemented.
3. Submit the same phone for the same pool twice; the UI must not create two demo leads or count twice.
4. Submit invalid mobile, blank name, a too-long note, mismatched city and invalid timeline; client and server reject them with helpful errors.
5. Configure a disposable Supabase project and run `supabase/schema.sql`; inspect six pools and RLS/column grants using Section 4.3 SQL.
6. Call `join_pool` twice for the same pool/number; verify first result is new, second is already joined, and count increments exactly once. Verify a closed/expired pool rejects joins.
7. Verify anonymous select of `pool_leads`, `pool_requests` and `pools.token_payment_url` is denied.
8. Run lint, `npx tsc --noEmit`, build.

**Phase gate:** public reads/writes have an explicit mock/live mode; schema's core security behavior is verified or clearly reported unverified against a real Supabase instance.

### Phase 3 — Public Buying Journey, Interest Modal and Demand Discovery

**Goal:** Complete the public user flow from browsing to joining, celebration/share, and requesting a new pool.

**Files to create/modify:**

- Create/modify: `components/pool-catalog.tsx`, `components/join-pool-modal.tsx`, `components/join-success.tsx`, `components/pool-request-form.tsx`, `components/countdown.tsx`.
- Modify: `app/page.tsx`, `components/pool-card.tsx`, `components/pool-progress.tsx`, `lib/whatsapp.ts`, `lib/demo-store.client.ts`, `lib/validation.ts`, `lib/constants.ts`.
- Use Phase 2 routes: `app/api/pools/[poolId]/join/route.ts`, `app/api/pool-requests/route.ts`.

**Exact prompt for the IDE agent:**

```text
Read MASTER_BLUEPRINT.md. Implement Phase 3 only: complete public pool filtering by city/category, the accessible JoinPoolModal, server-backed interest submission, buyer success state, safe WhatsApp viral share link, deadline/countdown display, and Request a New Pool form. Follow Section 6 exactly. Required fields are name, 10-digit Indian WhatsApp number, pool city, buying timeline (7 days / 15 days / 30–45 days), quote flag, optional quote amount and optional note. Validate the number with ^[6-9][0-9]{9}$ after normalization on client, Route Handler and SQL. Use the live join RPC in configured mode; use localStorage only in explicit demo mode and label it. The success screen must show buyer number, updated count, remaining target count and a one-click WhatsApp share link that makes no unsupported savings guarantee. Prevent double-click races and handle duplicate phone submission idempotently. Request submissions must go through the validated pool-request route/RPC. Do not add admin dashboard or SEO pages in this phase. Run lint, tsc, build and verify each public scenario listed below.
```

**Browser verification:**

1. Click “Join Pool for Free”: modal opens, focus is inside, Escape and close button work, focus returns to trigger.
2. Blank required fields show inline errors; `1234567890` and `5123456789` fail; `9876543210` is accepted by the front-end validator but still only accepted by server/database if other fields are valid.
3. Quote toggle reveals quote amount; unchecking clears/disables amount.
4. Submit valid live test data to a disposable Supabase pool; confirm `You are Buyer #N`, correct count/remaining and only one lead row. Do not use actual buyers' phone numbers for test fixtures.
5. Repeat the same number in that pool; confirm duplicate message and no count increment.
6. Inspect WhatsApp share URL: correct city/product/deal URL, encoded text, no private phone/notes/payment link, and no guaranteed savings when unverified.
7. Submit a product request; verify success only when RPC returns success; test field validation and mock-only feedback.
8. Test all filters, empty results, expired deadline and status-specific CTA. Run lint, tsc and build.

**Phase gate:** entire zero-login buyer journey works from the browser with truthful demo/live outcomes.

### Phase 4 — Secure Admin Command Center and Lead CRM

**Goal:** Deliver protected admin login, pools management, lead CRM, CSV export, WhatsApp templates and demand discovery.

**Files to create/modify:**

- Create: `lib/admin-auth.ts`, `lib/require-admin.ts`, `lib/csv.ts`, `lib/whatsapp.ts` if not finished in Phase 3.
- Create: `components/admin-login-form.tsx`, `components/admin-dashboard.tsx`, `components/admin-pools-tab.tsx`, `components/admin-leads-tab.tsx`, `components/admin-requests-tab.tsx`.
- Create/modify: `app/admin/page.tsx`, `app/admin/login/page.tsx`.
- Create: `app/api/admin/session/route.ts`, `app/api/admin/pools/route.ts`, `app/api/admin/pools/[poolId]/route.ts`, `app/api/admin/leads/route.ts`, `app/api/admin/leads/export/route.ts`, `app/api/admin/leads/[leadId]/whatsapp/route.ts`, `app/api/admin/pool-requests/route.ts`, `app/api/admin/pool-requests/[requestId]/route.ts`.
- Modify: `.env.example`, `types/index.ts`, `lib/supabase/admin.ts`, `lib/validation.ts`.

**Exact prompt for the IDE agent:**

```text
Read MASTER_BLUEPRINT.md. Implement Phase 4 only: admin passkey login with a signed HttpOnly cookie, server-side authentication guards on every /api/admin route, pools management, server-paginated/filtered leads CRM, RFC-4180-safe CSV export with spreadsheet formula-injection neutralization, WhatsApp message-template links, and demand-discovery requests. Use ADMIN_PASSKEY plus a separate ADMIN_SESSION_SECRET; no default credentials and no localStorage token. Compare passkeys safely, set Secure in production / SameSite=Strict / HttpOnly / Path=/ / no Domain, expire session within 8 hours, and verify signature/expiry for every protected request. Ensure service-role imports are server-only and only reachable after auth. Private payment/dealer links must never reach public pool DTOs. Unlocking requires target reached, verified price/terms, token amount and valid HTTPS payment URL; failed pools go to LEAD_FALLBACK only through explicit admin action. CSV must use active filters, quote fields correctly and neutralize spreadsheet formulas. WhatsApp buttons open a prefilled message for operator review; they do not send automatically. If admin secrets are missing, fail closed with a setup message. Implement every control; do not leave placeholder actions. Run lint, tsc, build and perform the unauthenticated/authenticated test matrix.
```

**Browser/security verification:**

1. With no `ADMIN_PASSKEY` or session secret configured, `/admin` cannot reveal leads and protected APIs return a setup/auth failure.
2. With local-only secrets in `.env.local`, wrong passkey fails; correct passkey logs in; cookie is HttpOnly and not available to `document.cookie`; it is Secure in production.
3. Call each `/api/admin/**` route while logged out: no private data or mutations are returned/performed.
4. Change a pool to `UNLOCKED` without target/verified terms/payment link: request is rejected with a clear message. Complete all requirements and unlock successfully.
5. Apply each lead filter; ensure count/pagination matches the returned records.
6. Export the filtered set; open in a spreadsheet; verify UTF-8, headers, comma/quote/newline escaping, formula neutralization, date/filters and no unrelated leads.
7. Click each WhatsApp template for appropriate pool status; confirm URL encodes message and phone; no automatic sending; non-unlocked pool cannot receive token link template.
8. Submit a new pool request and review/update status in Demand Discovery.
9. Inspect network responses and browser bundles for `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSKEY`, token URLs and other private fields. None may be present.
10. Run lint, tsc and build.

**Phase gate:** server-side admin authorization works independently of the UI; no public lead PII or private payment URL leaks.

### Phase 5 — City, Category and Deal SEO, Metadata and Structured Data

**Goal:** Implement crawlable, non-thin local/category/deal pages, metadata, safe JSON-LD, FAQ, sitemap and robots.

**Files to create/modify:**

- Create: `app/city/[citySlug]/page.tsx`, `app/category/[categorySlug]/page.tsx`, `app/deals/[citySlug]/[poolSlug]/page.tsx`.
- Create: `app/robots.ts`, `app/sitemap.ts`, `lib/seo.ts`, `components/faq-accordion.tsx`, `components/json-ld.tsx`.
- Optionally create: `app/deals/[citySlug]/[poolSlug]/opengraph-image.tsx` if a valid, performant social image can be generated from local primitives.
- Modify: `app/layout.tsx`, `lib/constants.ts`, `lib/pools.ts`, `components/pool-card.tsx`, `.env.example`.

**Exact prompt for the IDE agent:**

```text
Read MASTER_BLUEPRINT.md. Implement Phase 5 only: the finite allow-listed city landing pages, category landing pages, deal detail pages, Next.js 16 async params, per-page generateMetadata, canonical URLs, OpenGraph previews, safe Product/conditional Offer JSON-LD, visible FAQ accordion, sitemap and robots metadata routes. Use only public_pools fields for public SEO pages; verify the pool's citySlug and slug match. Use the central site URL helper. Product JSON-LD must not invent SKU/seller/price. Include Offer markup only when price_is_verified=true and real dealer terms are verified; otherwise omit Offer and display the conditional-price disclaimer. Do not include private lead or payment data in metadata. Limit indexable cities/categories to the approved mapping and useful inventory; fallback/demo pages must be visibly labeled and noindexed when running in demo mode. sitemap must exclude admin/API/fallback/closed/test routes and must not require database queries during build. Add internal linking and city/product-specific FAQ copy. Run lint, tsc, build, and inspect rendered metadata/JSON-LD and route behavior.
```

**Browser and SEO verification:**

1. Open `/city/bhopal`, `/city/indore`, `/category/ev-scooters`, `/category/electronics`, and a matching `/deals/bhopal/tvs-iqube-electric-scooter-bulk-deal` route.
2. Confirm unsupported city/category and city/pool mismatch produce 404s, not a generic deal page.
3. Inspect page source/metadata for title, description, canonical, absolute OpenGraph image and robots. Ensure there is only one canonical.
4. Inspect JSON-LD: valid JSON; `Product` present; no fake Offer for `price_is_verified=false`; Offer only for verified dealer terms.
5. Check the FAQ displayed on the page is the same content represented in any FAQ JSON-LD.
6. Visit `/sitemap.xml` and `/robots.txt`; ensure only approved public URLs and no `/admin`/API pages.
7. In demo mode, confirm explicit demo message and noindex/disallow policy; in live mode, confirm verified pages have intended index directives.
8. Verify share preview image is publicly accessible, has absolute HTTPS URL in production, and no auth is required.
9. Run lint, tsc and build.

**Phase gate:** metadata and structured data accurately describe real page content; mock/unverified offers are not falsely advertised to search engines.

### Phase 6 — Release Hardening, Regression, Deployment and Operational Runbook

**Goal:** Test the complete system, harden failure states, confirm Vercel/Netlify deployment configuration, and produce an operator runbook.

**Files to create/modify:**

- Add tests (use the repository's existing tooling if present; otherwise add the smallest compatible test setup): `lib/__tests__/validation.test.ts`, `lib/__tests__/format.test.ts`, `lib/__tests__/whatsapp.test.ts`, `lib/__tests__/csv.test.ts`, plus integration tests for route/auth/database behavior where credentials permit.
- Create/modify: `README.md`, `.env.example`, `.gitignore`, `AGENTS.md` only as needed, any final fixes to route handlers/components/SQL/SEO files.
- Optional: add `playwright.config.ts` and a small Playwright smoke suite if dependency/setup is appropriate; do not add a huge E2E framework without reason.

**Exact prompt for the IDE agent:**

```text
Read MASTER_BLUEPRINT.md. Implement Phase 6 only: end-to-end regression review, focused automated tests, final accessibility/security/error-state polish, deployment configuration verification for Vercel and Netlify's supported Next.js runtime, and a complete README operator runbook. Do not redesign or add unapproved features. Run npm run lint, npx tsc --noEmit, npm run build and the test suite. Test mock mode without Supabase; live mode with a disposable Supabase project; anonymous RLS; duplicate join concurrency/idempotency; expired/closed pool; admin no-session and bad passkey; missing secrets; CSV formula injection; invalid phone/URL; WhatsApp template eligibility; metadata/sitemap/robots. Check mobile width and keyboard accessibility. Verify the service-role key is not in client chunks, source maps, browser payloads or logs. Document exact Vercel and Netlify environment-variable settings, database schema deployment, migration/reseed caveats, smoke tests and rollback steps. Do not claim real production verification if credentials/deployment access were not provided. Report commands and evidence truthfully.
```

**Final verification checklist:**

- [ ] `npm run lint` passes.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run build` passes.
- [ ] Unit tests pass; live integration tests are either run against disposable Supabase or clearly marked unrun.
- [ ] No env secret is tracked by Git or included in a client bundle.
- [ ] Join RPC is atomic/idempotent and duplicate number does not increment count twice.
- [ ] Anonymous users cannot read leads/requests/private dealer fields.
- [ ] Admin routes reject requests without a valid signed session.
- [ ] CSV export filters match UI filters and formula injection is mitigated.
- [ ] Demo mode is visibly a demo and never represents mock records as real leads/dealer offers.
- [ ] SEO route map, canonicals, metadata, JSON-LD, sitemap and robots pass manual inspection.
- [ ] Mobile layout and all keyboard-accessible interactions work at 375px and desktop widths.
- [ ] README includes local setup, schema application, environment variable setup, admin login setup, deployment and rollback guidance.

**Phase gate:** report ready for staging only after all locally available checks pass. Report production readiness with caveats if live credentials or an authorized dealer verification process are not available.

---

## 12. Deployment and Operations

### 12.1 Local setup

From the project root:

```bash
npm install
cp .env.example .env.local
npm run dev
```

On Windows PowerShell, copy the file with:

```powershell
Copy-Item .env.example .env.local
```

For initial UI development, leave Supabase values empty and run in local mock mode. Before testing live writes, create a Supabase project, apply `supabase/schema.sql` in the SQL Editor, then fill the project URL, publishable/anon key, and service-role key in `.env.local`. Generate unique random values for `ADMIN_PASSKEY` and `ADMIN_SESSION_SECRET`; keep `.env.local` untracked.

### 12.2 Vercel

1. Import the existing Git repository into Vercel using the standard Next.js framework preset.
2. Keep the existing package manager and lockfile; build command should use the project scripts/default Next.js build, typically `npm run build`.
3. Add production environment variables in Vercel Project Settings → Environment Variables: `NEXT_PUBLIC_SITE_URL` set to the real HTTPS production domain, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy anon key), `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSKEY`, and `ADMIN_SESSION_SECRET`. Add the optional support contact values only if they are real and approved.
4. Keep `NEXT_PUBLIC_DEMO_MODE=false` or unset in production. Do not set a fake demo site URL as canonical.
5. Deploy, then smoke test `/`, one city page, one category page, one deal page, `/robots.txt`, `/sitemap.xml`, `/admin/login`, public join and authenticated admin actions.
6. Confirm the service-role key is only in server runtime environment; rotate it if it was ever committed or exposed.
7. For any database schema change after initial deployment, use a reviewed migration strategy and backup/inspect data before applying destructive SQL. Do not rerun seeds as a way to overwrite admin-edited pool records.

### 12.3 Netlify

1. Connect the repository to Netlify and ensure the site's Next.js framework/runtime integration supports the features used by the app. Use the currently supported Next.js adapter/runtime rather than configuring a custom server.
2. Keep the repository's package manager and lockfile. Use the build command `npm run build` unless the supported adapter documentation for the selected configuration specifies otherwise.
3. Configure the same server/public variables as Vercel in Netlify Site configuration → Environment variables. Secrets must be server-only; only variables prefixed `NEXT_PUBLIC_` may enter browser bundles.
4. Confirm dynamic Route Handlers, cookies, streamed CSV response, metadata routes and cache behavior run correctly on the selected adapter. If an adapter does not support a required route behavior, resolve that platform-specific limitation before launch rather than silently removing security checks.
5. Smoke test the same URL matrix and auth/lead privacy checks as the Vercel checklist.

### 12.4 Production launch checklist

Before public launch:

- Replace all demo copy/prices with dealer-verified terms or retain clear non-binding estimates and no Offer structured data.
- Verify each dealer relationship, token refund conditions, token recipient and payment domain in writing.
- Confirm real support contact details and reviewed privacy/terms pages before collecting real names and phone numbers.
- Verify how users consent to lead follow-up and dealer sharing; do not sell/share leads without the disclosed lawful basis/consent.
- Test a full join, admin unlock, WhatsApp link review, CSV export and lead opt-out using synthetic test data in a staging project.
- Remove demo environment flags and ensure mock data is not indexable.
- Confirm backups and schema migration process.
- Check security headers, dependency audit and platform logs; do not include personal data in logs.
- Confirm the admin passkey and session secret are unique and are not shared in screenshots, prompts, source control or browser-visible responses.

### 12.5 Operations and incident response

- If a service-role key or admin passkey is exposed, rotate it immediately and inspect logs/changes made during the exposure window.
- If an RPC or pool counter appears inconsistent, stop new joins for the affected pool, inspect `pool_leads` and `current_buyers`, and repair via a reviewed SQL transaction. Do not edit count fields blindly.
- If the payment URL or dealer terms change, update the pool only after re-verification. If terms are no longer valid, remove the token link and move the pool to a safe status before contacting buyers.
- If a buyer requests no further contact, set lead status to `DO_NOT_CONTACT` and ensure WhatsApp/export actions respect it. Do not include opted-out leads in marketing outreach by default.
- If a database query fails in production, display a controlled error and investigate; never silently switch to local mock content.

---

## 13. Acceptance Matrix

| Area | Required acceptance evidence |
|---|---|
| Local setup | Runs without Supabase keys in development, with visible demo banner |
| App structure | Root `app/`, no `src/`, Next 16 async route params |
| Public browse | Filters, progress, savings validation, deadline status, detail links work |
| Interest capture | Required fields, Indian mobile validation, city match, timeline, quote flag/amount, note length |
| Duplicate handling | Unique database constraint and idempotent RPC; one number increments once per pool |
| Counter integrity | Trigger assigns buyer number/count in transaction; no seeded orphan leads |
| Privacy | Anonymous role cannot read leads, pool requests, payment URL or dealer offer URL |
| Admin auth | HMAC-signed HttpOnly cookie; route guards; no default passkey; fail closed if secrets absent |
| Pool transitions | `UNLOCKED` gated on threshold/verified terms/payment link; fallback explicit and admin-controlled |
| Lead CRM | Pool/city/timeline/quote/status filters, pagination, note inspection |
| CSV | Same filters as UI, correct escaping, formula-injection mitigation, no-store attachment |
| WhatsApp | Correct encoded number/message, only eligible templates, manual send confirmation, no invented contacts |
| Demand discovery | New request saved through RPC; admin can view/review/status-change |
| SEO | Canonicals, async `generateMetadata`, product schema, conditional Offer, useful FAQ |
| Crawl controls | Sitemap excludes admin/API/fallback/closed/demo; robots disallows admin/API |
| Demo mode | Never labels mock data as live; no fake PII, no real dealer/payment claim |
| Deployment | Vercel/Netlify env documented; no custom server; serverless handlers tested |
| Quality | Lint, TypeScript, build and available automated tests pass |

---

## 14. Explicit Non-Goals for the First Six Phases

Do not build these unless the owner approves a later specification change:

- Buyer accounts/passwords/OTP login.
- Checkout, escrow, refunds, payment webhook processing, or storing payment credentials.
- Automated WhatsApp Business API campaigns. Initial WhatsApp buttons only open prefilled messages for a human to review and send.
- Dealer self-service portal or dealer login.
- Auto-unlocking pools based solely on count without operator confirmation of dealer terms.
- Automatic lead sharing or lead resale.
- Realtime subscriptions as a blocking MVP requirement.
- Large state-management frameworks, custom Express backend, microservices, queues, or a paid add-on without an approved need.
- Fabricated manufacturer authorization, verified prices, dealer contacts, buyer counts, reviews, or conversion statistics.
- Unbounded programmatic SEO pages from arbitrary database values.

---

## 15. Change-Control Protocol

Any agent proposing a change that affects database names, enum values, URL paths, status lifecycle, phone identity, admin authentication, public/private field boundaries, or deployment architecture must:

1. State the requirement conflict or technical reason.
2. Identify affected file paths and migration implications.
3. Propose the smallest compatible change.
4. Update this blueprint before implementing the incompatible change.
5. Add/adjust verification tests and the acceptance matrix.

Do not make speculative architecture changes silently. Do not remove security controls merely to make a test pass. If the IDE's actual setup differs from the assumed baseline, report the observed difference first and adapt the minimum amount necessary while retaining the root `app/` App Router and existing package configuration.

---

## 16. Official Technical References

Use current official documentation when resolving a version-specific detail; this blueprint's product/security rules take precedence over generic tutorials.

- [Next.js App Router documentation](https://nextjs.org/docs/app)
- [Next.js metadata and Open Graph images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images)
- [Next.js sitemap and robots metadata routes](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)
- [Next.js releases](https://github.com/vercel/next.js/releases)
- [Supabase Next.js tutorial and client patterns](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs)
- [Supabase JavaScript client](https://supabase.com/docs/reference/javascript/introduction)
- [PostgreSQL row-level security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Schema.org Product](https://schema.org/Product)
- [Schema.org Offer](https://schema.org/Offer)

**End of V1 baseline specification. Current V2 authority is defined by the amendment at the beginning and Section 17.**
---

# V2.0 CURRENT IMPLEMENTATION AMENDMENT — MULTI-CITY, CITY-SPECIFIC GROUP BUYING

**Amendment date:** 26 October 2026  
**Authority:** This amendment supersedes any conflicting V1 requirement elsewhere in this file. The original Phases 1–6 document the initial build and are historical baseline instructions; they must NOT be rerun from scratch. Implement the incremental V2 phases A–F in Section 17 against the existing local project.

## Current owner-approved product direction

PoolBuy India is a technology-first, local-fulfilment, fixed-kit demand aggregation and group-buying platform. The app is currently being developed and verified at `http://localhost:3000`. Do not deploy, change DNS, migrate the production domain, or modify a production database unless the owner explicitly authorizes that action.

- Multiple cities can be listed in one catalog, but **each installation-dependent operational pool belongs to exactly one city** and has independent demand, vendor/installer coverage, quotations, pricing tiers, deadlines, and fulfilment.
- Reuse a standardized product and its brand-kit templates across cities; never merge different cities' buyer counts to imply local installation demand.
- Launch candidates include rooftop solar (hero candidate), inverter+battery fixed combos, whole-house water softeners, 200 LPD solar water heaters, chimney + hob combos, and additional approved standardized kits. This is a flexible catalog, not a closed category enum.
- Customers join a published pool for free. Keep the join form minimal: name, Indian WhatsApp number, and chosen pre-defined kit; capture locality/area or PIN code where needed to determine installation coverage. The pool already determines the city. Do not require a password, a mandatory buying timeline, a “how many days can you wait?” answer, or a long technical questionnaire to join.
- Customer-driven `Request a New Pool` is available for items outside the current catalog/category list. A request is stored as a demand request and enters an authenticated admin review queue. **It never creates a public pool until the admin approves the request, standardizes the product/package, confirms local fulfilment feasibility and records an appropriate vendor/pricing plan.**
- The admin initially manages cities, categories, standardized product templates, local vendors, fixed kit options, quotations, price tiers, and offer publication. Do not build a vendor portal in this change set; reserve it for a future phase after the manual process is validated.
- A buyer target being reached is only a demand milestone. A discount is not confirmed until the relevant vendor has approved a written offer or a valid pre-approved quantity-based price tier exists.
- Do not enable real token payments during this upgrade unless the existing project already has a correctly configured, legally reviewed payment flow and the owner confirms the exact commercial policy. The old ₹499–₹999 values are not a binding V2 default. Token pricing and money movement must pass the explicit commercial decision gate in Section 17.8.
- Preserve privacy, server-side admin authorization, RLS, service-role isolation, CSV formula-injection protection, truthful demo mode, and verified-price rules.

## Conflict-resolution map

When V1 sections conflict with this V2 amendment, follow V2 and update the implementation/documentation accordingly:

| V1 area | V2 rule that supersedes it |
|---|---|
| Section 1.2: mandatory buying timeline and quote questions in join form | Remove mandatory timeline/quote questions from the primary join flow. Keep legacy columns nullable/backward-compatible where necessary; collect only name, WhatsApp number, selected fixed kit, and locality/PIN when needed. |
| Sections 3–5: six-value category enum and fixed category TypeScript union | Make categories admin-managed data, not a permanently hardcoded enum. Migrate existing values safely into a `categories` table or equivalent dynamic taxonomy. |
| Section 4.2: initial schema SQL and seed categories | Treat it as the V1 baseline for understanding existing data. Do not re-run it destructively against existing Supabase. Update clean-install schema and add reviewed, additive migrations for any database already initialized. |
| Sections 6.2–6.7: limited categories and fixed city lists | Public catalog supports multiple configured cities and dynamically managed approved categories. Every operational installation pool remains city-specific. |
| Section 8: original pool and request admin behavior | Extend admin to manage cities, dynamic categories, standardized products, fixed kits, per-city vendor offers, request approval, and pool creation from an approved request. |
| Section 11: Phases 1–6 execution prompts | These are the original build record, not the current execution plan. Execute only V2 incremental Phases A–F in Section 17. |
| V1 token default / unlock assumptions | No token collection merely because target was hit. Vendor terms and the exact money-flow model must be verified and approved first. |

---

## 17. V2 Incremental Upgrade Specification and External Benchmark

### 17.1 Purpose and current repository state

The original six-phase project is reportedly built and runs locally. The owner reports two unresolved live-data symptoms: a successful join briefly displays an incremented count, but a refresh resets it to zero; and an admin-created pool may report success but not appear in the public catalog. The repository itself must prove the root cause—do not assume one.

This upgrade adds the current business model to the existing system while fixing these data-integrity issues. It is not permission to initialize a new Next.js app, replace the stack, move to `src/`, wipe data, or redo every original phase.

### 17.2 External website benchmark: `https://poolbuy.app/`

The owner asked to review this website as a business/product benchmark. On 26 October 2026, its publicly readable homepage, group-buying explanation, and privacy page presented these product patterns. These are observations of the website's public claims; the site's actual backend, contracts, payment protections, and commercial results have not been independently audited.

**Potentially useful patterns to learn from, without copying its text, graphics, code, brand assets, or exact visual design:**

1. A short, free interest-registration journey before a customer must commit money.
2. Product/category selection plus a “Something else” path, so demand for unlisted items can be captured.
3. Locality/PIN-based matching to help identify suppliers capable of serving a buyer's area.
4. A post-submission share action and customer updates when a matching group/offer becomes available.
5. A public aggregate-demand view that does not expose names, phone numbers, or precise PIN codes; its stated policy uses a minimum cohort before displaying an item.
6. Written vendor prices and clear explanations of whether a displayed amount is indicative or a confirmed offer.
7. Direct purchase from the seller, with seller/dealer onboarding and the seller's fulfilment responsibilities made visible.
8. A clear “what happens if the group does not fill?” explanation before any booking/payment decision.
9. A seller-facing value proposition based on aggregated intent and payment tied to a completed sale, as described in its public copy.

**PoolBuy India should adapt the principles, not copy the implementation blindly:**

- Keep the primary join form shorter than the competitor's form: no mandatory buying timeline or waiting-period question in the V2 join flow.
- Since the intended products may need physical installation, use the selected city plus locality/PIN/vendor coverage as applicable. Do not hardcode a 5 km radius as a universal rule; let each vendor's verified service area and product type determine coverage.
- For ordinary installation kits, pools in Bhopal and Indore are separate even if the product is identical. A city can become active only when the admin has configured an appropriate local fulfilment option or clearly labels the demand as unserved/request-only.
- Do not expose individual participants or tiny-area demand publicly. Any discovery dashboard outside a known pool should aggregate data and apply a privacy threshold (default minimum 3 unrelated valid requests for a public aggregate; do not show phone, name, house, or exact PIN). An operator may choose a higher threshold for sensitive categories.
- The site currently uses the PoolBuy name and publicly identifies a separate operating company in its footer. Because the proposed project also uses “PoolBuy India”, the owner must perform an official trademark/company/domain clearance review before broad marketing or claiming exclusivity. The IP India official trademark search is at https://tmrsearch.ipindia.gov.in/tmrpublicsearch and the official guidance is at https://ipindia.gov.in/trade-marks-before-you-apply-search-existing-trademarks. This blueprint does not make a legal determination that the name is available or infringing.
- Do not claim that competitor-reported discounts, registrations, or safety measures are independently verified. Treat all benchmark observations as website statements, not audited outcomes.

**Observed competitive mechanics (summary only):** the homepage describes free registration, local/pincode-based grouping, group-price examples for different buyer counts, written seller terms before payment, direct seller purchase, a booking payment credited toward the purchase price, and a seller fee after a delivered sale. Its privacy page says publicly visible demand is aggregated and personal details are shared with a seller only at a later stage in the journey. These patterns are reference points, not mandatory PoolBuy policies. Source URLs: https://poolbuy.app/ ; https://poolbuy.app/what-is-group-buying ; https://poolbuy.app/privacy .

### 17.3 V2 domain model: catalog entities versus operational pools

Separate reusable definitions from local campaigns. Reuse equivalent existing tables if they already provide the same behavior; do not create duplicate tables just to match these names.

#### A. `cities`

Admin-managed city directory. Minimum conceptual fields: `id`, `name`, unique `slug`, `state`, `is_active`, `created_at`, `updated_at`. Optionally include public display text and service-region metadata.

- Seed/migrate existing city values such as Bhopal, Indore, Pune, Delhi, Mumbai, and Banda only where appropriate to the existing data.
- The city list in public filters comes from active configured city records, not duplicated hardcoded arrays.
- Adding a city in admin must not imply that a local installation vendor already exists.
- A city can be marked `demand_only`/not operational (or represented through equivalent existing fields) until a local vendor/fulfilment route is verified.

#### B. `categories`

Admin-managed dynamic categories. Minimum conceptual fields: `id`, `name`, unique `slug`, description, `is_active`, sort order, timestamps. A category may also be `draft` until the admin publishes it.

- Do not make a PostgreSQL enum the sole source of available product categories.
- Existing enum values must be backfilled into the dynamic category table.
- Avoid deleting or rewriting historic category data during migration.
- Public category pages and filters derive from active published categories with appropriate inventory.
- A new free-text request does not automatically create a category.

#### C. `products`

Reusable standardized product definitions. Minimum conceptual fields: `id`, `name`, unique/controlled `slug`, `category_id`, description, installation-required flag, standardization notes, `is_active`, timestamps. Do not store per-city price as the product's global price.

#### D. `product_kits` (or equivalent reusable fixed-kit template)

Represents one predefined option with a brand and exact model/SKU. Fields should capture brand, model/SKU, display name, technical configuration, included components, exclusions, warranty details, standard installation scope where applicable, and active state.

Customers select from these predefined options. They do not build a custom kit from loose components. If a product legitimately has no brand choice, use one fixed standard package instead of adding empty configuration screens.

#### E. `pools`

A pool is an operational campaign for one product in exactly one city, optionally with a defined vendor service area. Reuse existing pool records and IDs.

Every operational pool must have an unambiguous city reference and its own status, target count, deadline, buyer count, publication state, vendor/fulfilment requirements, offer validity, and timestamps.

The same product may have separate pool records in several cities. Each pool has its own city-specific quotation and demand. No public query may sum different cities into one installation-dependent buyer count.

Prefer city UUID foreign keys in the new normalized model. If the existing slug/text columns must remain for compatibility, backfill them and add controlled consistency checks before changing read paths. Do not break existing SEO URLs while adding the city key.

#### F. Local vendor/fulfilment records

If there is no usable vendor model already, create an admin-managed `vendors` table or equivalent. Track business name, city/service area, product/category coverage, status, authorization/verification notes, contact information (private), quotation availability and timestamps. Vendor verification claims must reflect evidence the operator actually checked.

No vendor login or self-service portal in this upgrade. All vendor data mutations remain admin-only.

#### G. Pool kit offers / city-specific offers

A pool can offer several predefined kit choices. A pool-kit-offer join table (or equivalent) should bind a reusable kit to a specific city pool and a valid vendor quote. Track per-offer reference price, current quoted price, conditional target price, price verification state, quotation date, validity, inclusions/exclusions, vendor reference, and publication state.

Track both total pool interest and selected-kit demand. If the pool has 10 interested customers but only 6 have selected Waaree, do not tell the Waaree vendor that 10 Waaree buyers are committed unless a written vendor arrangement explicitly defines a shared mixed-brand tier.

#### H. Price tiers and history

Support two modes:

1. **Pre-approved quantity tier:** a vendor has confirmed quantity thresholds, prices, scope, and validity in writing. The system can apply a tier when its condition is met and the quote remains valid.
2. **Fresh quotation required:** demand reaches a threshold, but the admin must obtain a new quotation. Until it is confirmed, the public state says that a quote is pending; it must not fabricate a lower price.

Store each material quotation/offer change as an immutable history event or versioned record with old/new values, vendor/source, quantity condition, timestamp, validity, operator and status. Do not silently overwrite evidence needed to explain a price displayed to a customer.

#### I. `pool_leads`

Preserve existing leads, UUIDs, and current buyer numbers. Add fields only through safe migrations as necessary, including the selected pool-kit offer and locality/PIN code when needed for installation matching. The pool city is authoritative and must not be overwritten by arbitrary client form input.

The join form must not require `buying_timeline` in V2. Existing records and legacy admin filters must remain valid: make the field nullable or use an equivalent backward-compatible “not supplied” representation after reviewing the existing schema and TypeScript contracts. Do not fabricate timeline values for old leads.

Duplicate protection remains `UNIQUE(pool_id, normalized_whatsapp_number)`. Per-pool buyer numbers and `current_buyers` must remain transactionally consistent. A duplicate join must not create another buyer or send a duplicate success-notification event.

#### J. `pool_requests`

Allow demand for any product/category, including one that does not exist yet. Retain the submitted free text. Suggested fields include request ID, requested product text, optional requested brand/model, requested city, optional locality/PIN, contact name, normalized WhatsApp number, optional note, consent timestamp/version, review status, reviewer note, review timestamps, linked standardized product/category IDs after approval, and resulting pool ID after creation.

The existing V1 `category public.pool_category` enum cannot by itself support future categories. Introduce a dynamic category foreign key and/or free-text category label with a safe migration. Do not require an unknown category to cast into an old enum. Preserve the old field until dependent code and data have migrated.

Requests progress through a controlled review process such as `SUBMITTED`, `UNDER_REVIEW`, `NEEDS_INFORMATION`, `APPROVED`, `REJECTED`, and `CONVERTED_TO_POOL`. Reuse existing statuses where possible and migrate carefully. “Approved” means the product idea is accepted for validation, not necessarily published; the actual pool needs its own explicit create/publish action.

### 17.4 Buyer journey and local serviceability

#### Existing pool join

The form must be minimal and product-aware:

**Required:** name, valid 10-digit Indian WhatsApp number, one predefined kit selection if the pool has multiple options, and the applicable consent checkbox/text required by the approved privacy design.

**Locality/PIN code:** required only when needed to establish local installation/delivery coverage; otherwise optional. The city is inherited from the pool and shown to the user. Do not ask for city again in the join modal when the pool already defines it.

**Remove from the primary join form:** mandatory buying timeline, mandatory wait-period question, mandatory quote amount, and long customization fields. Optional note may remain if it is genuinely useful. A product-specific follow-up can collect more information later, with the customer's permission.

The join experience must state that registration is free and does not constitute a purchase or guarantee a price. Keep the success page concise, show the authoritative buyer count/number, and offer a gender-neutral share link.

Suggested neutral share text (do not reproduce the old “chuka/chuki” version):

> Main PoolBuy par {{Product Name}} ke group-buy pool mein interest register kar raha/rahi hoon.
> Jitne zyada log judenge, utna better bulk price negotiate karne ka mauka ho sakta hai.
> Latest verified offer aur pool details: {{Production Deal URL}}
> Aap bhi pool join karke interest register kar sakte hain.

For the most gender-neutral version, avoid first-person gendered verb forms entirely:

> Maine PoolBuy par {{Product Name}} ke group-buy pool mein interest register kiya hai. Jitne zyada log judenge, utna better bulk price negotiate karne ka mauka ho sakta hai. Latest verified offer aur pool details: {{Production Deal URL}}. Aap bhi interest register kar sakte hain.

Do not claim a particular saving amount or “deal unlocked” unless the relevant price is verified and the pool status allows that claim.

#### Request a New Pool

Keep it short but contactable:

- Product/package requested (required free text).
- City (required, selected from configured cities or submitted as a validated request for an unconfigured city).
- Name (required).
- WhatsApp number (required and validated).
- Locality/PIN and short note/brand preference (optional or conditionally required for installation feasibility).
- Clear notice that PoolBuy may contact the user about the request, and a separate clear choice before sharing personal contact details with a supplier.

A request for an unconfigured city may be saved as a request, but it must not produce an operational pool until a city/vendor and fulfilment arrangement is approved.

#### Locality matching

Do not impose a universal 5 km rule. For installation-dependent products, check city and vendor service-area/PIN coverage. The admin may define a service zone or relevant PIN code list for a vendor/pool. If coverage is unknown or unavailable, allow a request or interest record but do not show “installation available” or a confirmed local price.

For the public “demand discovery” view, show only aggregated, privacy-preserving counts. Never display names, WhatsApp numbers, exact home addresses, or exact PIN codes. For new/unpublished requests outside a known pool, default to showing a public aggregate only after at least 3 unrelated valid requests exist for that same standardized item and locality group. This threshold is a privacy rule, not an offer/price threshold.

### 17.5 Admin workflow and publication controls

Extend the existing admin screen rather than building a separate app. Preserve authentication and every server-side route guard.

Required admin capabilities in V2:

1. **Cities:** create/activate/deactivate cities; see which have eligible vendor coverage; do not label a city fully operational without a checked fulfilment route.
2. **Categories:** create/manage arbitrary categories; category slugs unique; draft categories remain private until deliberately published.
3. **Products:** create standardized product templates; capture whether installation is needed; link product to a category; avoid duplicate templates with an admin search.
4. **Fixed kits:** define brands, exact models/SKUs, specs, inclusions, exclusions, warranty and standard installation terms.
5. **City pools:** create a separate pool for a product in a chosen city. The same product can be reused in more cities without copying other city's pricing or leads.
6. **Vendors:** initially record and manage local vendors/coverage manually. No vendor login in V2.
7. **Kit offer/prices:** link a pool to approved kit options and quotations; publish only verified offers.
8. **Demand Requests:** search/filter requests, review duplicate demand, approve/reject/ask for information, create a product/category if appropriate, then explicitly create/publish a pool and link the request(s).
9. **Price history:** retain all published offer versions and the evidence/date/source for each update.
10. **Audit trail:** record admin actor and timestamp for category creation, pool publication, quote changes, status transitions, and token-related changes if configured.

Do not automatically create a new city, category, product, vendor, or public pool from an anonymous request without admin review.

### 17.6 Financial model and token decision gate

The current owner proposal has discussed a customer token between roughly ₹799 and ₹2,499, credited toward the agreed deal price, with the remaining balance paid to the local vendor. The competitor website's public copy describes a different arrangement: a booking amount credited to the seller's price and a fee paid by the seller after a delivered sale. These are different commercial flows; do not mix them in code or user-facing explanations.

Before enabling any real payment feature, the owner must select and document one exact model with accounting/payment-provider/legal review:

**Model A — Seller-paid success fee (reference option):** customer booking/deposit is handled through the supplier or a suitably configured payment provider and is credited toward the customer's purchase price; PoolBuy invoices/receives an agreed seller fee only under a written success-fee agreement after the defined sale/delivery milestone.

**Model B — Customer-paid booking/token credited toward price:** the buyer pays a disclosed amount to the specified recipient, that exact amount is deducted from the remaining purchase price according to the signed vendor agreement, and the vendor's receivable is calculated accordingly. The terms must define who is merchant of record, how the amount is settled, platform revenue/tax treatment, cancellations, refund responsibility, disputed transactions and payment-provider support.

**Model C — Separate customer service/platform fee:** only if explicitly approved and disclosed as a genuine additional fee. Do not simultaneously claim it is extra platform revenue and also count it as a credit against the vendor's price without a corresponding reconciled ledger and signed agreement.

No model is automatically endorsed by this technical specification. Until the model is chosen and tested, keep live payment collection disabled. The MVP may publish a verified offer and give instructions for direct vendor purchase, but it must not pretend to process a token or generate fake payment success.

Do not use “refundable” unless the refund conditions, payer/recipient, processing responsibility and time expectations are documented. Do not call a customer fee a “platform commission” in tax/accounting records without appropriate professional advice.

### 17.7 Known defects that must be verified locally

The owner reports:

- The join success UI increments the buyer count, but a refresh resets the displayed count to zero.
- Submitted leads do not reliably appear in the admin CRM.
- Admin-created pools may report success but not appear on the public frontend.
- WhatsApp share messages have included `http://localhost:3000`.

Treat these as P0 symptoms. For each, capture actual reproduction steps, request/response, Supabase result, and affected files. Likely causes such as optimistic UI state, mock fallback, query/view conditions, cache invalidation, inconsistent IDs, or mismatched Supabase projects are hypotheses until proved.

After a live join, independently verify the persisted lead row, pool aggregate count, public feed, and admin table. After pool creation/publication, verify the same pool ID in admin, base table, public view/query, home listing, city/category filters, and deal route. Fix the cause rather than adding an arbitrary client refresh or hardcoded count.

`NEXT_PUBLIC_SITE_URL` should be validated centrally. `http://localhost:3000` is acceptable only in local development. Any production share URL must use the configured canonical HTTPS host. All WhatsApp wording must be gender-neutral and must not imply an unconfirmed discount.

### 17.8 V2 implementation phases — exact prompts for Antigravity IDE

**Execution mode:** The original Phase 1–6 are completed baseline phases according to the owner. Do not re-run those prompts. Execute Phases A–F sequentially below against the current local project. Continue to the next phase only if the current phase's acceptance gate passes; if a required live integration is unavailable, mark that gate `NOT VERIFIED` and do not falsely claim it passed. Work locally at `http://localhost:3000`; do not deploy.

#### Phase A — Audit and fix persistence/public visibility/canonical URLs

**Likely files:** existing join modal, pool repository, join Route Handler, SQL/RPC/migration, public pool repository/view, admin pool API, admin leads API, `lib/format.ts`/URL helper, relevant tests, `README.md`.

**Exact IDE prompt:**

```text
Read AGENTS.md and MASTER_BLUEPRINT.md completely. Treat Section 17 as the current V2 authority. This is Phase A only; do not implement the future category/product/vendor model yet.

Audit the existing local PoolBuy India code and prove the root causes of (1) join success with count resetting after refresh, (2) leads missing from the admin table, (3) admin-created pools not appearing publicly, and (4) WhatsApp share URLs containing localhost in an incorrect environment.

Trace actual code from UI through Route Handler/RPC/table/view and back to public/admin readers. Inspect Supabase project configuration and cache/revalidation behavior. Do not assume the cause. Preserve the root app/ Next.js 16 setup. Apply the smallest safe fix, preserve real data, never reset the database, never hide live DB errors by falling back to mock success, and keep the mock banner truthful. Use the database as the sole source of truth in configured live mode. Centralize canonical URL construction from NEXT_PUBLIC_SITE_URL and make production links use HTTPS production host.

Run the existing lint, TypeScript, test and build commands. Verify locally: submit a valid test join, confirm the database row and counter, refresh the public page and admin table, resubmit the same number and confirm the count does not increase, create/publish a test pool, and confirm it appears from the authoritative public query and on the matching deal URL. If Supabase is not configured, do not claim live persistence passed; document the limitation and test available mock behavior separately. Do not implement Phase B onward until reporting Phase A findings and gate status.
```

**Gate:** one actual persisted join remains present and counted after refresh; the admin sees the same lead; duplicate phone submission is idempotent; published pool ID is consistent between admin and public listing; canonical link behavior is correct.

#### Phase B — Multi-city, dynamic categories/products and safe migrations

**Likely files:** `types/index.ts`, `lib/constants.ts`, catalog repositories, city/category/deal pages, admin pool APIs/UI, `supabase/schema.sql`, new additive `supabase/migrations/*`, SQL tests.

**Exact IDE prompt:**

```text
Read AGENTS.md and MASTER_BLUEPRINT.md. Implement Phase B only, using the V2 data model in Section 17. Do not reset Supabase or delete existing rows. Inspect actual schema and code, then add reviewed, additive migrations for dynamic cities, dynamic categories, reusable standardized products and fixed-kit templates as needed. Backfill existing categories and cities without changing existing pool IDs or breaking current deal slugs. Keep legacy enum/text columns until all reads/writes are migrated and tests prove compatibility; do not blindly rerun the V1 schema against an existing database.

Allow the same product/template to exist as independent operational pools in multiple cities. Each pool must have its own city, current buyers, lead set, deadline, vendor/fulfilment arrangement and pricing. Public city/category filters must load from configured active data, not a closed hardcoded union. A product request or category must not become public automatically. Preserve public/private DTO separation and all admin authentication/RLS rules.

Use the installed Next.js 16 async params pattern and preserve current canonical routes. City and deal route lookup must require a matching city and pool slug. Support active city selection and a helpful empty-state/request action for cities without a live pool. Do not mark a city operational unless its local installation/fulfilment arrangement is verified.

Run migrations only on a safe development database or provide a clear operator-reviewed migration plan if no development DB exists. Test two city pools for the same product, each with separate count, lead, vendor quote and price. Run lint, tsc, tests and build; inspect the local city selector and both deal pages at http://localhost:3000. Stop at this phase gate.
```

**Gate:** two city pools for the same product are independent; categories/cities are data-driven; no old URLs or records are lost; unknown category values can be requested without enum-cast errors.

#### Phase C — Demand request queue and admin-approved pool creation

**Likely files:** `components/pool-request-form.tsx`, `app/api/pool-requests/route.ts`, existing admin request APIs/components, city/category/product admin forms, request schema/RPC/migration, tests.

**Exact IDE prompt:**

```text
Read AGENTS.md and MASTER_BLUEPRINT.md. Implement Phase C only. Build a short public Request a New Pool flow that accepts free-text product/package, requested city (including a validated request for an unconfigured city), name, valid 10-digit WhatsApp number, and optional area/PIN/brand/note. Do not require the product to belong to an existing category, do not force a long questionnaire, and do not create a public pool automatically.

Persist requests in the database through a validated server route/RPC. Ensure the current schema can store unknown category/product requests without casting free text to the legacy pool_category enum. Use appropriate consent/privacy text, anti-spam limits, and server-side validation. Demo submissions must remain visibly demo-only and never appear as real leads.

In the admin, implement search/filter, request detail, review note, status update, duplicate-demand discovery that preserves individual records, approval/rejection/need-information, and a separate explicit workflow to create a standardized product/category and then a city-specific pool. Link the source requests to the resulting product/pool. Require admin session verification on every read/write. Approval of an idea is not equivalent to publication; only a separate explicit pool publish action makes it public.

Verify by submitting an existing-category request and an unknown-category request from the browser, refreshing, confirming both in admin, approving one, creating a category/product/pool, and confirming it becomes public only after publication. Test unauthorized admin APIs. Run lint, tsc, tests and build; stop at the gate.
```

**Gate:** requests persist across refresh; unknown categories are accepted as request text; all review actions are protected; only approved and explicitly published pools become public.

#### Phase D — Fixed brand kits, city-specific vendor quotes and price ladder

**Likely files:** new/reused kit-offer and price-tier components/repositories, admin pool form/tab, pool detail/card, offer API/Route Handlers, schema migration and tests.

**Exact IDE prompt:**

```text
Read AGENTS.md and MASTER_BLUEPRINT.md. Implement Phase D only. Support multiple predefined, non-customizable brand-kit options inside one city-specific product pool. Reuse product-kit templates across cities but create separate city-specific vendor offers, quote validity, price verification and price-history records. Do not make the customer assemble components.

Track total pool interest separately from per-kit buyer selections. A mixed-brand group can count toward one vendor threshold only when the written vendor offer explicitly permits it. Add admin CRUD for exact SKU/model, package inclusions/exclusions, installation scope, warranty, vendor, reference price/source/date, current quote, conditional target price, validity and verification state.

Support a vendor-approved quantity tier and a manual-new-quote-required mode. When a threshold is met, update the approved tier only if its terms are still valid; otherwise show quote pending and notify/admin-flag the pool. Never generate a lower price simply because the count increased. Keep an immutable/auditable quote history and make all public price/savings claims conditional on comparability and verification.

Use realistic test records only in explicitly labeled demo mode. Keep real dealer identities, contact details, cost prices and private terms out of public API responses. Verify at localhost: create one pool with three brand options, join 6/3/1 test buyers, check per-kit counts, update one vendor quote and see the approved offer/history update without affecting another city. Ensure unverified/expired quotes are not labelled current savings. Run lint, tsc, tests and build; stop at the gate.
```

**Gate:** fixed kits and independent per-kit counts work; quote updates are auditable; public prices never claim unverified savings; city-specific prices remain isolated.

#### Phase E — Simplified customer UX, share links, consent and payment readiness

**Likely files:** join form/success UI, WhatsApp helper, canonical URL helper, privacy copy, admin offer publication, optional payment configuration (only if separately approved), tests and docs.

**Exact IDE prompt:**

```text
Read AGENTS.md and MASTER_BLUEPRINT.md. Implement Phase E only. Simplify the buyer join form to name, valid WhatsApp number, selected fixed kit when applicable, and locality/PIN only when required for vendor coverage. The city comes from the pool. Remove mandatory buying timeline, mandatory waiting-period, mandatory existing-quote, and long customization fields from the primary join flow. Preserve legacy lead data safely and do not invent values for fields no longer collected.

Update share copy to natural gender-neutral Hinglish. Always use the canonical URL helper: localhost links are allowed only when intentionally testing locally; production uses the configured production HTTPS URL. Include price/savings only if supported by a current verified offer. Do not say the deal is unlocked merely because demand hit the target.

Implement offer-notification readiness around approved price publication, consent, opt-out, deduplication by offer version and an auditable manual WhatsApp prefill workflow. A wa.me link is manual, not an automatic send. Do not claim bulk WhatsApp API sending without the official provider integration configured.

Do not turn on real payment collection during this phase unless the project owner has explicitly selected and documented the payment model in Section 17.6 and the gateway/legal/accounting prerequisites are actually configured. The current proposal has a token credited toward vendor price, while a public industry reference describes seller-paid success fees; do not merge those models. If unresolved, keep payment disabled, keep verified offer display functional and report the exact remaining business decision. Do not build an escrow or wallet.

Test the simplified form, demo/live errors, production URL configuration, WhatsApp encoding, offer expiry, consent/opt-out behavior and payment-disabled state at localhost:3000. Run lint, tsc, tests and build. Stop at the gate.
```

**Gate:** form is minimal; sharing is correctly gender-neutral; links use the right environment; offer communications are truthful; payment cannot be used until its commercial/legal flow has been explicitly approved.

#### Phase F — Regression, hardening, documentation and local acceptance

**Likely files:** all affected components/repositories/Route Handlers, tests, `README.md`, `.env.example`, `AGENTS.md`, `MASTER_BLUEPRINT.md`, migration docs.

**Exact IDE prompt:**

```text
Read AGENTS.md and MASTER_BLUEPRINT.md. Implement Phase F only. Run a full regression review of the existing and V2 features without redesigning unrelated UI or deploying. Add tests for persistent join/count idempotency, admin-created pool visibility, multiple cities for the same product, dynamic category creation, unknown-product requests, admin approval, fixed-kit selection counts, quote validity/history, WhatsApp/canonical URLs, RLS/private data, CSV formula injection and admin authentication.

Run the repository's actual commands for lint, TypeScript, test suite and production build. Use a disposable/test Supabase project for database integration tests if available; if it is not available, clearly mark live persistence and RLS acceptance as NOT VERIFIED rather than claiming success. Keep mock mode visible and do not seed fake leads into live data. Do not deploy or change domains; the current phase is local development.

Update README with local start instructions, environment setup, schema/migration order, admin setup, troubleshooting for stale counts/missing pools, how to add city/category/product/request-approved pool, vendor quote updates, current payment-disabled/approved status, and the exact tests performed. Update AGENTS.md so it points to this amended MASTER_BLUEPRINT as authoritative. Remove contradictions in duplicated instructions, but retain useful project-specific constraints.

Verify in a browser at http://localhost:3000 at 375px mobile width and desktop width: join persists, refresh does not reset the count, admin lead list sees it, a new city-specific pool appears publicly, city counts/prices remain separate, a new product request enters admin review, approved request creates a pool only through the explicit action, quote updates render correctly, and WhatsApp links are correct. Report PASS/FAIL/NOT VERIFIED with evidence. Do not deploy and do not claim production readiness without live verification.
```

**Gate:** tests and build pass; all locally available end-to-end checks pass; unavailable live prerequisites are listed without false claims; documentation matches the final code.

### 17.9 Required route/data-access additions or adaptations

Reuse existing routes where they already satisfy the behavior. Add only the minimum missing routes, such as:

- Admin cities: `GET/POST /api/admin/cities`, `PATCH /api/admin/cities/[cityId]`.
- Admin categories: `GET/POST /api/admin/categories`, `PATCH /api/admin/categories/[categoryId]`.
- Admin products/kits if required: routes under `/api/admin/products/**` and `/api/admin/pools/[poolId]/kit-offers/**`.
- Admin pool requests: existing protected list/update APIs plus an explicit approved-request-to-pool action.
- Public pool listing/detail: use safe public repository/view and match both city and pool slug.

Every new admin Route Handler must validate the session and Origin for mutations. `Cache-Control: no-store` applies to private admin responses. Public view models must exclude buyer PII, private vendor contact details, private acquisition costs, payment URLs, and admin notes.

### 17.10 Local development and completion rules

The owner says the project currently runs locally. Work against the existing local project directory and use `http://localhost:3000` for manual checks. The IDE agent should not rely on this ChatGPT environment having access to the owner's Windows filesystem or local browser session.

- Preserve the installed package manager and lockfile.
- Do not run destructive database commands or a schema reset.
- Use a development/test Supabase project for migration and persistence tests. If `.env.local` targets production, do not run mutation tests until the operator verifies a safe environment.
- Do not paste `.env.local`, admin credentials, session secrets, service-role keys or buyer PII into chat or generated reports.
- If the repository is not open at the specified project root, stop and ask the operator to open the correct folder rather than creating another project.
- If tests fail, fix the causes before moving to the next phase. A build success is not proof of data persistence or business correctness.
- The final implementation report must include changed files, migrations, actual command results, browser scenarios, and any NOT VERIFIED gate.

---

## V2 External References and Benchmark Notes

- PoolBuy.app homepage observed 26 October 2026: https://poolbuy.app/
- PoolBuy.app group-buying explanation observed 26 October 2026: https://poolbuy.app/what-is-group-buying
- PoolBuy.app privacy page observed 26 October 2026: https://poolbuy.app/privacy
- Official IP India trademark search: https://tmrsearch.ipindia.gov.in/tmrpublicsearch
- Official IP India trademark search guidance: https://ipindia.gov.in/trade-marks-before-you-apply-search-existing-trademarks

**Benchmark limitation:** This is a review of publicly accessible website claims and UX patterns, not independent verification of PoolBuy.app's source code, payments, dealer agreements, discounts, registrations, or business results.

# V3.0 OWNER-APPROVED IMPLEMENTATION AMENDMENT — LOCATION-FIRST UX, POOL LIFECYCLE, BUYING TIMELINE, NATIONAL SEO, BLOG CMS

**Document ID:** PBI-MASTER-001  
**Version:** 3.0  
**Last updated:** 26 October 2026  
**Precedence:** This Section 18 supersedes any earlier conflicting requirements in Sections 1–17, especially the old buying-timeline enum, single-city launch assumptions, hardcoded category lists, six-phase baseline, pool lifecycle, SEO scope, and non-goals. All compatible earlier security, architecture, validation, RLS, test, and migration requirements remain in force.

## 18.1 Current repository and phase state

The original Phases 1–6 and updated Phases A–C are reported as implemented and locally verified. The most recent Phase C report explicitly states that local verification ran with `NEXT_PUBLIC_DEMO_MODE=true`, and that the Supabase migration `20261026000002_dynamic_categories_and_pool_requests.sql` was prepared and tested locally but remote execution was **NOT VERIFIED**.

The IDE agent must not treat a local mock pass as proof of remote database durability. Before any new database-dependent feature is declared complete:

1. Inspect all existing migrations and the actual local repository.
2. Preserve the Phase A persistence fixes, Phase B city isolation, and Phase C request/category approval workflow.
3. Determine which migrations have actually been applied to the configured development database.
4. Do not run migrations or destructive mutations against a production database unless the operator has explicitly confirmed the target environment and backup/safe migration procedure.
5. If a dev Supabase connection is unavailable, implement and test safe local behavior, prepare migrations, and mark live persistence/RLS as `NOT VERIFIED`.
6. Do not duplicate features already implemented. Make incremental changes to the existing application.

## 18.2 Product definition and customer identity — final owner decision

PoolBuy India is a location-aware, fixed-kit group-buying platform. It collects buying interest from customers without requiring customer accounts, passwords, OTP login, or registration workflows. Customers may provide their name, WhatsApp number, selected State/City, a locality/PIN code when needed, their selected fixed kit, and a simple buying timeline.

Customer accounts are explicitly **out of scope** for the buyer journey. Typical purchases in these categories are infrequent and account creation adds friction without proving incremental value. The admin remains protected through the existing server-verified passkey session. A separate vendor login portal remains a later phase, not part of this implementation.

The platform will initially emphasize these three standardized product families:

1. **Rooftop Solar Complete Kits** — separate fixed product/pool templates for 3 kW and 5 kW, with exact verified brand/model packages and locally verified installation terms.
2. **Home Power-Backup Combo** — exact inverter + 200 Ah battery + trolley/package configuration, with model, warranty and installation scope fixed in advance.
3. **Whole-House Water Softener Kit** — a predefined home-use package with stated flow/resin/specification and clearly declared installation assumptions.

These are the first catalog priorities, not permission to invent vendor availability or margins. Product templates may be created as draft/catalog definitions. A city-specific operational pool must not be publicly represented as a live offer until the required local vendor and package terms are verified. Existing TVS iQube, Ather, car, laptop, QLED, tractor and other categories may remain in the extensible catalog but should not compete with the three launch product families in the initial primary marketing experience unless approved by the operator.

## 18.3 Customer buying timeline — final exact options

The join/interest form must include this single question:

**When are you planning to buy?**

- `THIS_MONTH` — **This month**
- `WITHIN_1_3_MONTHS` — **1–3 months**
- `WITHIN_3_6_MONTHS` — **3–6 months**
- `JUST_EXPLORING` — **Just exploring**

Do not ask a separate question such as “How many days can you wait for a better deal?”

Keep the rest of the customer form as short as the chosen package permits:

- Full name.
- Indian WhatsApp number.
- State and City, preselected from the browsing context/pool.
- Locality or PIN code only when useful for local service coverage.
- Preferred fixed brand-kit option if the pool contains multiple kits.
- The exact four-option buying timeline above.
- Clear consent/privacy notice for pool follow-up. Separate consent should be used for vendor sharing/marketing where required by the published policy.

Do not require customer password, account creation, detailed customization fields, financing interrogation, waiting-period preferences, or existing dealer quote details in the main flow. Optional follow-up questions can be collected later if operationally necessary and consented.

### Safe migration of old timeline values

The pre-V3 database may contain `WITHIN_7_DAYS`, `WITHIN_15_DAYS`, and `WITHIN_30_45_DAYS`. Do not silently map old records to a new timeline unless the source data supports that mapping. Add the new enum values or use a safe, forward-only text/check migration after inspecting dependencies. Keep legacy values readable in admin history and reports. New submissions must use the four V3 values. Update form labels, runtime validation, API validation, TypeScript types, admin filters, tests, and database/RPC validation consistently.

## 18.4 Location-first experience — State → City → local pools

### Core UX rule

Do not present a cluttered all-India catalog with every city’s pool mixed together. The first important discovery control is location. The customer must be able to:

1. Select a State/Union Territory.
2. Select a City/Town/recognized service area from that state.
3. Optionally click **Use my location**.
4. Confirm the detected city before viewing or joining a local installation-dependent pool.
5. See only the pools belonging to the selected city, together with the relevant category filters.
6. Change location easily without losing the ability to discover products.

The location picker is a discovery/filtering interface, not a promise of vendor service. A city may exist in the directory without an active vendor or pool.

### Use my location

- Location access must be initiated only after the user presses a clearly labelled button.
- Use the browser Geolocation API only in supported secure contexts and handle denied permission, timeout, inaccurate result, and unsupported browser gracefully.
- Do not request or store GPS coordinates merely on page load.
- If a reverse-geocoding provider is configured, resolve coordinates server-side and return a suggested State/City for user confirmation.
- If no geocoding provider/key is configured, do not invent the city from raw coordinates. Keep manual State/City/PIN selection available and explain the limitation in plain language.
- Do not expose a geocoding secret in a `NEXT_PUBLIC_` variable unless it is explicitly a provider-approved public browser key with restricted domains and quotas.
- Do not persist exact coordinates to customer records by default. Retain only the city/locality/PIN details needed for the requested service, and only with a clear purpose.
- The product must never require location permission: manual selection is always a full alternative.
- Remember a user's selected city locally only where appropriate; expose a visible “Change location” action. Do not treat localStorage selection as verified address or consent.

### Data model

Inspect the existing `cities` table added in Phase B and preserve its IDs/relationships. Introduce a normalized `states`/`state_directory` table if necessary. Keep the migration additive and data-preserving. City records should support at least:

- Stable ID and unique canonical slug.
- Display name.
- State/UT foreign key or normalized `state_slug`.
- Place type such as `CITY`, `TOWN`, `ISLAND_CENTRE`, or `SERVICE_ZONE` where a territorial unit is not reasonably a conventional city.
- Whether it is selectable in the location directory.
- Operational availability state: `ACTIVE`, `DEMAND_COLLECTING`, `NOT_YET_AVAILABLE`, or `INACTIVE` (adapt current fields if equivalent).
- Optional, verified service coverage metadata.
- Created/updated timestamps.

Important distinction: `selectable` does not mean `operational`. Do not label every seeded city as an active market. Only activate a city for live pool promotion when corresponding pool/fulfilment status is actually supported. Inactive/unserved cities can still be selected for a demand request.

## 18.5 India location directory — launch seed coverage

Seed a selectable State/UT directory containing all 28 States and all 8 Union Territories referenced by the Government of India's public State/UT directory. Seed the following representative initial urban markets for each State. This is a useful directory seed—not a claim that all locations currently have local dealers, are the five largest by population, or are operational markets.

For Union Territories with fewer than five genuine cities, do **not** fabricate five cities. Represent real towns/island centres/administrative locations as such and keep their serviceability status distinct.

### 28 States — five initial city/town selections each

- **Andhra Pradesh:** Visakhapatnam, Vijayawada, Guntur, Tirupati, Kurnool.
- **Arunachal Pradesh:** Itanagar, Naharlagun, Pasighat, Tawang, Ziro.
- **Assam:** Guwahati, Dibrugarh, Silchar, Jorhat, Tezpur.
- **Bihar:** Patna, Gaya, Muzaffarpur, Bhagalpur, Darbhanga.
- **Chhattisgarh:** Raipur, Bhilai, Bilaspur, Korba, Durg.
- **Goa:** Panaji, Margao, Vasco da Gama, Mapusa, Ponda.
- **Gujarat:** Ahmedabad, Surat, Vadodara, Rajkot, Gandhinagar.
- **Haryana:** Gurugram, Faridabad, Panipat, Hisar, Ambala.
- **Himachal Pradesh:** Shimla, Dharamshala, Solan, Mandi, Baddi.
- **Jharkhand:** Ranchi, Jamshedpur, Dhanbad, Bokaro Steel City, Hazaribagh.
- **Karnataka:** Bengaluru, Mysuru, Mangaluru, Hubballi-Dharwad, Belagavi.
- **Kerala:** Thiruvananthapuram, Kochi, Kozhikode, Thrissur, Kollam.
- **Madhya Pradesh:** Bhopal, Indore, Jabalpur, Gwalior, Ujjain.
- **Maharashtra:** Mumbai, Pune, Nagpur, Nashik, Chhatrapati Sambhajinagar.
- **Manipur:** Imphal, Thoubal, Churachandpur, Bishnupur, Kakching.
- **Meghalaya:** Shillong, Tura, Jowai, Nongpoh, Williamnagar.
- **Mizoram:** Aizawl, Lunglei, Champhai, Kolasib, Serchhip.
- **Nagaland:** Dimapur, Kohima, Mokokchung, Tuensang, Wokha.
- **Odisha:** Bhubaneswar, Cuttack, Rourkela, Sambalpur, Berhampur.
- **Punjab:** Ludhiana, Amritsar, Jalandhar, Patiala, Bathinda.
- **Rajasthan:** Jaipur, Jodhpur, Udaipur, Kota, Ajmer.
- **Sikkim:** Gangtok, Namchi, Gyalshing, Mangan, Singtam.
- **Tamil Nadu:** Chennai, Coimbatore, Madurai, Tiruchirappalli, Salem.
- **Telangana:** Hyderabad, Warangal, Karimnagar, Nizamabad, Khammam.
- **Tripura:** Agartala, Udaipur, Dharmanagar, Kailashahar, Belonia.
- **Uttar Pradesh:** Lucknow, Kanpur, Varanasi, Agra, Prayagraj.
- **Uttarakhand:** Dehradun, Haridwar, Haldwani, Roorkee, Rudrapur.
- **West Bengal:** Kolkata, Howrah, Durgapur, Siliguri, Asansol.

### 8 Union Territories — honest location coverage

- **Andaman and Nicobar Islands:** Sri Vijaya Puram (formerly Port Blair), Diglipur, Mayabunder, Rangat, Hut Bay. Use accurate place types; several are towns/settlements, not major cities.
- **Chandigarh:** Chandigarh. Do not create artificial extra cities. If helpful, support separately labelled service zones/sector areas.
- **Dadra and Nagar Haveli and Daman and Diu:** Silvassa, Daman, Diu, Dadra, Khanvel, with correct town/locality place types.
- **Delhi (NCT):** Delhi as the principal urban location. If the business needs locality-level coverage, store Delhi service/locality zones separately from cities (for example, Dwarka, Rohini, South Delhi, East Delhi), not as false independent cities.
- **Jammu and Kashmir:** Srinagar, Jammu, Anantnag, Baramulla, Udhampur.
- **Ladakh:** Leh, Kargil, Diskit, Drass, Nyoma, with correct settlement/service-area labels.
- **Lakshadweep:** Kavaratti, Agatti, Andrott, Minicoy, Amini as island/community centres, not five major cities.
- **Puducherry:** Puducherry, Karaikal, Mahe, Yanam. Do not force a fifth fictional city.

### Location-directory implementation rules

- Add these seed locations in an idempotent migration/seed mechanism using canonical slugs and `ON CONFLICT DO NOTHING` (or equivalent safe upsert that does not overwrite operator-edited fields).
- Do not automatically create 140+ empty public pools. Seed locations only.
- Existing operational cities with valid active pools should retain their current operational status after a data review.
- New seeded cities should default to `NOT_YET_AVAILABLE` or `DEMAND_COLLECTING`, not `ACTIVE` merely because they are present in the directory.
- Product templates may be visible nationally. Active offers must still be filtered by the selected city.
- A customer who selects an unavailable location must see a clean empty state plus a request option, not unrelated offers from other states.
- Use an accessible searchable State/City selector. Do not show 180 city cards on the homepage.
- Optionally show a national category page with a compact location prompt; once a location is selected, the page should focus on that city.
- City slug uniqueness must be handled safely. If the same display name exists in two states, use a stable disambiguated slug (for example, `city-state`) rather than mapping two cities to one route.

## 18.6 The three initial product families and fixed kits

### Product family A — Rooftop Solar Complete Kit

Provide fixed product templates for 3 kW and 5 kW; these may be separate product templates and separate operational pools. Within each city pool, support multiple complete brand-kit options only when the vendor can supply and install the exact defined package.

Each option's inclusions must be explicit: module type/brand/model and DC capacity; inverter make/model/capacity; ACDB/DCDB; earthing/lightning protection; standard structure specification; installation; delivery; net-metering assistance scope; warranty and service scope; taxes; and exclusions. Do not advertise exact structure thickness/coating, number of earthing pits, subsidy result, warranty, or service obligation unless supported by a written verified offer. Elevated/walkable-structure price additions must be a vendor-approved fixed add-on and clearly scoped.

Display total pre-subsidy package price separately from any possible government subsidy. A subsidy is never subtracted as guaranteed instant cashback; eligibility, commissioning, DISCOM/portal requirements and approval must be stated accurately. Compare only like-for-like complete installed packages. The illustrative `₹70,000/kW` or any proposed `₹55,000/kW`/brand target is an assumption until written quotations validate it.

### Product family B — Home power-backup combo

Create a fixed package template for an exact inverter + 200 Ah battery + trolley (and any included standard installation). The model/technology, battery chemistry, warranty, invoice, delivery and installation scope must be fixed in each kit. Do not allow customers to configure individual components during join. Different exact bundles should be separate predefined options.

### Product family C — Whole-house water softener

Create a fixed home-use package template (initially one clearly specified standard model/size, with additional sizes as separate kits if needed). Display flow rate/resin capacity, suitable home assumptions, included bypass/prefilter/plumbing work, installation exclusions, warranty, servicing/salt needs, and local vendor quote. Do not claim a kit fits every house without assessment; if site assessment is required, state that it is part of vendor fulfilment and does not turn the online product into a customer-configurable kit.

### Catalog visibility

- Seed or define these three product families as initial priorities, but set vendor-offer verification independently.
- Do not fabricate prices, dealer identities, verified quotes, savings, reviews, or vendor authorizations.
- Existing category/product data must be preserved and remain supported by the dynamic catalog model from Phase C.
- A product template can be national. A vendor offer and installation pool is city-specific unless a written fulfilment agreement explicitly defines another coverage region.

## 18.7 Pool lifecycle, auto-expiry, archive and deletion

Pool lifecycle management must be explicit, auditable, and safe. “Delete” must not permanently erase real buyer leads or financial/quotation history by default.

### Public/admin actions

Admin pool controls must include:

- **Save Draft** when the existing architecture supports drafts.
- **Publish / Activate** only after required pool fields and supplier/fulfilment prerequisites are satisfied.
- **Pause / Resume** (if added, implement as a valid explicit state or controlled activation flag; do not overload `CLOSED` ambiguously).
- **Close now** with required reason.
- **Expire now** (immediately set a terminal/expired lifecycle outcome with reason `ADMIN_EXPIRED`, without waiting for the deadline).
- **Archive** to remove from active operational screens while preserving history.
- **Soft delete / hide** for erroneous or withdrawn draft pools. Maintain a recoverable record and audit trail.
- **Restore** an archived/soft-deleted pool only if the offer is still valid and the admin revalidates it.
- **Permanent deletion** only for an unused draft/test record with no leads, payment/commitment references, requests, vendor quotes, or audit dependencies and only after explicit confirmation. If any dependent business record exists, disable hard deletion and use archive/soft-delete instead.

### Schema evolution

Inspect the current `pool_status` enum and current pool fields before changing them. Prefer an additive migration adding clear lifecycle fields rather than destabilizing existing status values unnecessarily. Possible fields include:

- `closed_at timestamptz`
- `closure_reason text` constrained to approved reasons such as `ADMIN_CLOSED`, `AUTO_POOL_EXPIRED`, `ADMIN_EXPIRED`, `AUTO_OFFER_EXPIRED`, `VENDOR_UNAVAILABLE`, or `OTHER`
- `archived_at timestamptz null`
- `deleted_at timestamptz null`
- `deleted_by text/uuid null` appropriate to current passkey-admin model
- `deletion_reason text null`
- `offer_valid_until timestamptz null` separate from initial pool deadline

Use existing columns when equivalent. Do not add redundant fields merely because they are listed as examples. Preserve foreign keys and historical leads. The `CLOSED` status can remain the terminal display state if `closure_reason` disambiguates manual close from automatic expiry; otherwise propose a safe normalized state migration.

### Automatic expiry rules

- `deadline` governs the period during which an `ACTIVE` pool accepts new interest/joins.
- A pool whose deadline has passed must stop accepting joins even if a scheduled job has not yet run. This rule must be enforced in the database RPC and public UI/query.
- On scheduled expiry, an `ACTIVE` pool whose deadline has passed is transitioned to closed/expired with `closure_reason = AUTO_POOL_EXPIRED` and a timestamp.
- An `UNLOCKED` offer may have a separate `offer_valid_until`. If that offer expires, close the offer/pool according to the documented business state and record `AUTO_OFFER_EXPIRED`; do not silently extend the offer.
- Do not auto-expire/delete leads. Preserve leads and the pool audit trail according to retention policy.
- Expiry execution must be idempotent and safe when called more than once or concurrently.
- Public catalogue queries must filter expired deadlines immediately, even if the lifecycle update job is delayed.

### Serverless scheduler

- Provide a protected endpoint such as `GET /api/cron/expire-pools` using `CRON_SECRET` and constant-time secret comparison or platform-supported authenticated cron handling.
- Add Vercel Cron configuration only after inspecting existing `vercel.json` and account/plan constraints. A recommended hourly schedule is acceptable for this first release if plan limits allow; do not promise minute-perfect execution.
- For Netlify or local development, document the supported scheduled invocation mechanism. The local environment cannot depend on a background process running permanently; provide a protected admin “Run expiry check” action or a safe local script for verification.
- Cron endpoint must return summary counts only, not buyer PII, and must use server-only privileged database access.
- Never expose `CRON_SECRET` to the client or logs.

### Admin visibility

Provide filters/tabs for Active, Target Reached/Quote Pending, Unlocked, Lead Fallback, Closed/Expired, Archived and Deleted where supported. Do not show expired pools among active opportunities. Keep a view of historical pools and associated buyers for admin audit/export.

### Pool expiry acceptance tests

1. Active future-deadline pool remains joinable.
2. Active past-deadline pool rejects joins at the database/RPC boundary even before the cron runs.
3. Expiry job closes only eligible expired pools and is idempotent.
4. Unlocked offer expiry is handled using `offer_valid_until`, not the original deadline alone.
5. Archived/soft-deleted pools do not appear publicly.
6. Restoring a record requires a revalidation path.
7. Pool with leads cannot be permanently deleted through ordinary admin UI.
8. All existing leads and pool history remain intact after close/archive.

## 18.8 National SEO architecture and search-friendly location hierarchy

The objective is to make PoolBuy India discoverable nationally, but no agent can guarantee Google rankings. Implement technical SEO fundamentals and useful people-first content; avoid thin auto-generated location pages and copied vendor claims.

### Recommended public URLs

- `/` — location-first homepage.
- `/locations` — searchable State/City directory, with clear availability labels.
- `/state/[stateSlug]` — state coverage page where genuinely useful and indexable.
- `/city/[citySlug]` — city pools and useful local information.
- `/category/[categorySlug]` — national category landing page.
- `/deals/[citySlug]/[poolSlug]` — single city-specific live pool/offer.
- `/blog` — article index.
- `/blog/[slug]` — published article.
- `/blog/topic/[topicSlug]` — optional topic landing pages only if they have meaningful content.
- `/about`, `/how-it-works`, `/privacy`, `/terms`, `/contact`, `/refund-policy` or equivalent trust pages only with real, approved business details and reviewed policy language.

Preserve current route shapes where possible. Add `/state/[stateSlug]` only if it can provide useful content without making the site a page farm. Existing routes and old published URLs must remain stable or be handled by explicit redirects.

### Indexing rules

- Index useful national category pages with substantive product/market content.
- Index a city page only when it has live relevant pools or substantive, unique service/content information. Empty/not-yet-served city pages should ordinarily be `noindex,follow` until they become useful.
- Do not index every seeded directory city simply because a location record exists.
- Do not index request IDs, admin URLs, API paths, demos, test records, unapproved requests, draft/expired/archived offers, or private views.
- Individual closed deal pages may remain as truthful historical/closed pages with `noindex` or be redirected by a documented policy.
- Keep product/Offer JSON-LD honest. `Offer` structured data is allowed only when price is currently verified, valid and actually available under defined terms. Do not fabricate availability, seller, SKU, rating/review, or price.
- A city-specific pool page must resolve using both city slug and pool slug.

### Metadata and structured data

Use Next.js 16-compatible `generateMetadata` with async `params`. Provide unique, meaningful titles/descriptions, absolute canonical URLs, OpenGraph, Twitter card metadata, language, and robots directives. Use the validated central canonical-URL helper.

Use relevant schema only when supported by visible page content: `Organization`/`WebSite` for site identity, `BreadcrumbList` for navigation, `Product` and conditional `Offer` for real product offers, `BlogPosting` for articles. JSON-LD must be serialized safely (escape `<` to `\\u003c`) and never contain personal data, admin notes, private vendor costs or payment URLs.

### Crawlability and performance

- `app/sitemap.ts` should include only canonical, published, indexable pages: the homepage, useful active categories/cities/states, valid public pool pages and published articles. Do not require remote database access during production build if the architecture can read at request time.
- `app/robots.ts` should disallow admin/API paths and must not be used as a substitute for authentication.
- Add crawlable internal links from articles to useful category/city/deal pages and vice versa.
- Optimize images, responsive layout, metadata, canonical host, 404s, redirects and mobile performance.
- Provide a Search Console and analytics setup checklist, but never claim the properties are verified or tracking is live unless actual configuration is done.
- Avoid keyword stuffing, duplicate city content, generated content farms, artificial review markup and guaranteed ranking claims.

## 18.9 Blog CMS — regular publishing without code edits

Add a protected Blog Management tab inside the existing admin command center. The owner must be able to create and publish regular posts without editing the repository or manually changing SQL rows.

### Blog data model

Inspect whether a blog table already exists. Otherwise, add an additive migration creating `blog_posts` and, only if justified, a `blog_topics` table. A blog post should support:

- Stable UUID.
- Unique slug with safe slug normalization.
- Title.
- Short excerpt/summary.
- Body content stored as Markdown or a deliberately selected safe structured format.
- Author/byline field (real, owner-provided; never fabricate a credential).
- Topic/category and tags.
- Featured image URL and descriptive alt text.
- SEO title and meta description.
- Status `DRAFT`, `PUBLISHED`, or `ARCHIVED`.
- `published_at`, `created_at`, `updated_at` and suitable revision/audit information.
- Optional source/reference URLs and editorial review notes not exposed publicly.

Prevent duplicate slugs. Slug changes on already published articles require a 301 redirect or preserved slug alias, not a silent broken URL.

### Blog admin workflow

- Create draft.
- Edit draft.
- Preview the article using the same typography as the public page.
- Publish only after explicit admin action.
- Edit a published post with an updated timestamp/audit trail.
- Archive a post without deleting its history.
- Validate title, slug, body length, excerpt, image alt, canonical metadata and required byline.
- Drafts/archived posts must not be returned by public article queries or included in the sitemap/RSS.
- No public user registrations or article comments are required.

### Safe content rendering

Use the project's existing Markdown renderer if safe and suitable. Otherwise, select a maintained renderer only if necessary and avoid raw HTML by default. Sanitize any HTML if HTML authoring is ever supported. Do not execute arbitrary scripts/embeds supplied through article content. Use secure external-link handling.

### Public blog routes and publishing effects

Implement:

- `/blog` — paginated, mobile-friendly article index with headline, excerpt, image, byline, publication date and topic tags.
- `/blog/[slug]` — full article with headings, table of contents where useful, sources/references, author/date, related content and contextual links to PoolBuy product/category/location pages.
- An RSS endpoint at `/feed.xml` or equivalent.
- Blog sitemap entries containing only published articles.
- `BlogPosting` JSON-LD with truthful author, dates, headline and image.
- Revalidation of `/blog`, the specific article, relevant topic pages, RSS and sitemap after publish/update/archive.
- Empty-state UI for a new blog with no published posts; do not expose drafts.

### Publishing quality

The CMS is a publishing tool, not a bulk SEO-page generator. Articles should be original, fact-checked, useful to Indian buyers, clearly dated and attributed. For solar or subsidy material, link to current official sources and distinguish policy facts, vendor quotes and editorial estimates. Never publish fabricated market data, made-up customer case studies, false author credentials, or unverified discounts. Do not mass-generate dozens of thin near-duplicate city posts just for keyword coverage.

## 18.10 Benchmark lessons from PoolBuy.app

The public website `https://poolbuy.app/` was reviewed on 26 October 2026. It publicly presents a short interest form, category selection with “Something else,” name and WhatsApp, home PIN code, optional “Use my location,” the same four buying-timeline options, public aggregate registrations without names/numbers/exact PINs, seller-direct fulfilment and written seller terms before payment. It also describes booking amounts credited toward the seller price and a seller-paid fee per completed sale.

PoolBuy India may adopt useful UX principles:

- Free, quick interest registration.
- “Something else” product request linked to admin review.
- State/City/PIN/location-driven matching.
- Privacy-safe aggregate demand display with minimum cohort threshold.
- Verified written offers and direct seller fulfilment.
- Minimal friction and no compulsory customer account.

Do not copy another site's text, branding, imagery or code. Do not assume its commercial terms, registrations, margins, authorization claims or implementation are independently verified. PoolBuy India's token proposal differs from seller-paid success-fee models; keep the approved financial flow separate and do not enable payments until terms are settled.

## 18.11 Admin product catalogue, category and vendor readiness

The existing admin must continue to support:

- City and State/UT directory management.
- Operational status independent of simple directory presence.
- Runtime category and standard-product creation.
- Product request review and conversion.
- Local pool creation with one authoritative city.
- Separate fixed-kit offers and vendor quotes.
- Pool lifecycle/expiry/archive actions.
- Blog draft/publish/archive workflow.

Any new admin route must check the signed admin session on every request, validate Origin on mutation, return `Cache-Control: no-store` for private data, and keep service-role use server-only. Never add customer account/login features just to solve admin needs.

Vendor login and self-service quote submission remain explicitly deferred. The initial vendor process is admin-managed; vendor portal should only be implemented under a later approved specification.

## 18.12 Required database migration strategy

Review the actual ordered migration set, expected to include at least the previously reported:

- `20261025000001_initial_schema.sql`
- `20261025000002_rls_and_rpc.sql`
- `20261026000001_cities_and_multicity_pools.sql`
- `20261026000002_dynamic_categories_and_pool_requests.sql`

Do not assume that any migration has been remotely applied just because its file exists. Verify migration state using the safe supported Supabase CLI/database workflow and the correct development project.

New migrations may need to add:

- State/city directory relationships and operational availability metadata.
- New timeline enum values or a compatible timeline text/check representation.
- Pool closure/expiry/archive/soft-delete fields.
- Offer expiry timestamp and closure reason.
- Fixed-kit/offer/price-history structures if not already present.
- Blog posts/topics tables and their RLS/policies.
- Indexes, RPCs, view updates and grant changes.

All SQL changes must be forward-only/additive where practical, idempotent where feasible, reviewed for existing data compatibility, and tested against a disposable development database. Backfill existing pools/categories/cities/timeline values safely. Keep public safe-view column lists explicitly defined after adding tables/columns.

Never blindly replace `schema.sql` or rerun seed statements that reset data. `schema.sql` is the fresh-install reference; incremental migrations govern an existing database. Keep both aligned and document the migration order.

## 18.13 V3 implementation plan — continue after Phase C

Phase A–C are reported complete in local demo mode. The IDE agent must first perform a short repository/database preflight, then implement the remaining work in the following order. Do not repeat the initial six baseline phases.

### Preflight — repository and migration reality check

Inspect Phase A–C report and current repository. Confirm which routes/components/schema changes exist. Check demo mode settings and configured development database destination without printing secrets. Determine whether prior migrations are applied in the development DB. Preserve current state and tests. Report any missing remote prerequisites before making DB writes.

### Phase D — Fixed kit catalog and vendor-approved price management

Implement or complete the three initial product families (solar 3/5 kW, exact inverter + 200 Ah battery combo, whole-house water softener), reusable product-kit templates, per-pool kit selections, per-kit buyer counts, city-specific vendor quotes, approved quantity tiers/manual quote-pending behavior, public verified-price rules, and auditable price history. Do not fabricate vendor prices or margins. Do not implement a vendor portal. Stop only if its gate fails after attempting fixes; report exact evidence.

### Phase E — Location directory, State → City selection and optional geolocation

Add all 28 States with five representative city/town options each, plus all eight UTs and honest available towns/coverage centres as specified in Section 18.5. Seed directory entries as selectable but not live-operational by default. Implement dependent State/City selectors, search, optional user-initiated geolocation with permission/reverse-geocoding fallback, city confirmation, persistent city preference where appropriate, and active city-filtered catalog. Do not mix city pools. Inactive city pages must show an honest “not available yet / request a pool” state. Do not create 180 duplicate product pools.

### Phase F — Buying timeline, pool expiry, close/archive/delete

Update new joins to the four exact buying timeline options in Section 18.3 and migrate schema/types/admin filters compatibly. Add auto-expiry and separate offer-expiry handling, manual expire/close/archive/restore actions, safe soft-delete defaults, constrained hard deletion for dependency-free draft/test records only, and an idempotent secured scheduled endpoint. Configure Vercel Cron or document the selected hosting-equivalent scheduler. Always enforce deadline at query and join/RPC time, even if cron is late. Preserve lead/audit history.

### Phase G — Technical SEO, national/local indexability and analytics readiness

Implement useful national category pages, useful state/city pages, city-specific deal metadata, sitemap/robots, canonicals, social previews, safe conditional Product/Offer JSON-LD, breadcrumbs, internal links and noindex rules. Ensure only published and useful pages are indexable. Add a Google Search Console/analytics setup runbook and any minimal privacy-conscious analytics hook if configured. Do not promise rankings, create thin mass-generated city pages or publish invented prices.

### Phase H — Blog CMS and regular publishing workflow

Build protected admin Blog Management, safe editor/preview, draft/publish/archive, public blog index/article pages, RSS feed, metadata, BlogPosting schema, sitemap inclusion, source/byline/date fields and cache revalidation. Keep raw HTML/script execution disabled. Do not require customer accounts. Ensure new posts can be created/updated from admin without code deployment.

### Phase I — End-to-end regression, security, docs and completion report

Test real and demo mode separately. Validate joins, duplicate handling, live queries, city isolation, product requests, admin approval, kits/price tiers, pool expiry/archives, timeline, geolocation denied/allowed/manual fallback, blog publishing, sitemap, canonical URLs, SEO structured data, admin auth and public/private data boundaries. Run lint, TypeScript, unit tests and build. If remote Supabase isn't available, explicitly mark all live DB/RLS/migration gates `NOT VERIFIED`. Update `README.md`, `.env.example`, `AGENTS.md` and this blueprint's status/implementation notes without deleting the specification or logging secrets.

The IDE agent should attempt all remaining phases in order in a controlled execution run. If output/time limits make the entire run impossible, complete the current phase gate, save a clear continuation report, and continue in a later run without redoing completed phases. Do not skip gates, claim unverified tests passed, or ask the owner to repeat information already present here.

## 18.14 Blog and SEO acceptance matrix

- New blog draft can be created and saved by admin.
- Draft preview is private; anonymous visitors cannot fetch a draft by slug.
- Publishing makes the article available at `/blog/[slug]` without code changes or full rebuild.
- Updating/archive removes or changes the article according to its publication status and revalidates sitemap/RSS.
- Only published articles appear in public listings, RSS and sitemap.
- Correct canonical, metadata, alt text, byline/date and safe BlogPosting JSON-LD render.
- No raw unsafe HTML/script executes.
- City/category/deal pages only index when useful and accurate.
- State/City directory includes all intended selectable regions without falsely labelling them active markets.
- A new local pool changes only its city-specific pages and appropriate sitemap entries.
- `robots.txt` does not substitute for authentication or accidentally block required CSS/JS.
- Search Console/analytics are documented as configured or not configured honestly.

## 18.15 Final acceptance matrix and definition of done

The system can be described as locally implemented only when:

1. The lead/count bug stays fixed and is tested against the configured mode.
2. Demo and live persistence are clearly distinguished.
3. Each pool has one authoritative city and no cross-city count/price leakage exists.
4. State and city selection works; geolocation is optional and permission-respecting.
5. Directory contains all States/UTs and the proposed city/town entries, while operational availability remains truthful.
6. City-based public listings are uncluttered and show only selected-city pools.
7. Pool requests for existing and unknown categories go to protected admin approval.
8. Three initial product families are represented by fixed kit templates without fabricated offer data.
9. Multiple fixed kits have separate selection counts; prices use verified quotes and history.
10. The exact four buying timeline choices work for new leads and old lead history remains readable.
11. Pool deadline is enforced server-side and automatically expired pools leave public active listings.
12. Admin can close, expire, archive, soft-delete and restore safely; hard delete is blocked when history exists.
13. Blog drafts/published posts work from admin without code edits; published articles are crawled via sitemap/RSS.
14. SEO metadata/JSON-LD/canonicals/internal linking are valid and no thin-page farm is created.
15. WhatsApp links use the correct environment's canonical host and neutral wording.
16. All secrets remain server-only and private lead/vendor data cannot be read anonymously.
17. `npm run lint`, `npx tsc --noEmit`, `npm test`, and `npm run build` actually pass (use actual repository scripts).
18. Local browser verification is performed at `http://localhost:3000`.
19. Remote Supabase migrations, persistence, RLS and production hosting are explicitly marked verified or not verified; no false claim of production readiness.

## 18.16 Single master execution prompt for Antigravity IDE

Copy the following block when executing the remaining system scope:

```text
POOLBUY INDIA — MASTER V3 EXECUTION

Read AGENTS.md and MASTER_BLUEPRINT.md completely. The latest authoritative requirements are in Section 18. Original implementation Phases 1–6 and updated Phases A–C are reported complete; do not rebuild the app or repeat them. Inspect the actual local repository and the Phase A/B/C reports first.

Work only inside the existing project root: C:\\Users\\iamvi\\OneDrive\\Documents\\poolbuy-india. Preserve root app/ (no src/), Next.js 16, TypeScript, Tailwind v4, Supabase, the existing lockfile, and the current local setup at http://localhost:3000. Do not deploy to production.

Before modifying the database, identify the configured environment without printing secrets and determine which migrations are actually applied. The Phase A–C reports were verified in demo/local mode; remote Supabase migrations and live persistence may still be NOT VERIFIED. Never run destructive SQL, reset data, fabricate leads, or claim a live DB test passed when it did not.

Then execute Sections 18.13 Phases D through I in order, using a phase acceptance gate for every phase. Implement the entire pending scope: (D) fixed product-kit catalog for rooftop solar 3 kW/5 kW, exact inverter + 200 Ah battery combo, and whole-house water softener; city-specific vendor quotes, kit-specific demand counts, valid vendor-approved price tiers and price history; (E) location-first State → City selector with all 28 States, all 8 UTs, five representative cities/towns per State and honest UT place types, optional permission-based geolocation, manual fallback and city-only pools; (F) the exact buying timeline choices “This month”, “1–3 months”, “3–6 months”, and “Just exploring”, plus automatic pool expiry, offer expiry, close/archive/soft-delete/restore controls and protected scheduler; (G) national SEO architecture, correct indexability, dynamic sitemap/robots/canonicals/metadata/safe JSON-LD and no thin city page farm; (H) protected blog CMS with draft/preview/publish/archive, public /blog and /blog/[slug], safe Markdown rendering, Article structured data, RSS, sitemap and revalidation; (I) full security/regression/documentation verification.

Buyers must never need accounts/passwords. City is authoritative for every installation-dependent pool. Same product templates can exist in many cities, but buyer counts, kit selections, vendor offers, deadline and pricing are strictly independent by city. The product can be listed nationally but a live installation offer is shown only where a verified fulfilment route exists. Requests for new products/categories are reviewed by admin and never automatically become public pools.

Do not invent supplier price, margin, warranty, subsidy outcome, authorization, active vendor coverage, customer testimonial, or guaranteed saving. Treat all seed figures as demo and unverified. Target count does not automatically guarantee a discount or open payment collection. Payment stays disabled unless the owner-approved financial terms, gateway setup and legal/accounting review are actually documented and configured. Do not build customer login or vendor portal in this execution.

Pool expiry must be both query/RPC-enforced and scheduler-backed. Archive/soft delete by default; do not hard-delete pools with leads, quotations, requests, payment or audit references. Make expiry idempotent and protected with CRON_SECRET. Keep direct local verification possible and document hosting scheduler setup.

The city directory is selectable data, not a claim that all cities are operational. Do not create empty pools in every city. Keep public UX uncluttered: visitor selects state/city, then sees only that city’s listings. Unserved cities show a useful request action and do not leak unrelated pools.

Blog management must let the operator publish content from /admin without a code edit or redeploy. Only published articles are public and in sitemap/RSS. Preserve accurate authorship and sources; do not bulk-generate near-duplicate city SEO pages.

Implement incrementally. Reuse existing functionality where correct. Create reviewed additive migrations and preserve all existing IDs/leads. For each phase: test it, fix failures, report changed files and actual results, then proceed. If a necessary prerequisite is unavailable, complete safe work and mark that criterion NOT VERIFIED rather than fabricating success. Do not stop after producing a plan; implement and verify everything possible in the current local environment. If the context/time limit prevents all phases, finish the current gate, update a continuation report, and explicitly identify remaining phases rather than claiming completion.

At the end run the actual commands from package.json for lint, tsc, tests and production build. Use the actual browser at http://localhost:3000. Update README.md, .env.example and AGENTS.md to match the final implementation. Return a final PASS/FAIL/NOT VERIFIED matrix; state clearly whether test coverage was demo-only or used the configured development Supabase database. Do not deploy.
```

## 18.17 Official references and constraints

- Government of India, State/UT directory (28 States + 8 UTs): https://www.india.gov.in/directory/web-directory/state-uts
- PoolBuy.app public benchmark reviewed 26 October 2026: https://poolbuy.app/ (public UX claims only; backend, contract terms, and performance not independently audited).
- Google Search Central, helpful and reliable people-first content: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Google Search Essentials: https://developers.google.com/search/docs/essentials
- Next.js App Router ISR guidance: https://nextjs.org/docs/app/guides/incremental-static-regeneration
- Vercel Cron Jobs: https://vercel.com/docs/cron-jobs and https://vercel.com/docs/cron-jobs/quickstart
- MDN Geolocation API and permission/security considerations: https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API

These references guide implementation; they do not prove the owner's local code or production deployment has the described capabilities.

**End of V3.0 owner-approved implementation amendment.**

