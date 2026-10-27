'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit3, AlertCircle, CheckCircle2, X, Filter, Clock, Archive, Trash2, RotateCcw } from 'lucide-react';
import { AdminPool, PoolCategory, PoolStatus, City } from '@/types';
import { CATEGORIES, CITIES, STATUS_LABELS } from '@/lib/constants';
import { STANDARD_PRODUCTS } from '@/lib/products';
import { formatINR } from '@/lib/format';

export function AdminPoolsTab() {
  const [pools, setPools] = useState<AdminPool[]>([]);
  const [availableCities, setAvailableCities] = useState<City[]>([]);
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit / Create modal state
  const [editingPool, setEditingPool] = useState<AdminPool | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Create form controlled fields
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formCategory, setFormCategory] = useState<PoolCategory>('EV_SCOOTERS');
  const [formCity, setFormCity] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formTargetBuyers, setFormTargetBuyers] = useState<number>(10);
  const [formDaysFromNow, setFormDaysFromNow] = useState<number>(14);
  const [formMarketPrice, setFormMarketPrice] = useState<string>('');
  const [formGroupPrice, setFormGroupPrice] = useState<string>('');
  const [formShortDescription, setFormShortDescription] = useState('');
  const [formLongDescription, setFormLongDescription] = useState('');

  // Fetch pools & cities
  const loadPools = async () => {
    try {
      const [poolsRes, citiesRes] = await Promise.all([
        fetch('/api/admin/pools'),
        fetch('/api/admin/cities'),
      ]);
      const poolsData = await poolsRes.json();
      if (!poolsRes.ok || !poolsData.success) {
        setErrorMessage(poolsData.error?.message || 'Failed to load pools.');
        return;
      }
      setPools(poolsData.data);

      if (citiesRes.ok) {
        const citiesData = await citiesRes.json();
        if (citiesData.success && Array.isArray(citiesData.data)) {
          setAvailableCities(citiesData.data);
        }
      }
    } catch {
      setErrorMessage('Network error loading pools.');
    } finally {
      setIsLoading(false);
    }
  };

  const [isRunningExpiry, setIsRunningExpiry] = useState(false);

  const handleRunExpiryCheck = async () => {
    setIsRunningExpiry(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/cron/pool-lifecycle', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error?.message || 'Failed to run lifecycle expiry check.');
        return;
      }
      const count = data.data.totalClosedCount ?? 0;
      setSuccessMessage(`Lifecycle expiry check complete: ${count} pool(s) expired or closed.`);
      loadPools();
    } catch {
      setErrorMessage('Network error running lifecycle scheduler.');
    } finally {
      setIsRunningExpiry(false);
    }
  };

  const handleExpirePool = async (poolId: string) => {
    if (!confirm('Are you sure you want to expire this pool immediately?')) return;
    try {
      const res = await fetch(`/api/admin/pools/${poolId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CLOSED', closureReason: 'ADMIN_EXPIRED' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error?.message || 'Failed to expire pool.');
        return;
      }
      setSuccessMessage('Pool expired successfully.');
      loadPools();
    } catch {
      setErrorMessage('Network error expiring pool.');
    }
  };

  const handleArchiveToggle = async (pool: AdminPool) => {
    const nextArchived = !pool.isArchived;
    try {
      const res = await fetch(`/api/admin/pools/${pool.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: nextArchived }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error?.message || 'Failed to toggle archive status.');
        return;
      }
      setSuccessMessage(nextArchived ? 'Pool archived.' : 'Pool restored from archive.');
      loadPools();
    } catch {
      setErrorMessage('Network error toggling archive status.');
    }
  };

  const handleSoftDelete = async (poolId: string) => {
    if (!confirm('Soft-delete this pool? It will be closed and hidden from public views.')) return;
    try {
      const res = await fetch(`/api/admin/pools/${poolId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error?.message || 'Failed to delete pool.');
        return;
      }
      setSuccessMessage('Pool soft-deleted successfully.');
      loadPools();
    } catch {
      setErrorMessage('Network error deleting pool.');
    }
  };

  const handleRestore = async (poolId: string) => {
    try {
      const res = await fetch(`/api/admin/pools/${poolId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deletedAt: null, isArchived: false, status: 'ACTIVE', closureReason: null }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error?.message || 'Failed to restore pool.');
        return;
      }
      setSuccessMessage('Pool restored to active state.');
      loadPools();
    } catch {
      setErrorMessage('Network error restoring pool.');
    }
  };

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const [poolsRes, citiesRes] = await Promise.all([
          fetch('/api/admin/pools'),
          fetch('/api/admin/cities'),
        ]);
        const poolsData = await poolsRes.json();
        if (!ignore && poolsData.success) {
          setPools(poolsData.data);
        }
        if (!ignore && citiesRes.ok) {
          const citiesData = await citiesRes.json();
          if (citiesData.success && Array.isArray(citiesData.data)) {
            setAvailableCities(citiesData.data);
          }
        }
      } catch {
        if (!ignore) setErrorMessage('Network error loading pools.');
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, []);

  const activeCitiesList = useMemo(() => {
    if (availableCities.length > 0) {
      return availableCities.filter((c) => c.isActive);
    }
    return CITIES.map((c) => ({
      id: `city-${c.slug}`,
      name: c.name,
      slug: c.slug,
      state: c.state,
      isActive: true,
      createdAt: '',
      updatedAt: '',
    }));
  }, [availableCities]);

  const filteredPools = useMemo(() => {
    if (selectedCityFilter === 'all') return pools;
    return pools.filter((p) => p.citySlug === selectedCityFilter);
  }, [pools, selectedCityFilter]);

  const handleUpdatePool = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPool) return;
    setModalError(null);
    setIsSaving(true);

    try {
      const form = e.currentTarget;
      const formData = new FormData(form);

      const status = formData.get('status') as PoolStatus;
      const priceIsVerified = formData.get('priceIsVerified') === 'true';
      const dealerName = (formData.get('dealerName') as string) || null;
      const dealerTerms = (formData.get('dealerTerms') as string) || null;
      const tokenPaymentUrl = (formData.get('tokenPaymentUrl') as string) || null;
      const tokenAmountStr = formData.get('tokenAmount') as string;
      const tokenAmount = tokenAmountStr ? parseFloat(tokenAmountStr) : null;
      const targetBuyers = parseInt(formData.get('targetBuyers') as string, 10);
      const groupPriceStr = formData.get('groupPrice') as string;
      const groupPrice = groupPriceStr ? parseFloat(groupPriceStr) : null;

      const payload = {
        status,
        priceIsVerified,
        dealerName,
        dealerTerms,
        tokenPaymentUrl,
        tokenAmount,
        targetBuyers: isNaN(targetBuyers) ? undefined : targetBuyers,
        groupPrice: isNaN(Number(groupPrice)) ? undefined : groupPrice,
      };

      const res = await fetch(`/api/admin/pools/${editingPool.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setModalError(data.error?.message || 'Failed to update pool.');
        return;
      }

      setEditingPool(null);
      setSuccessMessage(`Pool "${data.data.name}" updated successfully.`);
      loadPools();
    } catch {
      setModalError('Network error while updating pool.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenCreate = () => {
    setFormName('');
    setFormSlug('');
    setFormCategory('EV_SCOOTERS');
    setFormCity(activeCitiesList[0]?.name || 'Bhopal');
    setFormBrand('');
    setFormModel('');
    setFormTargetBuyers(10);
    setFormDaysFromNow(14);
    setFormMarketPrice('');
    setFormGroupPrice('');
    setFormShortDescription('');
    setFormLongDescription('');
    setModalError(null);
    setIsCreateOpen(true);
  };

  const handleTemplateSelect = (templateId: string) => {
    const prod = STANDARD_PRODUCTS.find((p) => p.id === templateId);
    if (!prod) return;
    setFormName(prod.name);
    setFormSlug(prod.slug);
    setFormCategory(prod.category as PoolCategory);
    setFormBrand(prod.brand);
    setFormModel(prod.model);
    setFormMarketPrice(prod.defaultMarketPrice?.toString() || '');
    setFormGroupPrice(prod.defaultGroupPrice?.toString() || '');
    setFormTargetBuyers(prod.defaultTargetBuyers);
    setFormShortDescription(prod.shortDescription);
    setFormLongDescription(prod.longDescription);
  };

  const handleCreatePool = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setModalError(null);
    setIsSaving(true);

    try {
      const deadline = new Date(Date.now() + formDaysFromNow * 24 * 60 * 60 * 1000).toISOString();

      const payload = {
        name: formName.trim(),
        slug: formSlug.trim() || undefined,
        category: formCategory,
        city: formCity.trim(),
        productBrand: formBrand.trim(),
        productModel: formModel.trim(),
        targetBuyers: formTargetBuyers,
        marketPrice: formMarketPrice ? parseFloat(formMarketPrice) : null,
        groupPrice: formGroupPrice ? parseFloat(formGroupPrice) : null,
        deadline,
        shortDescription: formShortDescription.trim(),
        longDescription: formLongDescription.trim(),
        status: 'ACTIVE',
        priceIsVerified: false,
      };

      const res = await fetch('/api/admin/pools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setModalError(data.error?.message || 'Failed to create pool.');
        return;
      }

      setIsCreateOpen(false);
      setSuccessMessage(`New pool "${data.data.name}" in ${data.data.city} created successfully.`);
      loadPools();
    } catch {
      setModalError('Network error while creating pool.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-950">Group Pool Management</h2>
          <p className="text-xs text-gray-500 mt-1">
            Review buyer targets, edit pricing, verify dealership contracts, and manage independent city pools.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunExpiryCheck}
            disabled={isRunningExpiry}
            className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 active:scale-98 transition-all shadow-xs disabled:opacity-60"
            title="Checks deadlines and closes expired pools idempotently"
          >
            <Clock className={`w-3.5 h-3.5 text-amber-600 ${isRunningExpiry ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{isRunningExpiry ? 'Running...' : 'Run Expiry Check'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 active:scale-98 transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Create New Pool</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl p-3 flex items-center justify-between gap-2">
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
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* City Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-gray-400 font-semibold uppercase text-[10px] shrink-0 flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
          <span>City Filter:</span>
        </span>
        <button
          type="button"
          onClick={() => setSelectedCityFilter('all')}
          className={`px-3 py-1.5 rounded-xl font-semibold transition-colors shrink-0 text-xs ${
            selectedCityFilter === 'all'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Cities ({pools.length})
        </button>
        {activeCitiesList.map((c) => {
          const count = pools.filter((p) => p.citySlug === c.slug).length;
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => setSelectedCityFilter(c.slug)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-colors shrink-0 text-xs ${
                selectedCityFilter === c.slug
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {c.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Pools Table */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-gray-400">Loading pool records...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100">
                <tr>
                  <th className="py-3.5 px-4">Pool / Product</th>
                  <th className="py-3.5 px-4">City</th>
                  <th className="py-3.5 px-4">Target / Joined</th>
                  <th className="py-3.5 px-4">Group Price</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Dealer Terms</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {filteredPools.map((p) => {
                  const statusMeta = STATUS_LABELS[p.status] || STATUS_LABELS.ACTIVE;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-950 text-sm">{p.name}</div>
                        <div className="text-[11px] text-gray-400 font-mono">{p.slug}</div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-900">{p.city}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-gray-900">{p.currentBuyers}</span>
                        <span className="text-gray-400"> / {p.targetBuyers}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-950">{formatINR(p.groupPrice)}</div>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            p.priceIsVerified
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {p.priceIsVerified ? 'Verified' : 'Illustrative'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusMeta.badgeClass}`}
                          >
                            {statusMeta.label}
                          </span>
                          {p.closureReason && (
                            <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                              {p.closureReason}
                            </span>
                          )}
                          {p.isArchived && (
                            <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                              Archived
                            </span>
                          )}
                          {p.deletedAt && (
                            <span className="text-[10px] font-semibold text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded">
                              Soft-Deleted
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {p.dealerName ? (
                          <div className="text-gray-900 font-semibold">{p.dealerName}</div>
                        ) : (
                          <span className="text-gray-400 italic">Pending dealer</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end flex-wrap">
                          {p.deletedAt ? (
                            <button
                              type="button"
                              onClick={() => handleRestore(p.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                              title="Restore pool"
                            >
                              <RotateCcw className="w-3 h-3" aria-hidden="true" />
                              <span>Restore</span>
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPool(p);
                                  setModalError(null);
                                }}
                                className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-700 transition-colors"
                                title="Edit pool"
                              >
                                <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Edit</span>
                              </button>

                              {p.status === 'ACTIVE' && (
                                <button
                                  type="button"
                                  onClick={() => handleExpirePool(p.id)}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 transition-colors"
                                  title="Expire pool now"
                                >
                                  <Clock className="w-3 h-3" aria-hidden="true" />
                                  <span>Expire</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleArchiveToggle(p)}
                                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border transition-colors ${
                                  p.isArchived
                                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                    : 'border-gray-200 hover:bg-gray-100 text-gray-600'
                                }`}
                                title={p.isArchived ? 'Unarchive pool' : 'Archive pool'}
                              >
                                <Archive className="w-3 h-3" aria-hidden="true" />
                                <span>{p.isArchived ? 'Unarchive' : 'Archive'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSoftDelete(p.id)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors"
                                title="Soft delete pool"
                              >
                                <Trash2 className="w-3 h-3" aria-hidden="true" />
                                <span>Delete</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Pool Modal */}
      {editingPool && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 relative">
            <button
              type="button"
              onClick={() => setEditingPool(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>

            <h3 className="text-lg font-bold text-gray-950 mb-1">
              Edit Pool: {editingPool.name}
            </h3>
            <p className="text-xs text-gray-500 mb-6">
              Status changes to UNLOCKED require verified dealer terms, price verification, and token payment URL.
            </p>

            {modalError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 mb-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePool} className="space-y-4 text-xs">
              {/* Status */}
              <div>
                <label className="block font-semibold text-gray-800 mb-1">Pool Status</label>
                <select
                  name="status"
                  defaultValue={editingPool.status}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white focus:border-emerald-600 outline-hidden"
                >
                  <option value="ACTIVE">ACTIVE (Open for buyer joins)</option>
                  <option value="UNLOCKED">UNLOCKED (Target met & terms verified)</option>
                  <option value="LEAD_FALLBACK">LEAD_FALLBACK (Direct dealer quotation)</option>
                  <option value="CLOSED">CLOSED (Concluded)</option>
                </select>
              </div>

              {/* Price is verified toggle */}
              <div>
                <label className="block font-semibold text-gray-800 mb-1">Price Verification</label>
                <select
                  name="priceIsVerified"
                  defaultValue={editingPool.priceIsVerified ? 'true' : 'false'}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white focus:border-emerald-600 outline-hidden"
                >
                  <option value="false">Illustrative / Demo Estimate (Unverified)</option>
                  <option value="true">Verified Authorized Dealer Quotation</option>
                </select>
              </div>

              {/* Group Price & Target */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-800 mb-1">Target Buyers</label>
                  <input
                    type="number"
                    name="targetBuyers"
                    min={2}
                    max={10000}
                    defaultValue={editingPool.targetBuyers}
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-800 mb-1">Group Target Price (₹)</label>
                  <input
                    type="number"
                    name="groupPrice"
                    defaultValue={editingPool.groupPrice || ''}
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 outline-hidden"
                  />
                </div>
              </div>

              {/* Dealer Showroom Details */}
              <div className="pt-2 border-t border-gray-100 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">
                  Dealership Verification (Required to Unlock)
                </span>

                <div>
                  <label className="block font-semibold text-gray-800 mb-1">Authorized Dealer Name</label>
                  <input
                    type="text"
                    name="dealerName"
                    defaultValue={editingPool.dealerName || ''}
                    placeholder="e.g. TVS Prime Motors Bhopal"
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-800 mb-1">Dealer Commercial Terms</label>
                  <textarea
                    name="dealerTerms"
                    rows={2}
                    defaultValue={editingPool.dealerTerms || ''}
                    placeholder="e.g. Price includes standard warranty and charger. Insurance extra."
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 outline-hidden resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-800 mb-1">Token Deposit (₹499–₹999)</label>
                    <input
                      type="number"
                      name="tokenAmount"
                      min={499}
                      max={999}
                      defaultValue={editingPool.tokenAmount || 499}
                      className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-800 mb-1">HTTPS Token Payment Link</label>
                    <input
                      type="url"
                      name="tokenPaymentUrl"
                      defaultValue={editingPool.tokenPaymentUrl || ''}
                      placeholder="https://rzp.io/l/poolbuy-token"
                      className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPool(null)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Pool Modal */}
      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 relative">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>

            <h3 className="text-lg font-bold text-gray-950 mb-1">Create City-Specific Group Pool</h3>
            <p className="text-xs text-gray-500 mb-6">
              Launch a standardized product or custom deal for an authoritative city. Counts and buyers remain completely isolated to that city.
            </p>

            {modalError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 mb-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreatePool} className="space-y-4 text-xs">
              {/* Product Template Selector */}
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-2xl">
                <label className="block font-bold text-emerald-950 mb-1">
                  Standard Product Template <span className="text-emerald-700 font-normal">(Optional Pre-fill)</span>
                </label>
                <select
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  defaultValue=""
                  className="w-full text-xs px-3 py-2 rounded-xl border border-emerald-300 bg-white text-gray-900 outline-hidden font-medium"
                >
                  <option value="">-- Choose a standard product template --</option>
                  {STANDARD_PRODUCTS.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name} ({prod.category})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-emerald-800/80 mt-1">
                  Selecting a template sets standard specs & slug. You can customize target buyers, pricing, or city below.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-gray-800 mb-1">Product Title</label>
                <input
                  type="text"
                  name="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  placeholder="e.g. Ather Rizta Electric Scooter"
                  className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-800 mb-1">Authoritative City</label>
                  <select
                    name="city"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    required
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 bg-white outline-hidden font-medium"
                  >
                    {activeCitiesList.map((c) => (
                      <option key={c.slug} value={c.name}>
                        {c.name} ({c.state})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-800 mb-1">Category</label>
                  <select
                    name="category"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as PoolCategory)}
                    required
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 bg-white outline-hidden"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.slug} value={c.category}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-800 mb-1">Brand</label>
                  <input
                    type="text"
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    placeholder="e.g. Ather"
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-800 mb-1">Model / Variant</label>
                  <input
                    type="text"
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    placeholder="e.g. Rizta S"
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-800 mb-1">Target Buyers</label>
                  <input
                    type="number"
                    min={2}
                    max={10000}
                    value={formTargetBuyers}
                    onChange={(e) => setFormTargetBuyers(parseInt(e.target.value, 10) || 10)}
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-800 mb-1">Duration (Days)</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={formDaysFromNow}
                    onChange={(e) => setFormDaysFromNow(parseInt(e.target.value, 10) || 14)}
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-800 mb-1">MRP / Market Price (₹)</label>
                  <input
                    type="number"
                    value={formMarketPrice}
                    onChange={(e) => setFormMarketPrice(e.target.value)}
                    placeholder="150000"
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-800 mb-1">Group Target Price (₹)</label>
                  <input
                    type="number"
                    value={formGroupPrice}
                    onChange={(e) => setFormGroupPrice(e.target.value)}
                    placeholder="135000"
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-800 mb-1">
                  Custom Pool Slug <span className="text-gray-400 font-normal">(Optional standard identifier)</span>
                </label>
                <input
                  type="text"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="Auto-generated if left blank"
                  className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 outline-hidden font-mono text-xs text-gray-700"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-800 mb-1">Short Description</label>
                <textarea
                  value={formShortDescription}
                  onChange={(e) => setFormShortDescription(e.target.value)}
                  rows={2}
                  maxLength={300}
                  placeholder="e.g. City-level group quotation pool for the latest electric scooter model."
                  className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 outline-hidden resize-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isSaving ? 'Creating...' : 'Create City Pool'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
