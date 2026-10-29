'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Layers,
  MapPin,
  LayoutDashboard,
  LogOut,
  ArrowLeft,
  Shield,
  Clock,
  MessageSquare,
  Users,
  Activity,
} from 'lucide-react';
import { AdminOverviewTab } from './admin-overview-tab';
import { AdminCategoriesTab } from './admin-categories-tab';
import { AdminLocationsTab } from './admin-locations-tab';
import { AdminCampaignsPlaceholder } from './admin-campaigns-placeholder';

export type AdminTab = 'overview' | 'categories' | 'locations' | 'campaigns';

export function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/admin/session', { method: 'DELETE' });
      router.push('/admin/login');
      router.refresh();
    } catch {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      {/* Top Console Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200/80 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center shadow-xs">
            <Shield className="w-5 h-5 text-emerald-400" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-gray-950 tracking-tight">
                GroupBuying Operator Console
              </h1>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Step 1 Foundation
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Passkey Session Verified • Categories & Location Directory System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Public Site</span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isLoggingOut ? 'Logging out...' : 'Log Out'}</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-8 overflow-x-auto gap-1">
        {/* 1. Overview */}
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${activeTab === 'overview'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
            }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Overview</span>
        </button>

        {/* 2. Categories */}
        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${activeTab === 'categories'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
            }`}
        >
          <Layers className="w-4 h-4" />
          <span>Categories</span>
        </button>

        {/* 3. Locations */}
        <button
          type="button"
          onClick={() => setActiveTab('locations')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${activeTab === 'locations'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
            }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Locations</span>
        </button>

        {/* 4. Campaigns & Pools (Step 2 Placeholder) */}
        <button
          type="button"
          onClick={() => setActiveTab('campaigns')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${activeTab === 'campaigns'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
            }`}
        >
          <Clock className="w-4 h-4 text-amber-500" />
          <span>Campaigns & Pools</span>
          <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded">
            Step 2
          </span>
        </button>

        {/* 5. Members & Requests (Reserved Step 3) */}
        <button
          type="button"
          disabled
          title="Reserved for Step 3 implementation"
          className="flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 border-transparent text-gray-400 cursor-not-allowed whitespace-nowrap opacity-60"
        >
          <Users className="w-4 h-4" />
          <span>Members & Requests</span>
          <span className="text-[9px] font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.2 rounded">
            Step 3
          </span>
        </button>

        {/* 6. Quotes & Messages (Reserved Step 3) */}
        <button
          type="button"
          disabled
          title="Reserved for Step 3 implementation"
          className="flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 border-transparent text-gray-400 cursor-not-allowed whitespace-nowrap opacity-60"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Quotes & Messages</span>
          <span className="text-[9px] font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.2 rounded">
            Step 3
          </span>
        </button>

        {/* 7. Activity Log (Reserved Later Step) */}
        <button
          type="button"
          disabled
          title="Reserved for a later implementation step"
          className="flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 border-transparent text-gray-400 cursor-not-allowed whitespace-nowrap opacity-60"
        >
          <Activity className="w-4 h-4" />
          <span>Activity Log</span>
          <span className="text-[9px] font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.2 rounded">
            Step 4
          </span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <AdminOverviewTab onNavigateTab={(tab) => setActiveTab(tab)} />
      )}
      {activeTab === 'categories' && <AdminCategoriesTab />}
      {activeTab === 'locations' && <AdminLocationsTab />}
      {activeTab === 'campaigns' && (
        <AdminCampaignsPlaceholder
          onNavigateToCategories={() => setActiveTab('categories')}
          onNavigateToLocations={() => setActiveTab('locations')}
        />
      )}
    </div>
  );
}
