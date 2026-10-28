'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { MapPin, Search, Check, ChevronDown, Globe } from 'lucide-react';
import { LAUNCH_CITIES } from '@/lib/constants';
import { useSelectedCity } from '@/lib/location-store';

interface LocationSelectorProps {
  currentCitySlug?: string | null;
  onSelectCity?: (citySlug: string) => void;
  className?: string;
}

export function LocationSelector({
  currentCitySlug: propCitySlug,
  onSelectCity,
  className = '',
}: LocationSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [storeCity, setStoreCity] = useSelectedCity();
  const effectiveCitySlug = propCitySlug !== undefined ? propCitySlug : storeCity;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Current active city meta
  const currentCity = useMemo(() => {
    if (!effectiveCitySlug || effectiveCitySlug === 'all') return null;
    return LAUNCH_CITIES.find((c) => c.slug === effectiveCitySlug) || {
      name: effectiveCitySlug.charAt(0).toUpperCase() + effectiveCitySlug.slice(1),
      slug: effectiveCitySlug,
      state: 'India',
    };
  }, [effectiveCitySlug]);

  const isAllIndiaActive = !effectiveCitySlug || effectiveCitySlug === 'all';

  const handleCitySelect = (slug: string) => {
    const nextSlug = slug === 'all' ? null : slug;
    setStoreCity(nextSlug);

    if (onSelectCity) {
      onSelectCity(slug);
    } else {
      if (pathname.startsWith('/city/')) {
        if (nextSlug) {
          router.push(`/city/${nextSlug}`);
        } else {
          router.push('/#pools');
        }
      }
    }

    setIsOpen(false);
    setSearchQuery('');
  };

  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) return LAUNCH_CITIES;
    const q = searchQuery.toLowerCase().trim();
    return LAUNCH_CITIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q) || c.slug.includes(q)
    );
  }, [searchQuery]);

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
        <span className="truncate max-w-[130px] sm:max-w-[180px]">
          {currentCity ? `${currentCity.name}, ${currentCity.state}` : 'All India (National)'}
        </span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover / Dialog */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute right-0 mt-2 w-[calc(100vw-32px)] sm:w-[420px] max-w-[420px] bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-scale-in"
        >
          {/* Header & Search */}
          <div className="p-3.5 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                Select Discovery Location
              </span>
              <span className="text-[10px] text-gray-500 font-medium">
                25 Launch Markets
              </span>
            </div>

            {/* All India Button */}
            <button
              type="button"
              onClick={() => handleCitySelect('all')}
              className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all mb-2.5 cursor-pointer ${
                isAllIndiaActive
                  ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 font-bold ring-1 ring-emerald-600 shadow-2xs'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <div className="font-bold flex items-center gap-1.5">
                    <span>All India (Default)</span>
                    {isAllIndiaActive && (
                      <span className="text-[10px] font-semibold bg-emerald-600 text-white px-1.5 py-0.2 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    Show group deals from all Indian launch cities
                  </div>
                </div>
              </div>
              {isAllIndiaActive && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
            </button>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search launch cities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden"
              />
            </div>
          </div>

          {/* Cities Grid */}
          <div className="max-h-[280px] overflow-y-auto p-2">
            <div className="grid grid-cols-2 gap-1.5">
              {filteredCities.map((city) => {
                const isSelected = effectiveCitySlug === city.slug;
                return (
                  <button
                    key={city.slug}
                    type="button"
                    onClick={() => handleCitySelect(city.slug)}
                    className={`text-left p-2 rounded-xl text-xs flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-300'
                        : 'hover:bg-slate-50 text-slate-700 border border-slate-100'
                    }`}
                  >
                    <div className="truncate">
                      <div className="font-semibold text-gray-900 truncate">{city.name}</div>
                      <div className="text-[10px] text-gray-400 truncate">{city.state}</div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>

            {filteredCities.length === 0 && (
              <div className="p-4 text-center text-xs text-gray-400">
                No matching launch city. Requests are accepted from anywhere in India via the Request a Pool form.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
