'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Layers,
  Users,
  Sparkles,
  LogOut,
  ArrowLeft,
  Shield,
  MapPin,
  BookOpen,
  LayoutDashboard,
  Settings,
} from 'lucide-react';
import { AdminOverviewTab } from './admin-overview-tab';
import { AdminPoolsTab } from './admin-pools-tab';
import { AdminLeadsTab } from './admin-leads-tab';
import { AdminRequestsTab } from './admin-requests-tab';
import { AdminCategoriesTab } from './admin-categories-tab';
import { AdminCitiesTab } from './admin-cities-tab';
import { AdminBlogTab } from './admin-blog-tab';
import { AdminSettingsTab } from './admin-settings-tab';

export function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'pools' | 'leads' | 'requests' | 'categories' | 'cities' | 'blog' | 'settings'
  >('overview');
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
                Operator Command Center
              </h1>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Authorized
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Passkey Session Verified • Restricted Administrative Operations
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
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isLoggingOut ? 'Logging out...' : 'Log Out'}</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-8 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
          <span>Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pools')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'pools'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <Layers className="w-4 h-4" aria-hidden="true" />
          <span>Group Pools</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('leads')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'leads'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <Users className="w-4 h-4" aria-hidden="true" />
          <span>Leads & Buyers CRM</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'requests'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          <span>Demand Discovery</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'categories'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <Layers className="w-4 h-4" aria-hidden="true" />
          <span>Product Categories</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cities')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'cities'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <MapPin className="w-4 h-4" aria-hidden="true" />
          <span>Operational Cities</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('blog')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'blog'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <BookOpen className="w-4 h-4" aria-hidden="true" />
          <span>Blog CMS</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'settings'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <Settings className="w-4 h-4" aria-hidden="true" />
          <span>Settings</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <AdminOverviewTab onNavigateTab={(tab) => setActiveTab(tab)} />
      )}
      {activeTab === 'pools' && <AdminPoolsTab />}
      {activeTab === 'leads' && <AdminLeadsTab />}
      {activeTab === 'requests' && <AdminRequestsTab />}
      {activeTab === 'categories' && <AdminCategoriesTab />}
      {activeTab === 'cities' && <AdminCitiesTab />}
      {activeTab === 'blog' && <AdminBlogTab />}
      {activeTab === 'settings' && <AdminSettingsTab />}
    </div>
  );
}
