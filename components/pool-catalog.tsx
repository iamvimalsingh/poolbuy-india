'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Filter, Layers, MapPin, Sparkles, ArrowRight, Globe, X, Rocket } from 'lucide-react';
import { PublicPool, JoinPoolResult, City, Category } from '@/types';
import { CITIES as FALLBACK_CITIES, CATEGORIES as STATIC_CATEGORIES, CATEGORY_SLUG_MAP } from '@/lib/constants';
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
}

export function PoolCatalog({
  initialPools,
  initialCities,
  initialCategories,
  initialCity,
}: PoolCatalogProps) {
  const [overrideBuyerCounts, setOverrideBuyerCounts] = useState<Record<string, number>>({});
  
  // Authoritative location state (defaults to null = All India on first visit)
  const [storeCity, setStoreCity] = useSelectedCity();
  const selectedCity = initialCity || storeCity;

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
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
    return FALLBACK_CITIES.map((c) => ({
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
    // Brief smooth skeleton display (280ms) to clearly communicate cohort switch without layout jump
    transitionTimerRef.current = setTimeout(() => {
      setIsLoading(false);
    }, 280);
  };

  const handleCategorySelect = (newCategorySlug: string) => {
    if (newCategorySlug === selectedCategory) return;
    setIsLoading(true);
    setSelectedCategory(newCategorySlug);

    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
    }
    // Brief smooth skeleton display (200ms) for category transition
    transitionTimerRef.current = setTimeout(() => {
      setIsLoading(false);
    }, 200);
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

  // Current selected city metadata (null = All India)
  const currentCityMeta = useMemo(() => {
    if (!selectedCity) {
      return {
        name: 'All India',
        slug: 'all',
        state: 'National Overview',
      };
    }
    return (
      availableCities.find((c) => c.slug === selectedCity) || {
        name: selectedCity.charAt(0).toUpperCase() + selectedCity.slice(1),
        slug: selectedCity,
        state: 'India',
      }
    );
  }, [availableCities, selectedCity]);

  // Filtered pool computation:
  // When selectedCity is null, shows pools across all cities!
  // When selectedCity is chosen, filters strictly to that city.
  const filteredPools = useMemo(() => {
    return pools.filter((pool) => {
      // 1. Authoritative status exclusion: CLOSED and past-deadline pools never appear in active listings
      if (pool.status === 'CLOSED') return false;
      const { isExpired } = getCountdownParts(pool.deadline);
      if (isExpired) return false;

      // 2. City isolation: if a specific city is selected, pool must belong to that city.
      // If selectedCity is null (All India), show all cities!
      if (selectedCity && pool.citySlug !== selectedCity) {
        return false;
      }

      // 3. Category filter (supports configured D1 categories and backward compatibility)
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

      // 4. Search query filter across all relevant fields
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

  const uniqueCitiesInFiltered = useMemo(() => {
    return new Set(filteredPools.map((p) => p.city)).size;
  }, [filteredPools]);

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

    // Trigger premium Toast notification
    setToastMessage(DEFAULT_JOIN_SUCCESS_MESSAGE);
  };

  return (
    <div className="space-y-8">
      {/* Authoritative Discovery Header */}
      <div className="bg-gradient-to-r from-emerald-50 via-slate-50 to-teal-50 rounded-3xl border border-emerald-200/70 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
            {selectedCity ? (
              <>
                <MapPin className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                <span>City-Specific Cohort</span>
              </>
            ) : (
              <>
                <Globe className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                <span>National Overview • All India</span>
              </>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight">
            {selectedCity ? (
              <>
                Group Buying Pools in <span className="text-emerald-700">{currentCityMeta.name}</span>
              </>
            ) : (
              <>
                Active Group Buying Pools Across <span className="text-emerald-700">India</span>
              </>
            )}
          </h2>
          <p className="text-xs text-gray-600 max-w-2xl">
            {selectedCity ? (
              `Installation, fulfillment, and local supplier coordination are strictly local to ${currentCityMeta.name}.`
            ) : (
              'Showing collective buying pools across all Indian cities. Each group has an independent local fulfillment cohort.'
            )}
          </p>
        </div>

        {/* Clear City Filter / Switch back to All India */}
        {selectedCity && (
          <div className="flex items-center gap-2 self-stretch md:self-auto shrink-0">
            <button
              type="button"
              onClick={() => handleCitySelect(null)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-all cursor-pointer"
            >
              <X className="w-3.5 h-3.5 text-slate-500" />
              <span>Show All India</span>
            </button>
          </div>
        )}
      </div>

      {/* Search and Filters Shell */}
      <div className="bg-white rounded-3xl border border-gray-200/80 p-5 sm:p-6 shadow-xs space-y-5">
        {/* Search bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products, brands, models, or city name..."
            className="w-full text-sm pl-11 pr-4 py-3 rounded-2xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium transition-all"
          />
        </div>

        {/* Operational Cities Quick-Select Bar */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              <span>Popular Launch Cities</span>
            </div>
            <span className="text-[11px] text-gray-400">Independent city cohorts</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* All India Chip */}
            <button
              type="button"
              onClick={() => handleCitySelect(null)}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                !selectedCity
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200/80'
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>All India</span>
            </button>

            {/* City Chips */}
            {availableCities.map((city) => (
              <button
                key={city.slug}
                type="button"
                onClick={() => handleCitySelect(city.slug)}
                className={`text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                  selectedCity === city.slug
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200/80'
                }`}
              >
                {city.name}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Category Filter Buttons */}
        <div className="pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
              <Filter className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              <span>Browse Categories</span>
            </div>
            <span className="text-[11px] text-gray-500 font-medium">
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

      {/* Pools Grid Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-600" aria-hidden="true" />
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight">
            {selectedCity ? `Active Group Pools in ${currentCityMeta.name}` : 'Active Pools Nationwide'}
          </h2>
        </div>
        <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full">
          Showing {filteredPools.length} pool{filteredPools.length === 1 ? '' : 's'}
          {!selectedCity && uniqueCitiesInFiltered > 0 ? ` across ${uniqueCitiesInFiltered} cities` : ''}
        </span>
      </div>

      {/* Pools Grid or Skeleton Loading State or Honest Empty State */}
      {isLoading ? (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          aria-busy="true"
          aria-label="Loading active pools"
        >
          <PoolCardSkeleton />
          <PoolCardSkeleton />
          <PoolCardSkeleton />
        </div>
      ) : filteredPools.length === 0 ? (
        <div className="text-center py-16 px-6 rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50/50 max-w-2xl mx-auto shadow-xs">
          {/* Animated Graphic Icon with subtle pulse */}
          <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-emerald-200/60 animate-ping opacity-25" />
            <div className="relative w-16 h-16 rounded-full bg-emerald-100/80 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-xs">
              <Rocket className="w-8 h-8" aria-hidden="true" />
            </div>
          </div>

          {/* Context Badge */}
          {selectedCity && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60 mb-3 shadow-2xs">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              <span>{currentCityMeta.name} • Demand Discovery Stage</span>
            </div>
          )}

          {/* Dynamic Headline */}
          <h3 className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight mb-2.5">
            {selectedCity
              ? `Be the first in ${currentCityMeta.name}! 🚀`
              : 'No active group pools match your criteria 🔍'}
          </h3>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-gray-600 max-w-lg mx-auto mb-8 leading-relaxed">
            {selectedCity
              ? 'There are no active group buys here yet, but you can change that. Start a pool, gather your neighbors, and unlock massive commercial discounts.'
              : 'Try clearing your filters or propose a new group buying pool for your city to aggregate local demand.'}
          </p>

          {/* Call to Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#request-pool"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm font-bold px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-98 transition-all duration-200"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <span>{selectedCity ? `Propose a Pool in ${currentCityMeta.name}` : 'Propose a New Pool'}</span>
            </a>

            {selectedCity && (
              <button
                type="button"
                onClick={() => handleCitySelect(null)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm font-semibold px-5 py-3.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-xs active:scale-98 transition-all duration-200 cursor-pointer"
              >
                <Globe className="w-4 h-4 text-gray-400" aria-hidden="true" />
                <span>Explore All India Pools</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-gray-400 mt-5">
            100% Free to propose • No purchase commitment or upfront deposit required
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPools.map((pool, idx) => (
            <PoolCard
              key={pool.id}
              pool={pool}
              onJoinClick={handleOpenJoin}
              priorityImage={idx === 0}
            />
          ))}
        </div>
      )}

      {/* Join Pool Modal */}
      <JoinPoolModal
        pool={activeJoinPool}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleJoinSuccess}
      />

      {/* Premium Success Notification Toast */}
      <Toast
        message={toastMessage || ''}
        isOpen={Boolean(toastMessage)}
        onClose={() => setToastMessage(null)}
      />
    </div>
  );
}
