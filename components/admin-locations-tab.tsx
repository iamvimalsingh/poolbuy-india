'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  ToggleLeft,
  ToggleRight,
  MapPin,
  Loader2,
  Search,
  Filter,
  Check,
  Ban,
  Clock,
  Building,
} from 'lucide-react';
import { City, LocationRequest } from '@/types';
import { slugify } from '@/lib/format';
import { INDIA_LOCATION_DIRECTORY } from '@/lib/location-directory';

interface CityDependencies {
  poolsCount: number;
  poolCitiesCount: number;
  requestsCount: number;
  totalDependencies: number;
}

export function AdminLocationsTab() {
  const [cities, setCities] = useState<City[]>([]);
  const [locationRequests, setLocationRequests] = useState<LocationRequest[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'cities' | 'requests'>('cities');

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search & Filter state for cities
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Filter state for location requests
  const [reqStatusFilter, setReqStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  // Create city modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newState, setNewState] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newIsActive, setNewIsActive] = useState(true);

  // Edit city modal state
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [editName, setEditName] = useState('');
  const [editState, setEditState] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  // View city details modal state
  const [viewingCity, setViewingCity] = useState<City | null>(null);
  const [viewingDependencies, setViewingDependencies] = useState<CityDependencies | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Delete city modal state
  const [deletingCity, setDeletingCity] = useState<City | null>(null);
  const [deleteDependencies, setDeleteDependencies] = useState<CityDependencies | null>(null);
  const [isCheckingDelete, setIsCheckingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Action on location request
  const [processingReqId, setProcessingReqId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [citiesRes, reqsRes] = await Promise.all([
        fetch('/api/admin/cities'),
        fetch('/api/admin/location-requests'),
      ]);

      const citiesData = await citiesRes.json();
      if (citiesData.success && Array.isArray(citiesData.data)) {
        setCities(citiesData.data);
      }

      const reqsData = await reqsRes.json();
      if (reqsData.success && Array.isArray(reqsData.data)) {
        setLocationRequests(reqsData.data);
      }
    } catch {
      setErrorMessage('Network error loading location directory.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    void (async () => {
      if (!ignore) await loadData();
    })();
    return () => {
      ignore = true;
    };
  }, []);

  // Distinct states list for filtering and creation
  const allStatesList = useMemo(() => {
    const fromDir = INDIA_LOCATION_DIRECTORY.map((s) => s.name);
    const fromConfigured = cities.map((c) => c.state).filter(Boolean);
    return Array.from(new Set([...fromDir, ...fromConfigured])).sort();
  }, [cities]);

  // Filtered cities list
  const filteredCities = useMemo(() => {
    return cities.filter((city) => {
      const matchesSearch =
        searchQuery === '' ||
        city.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        city.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
        city.slug.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesState = stateFilter === 'ALL' || city.state === stateFilter;

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && city.isActive) ||
        (statusFilter === 'INACTIVE' && !city.isActive);

      return matchesSearch && matchesState && matchesStatus;
    });
  }, [cities, searchQuery, stateFilter, statusFilter]);

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return locationRequests.filter((req) => {
      if (reqStatusFilter === 'ALL') return true;
      return req.status === reqStatusFilter;
    });
  }, [locationRequests, reqStatusFilter]);

  const pendingRequestsCount = useMemo(() => {
    return locationRequests.filter((r) => r.status === 'PENDING').length;
  }, [locationRequests]);

  const handleToggleCity = async (city: City) => {
    setErrorMessage(null);
    setSuccessMessage(null);
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

  const handleCreateCity = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setIsSaving(true);

    const generatedSlug = newSlug.trim() ? slugify(newSlug.trim()) : slugify(newName.trim());

    try {
      const res = await fetch('/api/admin/cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          state: newState.trim(),
          slug: generatedSlug,
          isActive: newIsActive,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setModalError(data.error?.message || 'Failed to create city.');
        return;
      }

      setCities((prev) => [...prev, data.data].sort((a, b) => a.name.localeCompare(b.name)));
      setIsCreateOpen(false);
      setNewName('');
      setNewState('');
      setNewSlug('');
      setNewIsActive(true);
      setSuccessMessage(`City "${data.data.name}" added to authoritative directory.`);
    } catch {
      setModalError('Network error creating city.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenEdit = (city: City) => {
    setEditingCity(city);
    setEditName(city.name);
    setEditState(city.state);
    setEditSlug(city.slug);
    setEditIsActive(city.isActive);
    setModalError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCity) return;
    setModalError(null);
    setIsSaving(true);

    try {
      const res = await fetch(`/api/admin/cities/${editingCity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          state: editState.trim(),
          slug: editSlug.trim() ? slugify(editSlug.trim()) : undefined,
          isActive: editIsActive,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setModalError(data.error?.message || 'Failed to save city changes.');
        return;
      }

      setCities((prev) =>
        prev
          .map((c) => (c.id === editingCity.id ? data.data : c))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingCity(null);
      setSuccessMessage(`City "${editName}" updated successfully.`);
    } catch {
      setModalError('Network error saving city.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDetails = async (city: City) => {
    setViewingCity(city);
    setViewingDependencies(null);
    setIsLoadingDetails(true);

    try {
      const res = await fetch(`/api/admin/cities/${city.id}`);
      const data = await res.json();
      if (data.success && data.data?.dependencies) {
        setViewingDependencies(data.data.dependencies);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleOpenDelete = async (city: City) => {
    setDeletingCity(city);
    setDeleteDependencies(null);
    setIsCheckingDelete(true);
    setModalError(null);

    try {
      const res = await fetch(`/api/admin/cities/${city.id}`);
      const data = await res.json();
      if (data.success && data.data?.dependencies) {
        setDeleteDependencies(data.data.dependencies);
      }
    } catch {
      // Fallback
    } finally {
      setIsCheckingDelete(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCity) return;
    setIsDeleting(true);
    setModalError(null);

    try {
      const res = await fetch(`/api/admin/cities/${deletingCity.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setModalError(data.error?.message || 'Deletion failed.');
        if (data.error?.dependencies) {
          setDeleteDependencies(data.error.dependencies);
        }
        return;
      }

      setCities((prev) => prev.filter((c) => c.id !== deletingCity.id));
      setSuccessMessage(`City "${deletingCity.name}" deleted successfully.`);
      setDeletingCity(null);
    } catch {
      setModalError('Network error deleting city.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleApproveRequest = async (req: LocationRequest) => {
    setProcessingReqId(req.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/admin/location-requests/${req.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error?.message || 'Failed to approve location request.');
        return;
      }

      setLocationRequests((prev) =>
        prev.map((r) => (r.id === req.id ? { ...r, status: 'APPROVED' } : r))
      );
      setSuccessMessage(`Location "${req.cityName}, ${req.stateName}" approved and added to active cities!`);
      // Reload cities to update directory
      void loadData();
    } catch {
      setErrorMessage('Network error approving location request.');
    } finally {
      setProcessingReqId(null);
    }
  };

  const handleRejectRequest = async (req: LocationRequest) => {
    setProcessingReqId(req.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/admin/location-requests/${req.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECT' }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error?.message || 'Failed to reject location request.');
        return;
      }

      setLocationRequests((prev) =>
        prev.map((r) => (r.id === req.id ? { ...r, status: 'REJECTED' } : r))
      );
      setSuccessMessage(`Location request for "${req.cityName}" rejected.`);
    } catch {
      setErrorMessage('Network error rejecting location request.');
    } finally {
      setProcessingReqId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            Location & City Management
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {cities.filter((c) => c.isActive).length} active of {cities.length} configured
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Configure state and city markets, inspect dependent pools/requests, and review user-entered location requests.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsCreateOpen(true);
            setModalError(null);
          }}
          className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Location</span>
        </button>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl p-3.5 flex items-center justify-between animate-scale-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3.5 flex items-center justify-between animate-scale-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-700 hover:text-rose-900 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sub-Tabs: Configured Cities vs User-Requested Locations */}
      <div className="flex border-b border-gray-200 gap-4">
        <button
          type="button"
          onClick={() => setActiveSubTab('cities')}
          className={`flex items-center gap-2 pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${activeSubTab === 'cities'
            ? 'border-emerald-600 text-emerald-700'
            : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
        >
          <Building className="w-4 h-4" />
          <span>Configured Cities ({cities.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('requests')}
          className={`flex items-center gap-2 pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${activeSubTab === 'requests'
            ? 'border-emerald-600 text-emerald-700'
            : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
        >
          <Clock className="w-4 h-4" />
          <span>User Location Requests</span>
          {pendingRequestsCount > 0 && (
            <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
              {pendingRequestsCount} Pending
            </span>
          )}
        </button>
      </div>

      {activeSubTab === 'cities' ? (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3.5 rounded-2xl border border-gray-200/80 shadow-xs">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search city, state or slug..."
                className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-gray-200 bg-slate-50 text-slate-900 placeholder:text-gray-400 focus:bg-white focus:border-emerald-600 outline-hidden font-medium"
              />
            </div>

            <div>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-gray-200 bg-white text-slate-800 font-medium focus:border-emerald-600 outline-hidden"
              >
                <option value="ALL">All States ({allStatesList.length})</option>
                {allStatesList.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
                className="w-full text-xs px-3 py-2 rounded-xl border border-gray-200 bg-white text-slate-800 font-medium focus:border-emerald-600 outline-hidden"
              >
                <option value="ALL">All Statuses ({cities.length})</option>
                <option value="ACTIVE">Active Markets ({cities.filter((c) => c.isActive).length})</option>
                <option value="INACTIVE">Inactive Markets ({cities.filter((c) => !c.isActive).length})</option>
              </select>
            </div>
          </div>

          {/* Cities Table */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
            {isLoading ? (
              <div className="py-12 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Loading configured cities...</span>
              </div>
            ) : filteredCities.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-500 space-y-2">
                <MapPin className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="font-semibold text-gray-700">No configured cities match criteria.</p>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setStateFilter('ALL');
                    }}
                    className="text-emerald-700 underline text-xs cursor-pointer"
                  >
                    Reset filters
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100">
                    <tr>
                      <th className="py-3.5 px-4">City</th>
                      <th className="py-3.5 px-4">State</th>
                      <th className="py-3.5 px-4">URL Slug</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {filteredCities.map((city) => (
                      <tr key={city.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2 font-bold text-gray-950 text-sm">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{city.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-gray-900">{city.state}</td>
                        <td className="py-3.5 px-4">
                          <code className="text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">
                            /city/{city.slug}
                          </code>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleCity(city)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors cursor-pointer ${city.isActive
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                              }`}
                          >
                            {city.isActive ? (
                              <>
                                <ToggleRight className="w-4 h-4 text-emerald-600" />
                                <span>Active Market</span>
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-4 h-4 text-gray-400" />
                                <span>Inactive</span>
                              </>
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenDetails(city)}
                              title="View Details & Dependencies"
                              className="inline-flex items-center p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(city)}
                              title="Edit City"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDelete(city)}
                              title="Delete City"
                              className="inline-flex items-center p-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* USER LOCATION REQUESTS SUB-TAB */
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-gray-200/80 shadow-xs">
            <div className="text-xs text-gray-500">
              Users submit towns when proposing pools from locations not yet in the official directory.
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700">Filter Status:</span>
              <select
                value={reqStatusFilter}
                onChange={(e) => setReqStatusFilter(e.target.value as 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED')}
                className="text-xs px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-slate-800 font-medium focus:border-emerald-600 outline-hidden"
              >
                <option value="ALL">All ({locationRequests.length})</option>
                <option value="PENDING">Pending Only ({pendingRequestsCount})</option>
                <option value="APPROVED">Approved ({locationRequests.filter((r) => r.status === 'APPROVED').length})</option>
                <option value="REJECTED">Rejected ({locationRequests.filter((r) => r.status === 'REJECTED').length})</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
            {filteredRequests.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-500">
                No user location requests found in this category.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100">
                    <tr>
                      <th className="py-3 px-4">Requested City</th>
                      <th className="py-3 px-4">State</th>
                      <th className="py-3 px-4">Requester Phone</th>
                      <th className="py-3 px-4">Submitted Date</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Review Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {filteredRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-gray-950 text-sm">
                          {req.cityName}
                        </td>
                        <td className="py-3.5 px-4 text-gray-800">{req.stateName}</td>
                        <td className="py-3.5 px-4 font-mono text-gray-600">
                          {req.requestedByPhone || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-gray-500">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${req.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : req.status === 'REJECTED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                              }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {req.status === 'PENDING' ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                disabled={processingReqId === req.id}
                                onClick={() => handleApproveRequest(req)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Approve & Add</span>
                              </button>
                              <button
                                type="button"
                                disabled={processingReqId === req.id}
                                onClick={() => handleRejectRequest(req)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                              >
                                <Ban className="w-3.5 h-3.5 text-rose-500" />
                                <span>Reject</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-gray-400">Processed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE CITY MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-950 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600" />
                <span>Add Operational Location</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCity} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  State / Region <span className="text-emerald-600">*</span>
                </label>
                <select
                  required
                  value={newState}
                  onChange={(e) => setNewState(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium focus:border-emerald-600 outline-hidden"
                >
                  <option value="">Select State</option>
                  {allStatesList.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  City Name <span className="text-emerald-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (!newSlug) {
                      setNewSlug(slugify(e.target.value));
                    }
                  }}
                  placeholder="e.g. Pune, Bhopal, Surat"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 outline-hidden font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  URL Slug <span className="text-slate-400 font-normal">(Auto-generated if blank)</span>
                </label>
                <input
                  type="text"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="e.g. pune"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 outline-hidden font-mono font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Active Market Status
                </label>
                <button
                  type="button"
                  onClick={() => setNewIsActive(!newIsActive)}
                  className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${newIsActive
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-slate-300 bg-slate-50 text-slate-600'
                    }`}
                >
                  {newIsActive ? 'Active Market' : 'Inactive'}
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSaving ? 'Adding...' : 'Add Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CITY MODAL */}
      {editingCity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-950 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-emerald-600" />
                <span>Edit Location</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingCity(null)}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  City Name <span className="text-emerald-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 outline-hidden font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  State / Region <span className="text-emerald-600">*</span>
                </label>
                <select
                  required
                  value={editState}
                  onChange={(e) => setEditState(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium focus:border-emerald-600 outline-hidden"
                >
                  {allStatesList.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  URL Slug
                </label>
                <input
                  type="text"
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono font-medium focus:border-emerald-600 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Operational Status
                </label>
                <button
                  type="button"
                  onClick={() => setEditIsActive(!editIsActive)}
                  className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${editIsActive
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-slate-300 bg-slate-50 text-slate-600'
                    }`}
                >
                  {editIsActive ? 'Active Market' : 'Inactive'}
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingCity(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW CITY DETAILS MODAL */}
      {viewingCity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-950 flex items-center gap-2">
                <Eye className="w-5 h-5 text-emerald-600" />
                <span>Location Details & Dependencies</span>
              </h3>
              <button
                type="button"
                onClick={() => setViewingCity(null)}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-gray-400 font-semibold block text-[11px]">City Name</span>
                  <span className="font-bold text-gray-950 text-sm">{viewingCity.name}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-semibold block text-[11px]">State / Region</span>
                  <span className="font-bold text-gray-800">{viewingCity.state}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-semibold block text-[11px]">URL Path</span>
                  <code className="font-mono text-gray-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                    /city/{viewingCity.slug}
                  </code>
                </div>
                <div>
                  <span className="text-gray-400 font-semibold block text-[11px]">Operational Status</span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${viewingCity.isActive
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-gray-200 text-gray-700'
                      }`}
                  >
                    {viewingCity.isActive ? 'ACTIVE MARKET' : 'INACTIVE'}
                  </span>
                </div>
              </div>

              {/* Dependencies Summary */}
              <div className="border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between font-bold text-gray-900">
                  <span>Referenced Dependencies</span>
                  {isLoadingDetails && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />}
                </div>

                {viewingDependencies ? (
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="p-2.5 bg-slate-50 rounded-xl">
                      <div className="text-base font-black text-gray-950">{viewingDependencies.poolsCount}</div>
                      <div className="text-[10px] text-gray-500 font-semibold uppercase">Pools</div>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl">
                      <div className="text-base font-black text-gray-950">{viewingDependencies.poolCitiesCount}</div>
                      <div className="text-[10px] text-gray-500 font-semibold uppercase">Pool Cities</div>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl">
                      <div className="text-base font-black text-gray-950">{viewingDependencies.requestsCount}</div>
                      <div className="text-[10px] text-gray-500 font-semibold uppercase">Requests</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-400 text-[11px]">Checking database references...</div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setViewingCity(null)}
                className="px-4 py-2 rounded-xl bg-gray-950 hover:bg-gray-800 text-white font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingCity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-950 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-600" />
                <span>Delete Location</span>
              </h3>
              <button
                type="button"
                onClick={() => setDeletingCity(null)}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs text-gray-600">
              <p>
                Are you sure you want to delete city <strong>&ldquo;{deletingCity.name}&rdquo;</strong> ({deletingCity.state})?
              </p>

              {isCheckingDelete ? (
                <div className="p-3 bg-slate-50 rounded-xl text-center flex items-center justify-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>Checking dependent records...</span>
                </div>
              ) : deleteDependencies && deleteDependencies.totalDependencies > 0 ? (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Hard Deletion Blocked (Dependencies Exist)</span>
                  </div>
                  <p>
                    This city is referenced by{' '}
                    <strong>{deleteDependencies.poolsCount} pool(s)</strong>,{' '}
                    <strong>{deleteDependencies.poolCitiesCount} pool-city mapping(s)</strong>, and{' '}
                    <strong>{deleteDependencies.requestsCount} demand request(s)</strong>.
                  </p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    To maintain historical integrity and prevent cascading deletion of buyer records, hard deletion is blocked. Deactivate the city instead to remove it from new public requests.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      void handleToggleCity(deletingCity);
                      setDeletingCity(null);
                    }}
                    className="w-full mt-2 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                  >
                    Deactivate Market Instead
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-[11px]">
                  No dependent pools, mappings, or requests found. Safe to delete.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setDeletingCity(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer font-semibold text-xs"
              >
                Cancel
              </button>
              {(!deleteDependencies || deleteDependencies.totalDependencies === 0) && (
                <button
                  type="button"
                  disabled={isCheckingDelete || isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

