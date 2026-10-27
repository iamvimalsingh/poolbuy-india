'use client';

import React, { useState, useMemo } from 'react';
import { Search, Filter, Layers, MapPin } from 'lucide-react';
import { PublicPool, JoinPoolResult, City } from '@/types';
import { CITIES as FALLBACK_CITIES, CATEGORIES, CATEGORY_SLUG_MAP } from '@/lib/constants';
import { PoolCard } from './pool-card';
import { JoinPoolModal } from './join-pool-modal';

interface PoolCatalogProps {
  initialPools: PublicPool[];
  initialCities?: City[];
  initialCity?: string;
}

export function PoolCatalog({ initialPools, initialCities, initialCity }: PoolCatalogProps) {
  const [overrideBuyerCounts, setOverrideBuyerCounts] = useState<Record<string, number>>({});
  const [selectedCity, setSelectedCity] = useState<string>(initialCity || 'all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

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

  // Filtered pool computation
  const filteredPools = useMemo(() => {
    return pools.filter((pool) => {
      // City filter
      if (selectedCity !== 'all' && pool.citySlug !== selectedCity) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'all') {
        const mapped = CATEGORY_SLUG_MAP[selectedCategory];
        if (Array.isArray(mapped)) {
          if (!mapped.includes(pool.category)) return false;
        } else if (mapped && pool.category !== mapped) {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = pool.name.toLowerCase().includes(q);
        const matchesBrand = pool.productBrand.toLowerCase().includes(q);
        const matchesModel = pool.productModel.toLowerCase().includes(q);
        const matchesCity = pool.city.toLowerCase().includes(q);
        if (!matchesName && !matchesBrand && !matchesModel && !matchesCity) {
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
      {/* Search and Filters Shell */}
      <div className="bg-white rounded-3xl border border-gray-200/80 p-5 sm:p-6 shadow-xs space-y-5">
        {/* Search bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by vehicle, model, laptop, brand, or city..."
            className="w-full text-sm pl-11 pr-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600 outline-hidden transition-all"
          />
        </div>

        {/* City Filter Buttons */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            <span>Select City</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCity('all')}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-all ${
                selectedCity === 'all'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200/80'
              }`}
            >
              All Cities
            </button>
            {availableCities.map((city) => (
              <button
                key={city.slug}
                type="button"
                onClick={() => setSelectedCity(city.slug)}
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

        {/* Category Filter Buttons */}
        <div className="pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">
            <Filter className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            <span>Select Category</span>
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
            {CATEGORIES.map((cat) => (
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
            Active Group Pools
          </h2>
        </div>
        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          Showing {filteredPools.length} pool{filteredPools.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Pools Grid or Empty State */}
      {filteredPools.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50/50 max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-white shadow-xs border border-gray-100 flex items-center justify-center text-gray-400 mx-auto mb-4">
            <Layers className="w-6 h-6 text-gray-400" aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            {selectedCity !== 'all'
              ? `No active pools in ${availableCities.find((c) => c.slug === selectedCity)?.name || selectedCity} right now`
              : 'No group pools found'}
          </h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6 leading-relaxed">
            {selectedCity !== 'all'
              ? `We do not have an active buying campaign in this city yet. Start one by requesting a group pool below!`
              : "We couldn't find any active pools matching your selected filters. Adjust your search or request a new pool."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="#request-pool"
              className="inline-flex items-center justify-center text-xs font-semibold px-4 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
            >
              Request a New Pool
            </a>
            <button
              type="button"
              onClick={() => {
                setSelectedCity('all');
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="inline-flex items-center justify-center text-xs font-semibold px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors shadow-xs"
            >
              Clear All Filters
            </button>
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
