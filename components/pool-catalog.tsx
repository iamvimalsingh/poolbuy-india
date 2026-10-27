'use client';

import React, { useState, useMemo, useSyncExternalStore } from 'react';
import { Search, Filter, Layers, MapPin, Sparkles, ArrowRight } from 'lucide-react';
import { PublicPool, JoinPoolResult, City, Category } from '@/types';
import { CITIES as FALLBACK_CITIES, CATEGORIES as STATIC_CATEGORIES, CATEGORY_SLUG_MAP } from '@/lib/constants';
import { getCountdownParts } from '@/lib/format';
import { PoolCard } from './pool-card';
import { JoinPoolModal } from './join-pool-modal';
import { LocationSelector } from './location-selector';

function subscribeCity(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener('poolbuy:city-change', onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener('poolbuy:city-change', onStoreChange);
  };
}

function getCitySnapshot(): string | null {
  try {
    const val = localStorage.getItem('poolbuy_preferred_city');
    return val && val.trim() !== '' ? val.trim() : null;
  } catch {
    return null;
  }
}

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
  initialCity = 'bhopal',
}: PoolCatalogProps) {
  const [overrideBuyerCounts, setOverrideBuyerCounts] = useState<Record<string, number>>({});
  // V3 Section 18.4: City-first isolation via useSyncExternalStore. Avoids cascading renders or impurity.
  const storedCity = useSyncExternalStore(subscribeCity, getCitySnapshot, () => null);
  const [explicitCity, setExplicitCity] = useState<string | null>(null);
  const selectedCity = explicitCity || storedCity || initialCity;

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

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

  const handleCitySelect = (newCitySlug: string) => {
    setExplicitCity(newCitySlug);
    try {
      localStorage.setItem('poolbuy_preferred_city', newCitySlug);
      window.dispatchEvent(new CustomEvent('poolbuy:city-change', { detail: newCitySlug }));
    } catch {
      // Ignore localStorage restrictions
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
    return (
      availableCities.find((c) => c.slug === selectedCity) || {
        name: selectedCity.charAt(0).toUpperCase() + selectedCity.slice(1),
        slug: selectedCity,
        state: 'India',
      }
    );
  }, [availableCities, selectedCity]);

  // Filtered pool computation with strict city-isolation and closed/expired exclusion
  const filteredPools = useMemo(() => {
    return pools.filter((pool) => {
      // 1. Authoritative status exclusion: CLOSED and past-deadline pools never appear in active listings
      if (pool.status === 'CLOSED') return false;
      const { isExpired } = getCountdownParts(pool.deadline);
      if (isExpired) return false;

      // 2. Strict city isolation: pools must belong to the confirmed selected city
      if (pool.citySlug !== selectedCity) {
        return false;
      }

      // 3. Category filter
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'home-power-backup') {
          const isBackup =
            pool.categorySlug === 'home-power-backup' ||
            pool.slug.includes('power-backup') ||
            pool.slug.includes('inverter') ||
            pool.name.toLowerCase().includes('inverter') ||
            pool.name.toLowerCase().includes('power-backup');
          if (!isBackup) return false;
        } else if (
          selectedCategory === 'water-softeners' ||
          selectedCategory === 'water-softener'
        ) {
          const isSoftener =
            pool.categorySlug === 'water-softeners' ||
            pool.slug.includes('water-softener') ||
            pool.slug.includes('softener') ||
            pool.name.toLowerCase().includes('softener');
          if (!isSoftener) return false;
        } else if (selectedCategory === 'rooftop-solar') {
          const isSolar =
            (pool.category === 'ROOFTOP_SOLAR' || pool.categorySlug === 'rooftop-solar') &&
            !pool.slug.includes('power-backup') &&
            !pool.slug.includes('inverter') &&
            !pool.slug.includes('water-softener') &&
            !pool.slug.includes('softener');
          if (!isSolar) return false;
        } else {
          const mapped = CATEGORY_SLUG_MAP[selectedCategory];
          if (Array.isArray(mapped)) {
            if (!mapped.includes(pool.category)) return false;
          } else if (mapped && pool.category !== mapped && pool.categorySlug !== selectedCategory) {
            return false;
          }
        }
      }

      // 4. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = pool.name.toLowerCase().includes(q);
        const matchesBrand = pool.productBrand.toLowerCase().includes(q);
        const matchesModel = pool.productModel.toLowerCase().includes(q);
        if (!matchesName && !matchesBrand && !matchesModel) {
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
  };

  return (
    <div className="space-y-8">
      {/* City-First Discovery Header & Location Selector */}
      <div className="bg-gradient-to-r from-emerald-50 via-slate-50 to-teal-50 rounded-3xl border border-emerald-200/70 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
            <MapPin className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            <span>Active City Discovery</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight">
            Group Buying Deals in <span className="text-emerald-700">{currentCityMeta.name}</span>
          </h2>
          <p className="text-xs text-gray-600">
            Installation, showroom invoicing, and logistics are strictly local to {currentCityMeta.name}.
          </p>
        </div>

        {/* Change Location Action */}
        <div className="flex items-center gap-2 self-stretch md:self-auto shrink-0">
          <LocationSelector
            currentCitySlug={selectedCity}
            onSelectCity={handleCitySelect}
          />
        </div>
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
            placeholder="Search solar systems, inverters, softeners, vehicles, or laptops..."
            className="w-full text-sm pl-11 pr-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600 outline-hidden transition-all"
          />
        </div>

        {/* Operational Cities Quick-Select Bar */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              <span>Operational Launch Cities</span>
            </div>
            <span className="text-[11px] text-gray-400">Strict local isolation</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableCities.map((city) => (
              <button
                key={city.slug}
                type="button"
                onClick={() => handleCitySelect(city.slug)}
                className={`text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-all ${
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

        {/* Prioritized V3 Category Filter Buttons */}
        <div className="pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
              <Filter className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              <span>Priority Product Families</span>
            </div>
            <span className="text-[11px] text-emerald-700 font-medium">Solar • Backup • Water Softener</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-all ${
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
                onClick={() => setSelectedCategory(cat.slug)}
                className={`text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-all ${
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
            Active Group Pools in {currentCityMeta.name}
          </h2>
        </div>
        <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full">
          Showing {filteredPools.length} pool{filteredPools.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Pools Grid or Honest Empty State */}
      {filteredPools.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50/50 max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-white shadow-xs border border-gray-100 flex items-center justify-center text-gray-400 mx-auto mb-4">
            <Layers className="w-6 h-6 text-gray-400" aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            No active group pools in {currentCityMeta.name} right now
          </h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6 leading-relaxed">
            We aggregate local demand before onboarding authorized dealerships. Start a group buy for Rooftop Solar, Power Backup, or Water Softeners in {currentCityMeta.name} below!
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="#request-pool"
              className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Request a New Pool in {currentCityMeta.name}</span>
            </a>
            {selectedCity !== 'bhopal' && (
              <button
                type="button"
                onClick={() => handleCitySelect('bhopal')}
                className="inline-flex items-center justify-center gap-1 text-xs font-semibold px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors shadow-xs"
              >
                <span>Switch to Bhopal (Active Hub)</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
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
    </div>
  );
}
