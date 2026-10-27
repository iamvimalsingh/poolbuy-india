'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Edit3,
  AlertCircle,
  CheckCircle2,
  X,
  Filter,
  Clock,
  Archive,
  Trash2,
  RotateCcw,
  Copy,
  Calendar,
  Eye,
  EyeOff,
} from 'lucide-react';
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

  // Clone Modal State
  const [cloneModalPool, setCloneModalPool] = useState<AdminPool | null>(null);
  const [cloneTargetCity, setCloneTargetCity] = useState('');
  const [cloneDays, setCloneDays] = useState(14);
  const [isCloning, setIsCloning] = useState(false);

  // Extend Deadline Modal State
  const [extendModalPool, setExtendModalPool] = useState<AdminPool | null>(null);
  const [extendNewDeadline, setExtendNewDeadline] = useState('');
  const [extendReason, setExtendReason] = useState('');
  const [isExtending, setIsExtending] = useState(false);

  // Delete Modal State
  const [deleteModalPool, setDeleteModalPool] = useState<AdminPool | null>(null);
  const [deleteMode, setDeleteMode] = useState<'soft' | 'hard'>('soft');
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleTogglePublish = async (pool: AdminPool) => {
    const nextPublished = !(pool.isPublished ?? true);
    try {
      const res = await fetch(`/api/admin/pools/${pool.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: nextPublished }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error?.message || 'Failed to toggle publication status.');
        return;
      }
      setSuccessMessage(
        nextPublished
          ? `Pool "${pool.name}" is now publicly visible.`
          : `Pool "${pool.name}" unpublished to draft.`
      );
      loadPools();
    } catch {
      setErrorMessage('Network error updating publication status.');
    }
  };

  const handleExecuteClone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneModalPool || !cloneTargetCity) return;
    setIsCloning(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/pools/${cloneModalPool.id}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetCity: cloneTargetCity, deadlineDays: cloneDays }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error?.message || 'Failed to clone pool.');
        return;
      }
      setSuccessMessage(
        `Pool successfully cloned to ${cloneTargetCity} as an independent draft pool.`
      );
      setCloneModalPool(null);
      loadPools();
    } catch {
      setErrorMessage('Network error cloning pool.');
    } finally {
      setIsCloning(false);
    }
  };

  const handleExecuteExtendDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendModalPool || !extendNewDeadline || !extendReason.trim()) return;
    setIsExtending(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/pools/${extendModalPool.id}/extend-deadline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newDeadline: new Date(extendNewDeadline).toISOString(),
          reason: extendReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error?.message || 'Failed to extend deadline.');
        return;
      }
      setSuccessMessage('Deadline extended successfully.');
      setExtendModalPool(null);
      loadPools();
    } catch {
      setErrorMessage('Network error extending deadline.');
    } finally {
      setIsExtending(false);
    }
  };

  const handleExecuteDelete = async () => {
    if (!deleteModalPool) return;
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `/api/admin/pools/${deleteModalPool.id}${deleteMode === 'hard' ? '?hard=true' : ''}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error?.message || 'Delete operation failed.');
        return;
      }
      setSuccessMessage(
        data.data?.action === 'hard_deleted'
          ? 'Pool permanently deleted.'
          : 'Pool soft-deleted and closed.'
      );
      setDeleteModalPool(null);
      loadPools();
    } catch {
      setErrorMessage('Network error deleting pool.');
    } finally {
      setIsDeleting(false);
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
      const isPublished = formData.get('isPublished') === 'true';
      const marketPriceType = (formData.get('marketPriceType') as string) || undefined;
      const groupPriceType = (formData.get('groupPriceType') as string) || undefined;
      const savingsDisplayApproved = formData.get('savingsDisplayApproved') === 'true';
      const quoteSource = (formData.get('quoteSource') as string) || null;
      const quoteDate = (formData.get('quoteDate') as string) || null;
      const quoteValidUntil = (formData.get('quoteValidUntil') as string) || null;
      const quoteScope = (formData.get('quoteScope') as string) || null;
      const quotePrivateNotes = (formData.get('quotePrivateNotes') as string) || null;
      const connectionStatus = (formData.get('connectionStatus') as string) || undefined;
      const connectionNotes = (formData.get('connectionNotes') as string) || null;

      const payload = {
        status,
        priceIsVerified,
        dealerName,
        dealerTerms,
        tokenPaymentUrl,
        tokenAmount,
        targetBuyers: isNaN(targetBuyers) ? undefined : targetBuyers,
        groupPrice: isNaN(Number(groupPrice)) ? undefined : groupPrice,
        isPublished,
        marketPriceType,
        groupPriceType,
        savingsDisplayApproved,
        quoteSource,
        quoteDate,
        quoteValidUntil,
        quoteScope,
        quotePrivateNotes,
        connectionStatus,
        connectionNotes,
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
                          {p.isPublished === false ? (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded">
                              Draft
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded">
                              Published
                            </span>
                          )}
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
                                onClick={() => handleTogglePublish(p)}
                                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border transition-colors ${
                                  p.isPublished === false
                                    ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                }`}
                                title={p.isPublished === false ? 'Publish publicly' : 'Unpublish to draft'}
                              >
                                {p.isPublished === false ? (
                                  <Eye className="w-3 h-3" aria-hidden="true" />
                                ) : (
                                  <EyeOff className="w-3 h-3" aria-hidden="true" />
                                )}
                                <span>{p.isPublished === false ? 'Publish' : 'Unpublish'}</span>
                              </button>

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

                              <button
                                type="button"
                                onClick={() => {
                                  setCloneModalPool(p);
                                  setCloneTargetCity(
                                    activeCitiesList.find((c) => c.name !== p.city)?.name || ''
                                  );
                                  setCloneDays(14);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-700 transition-colors"
                                title="Clone pool to another city as independent pool"
                              >
                                <Copy className="w-3 h-3" aria-hidden="true" />
                                <span>Clone</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setExtendModalPool(p);
                                  setExtendNewDeadline('');
                                  setExtendReason('');
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors"
                                title="Extend deadline with logged reason"
                              >
                                <Calendar className="w-3 h-3" aria-hidden="true" />
                                <span>Extend</span>
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
                                onClick={() => {
                                  setDeleteModalPool(p);
                                  setDeleteMode('soft');
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors"
                                title="Delete or soft-delete pool"
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

              {/* Publication Status */}
              <div className="pt-2 border-t border-gray-100">
                <label className="block font-semibold text-gray-800 mb-1">Public Visibility</label>
                <select
                  name="isPublished"
                  defaultValue={editingPool.isPublished !== false ? 'true' : 'false'}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white focus:border-emerald-600 outline-hidden"
                >
                  <option value="true">Published (Visible in city catalog and discovery)</option>
                  <option value="false">Draft / Unpublished (Admin only)</option>
                </select>
              </div>

              {/* Quote & Pricing Management */}
              <div className="pt-2 border-t border-gray-100 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">
                  Quote Classification & Evidence
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-800 mb-1">Market Price Classification</label>
                    <select
                      name="marketPriceType"
                      defaultValue={editingPool.marketPriceType || 'INDICATIVE_ESTIMATE'}
                      className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 bg-white"
                    >
                      <option value="INDICATIVE_ESTIMATE">Indicative Estimate (Approximate)</option>
                      <option value="SOURCED_REFERENCE">Sourced Reference / MSRP</option>
                      <option value="VERIFIED_COMPARABLE">Verified Comparable</option>
                      <option value="UNKNOWN">Unknown</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-800 mb-1">Group Price Classification</label>
                    <select
                      name="groupPriceType"
                      defaultValue={editingPool.groupPriceType || 'INDICATIVE_ESTIMATE'}
                      className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 bg-white"
                    >
                      <option value="INDICATIVE_ESTIMATE">Indicative Target</option>
                      <option value="VENDOR_QUOTED">Vendor Quoted</option>
                      <option value="VENDOR_VERIFIED">Vendor Verified</option>
                      <option value="EXPIRED_WITHDRAWN">Expired / Withdrawn</option>
                      <option value="UNKNOWN">Unknown</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="savingsDisplayApproved"
                    name="savingsDisplayApproved"
                    value="true"
                    defaultChecked={Boolean(editingPool.savingsDisplayApproved)}
                    className="w-4 h-4 rounded text-emerald-600"
                  />
                  <label htmlFor="savingsDisplayApproved" className="text-gray-700 font-medium text-[11px]">
                    Approve public savings badge display (only check if verified pricing evidence exists)
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-800 mb-1">Quote Source</label>
                    <input
                      type="text"
                      name="quoteSource"
                      defaultValue={editingPool.quoteSource || ''}
                      placeholder="e.g. Authorized Dealer Invoice"
                      className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-800 mb-1">Quote Valid Until</label>
                    <input
                      type="date"
                      name="quoteValidUntil"
                      defaultValue={
                        editingPool.quoteValidUntil ? editingPool.quoteValidUntil.split('T')[0] : ''
                      }
                      className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-gray-800 mb-1">Quote Scope & Deliverables</label>
                  <input
                    type="text"
                    name="quoteScope"
                    defaultValue={editingPool.quoteScope || ''}
                    placeholder="e.g. Standard ex-showroom, portable charger, 3-yr battery warranty"
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-800 mb-1">Private Quote Notes</label>
                  <textarea
                    name="quotePrivateNotes"
                    rows={2}
                    defaultValue={editingPool.quotePrivateNotes || ''}
                    placeholder="Private notes for admin records (never public)"
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 resize-none"
                  />
                </div>
              </div>

              {/* Connection Stage */}
              <div className="pt-2 border-t border-gray-100 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">
                  Connection Stage (Post-Target)
                </span>
                <p className="text-[11px] text-gray-500">
                  Participation is free before target. Connection fees are unconfigured and disabled in this MVP release.
                </p>
                <div>
                  <label className="block font-semibold text-gray-800 mb-1">Stage Status</label>
                  <select
                    name="connectionStatus"
                    defaultValue={editingPool.connectionStatus || 'NOT_ELIGIBLE'}
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 bg-white"
                  >
                    <option value="NOT_ELIGIBLE">NOT_ELIGIBLE (Free pooling / before target)</option>
                    <option value="ADMIN_REVIEW_PENDING">ADMIN_REVIEW_PENDING (Target reached, verifying quotes)</option>
                    <option value="TERMS_PENDING">TERMS_PENDING (Reviewing dealer terms)</option>
                    <option value="PAYMENT_LINK_CONFIGURED">PAYMENT_LINK_CONFIGURED (Terms / link ready)</option>
                    <option value="PAYMENT_PENDING">PAYMENT_PENDING (Awaiting confirmation)</option>
                    <option value="READY_TO_CONNECT">READY_TO_CONNECT (Ready for showroom introduction)</option>
                    <option value="COMPLETED">COMPLETED (Concluded / fulfilled)</option>
                    <option value="CANCELLED">CANCELLED (Group cancelled)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-800 mb-1">Connection Stage Notes</label>
                  <textarea
                    name="connectionNotes"
                    rows={2}
                    defaultValue={editingPool.connectionNotes || ''}
                    placeholder="Internal connection progress notes"
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 resize-none"
                  />
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

      {/* Clone Pool Modal */}
      {cloneModalPool && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-md w-full p-6 relative">
            <button
              type="button"
              onClick={() => setCloneModalPool(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
            <h3 className="text-lg font-bold text-gray-950 mb-1">Clone Group to Another City</h3>
            <p className="text-xs text-gray-500 mb-4">
              Creates an independent group for <span className="font-semibold">{cloneModalPool.name}</span> in a new city.
              Counters start at 0, no buyer leads are transferred, and the new group is saved as an un-published draft.
            </p>
            <form onSubmit={handleExecuteClone} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-800 mb-1">Target Operational City</label>
                <select
                  value={cloneTargetCity}
                  onChange={(e) => setCloneTargetCity(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white"
                  required
                >
                  <option value="">Select Target City</option>
                  {activeCitiesList
                    .filter((c) => c.name.toLowerCase() !== cloneModalPool.city.toLowerCase())
                    .map((c) => (
                      <option key={c.slug} value={c.name}>
                        {c.name} ({c.state})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-gray-800 mb-1">New Duration (Days from now)</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={cloneDays}
                  onChange={(e) => setCloneDays(parseInt(e.target.value, 10) || 14)}
                  className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300"
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCloneModalPool(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCloning || !cloneTargetCity}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isCloning ? 'Cloning...' : 'Create Cloned Draft Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Extend Deadline Modal */}
      {extendModalPool && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-md w-full p-6 relative">
            <button
              type="button"
              onClick={() => setExtendModalPool(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
            <h3 className="text-lg font-bold text-gray-950 mb-1">Extend Group Deadline</h3>
            <p className="text-xs text-gray-500 mb-4">
              Current deadline: <span className="font-semibold">{new Date(extendModalPool.deadline).toLocaleDateString()}</span>.
              A logged justification is required for audit history.
            </p>
            <form onSubmit={handleExecuteExtendDeadline} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-800 mb-1">New Target Deadline Date & Time</label>
                <input
                  type="datetime-local"
                  value={extendNewDeadline}
                  onChange={(e) => setExtendNewDeadline(e.target.value)}
                  className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-800 mb-1">Extension Reason / Commercial Justification</label>
                <textarea
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Dealer requested 5 more days to finalize bulk tier pricing for additional buyers."
                  className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 resize-none"
                  required
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setExtendModalPool(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isExtending || !extendNewDeadline || !extendReason.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isExtending ? 'Extending...' : 'Confirm Deadline Extension'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalPool && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-md w-full p-6 relative">
            <button
              type="button"
              onClick={() => setDeleteModalPool(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
            <h3 className="text-lg font-bold text-gray-950 mb-1">Delete Group Pool</h3>
            <p className="text-xs text-gray-500 mb-4">
              Pool: <span className="font-semibold">{deleteModalPool.name}</span> ({deleteModalPool.city}).
            </p>
            <div className="space-y-3 text-xs mb-6">
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="deleteMode"
                  checked={deleteMode === 'soft'}
                  onChange={() => setDeleteMode('soft')}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-bold text-gray-900">Soft-Delete (Recommended)</div>
                  <div className="text-gray-500 text-[11px]">
                    Closes the group and hides it from public exploration. Preserves all buyer lead history, quotation notes, and audit trails. Can be restored anytime.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-rose-200 bg-rose-50/50 cursor-pointer hover:bg-rose-50">
                <input
                  type="radio"
                  name="deleteMode"
                  checked={deleteMode === 'hard'}
                  onChange={() => setDeleteMode('hard')}
                  className="mt-0.5 text-rose-600"
                />
                <div>
                  <div className="font-bold text-rose-900">Permanent Hard Delete</div>
                  <div className="text-rose-700 text-[11px]">
                    Irrevocably deletes record from database. Permitted ONLY if 0 buyer leads, 0 price records, and 0 proposal links exist. If dependencies exist, the server will block this action.
                  </div>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteModalPool(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleExecuteDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 text-xs disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : deleteMode === 'hard' ? 'Hard Delete Permanently' : 'Soft-Delete Pool'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
