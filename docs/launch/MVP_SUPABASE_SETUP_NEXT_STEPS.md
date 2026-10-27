# GroupBuying (PoolBuy India) — Supabase Setup & Migration Runbook

**Document ID:** PBI-SBA-MVP-001  
**Target Specification:** `MASTER_BLUEPRINT.md` Section 19 & `MVP.md`  
**Status:** **NOT VERIFIED** (Remote credentials pending provisioning)

---

## 1. Executive Notice on Current Verification Status

> [!IMPORTANT]
> **Remote Supabase Persistence & RLS Status: NOT VERIFIED**  
> Active remote Supabase project credentials do not currently exist for this workspace.  
> - All SQL migration files, table schemas, views, and RPC definitions in `supabase/` and `supabase/migrations/` have been written, syntactically verified, and tested against local specifications.
> - The application is currently operating offline in high-fidelity mock store mode (`NEXT_PUBLIC_DEMO_MODE=true`).
> - When remote Supabase project credentials become available, follow this runbook to execute the migrations, enable RLS, verify permissions, and switch the application to live database mode.

---

## 2. Remote Project Provisioning Steps

1. Log into your [Supabase Organization](https://supabase.com/dashboard).
2. Click **New Project**:
   - **Name:** `groupbuying-production` (or `groupbuying-staging`)
   - **Database Password:** Generate a secure password and store it safely in your password vault.
   - **Region:** `ap-south-1` (Mumbai, India) for minimal latency to Indian consumers and dealerships.
   - **Pricing Plan:** Free tier for testing, or Pro tier for production with automated backups.
3. Once the database finishes provisioning, retrieve your API credentials from **Project Settings → API**:
   - **Project URL:** e.g., `https://xyzcompany.supabase.co`
   - **Publishable Key (`anon` / `publishable`):** Browser-safe key for reading public views.
   - **Service Role Key (`service_role`):** Server-only secret key that bypasses RLS for admin operations and API route handlers. **NEVER expose this to the browser or commit to Git.**

---

## 3. Migration Execution Order

Open the **SQL Editor** in your Supabase dashboard and execute the following SQL files in strict numerical order. Each file is designed to be idempotent and safe:

### Step 1: Baseline Core Schema
Paste and execute the complete contents of:
- [`supabase/schema.sql`](file:///c:/Users/iamvi/OneDrive/Documents/poolbuy-india/supabase/schema.sql)  
  *Sets up core tables (`pools`, `leads`, `products`), enums, triggers, RLS policies, and baseline RPC functions.*

### Step 2: Phase B — Normalized Cities & Isolation
Execute:
- [`supabase/migrations/20261026000001_cities_and_multicity_pools.sql`](file:///c:/Users/iamvi/OneDrive/Documents/poolbuy-india/supabase/migrations/20261026000001_cities_and_multicity_pools.sql)  
  *Normalizes the `cities` table, adds foreign keys, and provides city isolation.*

### Step 3: Phase C — Dynamic Categories & Demand Discovery
Execute:
- [`supabase/migrations/20261026000002_dynamic_categories_and_pool_requests.sql`](file:///c:/Users/iamvi/OneDrive/Documents/poolbuy-india/supabase/migrations/20261026000002_dynamic_categories_and_pool_requests.sql)  
  *Creates the `categories` and `pool_requests` tables with frequency clustering.*

### Step 4: Phase D — Fixed Kits, Price Tiers & V3 Timelines
Execute:
- [`supabase/migrations/20261026000003_fixed_kits_and_price_tiers.sql`](file:///c:/Users/iamvi/OneDrive/Documents/poolbuy-india/supabase/migrations/20261026000003_fixed_kits_and_price_tiers.sql)  
  *Adds fixed kit configurations, volume tier pricing, and timeline enums (`IMMEDIATELY`, `THIS_MONTH`, etc.).*

### Step 5: Phase E — Authoritative 28 States & 8 UTs Directory
Execute:
- [`supabase/migrations/20261026000004_location_directory_states_and_cities.sql`](file:///c:/Users/iamvi/OneDrive/Documents/poolbuy-india/supabase/migrations/20261026000004_location_directory_states_and_cities.sql)  
  *Installs the official Government of India 28 States and 8 Union Territories schema.*

### Step 6: Phase F — Pool Lifecycle, Auto-Expiry & Soft-Delete Protection
Execute:
- [`supabase/migrations/20261026000005_pool_lifecycle_and_expiry.sql`](file:///c:/Users/iamvi/OneDrive/Documents/poolbuy-india/supabase/migrations/20261026000005_pool_lifecycle_and_expiry.sql)  
  *Adds soft-delete columns (`deleted_at`), archive controls, hard-delete prevention, and the `expire_past_deadline_pools` RPC.*

### Step 7: Phase H — Blog CMS & Public Content
Execute:
- [`supabase/migrations/20261026000006_blog_cms.sql`](file:///c:/Users/iamvi/OneDrive/Documents/poolbuy-india/supabase/migrations/20261026000006_blog_cms.sql)  
  *Creates `blog_posts` table, slug generation, `public_blog_posts` view, and public read RLS.*

### Step 8: MVP Phase — Audit Logs & Transactional `join_pool` RPC
Execute:
- [`supabase/migrations/20261027000000_mvp_community_groupbuying.sql`](file:///c:/Users/iamvi/OneDrive/Documents/poolbuy-india/supabase/migrations/20261027000000_mvp_community_groupbuying.sql)  
  *Creates `admin_audit_logs`, adds additive columns to `pools`, `leads`, and `pool_requests`, defines the security-invoker `public_pools` view, and installs the atomic, transactional `join_pool` RPC function.*

---

## 4. Post-Migration Verification Queries

Run the following SQL queries in the Supabase SQL Editor to verify complete schema integrity:

```sql
-- 1. Verify all expected tables and views exist
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
-- Expected tables: admin_audit_logs, blog_posts, categories, cities, leads, location_directory, pool_requests, pools, products
-- Expected views: public_blog_posts, public_pools

-- 2. Verify Row-Level Security (RLS) is ENABLED on all public tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
-- All tables must report rowsecurity = true

-- 3. Verify public (anon) role permissions
-- The anon role MUST only have SELECT access to public views (public_pools, public_blog_posts, cities, categories)
-- The anon role MUST NOT have direct SELECT or INSERT on leads, admin_audit_logs, or pools
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE grantee = 'anon' AND table_schema = 'public'
ORDER BY table_name;

-- 4. Verify RPC functions exist
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name IN ('join_pool', 'expire_past_deadline_pools', 'record_pool_request');
```

---

## 5. Switching from Local Demo to Live Supabase Mode

1. Update your `.env.local` file with the provisioned credentials:
   ```dotenv
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   ADMIN_PASSKEY=your-secure-passkey
   ADMIN_SESSION_SECRET=your-32-char-hmac-secret
   CRON_SECRET=your-random-cron-secret

   # SWITCH FROM DEMO TO LIVE:
   NEXT_PUBLIC_DEMO_MODE=false
   ```
2. Restart the local dev server:
   ```bash
   npm run dev -- -p 3000
   ```
3. Run the verification script against the live database:
   ```bash
   node --env-file=.env.local scratch/mvp-community-verify.mjs
   ```
4. Verify that:
   - Public proposal submission persists into the remote `pool_requests` table.
   - Public join persists into the remote `leads` table and updates `pools.current_buyers`.
   - Admin audit logs record operator actions into the remote `admin_audit_logs` table.
