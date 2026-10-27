# GroupBuying (PoolBuy India) — Operator Runbook & Architecture Documentation

**Document ID:** PBI-DOC-MVP-001  
**Version:** 3.1.0 (Master V3.1 Specification & Community MVP)  
**Primary Brand:** **GroupBuying** (`https://groupbuying.store`)  
**Secondary / Historical Identity:** **PoolBuy India**  
**Target Platform:** Next.js 16.4+ (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase PostgreSQL

---

## 1. Overview & Core Philosophy

**GroupBuying** is a community-led group-buying and high-intent buyer acquisition platform for high-ticket consumer products (Electric Scooters, Passenger Cars, Rooftop Solar, Laptops, Smart TVs, Water Softeners, and Commercial Equipment) across Indian cities.

### Supreme Specification Authority
The authoritative product and implementation specification is defined in `MASTER_BLUEPRINT.md` Section 19 (V3.1 amendment) and `MVP.md`. These supersede any older conflicting text in Sections 1–18.

### Core Architectural Guarantees:
1. **Zero Customer Accounts / Login:** Buyers never enter passwords, register accounts, or undergo SMS/WhatsApp OTP friction. Buyers join groups simply by submitting their name, verified 10-digit Indian WhatsApp number, city, and purchasing timeline.
2. **Zero Automated WhatsApp Bots:** All WhatsApp interactions use human-reviewed click-to-chat `wa.me/91...` URLs with pre-formatted, truthful templates. No unverified third-party bots or unapproved automated message dispatch.
3. **Zero Active Payment Collection in MVP:** Real money collection and token connection fees remain **unconfigured and disabled** (`paymentConfigState: 'DISABLED'`). No credit card, UPI, or payment gateway checkout runs in customer flows.
4. **No Customer Portal or Vendor Portal:** Group status is checked transparently on public deal pages. Dealerships and group buyers coordinate via operator-assisted communication.
5. **Universal City Synchronization:** City changes propagate instantaneously across the site header, deal catalogs, and public modals via the `poolbuy:city-change` custom DOM event and `poolbuy_selected_city` cookie/storage.

---

## 2. Directory Structure

```text
poolbuy-india/
├── app/
│   ├── layout.tsx                     # Root App Router layout, brand metadata & header/footer
│   ├── page.tsx                       # Homepage catalog with city/category filtering & Start a Group Buy form
│   ├── loading.tsx, error.tsx, not-found.tsx
│   ├── robots.ts                      # MetadataRoute.Robots with demo/admin protection
│   ├── sitemap.ts                     # MetadataRoute.Sitemap (dynamic city & category routes)
│   ├── city/[citySlug]/page.tsx       # Programmatic city SEO landing pages
│   ├── category/[categorySlug]/page.tsx # Dynamic Category SEO landing pages
│   ├── deals/[citySlug]/[poolSlug]/page.tsx # Deal detail SEO pages + JSON-LD + join modal
│   ├── blog/                          # Public Educational Hub
│   │   ├── page.tsx                   # Blog directory with topic filtering
│   │   ├── [slug]/page.tsx            # Article page with safe Markdown & Article JSON-LD
│   │   └── rss.xml/route.ts           # Secondary RSS endpoint
│   ├── feed.xml/route.ts              # Primary RSS 2.0 XML distribution
│   ├── admin/
│   │   ├── page.tsx                   # Server-authenticated admin console shell
│   │   └── login/page.tsx             # Constant-time passkey entry
│   └── api/
│       ├── cities/route.ts            # Public operational cities directory
│       ├── locations/route.ts         # Full 28 States & 8 UTs location directory
│       ├── categories/route.ts        # Public operational dynamic categories
│       ├── cron/pool-lifecycle/route.ts # Automated lifecycle & expiry scheduler
│       ├── pools/[poolId]/join/route.ts # Public atomic join RPC bridge with duplicate handling
│       ├── pool-requests/route.ts     # Public demand discovery / proposal submission
│       └── admin/                     # Protected admin management endpoints (passkey cookie auth)
│           ├── session/route.ts       # Passkey login/logout
│           ├── audit-logs/route.ts    # Comprehensive immutable operator audit logs
│           ├── pools/route.ts         # Pool create/list
│           ├── pools/[poolId]/route.ts # Pool update, soft-delete, archive, restore
│           ├── pools/[poolId]/clone/route.ts # Multi-city pool cloning (leads preserved)
│           ├── pools/[poolId]/extend-deadline/route.ts # Deadline extension with audit logging
│           ├── blog/                  # Blog CMS CRUD
│           │   ├── route.ts           # Blog list & draft creation
│           │   └── [postId]/route.ts  # Blog edit, publish, archive, delete
│           ├── cities/route.ts        # Admin city directory CRUD
│           ├── categories/route.ts    # Admin dynamic category CRUD
│           ├── leads/route.ts         # Lead query & status modification
│           ├── leads/export/route.ts  # RFC-4180 CSV streaming export with injection mitigation
│           ├── leads/[leadId]/whatsapp/route.ts # Verified WhatsApp click-to-chat generator
│           └── pool-requests/         # Demand discovery status management
│               ├── route.ts           # List & cluster count search/filtering
│               └── [requestId]/       # Note editing & status update
│                   └── convert/route.ts # Idempotent request-to-pool draft conversion
├── components/
│   ├── site-header.tsx                # Header with GroupBuying brand, LocationSelector & Blog links
│   ├── site-footer.tsx
│   ├── location-selector.tsx          # 28 States + 8 UTs directory modal & geolocation
│   ├── demo-banner.tsx                # Truthful demo disclaimer banner
│   ├── pool-catalog.tsx               # Client filtering & catalog coordinator
│   ├── pool-card.tsx                  # Deal card with countdown, progress & truthful pricing
│   ├── pool-progress.tsx              # Clamped buyer progress bar
│   ├── countdown.tsx                  # Hydration-safe client countdown timer
│   ├── join-pool-modal.tsx            # Zero-login join modal with kit selection & 4 timelines
│   ├── join-success.tsx               # Buyer #N celebration & viral share
│   ├── pool-request-form.tsx          # Community group proposal form (Start a Group Buy)
│   ├── deal-action-panel.tsx          # Deal page sticky pricing & tier discounts
│   ├── faq-accordion.tsx              # Accessible keyboard-friendly FAQ accordion
│   ├── json-ld.tsx                    # XSS-safe Schema.org script injector
│   ├── admin-requests-tab.tsx         # Demand discovery queue, proposals & conversion modal
│   ├── admin-cities-tab.tsx           # City operations management
│   ├── admin-pools-tab.tsx            # Pool lifecycle actions, cloning, deadline extension
│   ├── admin-leads-tab.tsx            # Buyer CRM, WhatsApp click-to-chat & opt-out controls
│   ├── admin-blog-tab.tsx             # Blog CMS table, editor & live Markdown preview
│   └── admin-*                        # Admin dashboard UI tabs
├── lib/
│   ├── constants.ts                   # Brand constants, approved cities, categories, status labels
│   ├── data-mode.ts                   # Centralized demo vs Supabase mode resolver
│   ├── env.ts                         # Server-only environment variable validation
│   ├── format.ts                      # Currency (INR), date, phone, slug helpers
│   ├── validation.ts                  # Zod schemas for client, server, and SQL boundaries
│   ├── mock-data.ts                   # Illustrative local demo fixtures & globalThis store
│   ├── audit.ts                       # Immutable operator audit logging helper
│   ├── location-directory.ts          # Authoritative GoI 28 States & 8 UTs dataset
│   ├── blog.ts                        # Dual-mode Blog repository & accessors
│   ├── blog-render.ts                 # Client/server safe Markdown parser & reading time
│   ├── cities.ts                      # Dual-mode city directory data access
│   ├── categories.ts                  # Dual-mode dynamic categories data access
│   ├── products.ts                    # Reusable standardized products definitions
│   ├── pools.ts                       # Public pool repository & join execution
│   ├── leads.ts                       # Server-only CRM queries & status management
│   ├── requests.ts                    # Demand discovery repository & submission RPC
│   ├── admin-auth.ts                  # Constant-time HMAC cookie signing & verification
│   ├── require-admin.ts               # Server-side guard for Route Handlers
│   ├── whatsapp.ts                    # WhatsApp link generator & verified templates
│   ├── csv.ts                         # RFC-4180 escaping & formula injection mitigation
│   ├── seo.ts                         # Metadata, canonical URLs & safe JSON-LD builders
│   └── supabase/
│       ├── public.ts                  # Browser/server-safe public client (anon key)
│       └── admin.ts                   # Server-only service-role client ('server-only')
├── supabase/
│   ├── schema.sql                     # Authoritative baseline PostgreSQL schema & base RPCs
│   └── migrations/
│       ├── 20261026000001_cities_and_multicity_pools.sql # Phase B migration
│       ├── 20261026000002_dynamic_categories_and_pool_requests.sql # Phase C migration
│       ├── 20261026000003_fixed_kits_and_price_tiers.sql # Phase D migration
│       ├── 20261026000004_location_directory_states_and_cities.sql # Phase E migration
│       ├── 20261026000005_pool_lifecycle_and_expiry.sql # Phase F migration
│       ├── 20261026000006_blog_cms.sql # Phase H migration
│       └── 20261027000000_mvp_community_groupbuying.sql # MVP Phase migration (audit logs, join_pool RPC)
└── lib/__tests__/                     # Automated test suite (68 unit tests)
```

---

## 3. Environment Variables & Security Configuration

Create a `.env.local` file in the project root. Never commit `.env.local` or expose server secrets in `NEXT_PUBLIC_` variables:

```dotenv
# Public Canonical URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Supabase Public Keys (Required for Live DB Mode; NOT VERIFIED against remote project yet)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
# Legacy fallback if your project uses anon key:
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Server-Only Service Role Key (Bypasses RLS - NEVER expose to browser)
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Admin Passkey & Cookie Signing Secret
ADMIN_PASSKEY=choose-a-strong-passkey-here
ADMIN_SESSION_SECRET=at-least-32-random-alphanumeric-secret-key-here

# Secret token for authenticating automated cron/scheduler tasks (Pool lifecycle & expiry)
# Must match Authorization: Bearer <CRON_SECRET> header when calling /api/cron/pool-lifecycle
CRON_SECRET=your-random-32-or-48-char-hex-secret-here

# Local Development Switch (Set to true to run in offline local demo mode with in-memory store)
NEXT_PUBLIC_DEMO_MODE=true
```

> [!IMPORTANT]
> **Remote Supabase Status: NOT VERIFIED**  
> Active remote Supabase project credentials do not currently exist for this deployment. The local migration files and RPC definitions in `supabase/migrations/` are thoroughly prepared and syntactically validated, but remote schema application, live RLS, and remote persistence remain **NOT VERIFIED**.  
> The application runs seamlessly locally in offline mock store mode (`NEXT_PUBLIC_DEMO_MODE=true`).

---

## 4. Supabase Setup & Migration Runbook

When a remote Supabase project is provisioned:
1. Open the [Supabase Dashboard](https://supabase.com/dashboard) and create a new project.
2. In the Supabase SQL Editor, execute [`supabase/schema.sql`](file:///c:/Users/iamvi/OneDrive/Documents/poolbuy-india/supabase/schema.sql) (baseline schema, enums, triggers, RLS, and baseline RPCs).
3. Execute the 7 sequential migrations in [`supabase/migrations/`](file:///c:/Users/iamvi/OneDrive/Documents/poolbuy-india/supabase/migrations/) in strict numerical order:
   - `20261026000001_cities_and_multicity_pools.sql` (Phase B: normalized cities, foreign keys, city isolation)
   - `20261026000002_dynamic_categories_and_pool_requests.sql` (Phase C: categories table, demand discovery RPCs)
   - `20261026000003_fixed_kits_and_price_tiers.sql` (Phase D: fixed kits, volume tiers, quote history, V3 timelines)
   - `20261026000004_location_directory_states_and_cities.sql` (Phase E: 28 States + 8 UTs directory schema)
   - `20261026000005_pool_lifecycle_and_expiry.sql` (Phase F: hard delete prevention, auto-expiry RPC)
   - `20261026000006_blog_cms.sql` (Phase H: blog posts CMS schema, public views, and RLS)
   - `20261027000000_mvp_community_groupbuying.sql` (MVP: audit logs, additive fields, security invoker `public_pools` view, and transactional `join_pool` RPC)
4. See [`docs/launch/MVP_SUPABASE_SETUP_NEXT_STEPS.md`](file:///c:/Users/iamvi/OneDrive/Documents/poolbuy-india/docs/launch/MVP_SUPABASE_SETUP_NEXT_STEPS.md) for full SQL verification queries.

---

## 5. Admin Console & Operational Runbook

1. Navigate to `/admin` or `/admin/login`.
2. Enter your `ADMIN_PASSKEY`. The server performs constant-time buffer comparison (`crypto.timingSafeEqual`) and issues an `HttpOnly`, `SameSite=Strict`, `Path=/` signed HMAC session cookie valid for 8 hours.

### Proposals & Demand Intake:
1. Community members propose groups via **Start a Group Buy** on the homepage (`components/pool-request-form.tsx`).
2. Proposals land in the Admin **Demand Discovery** tab (`components/admin-requests-tab.tsx`).
3. Admins review buyer requirements, update status (`REQUESTED` → `UNDER_REVIEW` → `NEEDS_INFO`), or click **Convert to Group Deal**.
4. The conversion creates an un-published draft pool (`isPublished: false`) that is completely hidden from public view until published.

### Group Deal Lifecycle & Safety Controls:
1. **Publish Toggle:** Groups remain private drafts until an operator verifies dealer arrangements and enables `isPublished: true`.
2. **Multi-City Clone:** Click **Clone Pool** to replicate a group template into a new city. Target buyer count resets to 0 and all existing leads stay strictly bound to the original pool.
3. **Extend Deadline:** Click **Extend Deadline** to prolong an active deal. Every extension logs the operator reason to the immutable audit log.
4. **Hard Delete Guard:** The delete action prevents accidental data destruction. Pools with existing members return HTTP 400 `CANNOT_HARD_DELETE` with instructions to soft-delete/archive instead.

### Member CRM & WhatsApp Click-to-Chat:
1. Navigate to **Leads & Buyers** tab (`components/admin-leads-tab.tsx`).
2. Click **WhatsApp** on any buyer. The modal supports verified message templates:
   - Group Target Reached / Booking Confirmation
   - Direct Showroom Quote Follow-up
   - Timeline Verification
3. Clicking **Open in WhatsApp** generates a prefilled `https://wa.me/91...` link for human operator review in WhatsApp Web/Desktop.
4. If a buyer opts out, their status transitions to `DO_NOT_CONTACT`. The API blocks all future WhatsApp link generation with HTTP 400 `CONTACT_OPTED_OUT`.

---

## 6. Local Development & Verification

```bash
# 1. Install dependencies
npm install

# 2. Run TypeScript type check (0 errors required)
npx tsc --noEmit

# 3. Run ESLint (0 errors, 0 warnings required)
npm run lint

# 4. Run automated test suite (68 tests passing)
npm test

# 5. Run end-to-end MVP verification script (41 checks passing)
node --env-file=.env.local scratch/mvp-community-verify.mjs

# 6. Run Phase F & GH lifecycle and SEO verification scripts
node --env-file=.env.local scratch/phase-f-verify.mjs
node --env-file=.env.local scratch/phase-gh-verify.mjs

# 7. Start local development server
npm run dev -- -p 3000

# 8. Build production bundle (45 static and partial-prerendered routes)
npm run build
```

---

## 7. Key Architecture Commitments

- **No Remote Deployment Executed:** No unauthorized deployments to Vercel, Netlify, or DNS modifications were performed.
- **Zero Secrets Echoed:** Passkeys, session HMAC secrets, and cron secrets are never echoed or committed to version control.
- **Dedicated Git Branch:** All changes reside on `mvp-community-groupbuying`.
