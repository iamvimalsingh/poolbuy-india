# PoolBuy India / GroupBuying.store — Phase 4A Local Preflight Report
**Local-Only Verification & Readiness Audit Before Supabase Account Setup**

- **Date:** October 27, 2026
- **Current Branch:** `phase-4-staging-brand-seo`
- **Application Baseline:** Next.js 16.4.3 App Router, TypeScript 5.8, Tailwind CSS v4, Node.js 22 LTS
- **Authoritative Spec:** `MASTER_BLUEPRINT.md` (Version 3.0, Section 18)
- **Deployment Status:** Local Development Only (`http://localhost:3000`). No remote Supabase, Vercel, Netlify, or DNS deployment has been created or modified.

---

## 1. Git State Verification

| Check Item | Observed State | Status |
| :--- | :--- | :--- |
| **Current Branch** | `phase-4-staging-brand-seo` | **VERIFIED** |
| **Working Tree** | Clean (`nothing to commit, working tree clean`) | **VERIFIED** |
| **Latest Commit** | `141203f fix(cache): add 'use cache' to sitemap and protect Date.now against ISR background prerender bailout in Next.js 16` | **VERIFIED** |
| **Previous Phase Commit** | `ed025bc feat(phase-4): reconcile supabase migrations, align GroupBuying.store primary brand, update canonical/seo structured data, and disambiguate search intent` | **VERIFIED** |
| **Remote Branch Tracking** | `origin/phase-4-staging-brand-seo` is up-to-date on GitHub (`iamvimalsingh/poolbuy-india`) | **VERIFIED** |
| **Protection Guardrail** | No branches reset, merged into `main`, or discarded. Existing Phase 3 and Phase 4 branches intact. | **VERIFIED** |

---

## 2. Application Data Mode & Fail-Closed Behavior

### Data Mode Resolution (`lib/data-mode.ts`)
```typescript
export function isDemoMode(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return true;
  if (process.env.NODE_ENV === 'production') return false;
  const hasSupabaseUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasSupabaseKey = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  return !hasSupabaseUrl || !hasSupabaseKey;
}
```

### Workflow Audit Matrix:

| Workflow | Current Implementation Path | Behavior in Demo Mode | Behavior in Live Mode (Without Database) |
| :--- | :--- | :--- | :--- |
| **Public Pool Catalog** | `lib/pools.ts` -> `getPublicPools()` | Reads from in-memory `MOCK_POOLS`. Filters closed and past-deadline pools. | Queries `public_pools` view. If Supabase unconfigured, returns `null` and logs notice. |
| **Deal Detail View** | `lib/pools.ts` -> `getPublicPoolBySlug()` | Resolves from `MOCK_POOLS`. | Queries `public_pools` view by `(city_slug, slug)`. Fails closed if database error. |
| **Buyer Pool Join** | `POST /api/pools/[poolId]/join` | Validates Zod schema; stores in-memory demo lead via `recordDemoLead()`. Monotonically increments demo counter. | Invokes PostgreSQL RPC `join_pool`. Throws `Error('Supabase client is not available')` -> Returns HTTP 500 (`INTERNAL_ERROR`). **Fails closed.** |
| **Demand Request** | `POST /api/pool-requests` | Validates Zod schema; stores in `demo-store` via `addDemoRequest()`. Returns `{ id: demoId, isDemo: true }`. | Invokes PostgreSQL RPC `submit_pool_request`. Throws if client unconfigured -> Returns HTTP 500 (`INTERNAL_ERROR`). **Fails closed.** |
| **Admin Operations** | `app/api/admin/...` | Validates signed passkey cookie; reads/mutates in-memory demo stores. | Validates signed passkey cookie; calls `getAdminSupabase()`. Throws if `SUPABASE_SERVICE_ROLE_KEY` missing. **Fails closed.** |
| **Lifecycle Scheduler** | `POST /api/cron/pool-lifecycle` | Requires bearer `CRON_SECRET`; executes in-memory pool expiry in demo mode. | Requires bearer `CRON_SECRET`; calls PostgreSQL RPC `process_pool_expiry()`. **Fails closed.** |

### Public Disclosure & Transparency Safeguards:
1. **Persistent Top Banner (`components/demo-banner.tsx`):**
   When `isDemoMode()` is true, a full-width amber notice is displayed on every page:  
   *"Demo Mode: Demo data — not a live dealer offer. Submissions are saved locally for demonstration purposes only. [MOCK DATA]"*
2. **Interactive Join Modal (`components/join-pool-modal.tsx`):**
   When prices are unverified, displays an explicit amber warning before submission:  
   *"Demo estimate only: This price is an illustrative estimate for demonstration purposes. It is not an authorized dealer quotation."*
3. **No False Persistence Claims:**
   The frontend never misleads the buyer into believing an official dealer contract or live database transaction occurred during demo mode.

---

## 3. Local Audit of the Migration Chain

The versioned migration directory `supabase/migrations/` was audited for ordering, dependencies, duplicate objects, and destructive operations:

| Migration File | Description | Dependency Checks | Safety & Idempotency Audit |
| :--- | :--- | :--- | :--- |
| `20261026000000_baseline_schema.sql` | Baseline tables, enums, triggers, RLS, RPCs, seed pools | None (starts chain) | Uses `IF NOT EXISTS` for tables, catches duplicate enums via `do $$ begin ... exception when duplicate_object`, uses `CREATE OR REPLACE FUNCTION` and `DROP TRIGGER IF EXISTS`. Safe illustrative seed only. **0 destructive statements.** |
| `20261026000001_cities_and_multicity_pools.sql` | `cities` table, composite unique key on `pools (city_slug, slug)` | Depends on `000` (`pools` table and `set_updated_at` function) | Safely drops single-slug constraint and replaces with composite `(city_slug, slug)` to support multi-city deals. Seeds operational cities idempotently via `ON CONFLICT (slug) DO UPDATE`. **0 destructive statements.** |
| `20261026000002_dynamic_categories_and_pool_requests.sql` | `categories`, `standard_products`, `pools.category_slug` | Depends on `000` & `001` | Safe `ADD COLUMN IF NOT EXISTS`. Seeds standard categories with `ON CONFLICT DO UPDATE`. Updates existing pools without dropping records. **0 destructive statements.** |
| `20261026000003_fixed_kits_and_price_tiers.sql` | `pool_kit_offers`, `vendor_price_tiers`, lifecycle fields | Depends on `000` | Safe additive columns on `pools` (`closed_at`, `closure_reason`, `offer_valid_until`, `is_archived`, `deleted_at`). Cascade delete restricted to dependent child kit offers. **0 destructive statements.** |
| `20261026000004_location_directory_states_and_cities.sql` | `states` table (28 States + 8 UTs), foreign key to `cities` | Depends on `001` | Creates normalized `states` table. Adds `state_code` reference to `cities`. RLS enabled with public read policy. **0 destructive statements.** |
| `20261026000005_pool_lifecycle_and_expiry.sql` | Expiry processor RPC and soft-delete trigger | Depends on `000` & `003` | Creates trigger `trg_prevent_pool_hard_delete` that **strictly prevents hard deletion** of pools having buyer leads. Rebuilds `public_pools` view safely using `DROP VIEW IF EXISTS ... CREATE VIEW`. Creates idempotent `process_pool_expiry()` RPC. **0 destructive statements.** |
| `20261026000006_blog_cms.sql` | `blog_posts` table, view, RLS | Independent | Creates `blog_posts` table. RLS restricts public read access strictly to `status = 'PUBLISHED'`. Service role granted full management. **0 destructive statements.** |

### Audit Conclusions:
- **Sequential Integrity:** Numbering is strictly ordered from `000000` to `000006`.
- **Destructive Operations:** **ZERO** `DROP TABLE`, `TRUNCATE`, or `DROP DATABASE` statements exist.
- **Foreign Key Validity:** All foreign keys reference tables defined in earlier migrations.
- **Application Compatibility:** Every column, enum, and RPC signature corresponds exactly to TypeScript definitions in `types/index.ts` and data access helpers in `lib/`.

---

## 4. Environment Setup & Variables Safety Audit

### Variable Configuration Architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PUBLIC ENVIRONMENT VARIABLES                     │
│               (Exposed to Browser via NEXT_PUBLIC_ Prefix)              │
├────────────────────────────────┬───────────────────────────────────────┤
│ Variable Name                  │ Purpose                               │
├────────────────────────────────┼───────────────────────────────────────┤
│ NEXT_PUBLIC_SITE_URL           │ Canonical site origin (localhost/prod)│
│ NEXT_PUBLIC_SUPABASE_URL       │ Staging project URL (*.supabase.co)   │
│ NEXT_PUBLIC_SUPABASE_ANON_KEY  │ Public, browser-safe API key          │
│ NEXT_PUBLIC_DEMO_MODE          │ Explicit flag for demo fallback       │
│ NEXT_PUBLIC_SUPPORT_WHATSAPP   │ Optional public WhatsApp contact      │
│ NEXT_PUBLIC_SUPPORT_EMAIL      │ Optional public support email         │
└────────────────────────────────┴───────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                      CONFIDENTIAL SERVER-ONLY SECRETS                  │
│                (NEVER Prefixed with NEXT_PUBLIC_ / Server Only)         │
├────────────────────────────────┬───────────────────────────────────────┤
│ Variable Name                  │ Purpose                               │
├────────────────────────────────┼───────────────────────────────────────┤
│ SUPABASE_SERVICE_ROLE_KEY      │ Secret service_role JWT (bypasses RLS)│
│ ADMIN_PASSKEY                  │ Secret passkey for operator login     │
│ ADMIN_SESSION_SECRET           │ 64+ char HMAC cookie-signing secret   │
│ CRON_SECRET                    │ Bearer secret for scheduler endpoint  │
└────────────────────────────────┴───────────────────────────────────────┘
```

### Security Compliance:
- `.gitignore` strictly ignores `.env*` and only allows `.env.example`.
- `.env.local` is present locally, uncommitted, and not tracked in Git.
- **Zero secrets** are committed, logged, or printed in terminal reports.

---

## 5. Local Quality Verification Results

Every available automated check was run against the local codebase:

| Check Command | Tested Scope | Exit Code | Actual Result |
| :--- | :--- | :--- | :--- |
| **`npm run lint`** | ESLint 9 across all TS/TSX files | `0` | **PASS** — 0 errors, 0 warnings |
| **`npx tsc --noEmit`** | TypeScript 5.8 strict type check | `0` | **PASS** — 0 type errors |
| **`npm test`** | Node.js native test runner via `tsx` | `0` | **PASS** — 31 test suites, 68 tests passed, 0 failed |
| **`scratch/phase-d-verify.mjs`** | Priority product kits & volume tiers | `0` | **PASS** — 23/23 tests passed |
| **`scratch/phase-e-verify.mjs`** | 28 States + 8 UTs directory & city isolation | `0` | **PASS** — 23/23 tests passed |
| **`scratch/phase-f-verify.mjs`** | Scheduler, expiry, soft-delete & hard-delete prevention | `0` | **PASS** — 25/25 tests passed |
| **`scratch/phase-gh-verify.mjs`** | Sitemap, robots.txt, Schema.org, blog CMS & RSS | `0` | **PASS** — 40/40 tests passed |
| **`npm run build`** | Next.js 16 production compilation & SSG/PPR | `0` | **PASS** — Compiled in 2.4s; 44 static, partial-prerendered, and dynamic routes generated |
| **Local HTTP Server** | `http://localhost:3000` | `200` | **PASS** — Returns HTTP 200; `GroupBuying.store` active; Schema.org WebSite & Organization structured data confirmed |

---

## 6. Next Owner Actions Checklist (Step-by-Step)

Follow these exact steps when creating the Supabase staging project:

### Step 1: Create a Supabase Account
1. Visit **[https://supabase.com](https://supabase.com)** and sign up (or sign in using your GitHub account).
2. Confirm your email address if creating a new account.

### Step 2: Create a Dedicated Staging Project
1. In the Supabase dashboard, click **"New project"**.
2. Select your organization.
3. Configure project details:
   - **Name:** `poolbuy-staging`
   - **Database Password:** Generate and securely save a strong database password (e.g., in a password manager).
   - **Region:** Select **South Asia (Mumbai) - `ap-south-1`** (or region closest to Indian users).
   - **Pricing Plan:** Free tier is sufficient for MVP staging verification.
4. Click **"Create new project"** and wait 1–2 minutes for provisioning to finish.

### Step 3: Retrieve Project URL and API Keys
1. In the Supabase project dashboard, navigate to **Project Settings** (gear icon) > **API**.
2. Locate and copy the following 3 values:
   - **Project URL:** `https://<your-project-ref>.supabase.co`
   - **Project API Keys — `anon` / `public`:** `eyJhbGciOi...`
   - **Project API Keys — `service_role` (Secret):** Click "Reveal" and copy `eyJhbGciOi...` (keep this strictly private).

### Step 4: Configure Local `.env.local` Safely
Open `C:\Users\iamvi\OneDrive\Documents\poolbuy-india\.env.local` and add the 3 credentials:
```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
NEXT_PUBLIC_DEMO_MODE=false

# Keep existing admin secrets intact:
ADMIN_PASSKEY=<existing-passkey>
ADMIN_SESSION_SECRET=<existing-session-secret>
CRON_SECRET=<existing-cron-secret>
```

### Step 5: Link the Project & Dry-Run Migrations
In the terminal at `C:\Users\iamvi\OneDrive\Documents\poolbuy-india`:
1. Log in to the Supabase CLI:
   ```bash
   npx supabase login
   ```
2. Link your local repository to the staging project:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   ```
3. Inspect pending migrations without modifying the database:
   ```bash
   npx supabase migration list
   ```
   *(Verify all 7 migrations `20261026000000` through `20261026000006` are listed as local and pending remote application).*

### Step 6: Apply Migrations to Staging
Once confirmed that the target project is `poolbuy-staging`:
```bash
npx supabase db push
```
*(This applies all 7 migrations idempotently and builds the tables, triggers, RLS policies, and RPC functions).*

### Step 7: Verify Real Lead Persistence & Admin Access
1. Start the application locally with live credentials:
   ```bash
   npm run dev
   ```
2. Submit a test join interest from the frontend on a Bhopal deal.
3. Open Supabase Dashboard > **Table Editor** > `pool_leads` to confirm the row was persisted in the PostgreSQL database.
4. Verify RLS policies prevent unauthorized anonymous reads on `pool_leads`.

---

## 7. Statement of Non-Modification & Strict Boundary

- **No Remote Calls:** No network requests were made to any unconfigured remote database.
- **No Schema Changes on Remote:** No remote migrations or database resets were executed.
- **No Production Deployments:** No Vercel or Netlify production builds or custom domain bindings were attempted.
- **Phase Boundary Respected:** Stopped strictly at Phase 4A preflight completion. Ready for owner account creation.
