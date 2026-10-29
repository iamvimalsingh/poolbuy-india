# GROUPBUYING.STORE — CANONICAL PRODUCT CONTRACT

**Version:** 1.2.0  
**Effective Date:** 29 October 2026  
**Status:** Approved Canonical Specification  
**Primary Brand Identity:** GroupBuying (`https://groupbuying.store`)  
**Secondary / Historical Brand:** PoolBuy India  
**Target Runtime:** Next.js 16.4.3 App Router on Cloudflare Workers (via OpenNext) backed by Cloudflare D1 (SQLite)  
**Production Live URL:** `https://groupbuying.store`  

---

## 1. Business Model & Core Philosophy

1. **Free Interest-First Aggregation:**
   GroupBuying.store aggregates free, non-binding expressions of interest in consumer and commercial products by city and relevant service area. Joining a pool registers buying intent; it is **not** a financial transaction or binding purchase contract.
2. **Category-Agnostic Extensibility:**
   The platform is fundamentally product- and category-agnostic. **Solar is one configurable category**, not the platform's exclusive category or permanent architecture. Active categories are governed by the database and admin configuration.
3. **Honest Demand Coordination:**
   The platform coordinates demand to negotiate transparent group pricing with authorized dealers and suppliers. We never invent supplier names, discount claims, fictitious member counts, countdown timers, or fake testimonials.
4. **Initial MVP Boundaries (Strictly No Payments):**
   The initial MVP contains **zero payment processing**. There are no token booking fees, platform charges, escrow funds, payment orders, or payment-gated membership states. Real commerce and installation contracts occur directly between the buyer and verified supplier.

---

## 2. Brand Identity, Favicon & Social Previews

1. **Brand Standard:**
   - Primary: **GroupBuying.store**
   - Secondary Badge: **PoolBuy India**
2. **Approved Visual Assets:**
   - Official Logo: `public/images/logo.png` & `public/images/logo.jpg`
   - Official Favicon: `public/favicon.ico`, `public/favicon.jpg`, `public/favicon.png`, `public/apple-touch-icon.png`, and `app/favicon.ico`
   - OpenGraph & Social Preview: `public/images/og-image.jpg` and `public/images/og-image.svg`
3. **Social Sharing:**
   - Truthful non-binding copy across WhatsApp, Web Share API, and clipboard copy.
   - Non-sensitive referral tracking (`?ref=share`) with zero personal data transmission.

---

## 3. Product, Campaign & City Model

1. **Natural Identity & Independence:**
   - A Pool represents an active interest cohort for a specific product offer in a specific city.
   - Natural Identity: `(city_slug, slug)`.
   - **Isolated Capacity Invariant:** Different cities, different products, and materially different variants have **completely independent capacities and member counts**. Joining a pool in Pune increments Pune's cohort only; it never leaks into or shares capacity with Mumbai, Bhopal, or Delhi.
   - A campaign may be created across multiple cities, but this generates separate, independent city pool records.
2. **Canonical 25 Solar Launch Cities:**
   The 25 canonical launch cities for the initial Solar rollout are:
   1. Delhi (`delhi`)
   2. Mumbai (`mumbai`)
   3. Bengaluru (`bengaluru`)
   4. Hyderabad (`hyderabad`)
   5. Chennai (`chennai`)
   6. Kolkata (`kolkata`)
   7. Pune (`pune`)
   8. Ahmedabad (`ahmedabad`)
   9. Jaipur (`jaipur`)
   10. Surat (`surat`)
   11. Lucknow (`lucknow`)
   12. Kanpur (`kanpur`)
   13. Nagpur (`nagpur`)
   14. Indore (`indore`)
   15. Thane (`thane`)
   16. Bhopal (`bhopal`)
   17. Visakhapatnam (`visakhapatnam`)
   18. Pimpri-Chinchwad (`pimpri-chinchwad`)
   19. Patna (`patna`)
   20. Vadodara (`vadodara`)
   21. Ghaziabad (`ghaziabad`)
   22. Ludhiana (`ludhiana`)
   23. Agra (`agra`)
   24. Nashik (`nashik`)
   25. Faridabad (`faridabad`)
