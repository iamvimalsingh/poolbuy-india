# Frontend UI & Architecture Audit Report
**Date**: October 29, 2026  
**Platform**: GroupBuying.store (PoolBuy India)  
**Status**: Strictly Read-Only Audit Completed  

---

## Executive Summary
This audit provides an architectural and structural assessment of the GroupBuying frontend codebase (`app/` and `components/`). The frontend is built on **Next.js 16 (App Router with Turbopack)**, leveraging server components for data fetching and client components with React 19 hooks (`useSyncExternalStore`, `useTransition`, `useRef`) for local cohort selection, modal interactions, and loading states.

---

## 1. Routing & Page Structure

### 1.1 Active Public Frontend Routes

| Route | Type | Component File | Description & State |
| :--- | :--- | :--- | :--- |
| `/` | Dynamic Server Component | [`app/page.tsx`](file:///c:/Users/iamvi/poolbuy-india/app/page.tsx) | Homepage: Hero, Catalog with City/Category filters, How It Works, and Start a Pool proposal form. |
| `/city/[citySlug]` | Static (SSG) / Dynamic Fallback | [`app/city/[citySlug]/page.tsx`](file:///c:/Users/iamvi/poolbuy-india/app/city/[citySlug]/page.tsx) | City Deals Directory: Active local pools in that city or demand discovery state with city-level FAQs. |
| `/category/[categorySlug]` | Static (SSG) / Dynamic Fallback | [`app/category/[categorySlug]/page.tsx`](file:///c:/Users/iamvi/poolbuy-india/app/category/[categorySlug]/page.tsx) | Category Directory: Displays pools matching a vertical (Solar, Power Backup, Water Softeners, etc.). |
| `/deals/[citySlug]/[poolSlug]` | Dynamic Server Component | [`app/deals/[citySlug]/[poolSlug]/page.tsx`](file:///c:/Users/iamvi/poolbuy-india/app/deals/[citySlug]/[poolSlug]/page.tsx) | Deal Detail Page: Comprehensive product specs, volume discount tiers, verified dealer quotation status, and [`DealActionPanel`](file:///c:/Users/iamvi/poolbuy-india/components/deal-action-panel.tsx). |
| `/blog` | Static Server Component | [`app/blog/page.tsx`](file:///c:/Users/iamvi/poolbuy-india/app/blog/page.tsx) | Blog Directory: Explainer guides, solar subsidy updates, and buyer resources. |
| `/blog/[slug]` | Dynamic Server Component | [`app/blog/[slug]/page.tsx`](file:///c:/Users/iamvi/poolbuy-india/app/blog/[slug]/page.tsx) | Individual Blog Post: In-depth articles with JSON-LD structured data and related categories. |
| `/blog/rss.xml` & `/feed.xml` | Route Handlers | [`app/blog/rss.xml/route.ts`](file:///c:/Users/iamvi/poolbuy-india/app/blog/rss.xml/route.ts) | Public RSS/Atom feed syndication. |
| `/admin/login` | Static Page | [`app/admin/login/page.tsx`](file:///c:/Users/iamvi/poolbuy-india/app/admin/login/page.tsx) | Administrative authentication screen. |
| `/admin` | Dynamic Server Component | [`app/admin/page.tsx`](file:///c:/Users/iamvi/poolbuy-india/app/admin/page.tsx) | Protected Operator Console (`AdminDashboard`). |

### 1.2 Homepage Structure: State 1 (No City) vs State 2 (City Selected)
In [`app/page.tsx`](file:///c:/Users/iamvi/poolbuy-india/app/page.tsx), data fetching is performed on the server via `Promise.all([getPublicPools(), getOperationalCities(), getOperationalCategories()])`. The page does **not** conditionally swap server-side layouts; instead, the entire discovery experience is delegated to the client component [`PoolCatalog`](file:///c:/Users/iamvi/poolbuy-india/components/pool-catalog.tsx).

- **State 1: No City Selected (`selectedCity === null` or `'all'`)**:
  - **Hero Section**: Remained visible at the top (`Bring local buyers together.`).
  - **Discovery Header**: Renders the "National Overview • All India" banner with `<Globe />` icon: `"Active Group Buying Pools Across India"`.
  - **Location Switcher**: "Popular Launch Cities" quick-select chips show "All India" as active alongside city chips.
  - **Category Pills**: Fully displayed horizontally.
  - **Pool Listings**: Displays active pools **nationwide across all cities**, indicating the number of pools and unique cities.
  - **Empty State**: If filters match 0 pools, shows nationwide proposal options.

- **State 2: Specific City Selected (`selectedCity === 'bhopal'`, etc.)**:
  - **Discovery Header**: Changes to `"City-Specific Cohort"` with `<MapPin />` icon: `"Group Buying Pools in [City Name]"`.
  - **Reset Action**: A prominent `"Show All India"` button (`<X />`) appears in the header.
  - **Location Switcher**: The active city pill is highlighted in emerald.
  - **Pool Listings**: Strictly filtered to `pool.citySlug === selectedCity`.
  - **Empty State**: If 0 active pools exist in that city, an honest demand-discovery empty state appears: *"No active group pools in [City Name] right now. Demand collection is open. Be the first to propose a group buy!"* with direct CTA buttons.

---

## 2. Core Components Inventory

### Active Public Components

1. **[`SiteHeader`](file:///c:/Users/iamvi/poolbuy-india/components/site-header.tsx)**:
   - Sticky navigation header with brand mark, anchor links (`Explore Pools`, `How It Works`, `Start a Pool`), and the interactive `LocationSelector`.
2. **[`LocationSelector`](file:///c:/Users/iamvi/poolbuy-india/components/location-selector.tsx)**:
   - Interactive popover in the header featuring geolocation distance calculation, city search, and direct sync with `useSelectedCity()`.
3. **[`SiteFooter`](file:///c:/Users/iamvi/poolbuy-india/components/site-footer.tsx)**:
   - 5-column balanced dark footer featuring legal disclaimers, brand overview, a dense 2-to-3 column grid of 25 supported cities, category links, safety rules, and admin entry point.
4. **[`PoolCatalog`](file:///c:/Users/iamvi/poolbuy-india/components/pool-catalog.tsx)**:
   - Primary interactive catalog coordinator on the homepage. Manages city selection, category filtering, search input, skeleton shimmer transitions, and modal popups.
5. **[`PoolCard`](file:///c:/Users/iamvi/poolbuy-india/components/pool-card.tsx)**:
   - Modernized card container (`rounded-2xl`, subtle border, hover lift) with dedicated image header, glassmorphism status badges, indicative/verified pricing, dynamic gradient progress bar (`h-3`), waitlist count, and full-width CTA.
6. **[`PoolCardSkeleton`](file:///c:/Users/iamvi/poolbuy-india/components/pool-card-skeleton.tsx)**:
   - Shimmer placeholder component replicating the exact dimensions and styling of `PoolCard` for zero Cumulative Layout Shift (CLS).
7. **[`JoinPoolModal`](file:///c:/Users/iamvi/poolbuy-india/components/join-pool-modal.tsx)**:
   - Responsive dialog (centered modal on desktop `md:`, bottom sheet drawer on mobile `< md` with drag handle). Collects full name, WhatsApp number, 6-digit postal pincode, optional quote, and DPDP consent. Auto-closes smoothly (700ms) after success.
8. **[`Toast`](file:///c:/Users/iamvi/poolbuy-india/components/toast.tsx)**:
   - Fixed floating notification (`bottom-4 right-4 z-50 animate-slide-up`) displaying `"Interest registered successfully! We'll update you soon."` with auto-dismiss (4s).
9. **[`DealActionPanel`](file:///c:/Users/iamvi/poolbuy-india/components/deal-action-panel.tsx)**:
   - Sticky conversion module on `/deals/[citySlug]/[poolSlug]` displaying group vs market pricing, verified discount tiers, countdown timer, and join trigger.
10. **[`PoolRequestForm`](file:///c:/Users/iamvi/poolbuy-india/components/pool-request-form.tsx)**:
    - Community demand discovery form allowing buyers to propose a new pool in their city. Submissions enter Admin review.
11. **[`PoolImage`](file:///c:/Users/iamvi/poolbuy-india/components/pool-image.tsx)**:
    - Fallback-safe Next.js image component with category-specific SVG fallback assets.
12. **[`FaqAccordion`](file:///c:/Users/iamvi/poolbuy-india/components/faq-accordion.tsx)**:
    - Accessible accordion component for city and category pages.

---

## 3. State Management & Lifecycle

### 3.1 `selectedCity` State Persistence & Architecture
The authoritative location state is managed through a lightweight, custom reactive store built with React's native **`useSyncExternalStore`** in [`lib/location-store.ts`](file:///c:/Users/iamvi/poolbuy-india/lib/location-store.ts).

- **Implementation**:
  - `useSyncExternalStore(subscribeCity, getCitySnapshot, getServerSnapshot)`
- **Persistence Layers**:
  1. **`localStorage`**: Keyed under `'poolbuy_preferred_city'`. Persists preference across user sessions.
  2. **`document.cookie`**: Set under `'poolbuy_selected_city'` with `max-age=2592000` (30 days) and `SameSite=Lax`. This enables future Server Component and middleware geo-detection.
  3. **Event Dispatching**: Emits `poolbuy:city-change` custom events and listens to native `storage` events across browser tabs.
  4. **Initial Default**: `null` (representing All India / National Overview).
- **Synchronization**:
  When a user changes the city in [`LocationSelector`](file:///c:/Users/iamvi/poolbuy-india/components/location-selector.tsx) (header), [`PoolCatalog`](file:///c:/Users/iamvi/poolbuy-india/components/pool-catalog.tsx) instantly re-evaluates and switches context without page reloads or Prop Drilling.

### 3.2 `isLoading` State & Transition Handling
- In [`PoolCatalog`](file:///c:/Users/iamvi/poolbuy-india/components/pool-catalog.tsx), `isLoading` is managed as a boolean state (`useState(false)`).
- When a user triggers `handleCitySelect` or `handleCategorySelect`:
  - `setIsLoading(true)` is invoked immediately.
  - A managed timeout timer (`transitionTimerRef.current`, 280ms for city, 200ms for category) schedules `setIsLoading(false)`.
  - While `isLoading === true`, the component renders a grid of 3 [`PoolCardSkeleton`](file:///c:/Users/iamvi/poolbuy-india/components/pool-card-skeleton.tsx) cards.
  - Because the skeleton grid shares the exact layout classes (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6`), the transition feels immediate and has **zero layout shift**.

---

## 4. Technical Debt & Hardcoded Data Analysis

### 4.1 Mock Data vs. Production Database
1. **`lib/mock-data.ts`**:
   - Contains fallback demo pools (`MOCK_POOLS`, `MOCK_ADMIN_POOLS`), demo categories, and demo leads.
   - Guarded by [`isDemoMode()`](file:///c:/Users/iamvi/poolbuy-india/lib/data-mode.ts). When `process.env.NODE_ENV === 'production'` or `NEXT_PUBLIC_DEMO_MODE === 'false'`, the application queries Cloudflare D1 SQLite.
   - **Recommendation**: Retain `mock-data.ts` strictly for offline unit tests and staging dry-runs, but ensure mock fixtures never leak into live D1 tables.

2. **`lib/constants.ts` vs Cloudflare D1 Seed Data**:
   - In [`lib/constants.ts`](file:///c:/Users/iamvi/poolbuy-india/lib/constants.ts), `LAUNCH_CITIES` defines 25 Indian cities, and `CATEGORIES` defines 8 categories.
   - In [`components/site-footer.tsx`](file:///c:/Users/iamvi/poolbuy-india/components/site-footer.tsx), cities are rendered directly from `CITIES` (25 cities), while Cloudflare D1 migration `0007` only seeds 10 operational cities.
   - Unserved cities (e.g. Surat, Kochi) resolve via [`INDIA_LOCATION_DIRECTORY`](file:///c:/Users/iamvi/poolbuy-india/lib/cities.ts) to display a valid demand-discovery page rather than throwing 404 errors.
   - **Recommendation**: When adding new launch cities via the Admin Console, consider fetching active footer cities dynamically or syncing `LAUNCH_CITIES`.

### 4.2 Unused & Orphaned Components
The codebase contains several legacy components created during earlier prototyping phases that are no longer imported anywhere in `app/` or `components/`:

| Component | Status | Recommendation |
| :--- | :--- | :--- |
| `components/admin-blog-tab.tsx` | **Unused (0 imports)** | Safe to archive; blog management is handled via separate API. |
| `components/admin-campaigns-placeholder.tsx` | **Unused (0 imports)** | Safe to delete; superseded by `admin-campaigns-tab.tsx`. |
| `components/admin-cities-tab.tsx` | **Unused (0 imports)** | Safe to delete; superseded by `admin-locations-tab.tsx`. |
| `components/admin-leads-tab.tsx` | **Unused (0 imports)** | Archived; leads are reviewed inside campaign pool modals. |
| `components/admin-pools-tab.tsx` | **Unused (0 imports)** | Safe to delete; superseded by `admin-campaigns-tab.tsx`. |
| `components/admin-requests-tab.tsx` | **Unused (0 imports)** | Safe to delete; superseded by location requests tab. |
| `components/admin-settings-tab.tsx` | **Unused (0 imports)** | Safe to delete; no active settings console. |
| `components/join-success.tsx` | **Unused (0 imports)** | Safe to delete; superseded by inline modal state and `Toast`. |

---

## 5. Architectural Quality Checklist

- [x] **Strict Invariants**: Zero customer password authentication; WhatsApp + pincode submission only.
- [x] **Accessibility**: High-contrast text (`text-slate-900`), `sr-only` tags, `aria-live` polite regions, and `prefers-reduced-motion` compliance.
- [x] **Responsiveness**: Centered modal on desktop transitioning to bottom-sheet drawer on mobile.
- [x] **State Isolation**: Independent city pools with isolated capacity and buyer numbering.
- [x] **Build Status**: Compiles cleanly with Turbopack across all 47 routes (`next build` code 0).
