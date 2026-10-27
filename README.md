# PoolBuy India — Operator Runbook & Architecture Documentation

**Document ID:** PBI-DOC-001  
**Version:** 3.0.0 (Master V3 Specification — Complete)  
**Target Platform:** Next.js 16.4+ (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase PostgreSQL

---

## 1. Overview & Dual-Engine Architecture

**PoolBuy India** is an interest-based group-buying and high-intent buyer acquisition platform for high-ticket consumer products (Electric Scooters, Passenger Cars, Rooftop Solar, Laptops, Smart TVs, and Commercial Equipment) across Indian cities.

### Dual Commercial Monetization Paths:
1. **Engine A — Group-Buy Unlock:** When an active pool reaches its agreed buyer threshold, the operations team verifies commercial pricing and delivery commitments with an authorized dealership. The admin marks the pool `UNLOCKED`, triggering direct WhatsApp distribution of a fully refundable booking-token checkout link.
2. **Engine B — Lead-Generation Fallback:** If a pool deadline passes without reaching the buyer quota, or if the operator engages leads prior to expiry, the admin transitions the pool to `LEAD_FALLBACK`. Leads are filtered and exported via RFC-4180 safe CSV to provide partnered dealerships with verified buyer inquiries under explicit user consent.

---

## 2. Directory Structure

```text
poolbuy-india/
├── app/
│   ├── layout.tsx                     # Root App Router layout & header/footer
│   ├── page.tsx                       # Homepage catalog with city/category filtering & PoolRequestForm
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
│       ├── pools/[poolId]/join/route.ts # Public atomic join RPC bridge
│       ├── pool-requests/route.ts     # Public demand discovery submission (rate-limited)
│       └── admin/                     # Protected admin management endpoints
│           ├── session/route.ts       # Passkey login/logout
│           ├── pools/route.ts         # Pool create/list
│           ├── pools/[poolId]/route.ts # Pool update, soft-delete, archive, restore
│           ├── blog/                  # Blog CMS CRUD
│           │   ├── route.ts           # Blog list & draft creation
│           │   └── [postId]/route.ts  # Blog edit, publish, archive, delete
│           ├── cities/route.ts        # Admin city directory CRUD
│           ├── cities/[cityId]/route.ts # Admin city activation/editing
│           ├── categories/route.ts    # Admin dynamic category CRUD
│           ├── categories/[categoryId]/route.ts # Admin category editing
│           ├── leads/route.ts         # Lead query & status modification
│           ├── leads/export/route.ts  # RFC-4180 CSV streaming export
│           ├── leads/[leadId]/whatsapp/route.ts # Verified WhatsApp link generator
│           └── pool-requests/         # Demand discovery status management
│               ├── route.ts           # List & cluster count search/filtering
│               └── [requestId]/       # Note editing & status update
│                   └── convert/route.ts # Idempotent request-to-pool conversion
├── components/
│   ├── site-header.tsx                # Header with LocationSelector & Blog links
│   ├── site-footer.tsx
│   ├── location-selector.tsx          # 28 States + 8 UTs directory modal & geolocation
│   ├── demo-banner.tsx                # Truthful demo disclaimer banner
│   ├── pool-catalog.tsx               # Client filtering & catalog coordinator
│   ├── pool-card.tsx                  # Deal card with countdown & progress
│   ├── pool-progress.tsx              # Clamped buyer progress bar
│   ├── countdown.tsx                  # Hydration-safe client countdown timer
│   ├── join-pool-modal.tsx            # Zero-login join modal with kit selection & 4 timelines
│   ├── join-success.tsx               # Buyer #N celebration & viral share
│   ├── pool-request-form.tsx          # Dynamic demand discovery request form (+ Other option)
│   ├── deal-action-panel.tsx          # Deal page sticky pricing & tier discounts
│   ├── faq-accordion.tsx              # Accessible keyboard-friendly FAQ accordion
│   ├── json-ld.tsx                    # XSS-safe Schema.org script injector
│   ├── admin-requests-tab.tsx         # Demand discovery queue & conversion modal
│   ├── admin-cities-tab.tsx           # City operations management
│   ├── admin-pools-tab.tsx            # Pool lifecycle actions & 'Run Expiry Check'
│   ├── admin-blog-tab.tsx             # Blog CMS table, editor & live Markdown preview
│   └── admin-*                        # Admin dashboard UI tabs
├── lib/
│   ├── constants.ts                   # Approved cities, categories, status labels
│   ├── data-mode.ts                   # Centralized demo vs Supabase mode resolver
│   ├── env.ts                         # Server-only environment variable validation
│   ├── format.ts                      # Currency (INR), date, phone, slug helpers
│   ├── validation.ts                  # Zod schemas for client, server, and SQL boundaries
│   ├── mock-data.ts                   # Illustrative local demo fixtures & globalThis store
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
│   ├── schema.sql                     # Authoritative PostgreSQL schema & RPC definitions
│   └── migrations/
│       ├── 20261026000001_cities_and_multicity_pools.sql # Phase B migration
│       ├── 20261026000002_dynamic_categories_and_pool_requests.sql # Phase C migration
│       ├── 20261026000003_fixed_kits_and_price_tiers.sql # Phase D migration
│       ├── 20261026000004_location_directory_states_and_cities.sql # Phase E migration
│       ├── 20261026000005_pool_lifecycle_and_expiry.sql # Phase F migration
│       └── 20261026000006_blog_cms.sql # Phase H migration
└── lib/__tests__/                     # Automated test suite (36 unit tests)
```

---

## 3. Environment Variables & Security Configuration

Create a `.env.local` file in the project root. Never commit `.env.local` or expose server secrets in `NEXT_PUBLIC_` variables:

```dotenv
# Public Canonical URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Supabase Public Keys (Required for Live DB Mode)
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

# Local Development Switch (Set to true to force demo mode with banner)
NEXT_PUBLIC_DEMO_MODE=false
```

### Three-Tier Target Environment Architecture
- **Local Development:** Local mock mode (`NEXT_PUBLIC_DEMO_MODE=true`) or local development Supabase project.
- **Preview / Staging:** Dedicated staging Supabase project linked to Vercel Preview deployments.
- **Production:** Isolated production Supabase project with production customer leads, isolated secrets, and point-in-time recovery.

---

## 4. Supabase Setup & Migration Runbook

For a fresh staging or production Supabase instance:
1. Open your [Supabase Dashboard](https://supabase.com/dashboard) and create your project.
2. In the Supabase SQL Editor, first paste and execute [`supabase/schema.sql`](file:///c:/Users/iamvi/OneDrive/Documents/poolbuy-india/supabase/schema.sql) (baseline tables, enums, triggers, RLS, and base RPCs).
3. Next, execute the 6 incremental migrations in [`supabase/migrations/`](file:///c:/Users/iamvi/OneDrive/Documents/poolbuy-india/supabase/migrations/) in strict numerical order:
   - `20261026000001_cities_and_multicity_pools.sql` (Phase B: normalized cities, foreign keys, city isolation)
   - `20261026000002_dynamic_categories_and_pool_requests.sql` (Phase C: categories table, demand discovery RPCs)
   - `20261026000003_fixed_kits_and_price_tiers.sql` (Phase D: fixed kits, volume tiers, quote history, V3 timelines)
   - `20261026000004_location_directory_states_and_cities.sql` (Phase E: 28 States + 8 UTs directory schema)
   - `20261026000005_pool_lifecycle_and_expiry.sql` (Phase F: hard delete prevention, auto-expiry RPC)
   - `20261026000006_blog_cms.sql` (Phase H: blog posts CMS schema, public views, and RLS)

### Post-Schema Validation Queries:
Run these verification queries in Supabase SQL Editor to confirm setup:

```sql
-- 1. Verify tables and views exist
SELECT table_name, table_type FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Verify RLS is enabled on all tables
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- 3. Verify public permissions (anon role can only select public_pools and public_blog_posts)
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE grantee = 'anon' AND table_schema = 'public';
```

---

## 5. Admin Command Center Runbook

1. Navigate to `/admin` or `/admin/login`.
2. Enter your `ADMIN_PASSKEY`. The server performs a constant-time buffer comparison (`crypto.timingSafeEqual`) and issues an `HttpOnly`, `SameSite=Strict`, `Path=/` signed HMAC session cookie valid for 8 hours.

### Unlocking a Pool (Engine A):
When a pool reaches its target buyer count:
1. Contact the authorized dealership in the pool's city to lock fleet pricing and token terms.
2. In the Admin Dashboard **Pools** tab, click **Edit** on the pool.
3. Switch status to `UNLOCKED`.
4. The system strictly requires:
   - `current_buyers >= target_buyers`
   - Verified dealer name
   - Verified price checkbox checked
   - A valid HTTPS hosted token payment URL (e.g. Cashfree/Razorpay payment link)
   - Token amount (₹499–₹999)
5. Save changes. Then navigate to the **Leads & Buyers** tab.
6. Click **WhatsApp → Unlocked Token Payment Link** for each buyer. This opens a prefilled WhatsApp message in a new window for operator review. Click **Send** in WhatsApp.

### Fallback to Dealer Quotations (Engine B):
If a pool does not reach target or the operator elects direct lead fulfillment:
1. Transition the pool to `LEAD_FALLBACK`.
2. In the **Leads CRM**, apply filters (City, Timeline, Existing Quote status).
3. Click **Export CSV** to download an RFC-4180 compliant CSV file with Excel UTF-8 BOM and formula injection protection.
4. Use the **Lead Fallback** WhatsApp template to contact buyers with direct showroom offers.

### Demand Discovery & Pool Request Conversion (Phase C):
1. **Public Request Intake:** Community members submit requests for unlisted products or non-operational cities via the homepage form (`components/pool-request-form.tsx`).
2. **Spam Protection & Persistence:** Submissions are validated with Zod, sanitized, rate-limited via sliding IP windows, and stored via Supabase RPC or demo store.
3. **Admin Demand Review:** In the **Demand Discovery** tab (`components/admin-requests-tab.tsx`), requests are grouped with visual frequency badges (`🔥 N similar in {city}`) to highlight high-demand opportunities.
4. **Pool Conversion Workflow:** Admin clicks **Launch Pool**, configures the city-specific pool fields (standardized product, verified operational city, target buyers, timeline, and dealer details), and confirms publication.
5. **Idempotency Guarantee:** The conversion is atomic and idempotent (`app/api/admin/pool-requests/[requestId]/convert/route.ts`). Subsequent clicks or retries return HTTP 409 `ALREADY_CONVERTED`, preventing duplicate pools.
6. **SEO & Discovery:** Revalidated paths immediately surface the new pool on `/`, `/city/[citySlug]`, `/category/[categorySlug]`, and `/deals/[citySlug]/[poolSlug]`.

---

## 6. Local Development & Automated Tests

```bash
# 1. Install dependencies
npm install

# 2. Run TypeScript type check
npx tsc --noEmit

# 3. Run ESLint
npm run lint

# 4. Run automated unit tests (36 unit tests)
npm test

# 5. Start development server
npm run dev

# 6. Build production bundle
npm run build
```

---

## 7. Deployment Runbook

### Deploying on Vercel:
1. Push repository to GitHub/GitLab.
2. In Vercel Project Settings, add the following Environment Variables:
   - `NEXT_PUBLIC_SITE_URL`: `https://your-domain.com`
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://your-project.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: `your-publishable-key`
   - `SUPABASE_SERVICE_ROLE_KEY`: `your-service-role-key`
   - `ADMIN_PASSKEY`: `your-secure-passkey`
   - `ADMIN_SESSION_SECRET`: `your-32-char-hmac-secret`
   - `NEXT_PUBLIC_DEMO_MODE`: `false`
3. Deploy. The Next.js Turbopack build generates 30+ static and dynamic routes.

### Deploying on Netlify:
1. Connect Git repository.
2. Build command: `next build`. Publish directory: `.next`.
3. Set identical environment variables in Netlify Site Configuration → Environment Variables.
4. Ensure `@netlify/plugin-nextjs` is enabled (standard in modern Netlify builds).

---

## 8. Rollback & Troubleshooting

- **Admin Passkey Lockout:** If `ADMIN_PASSKEY` or `ADMIN_SESSION_SECRET` is changed, all active admin sessions are immediately invalidated. Re-login with the updated passkey.
- **Leads Not Saving:** If Supabase environment variables are missing, the app operates in fail-closed mode for public writes (or demo mode if `NEXT_PUBLIC_DEMO_MODE=true` is set). Verify `SUPABASE_SERVICE_ROLE_KEY` and project connectivity.
- **Formula Injection Mitigation:** Any buyer note or name starting with `=`, `+`, `-`, `@`, `\t`, or `\r` is automatically neutralized with a leading apostrophe (`'`) upon CSV export to prevent spreadsheet execution vulnerabilities.
