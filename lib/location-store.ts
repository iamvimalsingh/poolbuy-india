'use client';

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'poolbuy_preferred_city';
const COOKIE_NAME = 'poolbuy_selected_city';
const CHANGE_EVENT = 'poolbuy:city-change';

let memoryCity: string | null = null;

function getCitySnapshot(): string | null {
  if (typeof window === 'undefined') {
    return memoryCity;
  }
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (!val || val.trim() === '' || val.trim().toLowerCase() === 'all') {
      return null;
    }
    return val.trim().toLowerCase();
  } catch {
    return memoryCity;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

function subscribeCity(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handler = () => {
    onStoreChange();
  };
  window.addEventListener('storage', handler);
  window.addEventListener(CHANGE_EVENT, handler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener(CHANGE_EVENT, handler);
  };
}

/**
 * Sets the single authoritative selected city across the entire application.
 * Pass `null`, `''`, or `'all'` to revert to All India.
 */
export function setAuthoritativeCity(citySlug: string | null | undefined): void {
  const normalized = citySlug && citySlug.trim().toLowerCase() !== 'all' ? citySlug.trim().toLowerCase() : null;
  memoryCity = normalized;

  if (typeof window !== 'undefined') {
    try {
      if (normalized) {
        localStorage.setItem(STORAGE_KEY, normalized);
        document.cookie = `${COOKIE_NAME}=${normalized}; path=/; max-age=2592000; SameSite=Lax`;
      } else {
        localStorage.removeItem(STORAGE_KEY);
        document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
      }
    } catch {
      // Ignore localStorage restrictions (e.g. private mode)
    }

    try {
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: normalized }));
    } catch {
      // Ignore event dispatch failure
    }
  }
}

/**
 * Hook to access and update the authoritative selected city.
 * Returns null if All India is selected (the initial default).
 */
export function useSelectedCity(): [string | null, (citySlug: string | null | undefined) => void] {
  const city = useSyncExternalStore(subscribeCity, getCitySnapshot, getServerSnapshot);
  return [city, setAuthoritativeCity];
}

