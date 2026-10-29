'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  MapPin,
  Loader2,
  Search,
  Building,
  ShoppingBag,
  PauseCircle,
  PlayCircle,
  Rocket,
} from 'lucide-react';
import { Campaign, AdminPool, Category, City, PoolStatus, CampaignStatus } from '@/types';
import { formatINR } from '@/lib/format';
import { AdminGroupDetailModal } from './admin-group-detail-modal';

interface CampaignDependencyInfo {
  poolsCount: number;
  leadsCount: number;
  requestsCount: number;
  quotationsCount: number;
  totalDependencies: number;
}

interface PoolDependencyInfo {
  leadsCount: number;
  waitlistCount: number;
  requestsCount: number;
  quotationsCount: number;
  totalDependencies: number;
}

export function AdminCampaignsTab() {
  const [subTab, setSubTab] = useState<'campaigns' | 'pools'>('campaigns');

  // Core Data
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pools, setPools] = useState<AdminPool[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Alerts
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [isCreateCampaignOpen, setIsCreateCampaignOpen] = useState(false);
  const [viewCampaign, setViewCampaign] = useState<Campaign | null>(null);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [deleteCampaignTarget, setDeleteCampaignTarget] = useState<Campaign | null>(null);
  const [campaignDependencies, setCampaignDependencies] = useState<CampaignDependencyInfo | null>(null);
  const [isCheckingCampaignDeps, setIsCheckingCampaignDeps] = useState(false);

  // City Pools Modals
  const [viewPool, setViewPool] = useState<AdminPool | null>(null);
  const [editPool, setEditPool] = useState<AdminPool | null>(null);
  const [deletePoolTarget, setDeletePoolTarget] = useState<AdminPool | null>(null);
  const [poolDependencies, setPoolDependencies] = useState<PoolDependencyInfo | null>(null);
  const [isCheckingPoolDeps, setIsCheckingPoolDeps] = useState(false);
  const [isAddCityOpen, setIsAddCityOpen] = useState(false);
  const [targetCampaignForCity, setTargetCampaignForCity] = useState<Campaign | null>(null);

  // Form Submissions
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load Data
  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const [campRes, poolRes, catRes, cityRes] = await Promise.all([
        fetch('/api/admin/campaigns').then((r) => r.json()),
        fetch('/api/admin/pools').then((r) => r.json()),
        fetch('/api/categories').then((r) => r.json()),
        fetch('/api/cities').then((r) => r.json()),
      ]);

      if (campRes.success && Array.isArray(campRes.data)) setCampaigns(campRes.data);
      if (poolRes.success && Array.isArray(poolRes.data)) setPools(poolRes.data);
      if (catRes.success && Array.isArray(catRes.data)) setCategories(catRes.data);
      if (cityRes.success && Array.isArray(cityRes.data)) setCities(cityRes.data);
    } catch {
      setAlertMessage({ type: 'error', text: 'Failed to load campaigns and pools data.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    void (async () => {
      if (!ignore) {
        await loadData(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [loadData]);

  // Active Categories & Operational Cities
  const activeCategories = useMemo(() => categories.filter((c) => c.isActive), [categories]);
  const activeCities = useMemo(() => cities.filter((c) => c.isActive), [cities]);

  // Filtered Campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((camp) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = camp.title.toLowerCase().includes(q);
        const matchesBrand = camp.brand?.toLowerCase().includes(q);
        const matchesModel = camp.model?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesBrand && !matchesModel) return false;
      }
      if (selectedCategory !== 'all' && camp.categorySlug !== selectedCategory) return false;
      if (selectedStatus !== 'all' && camp.status !== selectedStatus) return false;
      if (selectedCity !== 'all') {
        const hasCity = camp.cityPools?.some((p) => p.citySlug.toLowerCase() === selectedCity.toLowerCase());
        if (!hasCity) return false;
      }
      return true;
    });
  }, [campaigns, searchQuery, selectedCategory, selectedStatus, selectedCity]);

  // Filtered Pools
  const filteredPools = useMemo(() => {
    return pools.filter((pool) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = pool.name.toLowerCase().includes(q);
        const matchesTitle = pool.productTitle?.toLowerCase().includes(q);
        const matchesCity = pool.city.toLowerCase().includes(q);
        if (!matchesName && !matchesTitle && !matchesCity) return false;
      }
      if (selectedCategory !== 'all' && pool.categorySlug !== selectedCategory && pool.category !== selectedCategory) return false;
      if (selectedCity !== 'all' && pool.citySlug.toLowerCase() !== selectedCity.toLowerCase()) return false;
      if (selectedStatus !== 'all' && pool.status !== selectedStatus) return false;
      return true;
    });
  }, [pools, searchQuery, selectedCategory, selectedCity, selectedStatus]);

  // --------------------------------------------------------------------------
  // CREATE MULTI-CITY CAMPAIGN FORM STATE
  // --------------------------------------------------------------------------
  const [campTitle, setCampTitle] = useState('');
  const [campCategorySlug, setCampCategorySlug] = useState('');
  const [campBrand, setCampBrand] = useState('');
  const [campModel, setCampModel] = useState('');
  const [campVariant, setCampVariant] = useState('');
  const [campShortDesc, setCampShortDesc] = useState('');
  const [campLongDesc, setCampLongDesc] = useState('');
  const [campMarketPrice, setCampMarketPrice] = useState('');
  const [campGroupPrice, setCampGroupPrice] = useState('');
  const [campTargetBuyers, setCampTargetBuyers] = useState('10');
  const [campSelectedCities, setCampSelectedCities] = useState<string[]>([]);
  const [campCityOverrides, setCampCityOverrides] = useState<Record<string, { targetBuyers?: number; deadline?: string }>>({});
  const [campDefaultDeadline, setCampDefaultDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });

  const handleOpenCreateCampaign = () => {
    setCampTitle('');
    setCampCategorySlug(activeCategories[0]?.slug || '');
    setCampBrand('');
    setCampModel('');
    setCampVariant('');
    setCampShortDesc('');
    setCampLongDesc('');
    setCampMarketPrice('');
    setCampGroupPrice('');
    setCampTargetBuyers('10');
    setCampSelectedCities([]);
    setCampCityOverrides({});
    setIsCreateCampaignOpen(true);
  };

  const toggleCitySelection = (citySlug: string) => {
    setCampSelectedCities((prev) =>
      prev.includes(citySlug) ? prev.filter((s) => s !== citySlug) : [...prev, citySlug]
    );
  };

  const selectAllActiveCities = () => {
    setCampSelectedCities(activeCities.map((c) => c.slug));
  };

  const clearAllCities = () => {
    setCampSelectedCities([]);
  };

  const handleCreateCampaignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campTitle.trim()) {
      setAlertMessage({ type: 'error', text: 'Campaign/Product title is required.' });
      return;
    }
    if (!campCategorySlug) {
      setAlertMessage({ type: 'error', text: 'Please select a product category.' });
      return;
    }
    if (campSelectedCities.length === 0) {
      setAlertMessage({ type: 'error', text: 'Select at least one city to create independent city pools.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const citiesPayload = campSelectedCities.map((slug) => {
        const cityObj = activeCities.find((c) => c.slug === slug);
        const override = campCityOverrides[slug];
        return {
          cityName: cityObj?.name || slug,
          citySlug: slug,
          targetBuyers: override?.targetBuyers || Number(campTargetBuyers) || 10,
          deadline: override?.deadline
            ? new Date(override.deadline).toISOString()
            : new Date(campDefaultDeadline).toISOString(),
        };
      });

      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: campTitle.trim(),
          categorySlug: campCategorySlug,
          brand: campBrand.trim(),
          model: campModel.trim(),
          variantName: campVariant.trim(),
          shortDescription: campShortDesc.trim(),
          longDescription: campLongDesc.trim(),
          defaultMarketPrice: campMarketPrice ? Number(campMarketPrice) : null,
          defaultGroupPrice: campGroupPrice ? Number(campGroupPrice) : null,
          defaultTargetBuyers: Number(campTargetBuyers) || 10,
          defaultDeadline: new Date(campDefaultDeadline).toISOString(),
          cities: citiesPayload,
          status: 'ACTIVE',
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to create campaign.');
      }

      setAlertMessage({
        type: 'success',
        text: `Created campaign "${json.data.campaign.title}" across ${json.data.pools.length} independent city pools!`,
      });
      setIsCreateCampaignOpen(false);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Creation failed.';
      setAlertMessage({ type: 'error', text: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // EDIT CAMPAIGN
  // --------------------------------------------------------------------------
  const handleOpenEditCampaign = (campaign: Campaign) => {
    setEditCampaign({ ...campaign });
  };

  const handleEditCampaignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCampaign) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${editCampaign.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editCampaign.title,
          brand: editCampaign.brand,
          model: editCampaign.model,
          variantName: editCampaign.variantName,
          shortDescription: editCampaign.shortDescription,
          longDescription: editCampaign.longDescription,
          defaultMarketPrice: editCampaign.defaultMarketPrice,
          defaultGroupPrice: editCampaign.defaultGroupPrice,
          defaultTargetBuyers: editCampaign.defaultTargetBuyers,
          status: editCampaign.status,
          isPublished: editCampaign.isPublished,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to update campaign.');
      }

      setAlertMessage({ type: 'success', text: `Campaign "${editCampaign.title}" updated successfully.` });
      setEditCampaign(null);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update failed.';
      setAlertMessage({ type: 'error', text: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // DELETE / ARCHIVE CAMPAIGN
  // --------------------------------------------------------------------------
  const handleOpenDeleteCampaign = async (campaign: Campaign) => {
    setDeleteCampaignTarget(campaign);
    setIsCheckingCampaignDeps(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}`).then((r) => r.json());
      if (res.success && res.data.dependencies) {
        setCampaignDependencies(res.data.dependencies);
      }
    } catch {
      setCampaignDependencies(null);
    } finally {
      setIsCheckingCampaignDeps(false);
    }
  };

  const executeDeleteCampaign = async (hard: boolean) => {
    if (!deleteCampaignTarget) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${deleteCampaignTarget.id}?hard=${hard ? 'true' : 'false'}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to delete campaign.');
      }

      setAlertMessage({
        type: 'success',
        text: hard
          ? `Campaign "${deleteCampaignTarget.title}" and its empty city pools deleted.`
          : `Campaign "${deleteCampaignTarget.title}" archived. Historical records preserved.`,
      });
      setDeleteCampaignTarget(null);
      setCampaignDependencies(null);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed.';
      setAlertMessage({ type: 'error', text: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // ADD CITY TO EXISTING CAMPAIGN
  // --------------------------------------------------------------------------
  const [newCitySlug, setNewCitySlug] = useState('');
  const [newCityTargetBuyers, setNewCityTargetBuyers] = useState('10');
  const [newCityDeadline, setNewCityDeadline] = useState('');

  const handleOpenAddCity = (campaign: Campaign) => {
    setTargetCampaignForCity(campaign);
    // Find first active city not already under campaign
    const existingSlugs = new Set(campaign.cityPools?.map((p) => p.citySlug.toLowerCase()) || []);
    const available = activeCities.filter((c) => !existingSlugs.has(c.slug.toLowerCase()));
    setNewCitySlug(available[0]?.slug || '');
    setNewCityTargetBuyers(String(campaign.defaultTargetBuyers || 10));
    setNewCityDeadline(() => {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      return d.toISOString().split('T')[0];
    });
    setIsAddCityOpen(true);
  };

  const handleAddCitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCampaignForCity || !newCitySlug) return;

    setIsSubmitting(true);
    try {
      const cityObj = activeCities.find((c) => c.slug === newCitySlug);
      const res = await fetch(`/api/admin/campaigns/${targetCampaignForCity.id}/cities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cityName: cityObj?.name || newCitySlug,
          citySlug: newCitySlug,
          targetBuyers: Number(newCityTargetBuyers) || 10,
          deadline: newCityDeadline ? new Date(newCityDeadline).toISOString() : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to add city pool.');
      }

      setAlertMessage({
        type: 'success',
        text: `Added new independent city pool in ${json.data.city} to campaign "${targetCampaignForCity.title}"!`,
      });
      setIsAddCityOpen(false);
      setTargetCampaignForCity(null);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add city.';
      setAlertMessage({ type: 'error', text: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // CANONICAL 25-CITY BULK ROLLOUT WORKFLOW
  // --------------------------------------------------------------------------
  const [rolloutCampaign, setRolloutCampaign] = useState<Campaign | null>(null);
  const [rolloutPreview, setRolloutPreview] = useState<{
    campaignId: string;
    campaignTitle: string;
    totalCities: number;
    readyToCreateCount: number;
    alreadyExistsCount: number;
    invalidCount: number;
    cities: {
      citySlug: string;
      cityName: string;
      state: string;
      status: 'READY_TO_CREATE' | 'ALREADY_EXISTS' | 'INACTIVE' | 'NOT_FOUND';
      existingPoolId?: string;
      currentBuyers?: number;
      targetBuyers?: number;
      poolStatus?: string;
    }[];
  } | null>(null);
  const [isLoadingRollout, setIsLoadingRollout] = useState(false);
  const [isExecutingRollout, setIsExecutingRollout] = useState(false);
  const [rolloutResult, setRolloutResult] = useState<{
    campaignId: string;
    campaignTitle: string;
    totalRequested: number;
    createdCount: number;
    existingCount: number;
    failedCount: number;
    results: {
      citySlug: string;
      cityName: string;
      status: 'CREATED' | 'ALREADY_EXISTS' | 'FAILED' | 'SKIPPED';
      poolId?: string;
      reason: string;
      currentBuyers?: number;
    }[];
  } | null>(null);

  const handleOpenRollout = async (campaign: Campaign) => {
    setRolloutCampaign(campaign);
    setRolloutResult(null);
    setRolloutPreview(null);
    setIsLoadingRollout(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}/rollout`);
      const json = await res.json();
      if (json.success) {
        setRolloutPreview(json.data);
      } else {
        throw new Error(json.error?.message || 'Failed to load rollout preview.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Preview error.';
      setAlertMessage({ type: 'error', text: msg });
      setRolloutCampaign(null);
    } finally {
      setIsLoadingRollout(false);
    }
  };

  const handleExecuteRollout = async () => {
    if (!rolloutCampaign) return;
    setIsExecutingRollout(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${rolloutCampaign.id}/rollout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to execute rollout.');
      }
      setRolloutResult(json.data);
      setAlertMessage({
        type: 'success',
        text: `25-City Rollout completed for "${rolloutCampaign.title}": ${json.data.createdCount} created, ${json.data.existingCount} already present!`,
      });
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Execution error.';
      setAlertMessage({ type: 'error', text: msg });
    } finally {
      setIsExecutingRollout(false);
    }
  };

  // --------------------------------------------------------------------------
  // POOL LIFECYCLE & STATUS ACTIONS
  // --------------------------------------------------------------------------
  const handleTogglePoolStatus = async (pool: AdminPool, targetStatus: PoolStatus) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/pools/${pool.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Status update failed.');
      }

      setAlertMessage({
        type: 'success',
        text: `Pool "${pool.name}" status updated to ${targetStatus}.`,
      });
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed.';
      setAlertMessage({ type: 'error', text: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // DELETE SINGLE CITY POOL
  // --------------------------------------------------------------------------
  const handleOpenDeletePool = async (pool: AdminPool) => {
    setDeletePoolTarget(pool);
    setIsCheckingPoolDeps(true);
    try {
      const res = await fetch(`/api/admin/pools/${pool.id}`).then((r) => r.json());
      if (res.success && res.data.dependencies) {
        setPoolDependencies(res.data.dependencies);
      }
    } catch {
      setPoolDependencies(null);
    } finally {
      setIsCheckingPoolDeps(false);
    }
  };

  const executeDeletePool = async (hard: boolean) => {
    if (!deletePoolTarget) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/pools/${deletePoolTarget.id}?hard=${hard ? 'true' : 'false'}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Delete operation failed.');
      }

      setAlertMessage({
        type: 'success',
        text: hard
          ? `City pool "${deletePoolTarget.name}" deleted successfully.`
          : `City pool "${deletePoolTarget.name}" closed/archived. Historical memberships intact.`,
      });
      setDeletePoolTarget(null);
      setPoolDependencies(null);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete pool.';
      setAlertMessage({ type: 'error', text: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // EDIT CITY POOL SETTINGS
  // --------------------------------------------------------------------------
  const handleEditPoolSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPool) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/pools/${editPool.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetBuyers: editPool.targetBuyers,
          deadline: editPool.deadline,
          status: editPool.status,
          isPublished: editPool.isPublished,
          marketPrice: editPool.marketPrice,
          groupPrice: editPool.groupPrice,
          variantName: editPool.variantName,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to update city pool.');
      }

      setAlertMessage({
        type: 'success',
        text: `City pool settings for "${editPool.city}" updated in strict isolation.`,
      });
      setEditPool(null);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update failed.';
      setAlertMessage({ type: 'error', text: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Alert */}
      {alertMessage && (
        <div
          className={`p-4 rounded-xl flex items-start justify-between gap-3 shadow-xs ${
            alertMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {alertMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <p className="text-sm font-semibold">{alertMessage.text}</p>
          </div>
          <button
            type="button"
            onClick={() => setAlertMessage(null)}
            className="text-gray-400 hover:text-gray-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header and Sub-Tab Navigation */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Campaigns & City Pools</h2>
              <p className="text-xs text-gray-500 font-medium">
                Create 1 product campaign across multiple cities. Each city pool maintains isolated member counts and capacity.
              </p>
            </div>
          </div>

          {/* Sub-Tab Navigation */}
          <div className="flex items-center gap-2 mt-5">
            <button
              type="button"
              onClick={() => setSubTab('campaigns')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                subTab === 'campaigns'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Multi-City Campaigns ({campaigns.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('pools')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                subTab === 'pools'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              City Pools Dashboard ({pools.length})
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={handleOpenCreateCampaign}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-xs cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Multi-City Campaign</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder={subTab === 'campaigns' ? 'Search campaigns...' : 'Search pools...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 placeholder:text-gray-400 focus:outline-emerald-500"
          />
        </div>

        {/* Category Filter */}
        <div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500 cursor-pointer"
          >
            <option value="all">All Categories</option>
            {activeCategories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* City Filter */}
        <div>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500 cursor-pointer"
          >
            <option value="all">All Operational Cities</option>
            {activeCities.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name} ({c.state})
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="DRAFT">DRAFT</option>
            <option value="UNLOCKED">UNLOCKED / TARGET REACHED</option>
            <option value="PAUSED">PAUSED</option>
            <option value="CLOSED">CLOSED</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-xs">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700">Loading records from Cloudflare D1...</p>
        </div>
      ) : subTab === 'campaigns' ? (
        /* -------------------------------------------------------------------------- */
        /* SUB-TAB 1: MULTI-CITY CAMPAIGNS                                            */
        /* -------------------------------------------------------------------------- */
        filteredCampaigns.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-xs">
            <Building className="w-12 h-12 text-gray-400 mx-auto mb-3 opacity-60" />
            <h3 className="text-base font-bold text-slate-900">No campaigns found</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              No product campaigns match your active search and filter criteria. Create your first multi-city campaign to start collecting grouped demand.
            </p>
            <button
              type="button"
              onClick={handleOpenCreateCampaign}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Campaign</span>
            </button>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Campaign & Product</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">City Pools (Isolated)</th>
                    <th className="py-3 px-4">Pricing</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                  {filteredCampaigns.map((camp) => (
                    <tr key={camp.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm">{camp.title}</div>
                        {(camp.brand || camp.model) && (
                          <div className="text-[11px] text-gray-500">
                            {camp.brand} {camp.model} {camp.variantName ? `• ${camp.variantName}` : ''}
                          </div>
                        )}
                        <span className="font-mono text-[10px] text-gray-400">{camp.slug}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {camp.categoryName || camp.categorySlug}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1 text-slate-900 font-semibold text-xs">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{camp.citiesCount || camp.cityPools?.length || 0} Cities</span>
                            <span className="text-gray-400 font-normal">({camp.totalBuyers || 0} Total Confirmed)</span>
                          </div>
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {camp.cityPools && camp.cityPools.length > 0 ? (
                              camp.cityPools.map((p) => (
                                <span
                                  key={p.id}
                                  className="text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded"
                                >
                                  {p.city} ({p.currentBuyers}/{p.targetBuyers})
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-gray-400 italic">No pools attached</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div>
                          {camp.defaultGroupPrice ? (
                            <span className="font-bold text-emerald-700">{formatINR(camp.defaultGroupPrice)}</span>
                          ) : (
                            <span className="text-gray-400 italic">No group target</span>
                          )}
                          {camp.defaultMarketPrice && (
                            <span className="text-[11px] text-gray-400 line-through ml-1.5">
                              {formatINR(camp.defaultMarketPrice)}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-500">Target: {camp.defaultTargetBuyers} buyers/city</div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            camp.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : camp.status === 'DRAFT'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-gray-100 text-gray-600 border-gray-200'
                          }`}
                        >
                          {camp.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewCampaign(camp)}
                            title="View Campaign Details & Pools"
                            className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenRollout(camp)}
                            title="25-City Launch Rollout"
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Rocket className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenAddCity(camp)}
                            title="Add Another City Pool"
                            className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditCampaign(camp)}
                            title="Edit Campaign"
                            className="p-1.5 text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteCampaign(camp)}
                            title="Safe Delete / Archive"
                            className="p-1.5 text-gray-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* -------------------------------------------------------------------------- */
        /* SUB-TAB 2: INDEPENDENT CITY POOLS DASHBOARD                                 */
        /* -------------------------------------------------------------------------- */
        filteredPools.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-xs">
            <Building className="w-12 h-12 text-gray-400 mx-auto mb-3 opacity-60" />
            <h3 className="text-base font-bold text-slate-900">No city pools found</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              No pools match your selected city and status filters.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">City Pool & Product</th>
                    <th className="py-3 px-4">City</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Confirmed / Target</th>
                    <th className="py-3 px-4">Waitlist / Interest</th>
                    <th className="py-3 px-4">Pricing & Quotation</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                  {filteredPools.map((pool) => {
                    const pct = Math.min(100, Math.round((pool.currentBuyers / pool.targetBuyers) * 100));
                    return (
                      <tr key={pool.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 text-sm">{pool.productTitle || pool.name}</div>
                          <div className="text-[11px] text-gray-500">
                            {pool.categorySlug || pool.category}
                            {pool.variantName ? ` • ${pool.variantName}` : ''}
                          </div>
                          <span className="font-mono text-[10px] text-gray-400">ID: {pool.id}</span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                            {pool.city}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                              pool.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : pool.status === 'UNLOCKED'
                                ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                : pool.status === 'DRAFT'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-gray-100 text-gray-600 border-gray-200'
                            }`}
                          >
                            {pool.status}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">
                              {pool.currentBuyers} / {pool.targetBuyers}
                            </span>
                            <span className="text-[11px] text-gray-400">({pct}%)</span>
                          </div>
                          <div className="w-24 bg-gray-200 h-1.5 rounded-full mt-1 overflow-hidden">
                            <div
                              className={`h-full ${pct >= 100 ? 'bg-indigo-600' : 'bg-emerald-600'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-slate-800 font-medium">
                              Waitlist: {pool.waitlistCount || 0}
                            </span>
                            {pool.pendingRequestsCount !== undefined && (
                              <span className="text-[11px] text-gray-500">
                                Requests: {pool.pendingRequestsCount}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {pool.groupPrice ? (
                            <div className="font-bold text-emerald-700">{formatINR(pool.groupPrice)}</div>
                          ) : (
                            <div className="text-gray-400 italic">Indicative</div>
                          )}
                          {pool.priceIsVerified ? (
                            <span className="inline-block text-[10px] font-bold text-emerald-700">
                              ✓ Verified Quote
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400">Indicative Estimate</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewPool(pool)}
                              title="View Pool Details"
                              className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditPool({ ...pool })}
                              title="Edit City Pool"
                              className="p-1.5 text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {pool.status === 'ACTIVE' ? (
                              <button
                                type="button"
                                onClick={() => handleTogglePoolStatus(pool, 'CLOSED')}
                                title="Close / Pause Pool"
                                className="p-1.5 text-gray-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <PauseCircle className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleTogglePoolStatus(pool, 'ACTIVE')}
                                title="Reopen / Activate Pool"
                                className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <PlayCircle className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenDeletePool(pool)}
                              title="Safe Delete / Close Pool"
                              className="p-1.5 text-gray-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE MULTI-CITY CAMPAIGN                                       */}
      {/* ========================================================================= */}
      {isCreateCampaignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-gray-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-slate-900">Create Multi-City Campaign</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateCampaignOpen(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaignSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Campaign / Product Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TVS iQube Electric Scooter"
                    value={campTitle}
                    onChange={(e) => setCampTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Configured Category *
                  </label>
                  <select
                    required
                    value={campCategorySlug}
                    onChange={(e) => setCampCategorySlug(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500 cursor-pointer"
                  >
                    {activeCategories.map((c) => (
                      <option key={c.id} value={c.slug}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Brand</label>
                  <input
                    type="text"
                    placeholder="e.g. TVS"
                    value={campBrand}
                    onChange={(e) => setCampBrand(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Product Model</label>
                  <input
                    type="text"
                    placeholder="e.g. iQube / Solar Inverter"
                    value={campModel}
                    onChange={(e) => setCampModel(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Variant / Specification (e.g. 3kW On-Grid System)</label>
                  <input
                    type="text"
                    placeholder="e.g. 3kW On-Grid System / S 3.4 kWh"
                    value={campVariant}
                    onChange={(e) => setCampVariant(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Estimated Market Price (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="145000"
                    value={campMarketPrice}
                    onChange={(e) => setCampMarketPrice(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Estimated Group Buy Target Price (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="130000"
                    value={campGroupPrice}
                    onChange={(e) => setCampGroupPrice(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Target Buyers / City (Capacity)
                  </label>
                  <input
                    type="number"
                    required
                    min={2}
                    value={campTargetBuyers}
                    onChange={(e) => setCampTargetBuyers(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Default Closing Date
                  </label>
                  <input
                    type="date"
                    required
                    value={campDefaultDeadline}
                    onChange={(e) => setCampDefaultDeadline(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Short Description</label>
                <input
                  type="text"
                  placeholder="Summary shown on discovery cards"
                  value={campShortDesc}
                  onChange={(e) => setCampShortDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Product Description & Specifications
                </label>
                <textarea
                  rows={3}
                  placeholder="Full specifications, inclusions, and terms..."
                  value={campLongDesc}
                  onChange={(e) => setCampLongDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500"
                />
              </div>

              {/* City Selection Multi-Select */}
              <div className="border border-gray-200 rounded-xl p-4 bg-slate-50/50">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-900">
                    Select Target Cities ({campSelectedCities.length} Selected) *
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllActiveCities}
                      className="text-[11px] text-emerald-700 hover:underline font-bold cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-gray-300">•</span>
                    <button
                      type="button"
                      onClick={clearAllCities}
                      className="text-[11px] text-gray-500 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 mb-3">
                  Each selected city will get its own independent pool with separate member counts and waitlist.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1 border border-gray-200 rounded-lg bg-white">
                  {activeCities.map((city) => {
                    const isChecked = campSelectedCities.includes(city.slug);
                    return (
                      <label
                        key={city.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCitySelection(city.slug)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="truncate">{city.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCreateCampaignOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || campSelectedCities.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Create Campaign ({campSelectedCities.length} City Pools)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: VIEW CAMPAIGN & CHILD CITY POOLS                                 */}
      {/* ========================================================================= */}
      {viewCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-gray-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-slate-900">{viewCampaign.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setViewCampaign(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase">Category</div>
                  <div className="text-xs font-bold text-slate-900">{viewCampaign.categoryName}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase">Brand / Model</div>
                  <div className="text-xs font-bold text-slate-900">{viewCampaign.brand || '—'} {viewCampaign.model}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase">Target Group Price</div>
                  <div className="text-xs font-bold text-emerald-700">
                    {viewCampaign.defaultGroupPrice ? formatINR(viewCampaign.defaultGroupPrice) : 'Indicative'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase">Status</div>
                  <div className="text-xs font-bold text-slate-900">{viewCampaign.status}</div>
                </div>
              </div>

              {viewCampaign.shortDescription && (
                <div>
                  <h4 className="text-xs font-bold text-gray-700 mb-1">Short Description</h4>
                  <p className="text-xs text-gray-600 bg-white p-3 rounded-lg border border-gray-200">
                    {viewCampaign.shortDescription}
                  </p>
                </div>
              )}

              {/* Child City Pools Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span>Independent City Pools ({viewCampaign.cityPools?.length || 0})</span>
                  </h4>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const camp = viewCampaign;
                        setViewCampaign(null);
                        handleOpenRollout(camp);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:underline cursor-pointer"
                    >
                      <Rocket className="w-3.5 h-3.5" />
                      <span>25-City Rollout</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setViewCampaign(null);
                        handleOpenAddCity(viewCampaign);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add City Pool</span>
                    </button>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase">
                        <th className="py-2.5 px-3">City</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Confirmed / Target</th>
                        <th className="py-2.5 px-3">Deadline</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {viewCampaign.cityPools && viewCampaign.cityPools.length > 0 ? (
                        viewCampaign.cityPools.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{p.city}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                                {p.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {p.currentBuyers} / {p.targetBuyers} buyers
                            </td>
                            <td className="py-2.5 px-3 text-gray-500">
                              {new Date(p.deadline).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setViewCampaign(null);
                                  setViewPool(p);
                                }}
                                className="text-emerald-700 hover:underline font-bold text-xs cursor-pointer mr-2"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-gray-400 italic">
                            No city pools currently attached to this campaign.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setViewCampaign(null)}
                  className="px-5 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ADD CITY POOL TO CAMPAIGN                                        */}
      {/* ========================================================================= */}
      {isAddCityOpen && targetCampaignForCity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Add City Pool</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCityOpen(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-600 mb-4">
              Attach an additional city pool to campaign <strong>{targetCampaignForCity.title}</strong>. It will operate with its own isolated buyer count.
            </p>

            <form onSubmit={handleAddCitySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Select City *</label>
                <select
                  required
                  value={newCitySlug}
                  onChange={(e) => setNewCitySlug(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500 cursor-pointer"
                >
                  {activeCities.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name} ({c.state})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">City Target Buyers</label>
                <input
                  type="number"
                  required
                  min={2}
                  value={newCityTargetBuyers}
                  onChange={(e) => setNewCityTargetBuyers(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Closing Date</label>
                <input
                  type="date"
                  value={newCityDeadline}
                  onChange={(e) => setNewCityDeadline(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddCityOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newCitySlug}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Create City Pool</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: EDIT CAMPAIGN DETAILS                                            */}
      {/* ========================================================================= */}
      {editCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Edit Campaign</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditCampaign(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditCampaignSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Campaign Title *</label>
                  <input
                    type="text"
                    required
                    value={editCampaign.title}
                    onChange={(e) => setEditCampaign({ ...editCampaign, title: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Status</label>
                  <select
                    value={editCampaign.status}
                    onChange={(e) => setEditCampaign({ ...editCampaign, status: e.target.value as CampaignStatus })}
                    className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500 cursor-pointer"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="PAUSED">PAUSED</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Brand</label>
                  <input
                    type="text"
                    value={editCampaign.brand || ''}
                    onChange={(e) => setEditCampaign({ ...editCampaign, brand: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Product Model</label>
                  <input
                    type="text"
                    value={editCampaign.model || ''}
                    onChange={(e) => setEditCampaign({ ...editCampaign, model: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Variant / Specification (e.g. 3kW On-Grid System)</label>
                  <input
                    type="text"
                    placeholder="e.g. 3kW On-Grid System"
                    value={editCampaign.variantName || ''}
                    onChange={(e) => setEditCampaign({ ...editCampaign, variantName: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Target Group Price (₹)</label>
                  <input
                    type="number"
                    value={editCampaign.defaultGroupPrice || ''}
                    onChange={(e) =>
                      setEditCampaign({
                        ...editCampaign,
                        defaultGroupPrice: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Market Reference Price (₹)</label>
                  <input
                    type="number"
                    value={editCampaign.defaultMarketPrice || ''}
                    onChange={(e) =>
                      setEditCampaign({
                        ...editCampaign,
                        defaultMarketPrice: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Short Description</label>
                <input
                  type="text"
                  value={editCampaign.shortDescription}
                  onChange={(e) => setEditCampaign({ ...editCampaign, shortDescription: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Full Description</label>
                <textarea
                  rows={3}
                  value={editCampaign.longDescription}
                  onChange={(e) => setEditCampaign({ ...editCampaign, longDescription: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="campaignPublished"
                  checked={editCampaign.isPublished}
                  onChange={(e) => setEditCampaign({ ...editCampaign, isPublished: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="campaignPublished" className="text-xs font-medium text-gray-700 cursor-pointer">
                  Publicly visible on catalog and discovery
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditCampaign(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-xs cursor-pointer flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: DELETE / ARCHIVE CAMPAIGN CONFIRMATION                           */}
      {/* ========================================================================= */}
      {deleteCampaignTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete / Archive Campaign</h3>
                <p className="text-xs text-gray-500 font-mono">{deleteCampaignTarget.title}</p>
              </div>
            </div>

            {isCheckingCampaignDeps ? (
              <div className="py-6 text-center text-xs text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-gray-400" />
                <span>Checking dependencies across city pools...</span>
              </div>
            ) : campaignDependencies && campaignDependencies.totalDependencies > 0 ? (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs leading-relaxed">
                  <strong>Cannot hard delete this campaign.</strong> Dependent records exist across its city pools:
                  <ul className="list-disc ml-5 mt-1.5 space-y-0.5">
                    <li><strong>{campaignDependencies.poolsCount}</strong> city pools</li>
                    <li><strong>{campaignDependencies.leadsCount}</strong> active confirmed buyers</li>
                    <li><strong>{campaignDependencies.requestsCount}</strong> converted proposals</li>
                    <li><strong>{campaignDependencies.quotationsCount}</strong> quotes</li>
                  </ul>
                  <p className="mt-2 text-[11px] text-amber-800">
                    To preserve historical integrity, choose <strong>Archive Campaign</strong> instead.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteCampaignTarget(null);
                      setCampaignDependencies(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => executeDeleteCampaign(false)}
                    className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 shadow-xs cursor-pointer"
                  >
                    Archive Campaign
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-gray-600 leading-relaxed">
                  No active members or dependent records reference this campaign. You may safely delete it or archive it.
                </p>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteCampaignTarget(null);
                      setCampaignDependencies(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => executeDeleteCampaign(true)}
                    className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-xs cursor-pointer"
                  >
                    Hard Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: CITY POOL OPERATIONS DEEP-DIVE MODAL (MEMBERS, WAITLIST, QUOTES) */}
      {/* ========================================================================= */}
      {viewPool && (
        <AdminGroupDetailModal
          pool={viewPool}
          isOpen={Boolean(viewPool)}
          onClose={() => setViewPool(null)}
          onPoolUpdated={(updatedPool) => {
            setPools((prev) => prev.map((p) => (p.id === updatedPool.id ? updatedPool : p)));
            loadData();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: EDIT CITY POOL SETTINGS (ISOLATED)                               */}
      {/* ========================================================================= */}
      {editPool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit City Pool Settings</h3>
                  <p className="text-xs text-gray-500 font-mono">{editPool.city}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditPool(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditPoolSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Variant / Specification (e.g. 3kW On-Grid System)</label>
                <input
                  type="text"
                  value={editPool.variantName || ''}
                  onChange={(e) => setEditPool({ ...editPool, variantName: e.target.value })}
                  placeholder="e.g. 3kW On-Grid System"
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Market Price (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={editPool.marketPrice ?? ''}
                    onChange={(e) =>
                      setEditPool({
                        ...editPool,
                        marketPrice: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="e.g. 150000"
                    className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Group Target Price (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={editPool.groupPrice ?? ''}
                    onChange={(e) =>
                      setEditPool({
                        ...editPool,
                        groupPrice: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="e.g. 120000"
                    className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Target Buyers (Capacity)</label>
                <input
                  type="number"
                  required
                  min={2}
                  value={editPool.targetBuyers}
                  onChange={(e) => setEditPool({ ...editPool, targetBuyers: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Status</label>
                <select
                  value={editPool.status}
                  onChange={(e) => setEditPool({ ...editPool, status: e.target.value as PoolStatus })}
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500 cursor-pointer"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="UNLOCKED">UNLOCKED / TARGET REACHED</option>
                  <option value="CLOSED">CLOSED</option>
                  <option value="DRAFT">DRAFT</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Closing Deadline</label>
                <input
                  type="datetime-local"
                  value={editPool.deadline ? editPool.deadline.substring(0, 16) : ''}
                  onChange={(e) => setEditPool({ ...editPool, deadline: new Date(e.target.value).toISOString() })}
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded-xl text-slate-900 focus:outline-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="poolPublished"
                  checked={editPool.isPublished}
                  onChange={(e) => setEditPool({ ...editPool, isPublished: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="poolPublished" className="text-xs font-medium text-gray-700 cursor-pointer">
                  Published and discoverable on public city page
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditPool(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-xs cursor-pointer flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Save City Pool</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 8: DELETE SINGLE CITY POOL CONFIRMATION                             */}
      {/* ========================================================================= */}
      {deletePoolTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete / Close City Pool</h3>
                <p className="text-xs text-gray-500 font-mono">{deletePoolTarget.name} ({deletePoolTarget.city})</p>
              </div>
            </div>

            {isCheckingPoolDeps ? (
              <div className="py-6 text-center text-xs text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-gray-400" />
                <span>Checking pool dependencies...</span>
              </div>
            ) : poolDependencies && poolDependencies.totalDependencies > 0 ? (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs leading-relaxed">
                  <strong>Cannot hard delete this city pool.</strong> It is referenced by historical records:
                  <ul className="list-disc ml-5 mt-1.5 space-y-0.5">
                    <li><strong>{poolDependencies.leadsCount}</strong> active confirmed buyers</li>
                    <li><strong>{poolDependencies.waitlistCount}</strong> waitlist entries</li>
                    <li><strong>{poolDependencies.requestsCount}</strong> proposal requests</li>
                    <li><strong>{poolDependencies.quotationsCount}</strong> quotations</li>
                  </ul>
                  <p className="mt-2 text-[11px] text-amber-800">
                    To preserve member audit history and data integrity, choose <strong>Close / Archive Pool</strong> instead.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      setDeletePoolTarget(null);
                      setPoolDependencies(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => executeDeletePool(false)}
                    className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 shadow-xs cursor-pointer"
                  >
                    Close / Archive Pool
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-gray-600 leading-relaxed">
                  No active buyers, waitlist, or quotes exist for this city pool. You may safely delete it or close it.
                </p>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      setDeletePoolTarget(null);
                      setPoolDependencies(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => executeDeletePool(true)}
                    className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-xs cursor-pointer"
                  >
                    Hard Delete Pool
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 9: 25-CITY LAUNCH ROLLOUT PREVIEW & EXECUTION MODAL                 */}
      {/* ========================================================================= */}
      {rolloutCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
              <div className="flex items-center gap-2">
                <Rocket className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">25-City Launch Rollout</h3>
                  <p className="text-xs text-gray-500">{rolloutCampaign.title}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={isExecutingRollout}
                onClick={() => {
                  setRolloutCampaign(null);
                  setRolloutPreview(null);
                  setRolloutResult(null);
                }}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingRollout && (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span>Auditing canonical 25 launch cities and checking existing city pools...</span>
              </div>
            )}

            {!isLoadingRollout && rolloutPreview && (
              <div className="space-y-4">
                {/* Result banner if executed */}
                {rolloutResult ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm mb-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Rollout Completed Successfully!</span>
                    </div>
                    <div className="text-xs text-emerald-700 flex items-center gap-4 mt-2 font-mono">
                      <span>✓ {rolloutResult.createdCount} Pools Created</span>
                      <span>• {rolloutResult.existingCount} Already Active (Untouched)</span>
                      {rolloutResult.failedCount > 0 && <span>⚠ {rolloutResult.failedCount} Failed/Skipped</span>}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase font-bold">Launch Directory</div>
                      <div className="text-sm font-bold text-slate-900">{rolloutPreview.totalCities} Cities</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase font-bold">Ready to Create</div>
                      <div className="text-sm font-bold text-emerald-600">+{rolloutPreview.readyToCreateCount} Pools</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase font-bold">Already Active</div>
                      <div className="text-sm font-bold text-blue-600">{rolloutPreview.alreadyExistsCount} Pools</div>
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-600">
                  <p>
                    {rolloutResult
                      ? 'Detailed per-city execution outcomes:'
                      : 'Preview of canonical launch cities. Rerunning this workflow is completely idempotent and never duplicates pools or resets existing buyer counts.'}
                  </p>
                </div>

                {/* Cities List */}
                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 text-xs">
                  {(rolloutResult ? rolloutResult.results : rolloutPreview.cities).map((c) => (
                    <div key={c.citySlug} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <span className="font-bold text-slate-900">{c.cityName}</span>
                        {'state' in c && <span className="text-gray-400 text-[11px] ml-1.5 font-normal">({c.state})</span>}
                        {'reason' in c && <div className="text-[10px] text-gray-500 mt-0.5">{c.reason}</div>}
                      </div>
                      <div>
                        {c.status === 'CREATED' && (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">
                            ✓ Created
                          </span>
                        )}
                        {c.status === 'ALREADY_EXISTS' && (
                          <span className="bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded text-[10px] font-bold">
                            Active ({'currentBuyers' in c ? c.currentBuyers : 0} buyers)
                          </span>
                        )}
                        {c.status === 'READY_TO_CREATE' && (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                            + Ready to Create
                          </span>
                        )}
                        {(c.status === 'FAILED' || c.status === 'SKIPPED' || c.status === 'INACTIVE' || c.status === 'NOT_FOUND') && (
                          <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">
                            {c.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    disabled={isExecutingRollout}
                    onClick={() => {
                      setRolloutCampaign(null);
                      setRolloutPreview(null);
                      setRolloutResult(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
                  >
                    {rolloutResult ? 'Close' : 'Cancel'}
                  </button>
                  {!rolloutResult && (
                    <button
                      type="button"
                      disabled={isExecutingRollout || rolloutPreview.readyToCreateCount === 0}
                      onClick={handleExecuteRollout}
                      className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-xs cursor-pointer flex items-center gap-2 disabled:opacity-50"
                    >
                      {isExecutingRollout && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>
                        {rolloutPreview.readyToCreateCount === 0
                          ? 'All 25 Cities Already Active'
                          : `Confirm & Launch (${rolloutPreview.readyToCreateCount} Cities)`}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

