'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Filter, Layers, MapPin, Sparkles, X, Rocket, ArrowRight } from 'lucide-react';
import { PublicPool, JoinPoolResult, City, Category } from '@/types';
import { LAUNCH_CITIES, CATEGORIES as STATIC_CATEGORIES, CATEGORY_SLUG_MAP } from '@/lib/constants';
import { getCountdownParts } from '@/lib/format';
import { useSelectedCity } from '@/lib/location-store';
import { PoolCard } from './pool-card';
import { PoolCardSkeleton } from './pool-card-skeleton';
import { JoinPoolModal } from './join-pool-modal';
import { Toast, DEFAULT_JOIN_SUCCESS_MESSAGE } from './toast';

interface PoolCatalogProps {
  initialPools: PublicPool[];
  initialCities?: City[];
  initialCategories?: Category[];
  initialCity?: string;
  onSelectCategory?: (categorySlug: string) => void;
  activeCategory?: string;
}

export function PoolCatalog({
  initialPools,
  initialCities,
  initialCategories,
  initialCity,
  onSelectCategory: externalSelectCategory,
  activeCategory: externalCategory,
}: PoolCatalogProps) {
  const [overrideBuyerCounts, setOverrideBuyerCounts] = useState<Record<string, number>>({});

  // Authoritative location state (null = No City Selected on first visit)
  const [storeCity, setStoreCity] = useSelectedCity();
  const selectedCity = initialCity || storeCity;

  const [internalCategory, setInternalCategory] = useState<string>('all');
  const selectedCategory = externalCategory !== undefined ? externalCategory : internalCategory;

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [citySearchQuery, setCitySearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  // Operational cities for quick-switch pills
  const availableCities = useMemo(() => {
    if (initialCities && initialCities.length > 0) {
      return initialCities.filter((c) => c.isActive);
    }
    return LAUNCH_CITIES.map((c) => ({
      id: `city-${c.slug}`,
      name: c.name,
      slug: c.slug,
      state: c.state,
      isActive: true,
      createdAt: '',
      updatedAt: '',
    }));
  }, [initialCities]);

  // Priority category source of truth
  const displayCategories = useMemo(() => {
    if (initialCategories && initialCategories.length > 0) {
      return initialCategories
        .filter((c) => c.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return STATIC_CATEGORIES.map((c, idx) => ({
      id: `cat-${c.slug}`,
      slug: c.slug,
      label: c.label,
      description: c.description,
      isActive: true,
      sortOrder: idx + 1,
      createdAt: '',
      updatedAt: '',
    }));
  }, [initialCategories]);

  const handleCitySelect = (newCitySlug: string | null) => {
    if (newCitySlug === selectedCity) return;
    setIsLoading(true);
    setStoreCity(newCitySlug);

    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
    }
    // Smooth transition
    transitionTimerRef.current = setTimeout(() => {
      setIsLoading(false);
    }, 250);
  };

  const handleCategorySelect = (newCategorySlug: string) => {
    if (externalSelectCategory) {
      externalSelectCategory(newCategorySlug);
    } else {
      if (newCategorySlug === selectedCategory) return;
      setIsLoading(true);
      setInternalCategory(newCategorySlug);

      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
      transitionTimerRef.current = setTimeout(() => {
        setIsLoading(false);
      }, 200);
    }
  };

  // Modal coordination
  const [activeJoinPool, setActiveJoinPool] = useState<PublicPool | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const pools = useMemo(() => {
    return initialPools.map((p) =>
      overrideBuyerCounts[p.id] !== undefined
        ? { ...p, currentBuyers: overrideBuyerCounts[p.id] }
        : p
    );
  }, [initialPools, overrideBuyerCounts]);

  // Current selected city metadata
  const currentCityMeta = useMemo(() => {
    if (!selectedCity) return null;
    return (
      availableCities.find((c) => c.slug === selectedCity) || {
        name: selectedCity.charAt(0).toUpperCase() + selectedCity.slice(1),
        slug: selectedCity,
        state: 'India',
      }
    );
  }, [availableCities, selectedCity]);

  // Filtered pool computation:
  // When selectedCity is null, returns empty list because default homepage does NOT render nationwide pool cards.
  // When selectedCity is chosen, filters strictly to that city only.
  const filteredPools = useMemo(() => {
    if (!selectedCity) {
      return [];
    }

    return pools.filter((pool) => {
      // 1. Authoritative status exclusion: CLOSED, DRAFT, and past-deadline pools never appear in active listings
      if (pool.status === 'CLOSED' || pool.status === 'DRAFT') return false;
      const { isExpired } = getCountdownParts(pool.deadline);
      if (isExpired) return false;

      // 2. City isolation: pool must belong to the selected city strictly
      if (pool.citySlug !== selectedCity) {
        return false;
      }

      // 3. Category filter
      if (selectedCategory !== 'all') {
        const poolCatSlug = (pool.categorySlug || '').toLowerCase();
        const poolCat = String(pool.category || '').toLowerCase();
        const selCat = selectedCategory.toLowerCase();

        if (poolCatSlug === selCat || poolCat === selCat) {
          // Direct match
        } else if (selCat === 'home-power-backup') {
          const isBackup =
            poolCatSlug === 'home-power-backup' ||
            pool.slug.includes('power-backup') ||
            pool.slug.includes('inverter') ||
            pool.name.toLowerCase().includes('inverter') ||
            pool.name.toLowerCase().includes('power-backup');
          if (!isBackup) return false;
        } else if (
          selCat === 'water-softeners' ||
          selCat === 'water-softener'
        ) {
          const isSoftener =
            poolCatSlug === 'water-softeners' ||
            pool.slug.includes('water-softener') ||
            pool.slug.includes('softener') ||
            pool.name.toLowerCase().includes('softener');
          if (!isSoftener) return false;
        } else if (selCat === 'rooftop-solar') {
          const isSolar =
            (pool.category === 'ROOFTOP_SOLAR' || poolCatSlug === 'rooftop-solar') &&
            !pool.slug.includes('power-backup') &&
            !pool.slug.includes('inverter') &&
            !pool.slug.includes('water-softener') &&
            !pool.slug.includes('softener');
          if (!isSolar) return false;
        } else {
          const mapped = CATEGORY_SLUG_MAP[selectedCategory];
          if (Array.isArray(mapped)) {
            if (!mapped.includes(pool.category)) return false;
          } else if (mapped && pool.category !== mapped) {
            return false;
          } else if (!mapped && poolCatSlug !== selCat && poolCat !== selCat) {
            return false;
          }
        }
      }

      // 4. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (pool.name || '').toLowerCase().includes(q);
        const matchesTitle = (pool.productTitle || '').toLowerCase().includes(q);
        const matchesVariant = (pool.variantName || '').toLowerCase().includes(q);
        const matchesBrand = (pool.productBrand || '').toLowerCase().includes(q);
        const matchesModel = (pool.productModel || '').toLowerCase().includes(q);
        const matchesCity = (pool.city || '').toLowerCase().includes(q);
        const matchesCategory = (pool.categorySlug || '').toLowerCase().includes(q);
        if (
          !matchesName &&
          !matchesTitle &&
          !matchesVariant &&
          !matchesBrand &&
          !matchesModel &&
          !matchesCity &&
          !matchesCategory
        ) {
          return false;
        }
      }

      return true;
    });
  }, [pools, selectedCity, selectedCategory, searchQuery]);

  const handleOpenJoin = (pool: PublicPool) => {
    setActiveJoinPool(pool);
    setIsModalOpen(true);
  };

  const handleJoinSuccess = (result: JoinPoolResult) => {
    if (!activeJoinPool) return;

    setOverrideBuyerCounts((prev) => ({
      ...prev,
      [activeJoinPool.id]: result.currentBuyers,
    }));

    setToastMessage(DEFAULT_JOIN_SUCCESS_MESSAGE);
  };

  // Filter launch cities for city picker in default state
  const filteredLaunchCities = useMemo(() => {
    if (!citySearchQuery.trim()) return availableCities;
    const q = citySearchQuery.toLowerCase().trim();
    return availableCities.filter(
      (c) => c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q)
    );
  }, [availableCities, citySearchQuery]);

  return (
    <div className="space-y-8">
      {/* CASE 1: NO CITY SELECTED (Default Homepage State) */}
      {!selectedCity ? (
        <div className="bg-gradient-to-b from-white via-slate-50/50 to-white rounded-3xl border border-gray-200/90 p-6 sm:p-10 shadow-xs text-center space-y-6">
          <div className="max-w-2xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/70">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              <span>City-First Group Buying</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-950 tracking-tight">
              Choose Your City to Explore Local Buying Groups
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              Buying cohorts, supplier negotiations, and deliveries are organized city-by-city. Select your city to see active pools, or propose a new group for your community.
            </p>
          </div>

          {/* Search launch cities */}
          <div className="max-w-md mx-auto relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search your city (e.g. Pune, Bhopal, Bengaluru)..."
              value={citySearchQuery}
              onChange={(e) => setCitySearchQuery(e.target.value)}
              className="w-full text-xs sm:text-sm pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden"
            />
          </div>

          {/* Quick City Chips Grid */}
          <div className="max-w-4xl mx-auto">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">
              Configured Launch Markets ({filteredLaunchCities.length})
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {filteredLaunchCities.map((city) => (
                <button
                  key={city.slug}
                  type="button"
                  onClick={() => handleCitySelect(city.slug)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-emerald-50 hover:text-emerald-900 border border-gray-200 hover:border-emerald-300 text-gray-800 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <MapPin className="w-3 h-3 text-emerald-600" />
                  <span>{city.name}</span>
                </button>
              ))}
            </div>

            {filteredLaunchCities.length === 0 && (
              <div className="p-4 text-xs text-gray-500">
                No configured launch market matches your search.
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-200/60 max-w-xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-gray-500">
            <span>Can&apos;t find your city or prefer a custom group?</span>
            <a
              href="#request-pool"
              className="font-bold text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1"
            >
              <span>Propose a Pool</span>
              <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      ) : (
        /* CASE 2: CITY SELECTED STATE */
        <>
          {/* City Cohort Header */}
          <div className="bg-gradient-to-r from-emerald-50 via-slate-50 to-teal-50 rounded-3xl border border-emerald-200/70 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                <MapPin className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                <span>City Cohort: {currentCityMeta?.name}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight">
                Buying groups in <span className="text-emerald-700">{currentCityMeta?.name}</span>
              </h2>
              <p className="text-xs text-gray-600 max-w-2xl">
                Explore products and services with collective local demand. Supplier coordination and delivery are strictly local to {currentCityMeta?.name}.
              </p>
            </div>

            {/* Change City Action */}
            <div className="flex items-center gap-2 self-stretch md:self-auto shrink-0">
              <button
                type="button"
                onClick={() => handleCitySelect(null)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold border border-slate-200 shadow-2xs transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-slate-500" />
                <span>Change City</span>
              </button>
            </div>
          </div>

          {/* Search and Category Filters Shell */}
          <div className="bg-white rounded-3xl border border-gray-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            {/* Search bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search products in ${currentCityMeta?.name}...`}
                className="w-full text-sm pl-11 pr-4 py-2.5 rounded-2xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium transition-all"
              />
            </div>

            {/* Category Filter Pills */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <Filter className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                  <span>Category Filter</span>
                </div>
                <span className="text-[11px] text-gray-400">
                  {displayCategories.length} Categories Available
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleCategorySelect('all')}
                  className={`text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200/80'
                  }`}
                >
                  All Categories
                </button>
                {displayCategories.map((cat) => (
                  <button
                    key={cat.slug}
                    type="button"
                    onClick={() => handleCategorySelect(cat.slug)}
                    className={`text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                      selectedCategory === cat.slug
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200/80'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Pools Count Indicator */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              <h3 className="text-lg sm:text-xl font-extrabold text-gray-950 tracking-tight">
                Active Group Pools in {currentCityMeta?.name}
              </h3>
            </div>
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full">
              Showing {filteredPools.length} pool{filteredPools.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Pools Grid or Loading Skeleton or Approved Empty State */}
          {isLoading ? (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
              aria-busy="true"
              aria-label="Loading active pools"
            >
              <PoolCardSkeleton />
              <PoolCardSkeleton />
            </div>
          ) : filteredPools.length === 0 ? (
            /* Approved Empty State */
            <div className="text-center py-16 px-6 rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50/50 max-w-2xl mx-auto shadow-xs">
              <div className="relative w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-emerald-100/80 text-emerald-600 shadow-xs">
                <Rocket className="w-8 h-8" aria-hidden="true" />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60 mb-3 shadow-2xs">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                <span>{currentCityMeta?.name} • Demand Proposal Stage</span>
              </div>

              <h3 className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight mb-2">
                No active buying group yet
              </h3>

              <p className="text-xs sm:text-sm text-gray-600 max-w-lg mx-auto mb-6 leading-relaxed">
                There isn&apos;t an active group for this category in your city right now. You can submit a demand proposal for our team to review.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href="#request-pool"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Start a Pool for {currentCityMeta?.name}</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleCategorySelect('all')}
                  className="w-full sm:w-auto px-4 py-3 rounded-xl bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs sm:text-sm font-semibold transition-all cursor-pointer"
                >
                  Clear Category Filter
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPools.map((pool) => (
                <PoolCard key={pool.id} pool={pool} onJoinClick={handleOpenJoin} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Join Pool Modal */}
      {activeJoinPool && (
        <JoinPoolModal
          pool={activeJoinPool}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleJoinSuccess}
        />
      )}

      {/* Global Toast Notification */}
      {toastMessage && (
        <Toast
          isOpen={Boolean(toastMessage)}
          message={toastMessage || ''}
          onClose={() => setToastMessage(null)}
          duration={5000}
        />
      )}
    </div>
  );
}
