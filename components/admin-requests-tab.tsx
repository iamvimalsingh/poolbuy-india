'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Check,
  Clock,
  X,
  AlertCircle,
  Search,
  Rocket,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Loader2,
  Flame,
} from 'lucide-react';
import { PoolRequest, PoolRequestStatus, City, Category } from '@/types';
import { REQUEST_STATUS_LABELS } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';

export function AdminRequestsTab() {
  const [requests, setRequests] = useState<PoolRequest[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCity, setFilterCity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  // Admin note editing modal / inline state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Conversion Modal State
  const [convertingRequest, setConvertingRequest] = useState<PoolRequest | null>(null);
  const [convertForm, setConvertForm] = useState({
    citySlug: '',
    productName: '',
    categorySlug: 'ev-scooters',
    productBrand: '',
    productModel: '',
    marketPrice: '',
    groupPrice: '',
    targetBuyers: '10',
    durationDays: '14',
    dealerName: '',
  });
  const [isConverting, setIsConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertSuccess, setConvertSuccess] = useState<{ poolSlug: string; citySlug: string; dealUrl: string } | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/pool-requests');
      const data = await res.json();
      if (data.success) {
        setRequests(data.data);
      } else {
        setErrorMessage(data.error?.message || 'Failed to load requests.');
      }
    } catch {
      setErrorMessage('Network error loading pool requests.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function init() {
      await loadRequests();
      try {
        const [cRes, catRes] = await Promise.all([
          fetch('/api/cities'),
          fetch('/api/categories'),
        ]);
        const [cData, catData] = await Promise.all([cRes.json(), catRes.json()]);
        if (!ignore) {
          if (cData.success) setCities(cData.data);
          if (catData.success) setCategories(catData.data);
        }
      } catch (err) {
        console.error('Error fetching admin directory data:', err);
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, [loadRequests]);

  const handleStatusChange = async (requestId: string, status: PoolRequestStatus) => {
    try {
      const res = await fetch(`/api/admin/pool-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status } : r))
        );
      }
    } catch (e) {
      console.error('Failed to update request status:', e);
    }
  };

  const handleSaveNote = async (requestId: string) => {
    setIsSavingNote(true);
    try {
      const res = await fetch(`/api/admin/pool-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNotes: noteText.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, adminNotes: noteText.trim() } : r))
        );
        setEditingNoteId(null);
      }
    } catch (e) {
      console.error('Failed to save admin note:', e);
    } finally {
      setIsSavingNote(false);
    }
  };

  const openConvertModal = (request: PoolRequest) => {
    setConvertingRequest(request);
    setConvertError(null);
    setConvertSuccess(null);

    // Find if city exists in operational cities
    const matchingCity = cities.find(
      (c) => c.name.toLowerCase() === request.city.toLowerCase()
    );

    setConvertForm({
      citySlug: matchingCity ? matchingCity.slug : cities[0]?.slug || 'bhopal',
      productName: request.productName,
      categorySlug: request.category ? request.category.toLowerCase().replace(/_/g, '-') : (categories[0]?.slug || 'ev-scooters'),
      productBrand: request.brandPreference || 'Standardized Brand',
      productModel: request.modelPreference || 'Standardized Model',
      marketPrice: '',
      groupPrice: '',
      targetBuyers: '10',
      durationDays: '14',
      dealerName: '',
    });
  };

  const handleExecuteConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingRequest) return;

    setConvertError(null);
    setIsConverting(true);

    try {
      const payload = {
        citySlug: convertForm.citySlug,
        productName: convertForm.productName.trim(),
        categorySlug: convertForm.categorySlug,
        productBrand: convertForm.productBrand.trim(),
        productModel: convertForm.productModel.trim(),
        marketPrice: convertForm.marketPrice ? Number(convertForm.marketPrice) : null,
        groupPrice: convertForm.groupPrice ? Number(convertForm.groupPrice) : null,
        targetBuyers: Number(convertForm.targetBuyers) || 10,
        durationDays: Number(convertForm.durationDays) || 14,
        dealerName: convertForm.dealerName.trim() || null,
      };

      const res = await fetch(`/api/admin/pool-requests/${convertingRequest.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setConvertError(data.error?.message || 'Conversion failed.');
        return;
      }

      setConvertSuccess(data.data);
      // Update in table
      setRequests((prev) =>
        prev.map((r) =>
          r.id === convertingRequest.id
            ? {
                ...r,
                status: 'APPROVED',
                conversionStatus: 'CONVERTED',
                resultingPoolId: data.data.poolId,
              }
            : r
        )
      );
    } catch {
      setConvertError('Network error while converting request.');
    } finally {
      setIsConverting(false);
    }
  };

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (filterCity !== 'all' && r.city.toLowerCase() !== filterCity.toLowerCase()) {
        return false;
      }
      if (filterStatus !== 'all' && r.status !== filterStatus) {
        return false;
      }
      if (filterCategory !== 'all') {
        const catSlug = r.category ? r.category.toLowerCase().replace(/_/g, '-') : '';
        if (catSlug !== filterCategory && r.categoryName?.toLowerCase() !== filterCategory.toLowerCase()) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesProduct = r.productName.toLowerCase().includes(q);
        const matchesCity = r.city.toLowerCase().includes(q);
        const matchesName = r.fullName?.toLowerCase().includes(q) ?? false;
        const matchesNote = r.extraMessage?.toLowerCase().includes(q) ?? false;
        if (!matchesProduct && !matchesCity && !matchesName && !matchesNote) {
          return false;
        }
      }
      return true;
    });
  }, [requests, filterCity, filterStatus, filterCategory, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            Demand Discovery & Pool Requests
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {requests.length} requests
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Review community requests, cluster buyer interest, identify supplier pathways, and launch verified city-specific pools.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-1 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search product, city, requester..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-gray-200 focus:border-emerald-500 outline-hidden"
          />
        </div>

        <div>
          <select
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-xl border border-gray-200 focus:border-emerald-500 outline-hidden bg-white"
          >
            <option value="all">All Cities</option>
            {cities.map((c) => (
              <option key={c.slug} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-xl border border-gray-200 focus:border-emerald-500 outline-hidden bg-white"
          >
            <option value="all">All Review Statuses</option>
            <option value="REQUESTED">Requested (New)</option>
            <option value="REVIEWING">Reviewing</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        <div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-xl border border-gray-200 focus:border-emerald-500 outline-hidden bg-white"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-xs text-gray-400">Loading demand discovery queue...</div>
      ) : filteredRequests.length === 0 ? (
        <div className="p-12 text-center text-xs text-gray-500 bg-white rounded-2xl border border-gray-200/80">
          No pool requests match the selected filters.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100">
                <tr>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Product & Interest</th>
                  <th className="py-3.5 px-4">City / Category</th>
                  <th className="py-3.5 px-4">Requester Details</th>
                  <th className="py-3.5 px-4">Notes & Preferences</th>
                  <th className="py-3.5 px-4">Review Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {filteredRequests.map((r) => {
                  const isCityOperational = cities.some(
                    (c) => c.name.toLowerCase() === r.city.toLowerCase()
                  );
                  const isConverted = r.conversionStatus === 'CONVERTED' || Boolean(r.resultingPoolId);

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap text-gray-400 text-[11px]">
                        {formatDateTime(r.createdAt)}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-950 text-sm">{r.productName}</div>
                        {(r.brandPreference || r.modelPreference) && (
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            Pref: {[r.brandPreference, r.modelPreference].filter(Boolean).join(' • ')}
                          </div>
                        )}
                        {(r.similarRequestCount ?? 1) > 1 && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                              <Flame className="w-3 h-3 text-amber-500 fill-amber-500" aria-hidden="true" />
                              {r.similarRequestCount} similar in {r.city}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-900">{r.city}</span>
                          {!isCityOperational && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-orange-100 text-orange-800"
                              title="City not yet operational. Admin must establish vendor coverage before launching pool."
                            >
                              New City
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {r.categoryName || r.category || 'Custom Category'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {r.fullName || r.whatsappNumber ? (
                          <>
                            <div className="font-medium text-gray-900 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" aria-hidden="true" />
                              <span>{r.fullName || 'Anonymous Buyer'}</span>
                            </div>
                            {r.whatsappNumber && (
                              <div className="text-[11px] text-gray-500 font-mono">+91 {r.whatsappNumber}</div>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400 italic">No contact info</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        {r.extraMessage && (
                          <div className="text-gray-700 truncate" title={r.extraMessage}>
                            &ldquo;{r.extraMessage}&rdquo;
                          </div>
                        )}

                        {/* Internal Admin Notes */}
                        <div className="mt-1">
                          {editingNoteId === r.id ? (
                            <div className="space-y-1">
                              <textarea
                                rows={2}
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder="Internal review notes..."
                                className="w-full text-[11px] p-1.5 border border-gray-300 rounded-md outline-hidden resize-none"
                              />
                              <div className="flex gap-1 justify-end">
                                <button
                                  type="button"
                                  disabled={isSavingNote}
                                  onClick={() => handleSaveNote(r.id)}
                                  className="text-[10px] px-2 py-0.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-500"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingNoteId(null)}
                                  className="text-[10px] px-2 py-0.5 bg-gray-200 text-gray-700 rounded-md"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] text-gray-500 italic truncate" title={r.adminNotes || ''}>
                                {r.adminNotes ? `Note: ${r.adminNotes}` : 'No internal note'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingNoteId(r.id);
                                  setNoteText(r.adminNotes || '');
                                }}
                                className="text-gray-400 hover:text-gray-600 p-0.5"
                                title="Edit internal note"
                              >
                                <MessageSquare className="w-3 h-3" aria-hidden="true" />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span
                            className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                              r.status === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : r.status === 'REVIEWING'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : r.status === 'REJECTED'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-gray-100 text-gray-700 border-gray-200'
                            }`}
                          >
                            {REQUEST_STATUS_LABELS[r.status]}
                          </span>

                          {isConverted && (
                            <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                              <Check className="w-3 h-3" aria-hidden="true" />
                              <span>Pool Launched</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {/* Quick status actions */}
                          <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
                            <button
                              type="button"
                              onClick={() => handleStatusChange(r.id, 'APPROVED')}
                              title="Mark Approved"
                              className={`p-1.5 rounded-md hover:bg-white transition-colors ${
                                r.status === 'APPROVED' ? 'bg-emerald-600 text-white hover:bg-emerald-600' : 'text-gray-600'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(r.id, 'REVIEWING')}
                              title="Mark Reviewing"
                              className={`p-1.5 rounded-md hover:bg-white transition-colors ${
                                r.status === 'REVIEWING' ? 'bg-blue-600 text-white hover:bg-blue-600' : 'text-gray-600'
                              }`}
                            >
                              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(r.id, 'REJECTED')}
                              title="Decline"
                              className={`p-1.5 rounded-md hover:bg-white transition-colors ${
                                r.status === 'REJECTED' ? 'bg-rose-600 text-white hover:bg-rose-600' : 'text-gray-600'
                              }`}
                            >
                              <X className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>

                          {/* Conversion button */}
                          {isConverted ? (
                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                              Converted
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openConvertModal(r)}
                              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors"
                            >
                              <Rocket className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Launch Pool</span>
                            </button>
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

      {/* Convert to Operational Pool Modal */}
      {convertingRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-950 flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                  Launch City-Specific Pool
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Convert community request <strong>#{convertingRequest.id.slice(0, 8)}</strong> into an active operational pool.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConvertingRequest(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {convertError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{convertError}</span>
              </div>
            )}

            {convertSuccess ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-4 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <Check className="w-5 h-5" aria-hidden="true" />
                </div>
                <h4 className="text-sm font-bold">City Pool Launched Successfully!</h4>
                <p className="text-xs text-emerald-800">
                  The request is now linked to live pool: <code>{convertSuccess.poolSlug}</code>
                </p>
                <div className="pt-2 flex justify-center gap-2">
                  <Link
                    href={convertSuccess.dealUrl}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                  >
                    <span>View Live Deal</span>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setConvertingRequest(null)}
                    className="text-xs font-semibold px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleExecuteConversion} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Operational City Selector */}
                  <div>
                    <label htmlFor="convert-city" className="block font-semibold text-gray-700 mb-1">
                      Target Operational City <span className="text-emerald-600">*</span>
                    </label>
                    <select
                      id="convert-city"
                      required
                      value={convertForm.citySlug}
                      onChange={(e) => setConvertForm({ ...convertForm, citySlug: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:border-emerald-500 outline-hidden bg-white"
                    >
                      {cities.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.name} ({c.state})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Category Selector */}
                  <div>
                    <label htmlFor="convert-cat" className="block font-semibold text-gray-700 mb-1">
                      Product Category <span className="text-emerald-600">*</span>
                    </label>
                    <select
                      id="convert-cat"
                      required
                      value={convertForm.categorySlug}
                      onChange={(e) => setConvertForm({ ...convertForm, categorySlug: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:border-emerald-500 outline-hidden bg-white"
                    >
                      {categories.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Standardized Product Name */}
                  <div className="sm:col-span-2">
                    <label htmlFor="convert-pname" className="block font-semibold text-gray-700 mb-1">
                      Standardized Product Name <span className="text-emerald-600">*</span>
                    </label>
                    <input
                      id="convert-pname"
                      type="text"
                      required
                      value={convertForm.productName}
                      onChange={(e) => setConvertForm({ ...convertForm, productName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:border-emerald-500 outline-hidden"
                    />
                  </div>

                  {/* Brand & Model */}
                  <div>
                    <label htmlFor="convert-brand" className="block font-semibold text-gray-700 mb-1">
                      Brand
                    </label>
                    <input
                      id="convert-brand"
                      type="text"
                      value={convertForm.productBrand}
                      onChange={(e) => setConvertForm({ ...convertForm, productBrand: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:border-emerald-500 outline-hidden"
                    />
                  </div>

                  <div>
                    <label htmlFor="convert-model" className="block font-semibold text-gray-700 mb-1">
                      Model / Specification
                    </label>
                    <input
                      id="convert-model"
                      type="text"
                      value={convertForm.productModel}
                      onChange={(e) => setConvertForm({ ...convertForm, productModel: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:border-emerald-500 outline-hidden"
                    />
                  </div>

                  {/* Market & Group Price */}
                  <div>
                    <label htmlFor="convert-mprice" className="block font-semibold text-gray-700 mb-1">
                      Market Price (₹, optional)
                    </label>
                    <input
                      id="convert-mprice"
                      type="number"
                      min="0"
                      value={convertForm.marketPrice}
                      onChange={(e) => setConvertForm({ ...convertForm, marketPrice: e.target.value })}
                      placeholder="e.g. 155000"
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:border-emerald-500 outline-hidden"
                    />
                  </div>

                  <div>
                    <label htmlFor="convert-gprice" className="block font-semibold text-gray-700 mb-1">
                      Target Group Price (₹, optional)
                    </label>
                    <input
                      id="convert-gprice"
                      type="number"
                      min="0"
                      value={convertForm.groupPrice}
                      onChange={(e) => setConvertForm({ ...convertForm, groupPrice: e.target.value })}
                      placeholder="e.g. 142000"
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:border-emerald-500 outline-hidden"
                    />
                  </div>

                  {/* Target Buyers & Campaign Duration */}
                  <div>
                    <label htmlFor="convert-tbuyers" className="block font-semibold text-gray-700 mb-1">
                      Target Buyers Required <span className="text-emerald-600">*</span>
                    </label>
                    <input
                      id="convert-tbuyers"
                      type="number"
                      min="1"
                      required
                      value={convertForm.targetBuyers}
                      onChange={(e) => setConvertForm({ ...convertForm, targetBuyers: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:border-emerald-500 outline-hidden"
                    />
                  </div>

                  <div>
                    <label htmlFor="convert-duration" className="block font-semibold text-gray-700 mb-1">
                      Duration (Days) <span className="text-emerald-600">*</span>
                    </label>
                    <input
                      id="convert-duration"
                      type="number"
                      min="1"
                      max="180"
                      required
                      value={convertForm.durationDays}
                      onChange={(e) => setConvertForm({ ...convertForm, durationDays: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:border-emerald-500 outline-hidden"
                    />
                  </div>

                  {/* Verified Dealer Name */}
                  <div className="sm:col-span-2">
                    <label htmlFor="convert-dealer" className="block font-semibold text-gray-700 mb-1">
                      Verified Dealer / Supplier Arrangement (Optional)
                    </label>
                    <input
                      id="convert-dealer"
                      type="text"
                      value={convertForm.dealerName}
                      onChange={(e) => setConvertForm({ ...convertForm, dealerName: e.target.value })}
                      placeholder="e.g. Authorized Ather Experience Center Bhopal"
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:border-emerald-500 outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setConvertingRequest(null)}
                    className="text-xs font-semibold px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isConverting}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors disabled:opacity-50"
                  >
                    {isConverting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        <span>Launching Pool...</span>
                      </>
                    ) : (
                      <>
                        <Rocket className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Confirm & Launch City Pool</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
