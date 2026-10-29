'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  MapPin,
  X,
  AlertCircle,
} from 'lucide-react';
import { PublicPool, City, Category } from '@/types';
import { useSelectedCity } from '@/lib/location-store';
import { CategoryDiscovery } from './category-discovery';
import { PoolCatalog } from './pool-catalog';
import { HowItWorks } from './how-it-works';
import { TrustTransparency } from './trust-transparency';
import { HomepageFaqs } from './homepage-faqs';
import { PoolRequestForm } from './pool-request-form';

interface HomepageViewProps {
  pools: PublicPool[];
  operationalCities: City[];
  operationalCategories: Category[];
}

export function HomepageView({
  pools,
  operationalCities,
  operationalCategories,
}: HomepageViewProps) {
  const [storeCity, setStoreCity] = useSelectedCity();
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');

  const selectedCityMeta = React.useMemo(() => {
    if (!storeCity) return null;
    return operationalCities.find((c) => c.slug === storeCity) || {
      id: `city-${storeCity}`,
      name: storeCity.charAt(0).toUpperCase() + storeCity.slice(1),
      slug: storeCity,
      state: 'India',
      isActive: true,
      createdAt: '',
      updatedAt: '',
    };
  }, [storeCity, operationalCities]);

  const handleSelectCategory = (categorySlug: string) => {
    setActiveCategoryFilter(categorySlug);
    // Smooth scroll to pools section
    const el = document.getElementById('pools');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleChangeCity = () => {
    setStoreCity(null);
    const el = document.getElementById('pools');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col gap-12 sm:gap-16 pb-20">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white/90 via-slate-50/60 to-transparent border-b border-gray-100/90 pt-12 pb-16 sm:pt-20 sm:pb-24">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-tr from-emerald-100/35 via-teal-50/20 to-transparent blur-3xl -z-10 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Trust pill */}
          <div className="inline-flex items-center gap-2 bg-emerald-50/90 border border-emerald-200/80 text-emerald-800 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-6 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            <span>Community-Led Group Buying in India • 100% Free to Express Interest</span>
          </div>

          {/* Conditional Heading: Generic Hero (Default) vs City-Specific Hero (City Selected) */}
          {selectedCityMeta ? (
            /* City-Specific Hero */
            <div className="animate-fade-in-up">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100/80 text-emerald-900 border border-emerald-300 mb-4">
                <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                <span>Selected City Cohort</span>
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-sans font-extrabold text-gray-950 tracking-tight max-w-4xl mx-auto leading-[1.12] mb-4">
                Buying groups in <span className="text-emerald-700">{selectedCityMeta.name}</span>
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed mb-6">
                Explore products and services with collective local demand. We aggregate interest with fellow buyers in {selectedCityMeta.name} for direct supplier terms.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                  href="#pools"
                  className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3.5 rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-500 transition-all duration-150"
                >
                  <span>Explore {selectedCityMeta.name} Pools</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={handleChangeCity}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4 text-gray-400" />
                  <span>Change City</span>
                </button>
              </div>
            </div>
          ) : (
            /* General Platform Hero (No City Selected) */
            <div className="animate-fade-in-up">
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-sans font-extrabold text-gray-950 tracking-tight max-w-4xl mx-auto leading-[1.12] mb-6">
                Bring local buyers together.
                <span className="block text-emerald-700 text-3xl sm:text-4xl md:text-5xl mt-2 font-bold">
                  Unlock better buying opportunities.
                </span>
              </h1>

              <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed mb-8">
                Tell us what you want to buy. We bring together demand from people in your city and work towards better supplier offers.
              </p>

              {/* Primary CTAs */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                  href="#pools"
                  className="group inline-flex items-center gap-2 text-sm font-semibold px-6 py-3.5 rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/25 ring-1 ring-emerald-500/30 hover:bg-emerald-500 hover:shadow-lg transition-all duration-200"
                >
                  <MapPin className="w-4 h-4 text-emerald-200 group-hover:scale-110 transition-transform" />
                  <span>Choose Your City</span>
                </a>

                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-3.5 rounded-xl border border-gray-200 bg-white text-gray-800 hover:border-emerald-300 hover:bg-slate-50 transition-all duration-150"
                >
                  <span>How It Works</span>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </a>

                <a
                  href="#request-pool"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold px-5 py-3.5 text-emerald-700 hover:text-emerald-900 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Start a Pool</span>
                </a>
              </div>
            </div>
          )}

          {/* Key Truthful Platform Guarantees */}
          <div className="mt-10 pt-6 border-t border-gray-200/60 max-w-3xl mx-auto flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs text-gray-500 font-medium">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Free to express interest</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>No purchase commitment</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Supplier offers &amp; discounts are not guaranteed</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. CATEGORY DISCOVERY SECTION */}
      <CategoryDiscovery
        categories={operationalCategories}
        selectedCategory={activeCategoryFilter}
        onSelectCategory={handleSelectCategory}
        selectedCityName={selectedCityMeta?.name}
      />

      {/* 3. POOL CATALOG & CITY SELECTION SECTION */}
      <section id="pools" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full scroll-mt-24">
        <PoolCatalog
          initialPools={pools}
          initialCities={operationalCities}
          initialCategories={operationalCategories}
          activeCategory={activeCategoryFilter}
          onSelectCategory={setActiveCategoryFilter}
        />
      </section>

      {/* 4. HOW IT WORKS: 4 SIMPLE STEPS */}
      <HowItWorks />

      {/* 5. TRUST, TRANSPARENCY & OFFICIAL SCHEME INFORMATION */}
      <TrustTransparency />

      {/* 6. COMPREHENSIVE FAQS */}
      <HomepageFaqs />

      {/* 7. DEMAND PROPOSAL: START A POOL */}
      <section id="request-pool" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full scroll-mt-24">
        <div className="bg-gradient-to-r from-emerald-900 to-teal-900 rounded-3xl p-6 sm:p-12 text-white relative overflow-hidden shadow-lg">
          <div className="relative z-10 max-w-2xl mb-8">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-400/30 mb-4">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              Start a Pool (Demand Proposal for Admin Review)
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Propose a collective buying pool for your community
            </h2>
            <p className="text-sm sm:text-base text-emerald-100/90 leading-relaxed mb-6">
              Organizing for an apartment society, residential colony, or commercial group? Propose a group-buy pool in your city. Submissions enter Admin review and are published after approval so local neighbors can join.
            </p>
            <div className="flex flex-wrap gap-4 items-center">
              <div className="text-xs text-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                <span>100% Free to propose or join</span>
              </div>
              <div className="text-xs text-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                <span>Reviewed before public listing</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 max-w-3xl">
            <PoolRequestForm
              initialCities={operationalCities}
              initialCategories={operationalCategories}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
