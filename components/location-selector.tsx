'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { MapPin, Search, Check, ChevronDown, Globe, Navigation, Loader2, AlertCircle } from 'lucide-react';
import { LAUNCH_CITIES } from '@/lib/constants';
import { useSelectedCity } from '@/lib/location-store';

interface LocationSelectorProps {
  currentCitySlug?: string | null;
  onSelectCity?: (citySlug: string) => void;
  className?: string;
}

// Approximate coordinates for nearest launch market detection
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  delhi: { lat: 28.6139, lng: 77.209 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  pune: { lat: 18.5204, lng: 73.8567 },
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  surat: { lat: 21.1702, lng: 72.8311 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  lucknow: { lat: 26.8467, lng: 80.9462 },
  kanpur: { lat: 26.4499, lng: 80.3319 },
  nagpur: { lat: 21.1458, lng: 79.0882 },
  indore: { lat: 22.7196, lng: 75.8577 },
  bhopal: { lat: 23.2599, lng: 77.4126 },
  patna: { lat: 25.5941, lng: 85.1376 },
  vadodara: { lat: 22.3072, lng: 73.1812 },
  coimbatore: { lat: 11.0168, lng: 76.9558 },
  kochi: { lat: 9.9312, lng: 76.2673 },
  ludhiana: { lat: 30.901, lng: 75.8573 },
  chandigarh: { lat: 30.7333, lng: 76.7794 },
  gurugram: { lat: 28.4595, lng: 77.0266 },
  noida: { lat: 28.5355, lng: 77.391 },
  visakhapatnam: { lat: 17.6868, lng: 83.2185 },
  bhubaneswar: { lat: 20.2961, lng: 85.8245 },
};

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [suggestedCity, setSuggestedCity] = useState<{ name: string; slug: string; distanceKm: number } | null>(null);

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
    setSuggestedCity(null);
    setGeoMessage(null);
  };

  const handleDetectLocation = () => {
    setGeoMessage(null);
    setSuggestedCity(null);

    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGeoMessage('Device geolocation is not supported in this browser.');
      return;
    }

    setGeoLoading(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        const { latitude, longitude } = pos.coords;

        let closest: { name: string; slug: string; distanceKm: number } | null = null;

        for (const city of LAUNCH_CITIES) {
          const coords = CITY_COORDINATES[city.slug];
          if (!coords) continue;
          const dist = calculateDistanceKm(latitude, longitude, coords.lat, coords.lng);
          if (!closest || dist < closest.distanceKm) {
            closest = { name: city.name, slug: city.slug, distanceKm: Math.round(dist) };
          }
        }

        if (closest) {
          setSuggestedCity(closest);
        } else {
          setGeoMessage('Could not match device coordinates with a launch city.');
        }
      },
      (err) => {
        setGeoLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoMessage('Location permission denied. You can select your city manually below.');
        } else {
          setGeoMessage('Unable to detect location. Please select your city manually below.');
        }
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
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
              className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all mb-2 cursor-pointer ${
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

            {/* Optional Geolocation Action */}
            <div className="mb-2.5">
              <button
                type="button"
                disabled={geoLoading}
                onClick={handleDetectLocation}
                className="w-full text-left p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  {geoLoading ? (
                    <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                  ) : (
                    <Navigation className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span>{geoLoading ? 'Detecting nearest city...' : 'Use device location (optional)'}</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Permission-based</span>
              </button>

              {geoMessage && (
                <div className="mt-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>{geoMessage}</span>
                </div>
              )}

              {suggestedCity && (
                <div className="mt-1.5 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-semibold">Nearest launch city: {suggestedCity.name}</span>
                    <span className="text-[10px] text-emerald-700 block">
                      ~{suggestedCity.distanceKm} km away. Click to confirm.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCitySelect(suggestedCity.slug)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Select
                  </button>
                </div>
              )}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search launch cities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium"
              />
            </div>
          </div>

          {/* Cities Grid */}
          <div className="max-h-[260px] overflow-y-auto p-2">
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
