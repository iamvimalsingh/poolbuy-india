# PoolBuy India — Master Specification & Implementation Blueprint

**Document ID:** PBI-MASTER-001  
**Version:** 1.0  
**Last updated:** 26 October 2026  
**Status:** Authoritative implementation contract  
**Target IDE:** Antigravity IDE (AI coding agent)  
**Project root:** `C:\Users\iamvi\OneDrive\Documents\poolbuy-india`  
**Application:** Next.js 16.4+ App Router, TypeScript, Tailwind CSS v4 (`app-tw` starter), Supabase PostgreSQL, serverless Route Handlers  

> **Single source of truth:** This file is the product and implementation specification. `AGENTS.md` must instruct the coding agent to read this file before changing code and must not duplicate or contradict its requirements. If the repository's current code differs from this blueprint, inspect it, preserve working setup, and reconcile deliberately; do not blindly overwrite working configuration.

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

### 1.2 Buyers: no account and no password

The buyer's primary identity key for duplicate prevention is the exact 10-digit Indian mobile/WhatsApp number, unique within one pool:

`UNIQUE(pool_id, whatsapp_number)`

Required fields when joining a pool:

1. `full_name` — required, trimmed, 2–100 characters.
2. `whatsapp_number` — required, exactly 10 digits and matching `^[6-9][0-9]{9}$`; accept only digits in the submitted value (the UI may strip spaces/dashes before validating, but the server validates the normalized string again).
3. `city` — required; defaults to the pool's city and must match the pool city for the initial MVP. A buyer looking for a different city should join that city's pool rather than silently changing the locality of this pool's lead.
4. `buying_timeline` — required enum: `WITHIN_7_DAYS`, `WITHIN_15_DAYS`, or `WITHIN_30_45_DAYS`. Render labels “Immediate (Within 7 Days)”, “Soon (Within 15 Days)”, and “Planning (Within 30–45 Days)”.
5. `has_existing_quote` — boolean.
6. `existing_quote_amount` — optional non-negative INR amount, shown only when a quote is reported, if provided.
7. `extra_message` — optional, maximum 1,000 characters; can include variant/color, exchange vehicle, loan needs, or lowest quote. Treat it as untrusted plain text, never as HTML.

The form must also show a short privacy statement explaining that the information is used to manage this pool and contact the buyer about this request, and that contact/lead sharing with a dealer is only handled under the site's stated terms/consent. The final wording must be reviewed by the operator/legal adviser before launch; do not claim a legal review has occurred.

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

Use a single shared type module for domain shapes and API contracts. Keep database snake_case row types distinct from app-facing camelCase types. All external/API data is untrusted and must be validated before casting.

Required types (names may be refined without changing meanings):

```ts
export type PoolCategory =
  | 'EV_SCOOTERS'
  | 'CARS'
  | 'ROOFTOP_SOLAR'
  | 'LAPTOPS'
  | 'SMART_TVS'
  | 'TRACTORS_COMMERCIAL';

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
  category: PoolCategory;
  city: string;
  citySlug: string;
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
  city: string;
  buyingTimeline: BuyingTimeline;
  hasExistingQuote: boolean;
  existingQuoteAmount: number | null;
  extraMessage: string;
  // The server stamps the current privacy notice version; this is not buyer-editable.
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
  poolCategory: PoolCategory;
  fullName: string;
  whatsappNumber: string;
  city: string;
  buyingTimeline: BuyingTimeline;
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
  category: PoolCategory | null;
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
- Generate the share message after success. It should be Hinglish/English, e.g. `Main [City] mein [Product] ke PoolBuy group-buy pool mein interest register kar chuka/ chuki hoon. Target hit hone par dealer se bulk-price terms verify hongi. Details: [public deal URL]`. If savings/price is not verified, do not claim a guaranteed ₹ amount. If an illustrative amount is used in local demo, the demo label must be present and the message should call it an estimate.
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

## 11. Implementation Plan — Six Sequential Phases

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

**End of authoritative blueprint.**
