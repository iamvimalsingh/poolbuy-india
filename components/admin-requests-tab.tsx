'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Check,
  X,
  AlertCircle,
  Search,
  Rocket,
  MessageSquare,
  Loader2,
  Trash2,
} from 'lucide-react';
import { PoolRequest, PoolRequestStatus, Category } from '@/types';
import { REQUEST_STATUS_LABELS, LAUNCH_CITIES } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';

export function AdminRequestsTab() {
  const [requests, setRequests] = useState<PoolRequest[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCity, setFilterCity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  // Admin note editing modal / inline state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Archive confirmation
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  // Conversion Modal State
  const [convertingRequest, setConvertingRequest] = useState<PoolRequest | null>(null);
  const [convertForm, setConvertForm] = useState({
    title: '',
    description: '',
    categorySlug: '',
    citySlugs: ['delhi', 'mumbai', 'pune'] as string[],
    durationDays: '14',
    isPublished: true,
  });
  const [isConverting, setIsConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertSuccess, setConvertSuccess] = useState<{
    poolId: string;
    poolSlug: string;
    citySlugs: string[];
    isPublished: boolean;
    dealUrl?: string;
  } | null>(null);

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
        const catRes = await fetch('/api/categories');
        const catData = await catRes.json();
        if (!ignore && catData.success) {
          setCategories(catData.data);
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, [loadRequests]);

  const handleStatusChange = async (requestId: string, status: PoolRequestStatus) => {
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/pool-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status } : r))
        );
        setActionSuccessMessage(`Request status updated to ${status}.`);
      } else {
        setErrorMessage(data.error?.message || 'Failed to update request status.');
      }
    } catch {
      setErrorMessage('Network error updating request status.');
    }
  };

  const handleArchiveRequest = async (requestId: string) => {
    setIsArchiving(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/pool-requests/${requestId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error?.message || 'Failed to archive request.');
        return;
      }

      // Safe update only on server success
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setConfirmArchiveId(null);
      setActionSuccessMessage('Request safely archived.');
    } catch {
      setErrorMessage('Network error while archiving request. Row remains visible.');
    } finally {
      setIsArchiving(false);
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

    // Default to requester's specific city to maintain city-isolated pool integrity
    const rawReqCity = (request.cityText || request.city || '').toLowerCase().trim();
    const cleanReqSlug = rawReqCity.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const matchedLaunch = LAUNCH_CITIES.find((c) => c.slug === cleanReqSlug || c.name.toLowerCase() === rawReqCity);
    const initialCitySlugs = matchedLaunch ? [matchedLaunch.slug] : (cleanReqSlug ? [cleanReqSlug] : ['delhi']);

    setConvertForm({
      title: request.productName,
      description: request.requirementsSummary || request.extraMessage || '',
      categorySlug: request.category ? request.category.toLowerCase().replace(/_/g, '-') : '',
      citySlugs: initialCitySlugs,
      durationDays: '14',
      isPublished: true,
    });
  };

  const toggleCitySlug = (slug: string) => {
    setConvertForm((prev) => {
      const exists = prev.citySlugs.includes(slug);
      if (exists) {
        return { ...prev, citySlugs: prev.citySlugs.filter((s) => s !== slug) };
      } else {
        return { ...prev, citySlugs: [...prev.citySlugs, slug] };
      }
    });
  };

  const handleExecuteConversion = async (publish: boolean) => {
    if (!convertingRequest) return;

    if (!convertForm.title.trim()) {
      setConvertError('Pool title is required.');
      return;
    }

    if (publish && convertForm.citySlugs.length === 0) {
      setConvertError('At least one city visibility label is required to publish.');
      return;
    }

    setConvertError(null);
    setIsConverting(true);

    try {
      const payload = {
        title: convertForm.title.trim(),
        productName: convertForm.title.trim(),
        shortDescription: convertForm.description.trim() || undefined,
        categorySlug: convertForm.categorySlug || null,
        citySlug: convertForm.citySlugs[0] || undefined,
        citySlugs: convertForm.citySlugs,
        durationDays: Number(convertForm.durationDays) || 14,
        isPublished: publish,
      };

      const res = await fetch(`/api/admin/pool-requests/${convertingRequest.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setConvertError(data.error?.message || 'Conversion failed. Please try again.');
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
      // Exclude archived by default unless filtering by ARCHIVED
      if (filterStatus === 'all' && (r.status === 'ARCHIVED' || (r as unknown as { isArchived?: boolean }).isArchived)) {
        return false;
      }
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
            Demand Discovery &amp; Pool Requests
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {filteredRequests.length} pending / active
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Review community requests from across India, reject or archive safely, or convert into a shared pool across launch cities.
          </p>
        </div>
      </div>

      {actionSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-700 hover:text-rose-900"
          >
            <X className="w-3.5 h-3.5" />
          </button>
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
            placeholder="Search requirement, location, name..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium"
          />
        </div>

        <div>
          <select
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-xl border border-gray-200 focus:border-emerald-500 outline-hidden bg-white"
          >
            <option value="all">All Locations</option>
            {LAUNCH_CITIES.map((c) => (
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
            <option value="all">All Active Statuses</option>
            <option value="REQUESTED">Pending / Requested</option>
            <option value="REVIEWING">In Review</option>
            <option value="APPROVED">Approved / Converted</option>
            <option value="REJECTED">Rejected</option>
            <option value="ARCHIVED">Archived / Deleted</option>
          </select>
        </div>

        <div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-xl border border-gray-200 focus:border-emerald-500 outline-hidden bg-white"
          >
            <option value="all">All Internal Categories</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            <span>Loading demand requests...</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-xs text-gray-500">
            No demand requests found matching the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Requirement &amp; User</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredRequests.map((r) => {
                  const isConverted = r.conversionStatus === 'CONVERTED' || Boolean(r.resultingPoolId);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 max-w-sm">
                        <div className="font-bold text-gray-950 flex items-center gap-1.5">
                          <span>{r.productName}</span>
                        </div>
                        <div className="text-gray-500 text-[11px] mt-0.5">
                          Requested by <span className="font-semibold text-gray-700">{r.fullName || 'Anonymous'}</span> • {formatDateTime(r.createdAt)}
                        </div>
                        {r.extraMessage && (
                          <div className="text-gray-600 text-[11px] italic mt-0.5" title={r.extraMessage}>
                            &ldquo;{r.extraMessage}&rdquo;
                          </div>
                        )}
                        {/* Internal Admin Note */}
                        <div className="mt-1">
                          {editingNoteId === r.id ? (
                            <div className="space-y-1">
                              <textarea
                                rows={2}
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder="Internal review note..."
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
                                {r.adminNotes ? `Note: ${r.adminNotes}` : 'No note'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingNoteId(r.id);
                                  setNoteText(r.adminNotes || '');
                                }}
                                className="text-gray-400 hover:text-gray-600 p-0.5"
                                title="Edit note"
                              >
                                <MessageSquare className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-gray-700">
                        <div className="font-semibold">{r.city}</div>
                        {r.state && <div className="text-gray-400 text-[11px]">{r.state}</div>}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono text-gray-900 font-medium">
                          {r.whatsappNumber ? `+91 ${r.whatsappNumber}` : 'Not provided'}
                        </div>
                        <div className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                          <Check className="w-3 h-3" /> WhatsApp Opt-in
                        </div>
                        {r.joinPoolConsent ? (
                          <div className="text-[10px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1 mt-1">
                            <Check className="w-3 h-3" /> Buyer #1 Consent: YES
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded inline-flex items-center gap-1 mt-1">
                            Buyer #1 Consent: NO
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            r.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : r.status === 'REJECTED'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : r.status === 'ARCHIVED'
                              ? 'bg-gray-100 text-gray-600 border-gray-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {REQUEST_STATUS_LABELS[r.status] || r.status}
                        </span>
                        {isConverted && (
                          <div className="text-[10px] font-semibold text-emerald-700 mt-0.5">
                            Pool Created
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Convert / Create Pool Button */}
                          {!isConverted && r.status !== 'REJECTED' && r.status !== 'ARCHIVED' && (
                            <button
                              type="button"
                              onClick={() => openConvertModal(r)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors"
                            >
                              <Rocket className="w-3.5 h-3.5" />
                              <span>Create Pool</span>
                            </button>
                          )}

                          {/* Reject Button */}
                          {r.status !== 'REJECTED' && r.status !== 'APPROVED' && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(r.id, 'REJECTED')}
                              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors"
                              title="Reject request"
                            >
                              Reject
                            </button>
                          )}

                          {/* Archive / Delete Button */}
                          {confirmArchiveId === r.id ? (
                            <div className="inline-flex items-center gap-1 bg-rose-50 p-1 rounded-xl border border-rose-200">
                              <span className="text-[10px] text-rose-700 font-bold px-1">Archive?</span>
                              <button
                                type="button"
                                disabled={isArchiving}
                                onClick={() => handleArchiveRequest(r.id)}
                                className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                              >
                                {isArchiving ? '...' : 'Yes'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmArchiveId(null)}
                                className="text-[10px] px-1.5 py-0.5 rounded-lg bg-gray-200 text-gray-700"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmArchiveId(r.id)}
                              className="p-1.5 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Safely archive request"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        )}
      </div>

      {/* Convert to Shared Pool Modal */}
      {convertingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl max-w-xl w-full p-6 space-y-5 animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-950 flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-emerald-600" />
                  <span>Convert Request into Shared Pool</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Creates ONE pool master with shared capacity of 10 and visibility across selected launch cities.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConvertingRequest(null)}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {convertError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{convertError}</span>
              </div>
            )}

            {convertSuccess ? (
              <div className="space-y-4 py-4 text-center">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Pool Created Successfully!</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Pool ID: <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">{convertSuccess.poolId}</code>
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Live across {convertSuccess.citySlugs.length} cities: {convertSuccess.citySlugs.join(', ')}
                  </p>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConvertingRequest(null);
                      setConvertSuccess(null);
                    }}
                    className="text-xs font-semibold px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Consent Status Indicator Banner */}
                {convertingRequest.joinPoolConsent ? (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-xl p-3 text-xs flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-emerald-900">Requester Membership Consent: YES</span>
                      <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                        The requester provided explicit consent. Upon pool creation, they will be automatically enrolled as confirmed Buyer #1 (current buyers = 1).
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-3 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-900">Requester Membership Consent: NO</span>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        The requester did NOT give membership consent. This pool will be created with current buyers = 0 and zero customer membership records created.
                      </p>
                    </div>
                  </div>
                )}

                {/* Public Title */}
                <div>
                  <label htmlFor="convert-title" className="block font-bold text-slate-800 mb-1">
                    Final Public Pool Title <span className="text-emerald-600">*</span>
                  </label>
                  <input
                    id="convert-title"
                    type="text"
                    required
                    value={convertForm.title}
                    onChange={(e) => setConvertForm({ ...convertForm, title: e.target.value })}
                    placeholder="e.g. 2 kW Rooftop Solar System Package"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium"
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="convert-desc" className="block font-bold text-slate-800 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    id="convert-desc"
                    rows={2}
                    value={convertForm.description}
                    onChange={(e) => setConvertForm({ ...convertForm, description: e.target.value })}
                    placeholder="Community buying deal aggregated from verified interest..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium"
                  />
                </div>

                {/* Optional Category */}
                <div>
                  <label htmlFor="convert-cat" className="block font-bold text-slate-800 mb-1">
                    Internal Category (Optional Admin Metadata)
                  </label>
                  <select
                    id="convert-cat"
                    value={convertForm.categorySlug}
                    onChange={(e) => setConvertForm({ ...convertForm, categorySlug: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium"
                  >
                    <option value="">None / Optional</option>
                    {categories.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Live in Cities Multi-Select Chips */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block font-semibold text-gray-700">
                      Live in Launch Cities (Visibility Labels) <span className="text-emerald-600">*</span>
                    </label>
                    <span className="text-[11px] text-gray-500 font-medium">
                      {convertForm.citySlugs.length} selected
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-2">
                    Click to toggle visibility. ONE shared pool count of 10 active + 5 waitlist across all chosen cities.
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-gray-50 rounded-xl border border-gray-200">
                    {LAUNCH_CITIES.map((c) => {
                      const isSelected = convertForm.citySlugs.includes(c.slug);
                      return (
                        <button
                          key={c.slug}
                          type="button"
                          onClick={() => toggleCitySlug(c.slug)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label htmlFor="convert-days" className="block font-semibold text-gray-700 mb-1">
                    Campaign Duration (Days)
                  </label>
                  <input
                    id="convert-days"
                    type="number"
                    min="1"
                    max="180"
                    value={convertForm.durationDays}
                    onChange={(e) => setConvertForm({ ...convertForm, durationDays: e.target.value })}
                    className="w-32 px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setConvertingRequest(null)}
                    className="text-xs font-semibold px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={isConverting}
                    onClick={() => handleExecuteConversion(false)}
                    className="text-xs font-semibold px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-colors disabled:opacity-50"
                  >
                    Save as Draft
                  </button>

                  <button
                    type="button"
                    disabled={isConverting}
                    onClick={() => handleExecuteConversion(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors disabled:opacity-50"
                  >
                    {isConverting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Publishing...</span>
                      </>
                    ) : (
                      <>
                        <Rocket className="w-3.5 h-3.5" />
                        <span>Create &amp; Publish</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
