'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Navigation, Search, Check, ChevronDown, AlertCircle } from 'lucide-react';
import { INDIA_LOCATION_DIRECTORY } from '@/lib/location-directory';

interface LocationSelectorProps {
  currentCitySlug?: string;
  onSelectCity?: (citySlug: string) => void;
  className?: string;
}

function findCityBySlug(slug?: string) {
  if (!slug) return null;
  for (const state of INDIA_LOCATION_DIRECTORY) {
    const match = state.cities.find((c) => c.slug === slug);
    if (match) return { ...match, stateName: state.name };
  }
  return null;
}

export function LocationSelector({
  currentCitySlug,
  onSelectCity,
  className = '',
}: LocationSelectorProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStateCode, setSelectedStateCode] = useState<string>('MP');
  const [searchQuery, setSearchQuery] = useState('');
  const [geoStatus, setGeoStatus] = useState<{
    isLoading: boolean;
    message: string | null;
    isError?: boolean;
  }>({ isLoading: false, message: null });

  // Currently selected state object
  const currentState = useMemo(() => {
    return (
      INDIA_LOCATION_DIRECTORY.find((s) => s.code === selectedStateCode) ||
      INDIA_LOCATION_DIRECTORY[0]
    );
  }, [selectedStateCode]);

  // Current city label
  const currentCity = findCityBySlug(currentCitySlug);

  // Search filtered results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase().trim();
    const results: {
      cityName: string;
      citySlug: string;
      stateName: string;
      placeType: string;
      availabilityState: string;
    }[] = [];

    for (const state of INDIA_LOCATION_DIRECTORY) {
      for (const city of state.cities) {
        if (
          city.name.toLowerCase().includes(q) ||
          state.name.toLowerCase().includes(q)
        ) {
          results.push({
            cityName: city.name,
            citySlug: city.slug,
            stateName: state.name,
            placeType: city.placeType,
            availabilityState: city.availabilityState,
          });
        }
      }
    }
    return results.slice(0, 15);
  }, [searchQuery]);

  const handleCitySelect = (citySlug: string) => {
    setIsOpen(false);
    setSearchQuery('');
    setGeoStatus({ isLoading: false, message: null });

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('poolbuy_preferred_city', citySlug);
      } catch {
        // Ignore localStorage restrictions
      }
    }

    if (onSelectCity) {
      onSelectCity(citySlug);
    } else {
      router.push(`/city/${citySlug}`);
    }
  };

  /**
   * Section 18.4: Explicit button-initiated geolocation with manual fallback
   */
  const handleUseMyLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGeoStatus({
        isLoading: false,
        message: 'Geolocation is not supported by your browser. Please choose your city manually below.',
        isError: true,
      });
      return;
    }

    setGeoStatus({ isLoading: true, message: 'Requesting device location...' });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(2);
        const lon = position.coords.longitude.toFixed(2);

        // Approximate heuristic for seeded launch regions without paid external geocoding keys
        // Bhopal approx (23.25, 77.41), Indore (22.71, 75.85), Pune (18.52, 73.85), Delhi (28.61, 77.20)
        let suggestedCitySlug: string | null = null;
        const latNum = position.coords.latitude;
        const lonNum = position.coords.longitude;

        if (Math.abs(latNum - 23.25) < 0.8 && Math.abs(lonNum - 77.41) < 0.8) {
          suggestedCitySlug = 'bhopal';
        } else if (Math.abs(latNum - 22.71) < 0.8 && Math.abs(lonNum - 75.85) < 0.8) {
          suggestedCitySlug = 'indore';
        } else if (Math.abs(latNum - 18.52) < 0.8 && Math.abs(lonNum - 73.85) < 0.8) {
          suggestedCitySlug = 'pune';
        } else if (Math.abs(latNum - 28.61) < 0.8 && Math.abs(lonNum - 77.20) < 0.8) {
          suggestedCitySlug = 'delhi';
        } else if (Math.abs(latNum - 19.07) < 0.8 && Math.abs(lonNum - 72.87) < 0.8) {
          suggestedCitySlug = 'mumbai';
        } else if (Math.abs(latNum - 26.91) < 0.8 && Math.abs(lonNum - 75.78) < 0.8) {
          suggestedCitySlug = 'jaipur';
        }

        if (suggestedCitySlug) {
          setGeoStatus({
            isLoading: false,
            message: `Detected location near ${suggestedCitySlug.toUpperCase()} (${lat}°, ${lon}°). Switching to your local pools.`,
            isError: false,
          });
          setTimeout(() => handleCitySelect(suggestedCitySlug!), 1000);
        } else {
          setGeoStatus({
            isLoading: false,
            message: `Coordinates detected (${lat}°, ${lon}°). Please confirm your State & City from the list below.`,
            isError: false,
          });
        }
      },
      (error) => {
        let msg = 'Unable to retrieve location.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location permission was denied. You can select your State and City manually below.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Location request timed out. Please choose your city manually.';
        }
        setGeoStatus({ isLoading: false, message: msg, isError: true });
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  };

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold shadow-2xs transition-all"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
        <span className="truncate max-w-[140px] sm:max-w-[200px]">
          {currentCity ? `${currentCity.name}, ${currentCity.stateName}` : 'Select City & State'}
        </span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover / Dialog */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[340px] sm:w-[480px] bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-scale-in">
          {/* Header & Search */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Select Your Location
              </span>
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={geoStatus.isLoading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-semibold border border-emerald-200 transition-colors disabled:opacity-50"
              >
                <Navigation className="w-3 h-3 shrink-0" />
                <span>{geoStatus.isLoading ? 'Locating...' : 'Use my location'}</span>
              </button>
            </div>

            {/* Geolocation feedback message */}
            {geoStatus.message && (
              <div
                className={`text-[11px] p-2 rounded-lg mb-2 flex items-start gap-1.5 ${
                  geoStatus.isError
                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{geoStatus.message}</span>
              </div>
            )}

            {/* Search input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search any Indian city, town, or state..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden"
              />
            </div>
          </div>

          {/* Search Results Mode */}
          {searchResults !== null ? (
            <div className="max-h-[300px] overflow-y-auto p-2 divide-y divide-slate-100">
              {searchResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No matching city or state found.
                </div>
              ) : (
                searchResults.map((item) => (
                  <button
                    key={`${item.stateName}-${item.citySlug}`}
                    type="button"
                    onClick={() => handleCitySelect(item.citySlug)}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <span className="font-bold text-slate-900">{item.cityName}</span>
                      <span className="text-slate-400 ml-2 font-normal text-[11px]">
                        {item.stateName} • {item.placeType}
                      </span>
                    </div>
                    {item.availabilityState === 'ACTIVE' ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        Live Deals
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        Request Pool
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          ) : (
            /* State -> City Two-Column Picker */
            <div className="grid grid-cols-1 sm:grid-cols-12 max-h-[340px]">
              {/* States Column */}
              <div className="sm:col-span-6 border-r border-slate-100 overflow-y-auto max-h-[160px] sm:max-h-[340px] p-1.5 bg-slate-50/50">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  28 States & 8 UTs
                </div>
                {INDIA_LOCATION_DIRECTORY.map((state) => {
                  const isSelected = selectedStateCode === state.code;
                  return (
                    <button
                      key={state.code}
                      type="button"
                      onClick={() => setSelectedStateCode(state.code)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate">{state.name}</span>
                      <span
                        className={`text-[10px] ml-1 shrink-0 ${
                          isSelected ? 'text-emerald-100' : 'text-slate-400'
                        }`}
                      >
                        {state.cities.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Cities Column */}
              <div className="sm:col-span-6 overflow-y-auto max-h-[220px] sm:max-h-[340px] p-2">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {currentState.name} Urban Centres
                </div>
                <div className="space-y-1 mt-1">
                  {currentState.cities.map((city) => {
                    const isSelected = currentCitySlug === city.slug;
                    return (
                      <button
                        key={city.slug}
                        type="button"
                        onClick={() => handleCitySelect(city.slug)}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200'
                            : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-slate-900">{city.name}</div>
                          <div className="text-[10px] text-slate-400">
                            {city.placeType}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {city.availabilityState === 'ACTIVE' ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                              Live
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              Demand
                            </span>
                          )}
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Footer Notice */}
          <div className="p-3 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500 text-center">
            City determines local fulfilment. PoolBuy pools are independent by city.
          </div>
        </div>
      )}
    </div>
  );
}
