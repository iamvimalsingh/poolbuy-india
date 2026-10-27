'use client';

import React, { useState, useEffect } from 'react';
import { Plus, CheckCircle2, AlertCircle, MapPin, X, ToggleLeft, ToggleRight } from 'lucide-react';
import { City } from '@/types';

export function AdminCitiesTab() {
  const [cities, setCities] = useState<City[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Create city modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const res = await fetch('/api/admin/cities');
        const data = await res.json();
        if (!ignore && data.success) {
          setCities(data.data);
        }
      } catch {
        if (!ignore) setErrorMessage('Network error loading cities.');
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, []);

  const handleToggleCity = async (city: City) => {
    try {
      const res = await fetch(`/api/admin/cities/${city.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !city.isActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error?.message || 'Failed to update city status.');
        return;
      }
      setCities((prev) =>
        prev.map((c) => (c.id === city.id ? { ...c, isActive: !city.isActive } : c))
      );
      setSuccessMessage(
        `City "${city.name}" ${!city.isActive ? 'activated' : 'deactivated'} successfully.`
      );
    } catch {
      setErrorMessage('Network error updating city status.');
    }
  };

  const handleCreateCity = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setModalError(null);
    setIsSaving(true);

    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      const name = (formData.get('name') as string)?.trim();
      const state = (formData.get('state') as string)?.trim();
      const slug = (formData.get('slug') as string)?.trim() || undefined;

      const res = await fetch('/api/admin/cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, state, slug }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setModalError(data.error?.message || 'Failed to create city.');
        return;
      }

      setCities((prev) => [...prev, data.data]);
      setIsCreateOpen(false);
      setSuccessMessage(`City "${name}" added to authoritative directory.`);
    } catch {
      setModalError('Network error creating city.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Add Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-gray-950">
            Authoritative City Directory
          </h2>
          <p className="text-xs text-gray-500">
            Control geographic markets where PoolBuy operates. Deactivated cities cannot accept pool creation or public browsing.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsCreateOpen(true);
            setModalError(null);
          }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Add New City</span>
        </button>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-700 hover:text-rose-900"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Cities Table */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-gray-400">Loading city records...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100">
                <tr>
                  <th className="py-3.5 px-4">City</th>
                  <th className="py-3.5 px-4">State</th>
                  <th className="py-3.5 px-4">URL Slug</th>
                  <th className="py-3.5 px-4">Operational Status</th>
                  <th className="py-3.5 px-4 text-right">Toggle Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {cities.map((city) => (
                  <tr key={city.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2 font-bold text-gray-950 text-sm">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                        <span>{city.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-gray-900">{city.state}</td>
                    <td className="py-3.5 px-4">
                      <code className="text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">
                        /city/{city.slug}
                      </code>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          city.isActive
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}
                      >
                        {city.isActive ? 'Active Market' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggleCity(city)}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                          city.isActive
                            ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        }`}
                      >
                        {city.isActive ? (
                          <>
                            <ToggleRight className="w-4 h-4 text-amber-600" aria-hidden="true" />
                            <span>Deactivate</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                            <span>Activate</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add City Modal */}
      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-md w-full p-6 sm:p-8 relative">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>

            <h3 className="text-lg font-bold text-gray-950 mb-1">Add Operational City</h3>
            <p className="text-xs text-gray-500 mb-6">
              Add a verified geographic market to the authoritative directory.
            </p>

            {modalError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 mb-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCity} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-800 mb-1">City Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Surat"
                  className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-800 mb-1">State / Region</label>
                <input
                  type="text"
                  name="state"
                  required
                  placeholder="e.g. Gujarat"
                  className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-800 mb-1">
                  Custom Slug <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  name="slug"
                  placeholder="Leave empty to auto-generate (e.g. surat)"
                  className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 outline-hidden font-mono text-xs"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isSaving ? 'Adding...' : 'Add City'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
