'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  MapPin,
  Search,
  Check,
  ChevronDown,
  Navigation,
  Loader2,
  AlertCircle,
  X,
  Sparkles,
} from 'lucide-react';
import { LAUNCH_CITIES } from '@/lib/constants';
import { INDIA_LOCATION_DIRECTORY } from '@/lib/location-directory';
import { useSelectedCity } from '@/lib/location-store';

interface LocationSelectorProps {
  currentCitySlug?: string | null;
  onSelectCity?: (citySlug: string | null) => void;
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

// Flat list of directory locations for search
interface DirectoryLocation {
  name: string;
  slug: string;
  state: string;
  isLaunchMarket: boolean;
}

const ALL_DIRECTORY_LOCATIONS: DirectoryLocation[] = (() => {
  const launchSlugs = new Set(LAUNCH_CITIES.map((c) => c.slug));
  const list: DirectoryLocation[] = LAUNCH_CITIES.map((c) => ({
    name: c.name,
    slug: c.slug,
    state: c.state,
    isLaunchMarket: true,
  }));

  for (const st of INDIA_LOCATION_DIRECTORY) {
    for (const city of st.cities) {
      if (!launchSlugs.has(city.slug)) {
        list.push({
          name: city.name,
          slug: city.slug,
          state: st.name,
          isLaunchMarket: false,
        });
      }
    }
  }

  return list;
})();

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
    return (
      ALL_DIRECTORY_LOCATIONS.find((c) => c.slug === effectiveCitySlug) || {
        name: effectiveCitySlug.charAt(0).toUpperCase() + effectiveCitySlug.slice(1),
        slug: effectiveCitySlug,
        state: 'India',
        isLaunchMarket: false,
      }
    );
  }, [effectiveCitySlug]);

  const hasSelectedCity = Boolean(currentCity);

  const handleCitySelect = (slug: string | null) => {
    const nextSlug = slug === 'all' || !slug ? null : slug;
    setStoreCity(nextSlug);

    if (onSelectCity) {
      onSelectCity(nextSlug);
    } else {
      if (pathname.startsWith('/city/')) {
        if (nextSlug) {
          router.push(`/city/${nextSlug}`);
        } else {
          router.push('/');
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

  const { launchMatches, otherMatches } = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      return {
        launchMatches: LAUNCH_CITIES,
        otherMatches: [],
      };
    }
    const matchingLaunch = LAUNCH_CITIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q) || c.slug.includes(q)
    );
    const launchSlugs = new Set(matchingLaunch.map((c) => c.slug));
    const matchingOther = ALL_DIRECTORY_LOCATIONS.filter(
      (c) =>
        !c.isLaunchMarket &&
        !launchSlugs.has(c.slug) &&
        (c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q) || c.slug.includes(q))
    );
    return {
      launchMatches: matchingLaunch,
      otherMatches: matchingOther,
    };
  }, [searchQuery]);

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button: Displays "Choose City" when no city is selected */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer ${
          hasSelectedCity
            ? 'bg-emerald-50/90 text-emerald-950 border border-emerald-300/80 hover:bg-emerald-100/80'
            : 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-800'
        }`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
        <span className="truncate max-w-[130px] sm:max-w-[180px]">
          {hasSelectedCity ? `${currentCity!.name}, ${currentCity!.state}` : 'Choose City'}
        </span>
        {hasSelectedCity ? (
          <span className="text-[10px] font-bold text-emerald-700 underline decoration-emerald-400">
            Change
          </span>
        ) : (
          <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {/* Popover / Dialog */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute right-0 mt-2 w-[calc(100vw-32px)] sm:w-[420px] max-w-[420px] bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-scale-in"
          role="dialog"
          aria-label="City Selection"
        >
          {/* Header & Controls */}
          <div className="p-3.5 border-b border-slate-100 bg-slate-50/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                Select Your City
              </span>
              <span className="text-[10px] text-gray-500 font-medium">
                25 Launch Markets • All India Directory
              </span>
            </div>

            {/* If a city is currently active, show clear affordance */}
            {hasSelectedCity && (
              <div className="mb-2.5 p-2 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-950">
                <div className="flex items-center gap-1.5 truncate">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="font-semibold truncate">
                    Current: {currentCity!.name}, {currentCity!.state}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCitySelect(null)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-white px-2 py-0.5 rounded-lg border border-emerald-300 shrink-0 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </div>
            )}

            {/* Optional Geolocation Action (permission requested ONLY on explicit click) */}
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
                      ~{suggestedCity.distanceKm} km away. Click to select.
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
                placeholder="Search city or state..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium"
              />
            </div>
          </div>

          {/* Cities List / Grid */}
          <div className="max-h-[280px] overflow-y-auto p-2.5 space-y-3">
            {/* Launch Markets Section */}
            {launchMatches.length > 0 && (
              <div>
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1 mb-1.5">
                  <span>Configured Launch Markets ({launchMatches.length})</span>
                  <span className="text-[10px] text-emerald-700 font-semibold">Active Aggregation</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {launchMatches.map((city) => {
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
              </div>
            )}

            {/* Other Directory Locations */}
            {otherMatches.length > 0 && (
              <div>
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1 mb-1.5 pt-2 border-t border-slate-100">
                  <span>All India Directory ({otherMatches.length})</span>
                  <span className="text-[10px] text-slate-400 font-normal">Demand Proposals</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {otherMatches.map((city) => {
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
              </div>
            )}

            {launchMatches.length === 0 && otherMatches.length === 0 && (
              <div className="p-4 text-center text-xs text-gray-500 space-y-2">
                <p>No matching city found in directory.</p>
                <p className="text-[11px] text-gray-400">
                  You can propose a buying pool for any town or city in India via the Request a Pool form.
                </p>
                <a
                  href="#request-pool"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex items-center gap-1 text-emerald-700 font-bold hover:underline"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Propose Your City</span>
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
