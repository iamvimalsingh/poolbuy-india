'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  MapPin,
  Clock,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Building,
} from 'lucide-react';
import { AdminOverviewMetrics } from '@/types';

interface AdminOverviewTabProps {
  onNavigateTab?: (tab: 'categories' | 'locations' | 'campaigns' | 'members' | 'quotes' | 'blog' | 'activity') => void;
}

export function AdminOverviewTab({ onNavigateTab }: AdminOverviewTabProps) {
  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const res = await fetch('/api/admin/overview');
        const data = await res.json();
        if (data.success) {
          setMetrics(data.data);
        }
      } catch (e) {
        console.error('Failed to load overview metrics:', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadMetrics();
  }, []);

  if (isLoading) {
    return <div className="py-12 text-center text-xs text-gray-500">Loading operations overview...</div>;
  }

  const m = metrics || {
    totalDrafts: 0,
    totalOpenGroups: 0,
    totalTargetReached: 0,
    totalWaitlistPending: 0,
    totalQuotesAwaitingReview: 0,
    totalMemberResponsesPending: 0,
    totalFeesPendingVerification: 0,
    totalConnectionsPending: 0,
    totalCompletedGroups: 0,
    totalArchivedGroups: 0,
    totalCategories: 0,
    activeCategories: 0,
    totalCities: 0,
    activeCities: 0,
    pendingLocationRequests: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-950 tracking-tight">Admin System Overview</h2>
        <p className="text-xs text-gray-500 mt-1">
          GroupBuying.store administrative command center. Multi-category demand aggregation engine running on Cloudflare Workers and D1 SQLite.
        </p>
      </div>

      {/* Foundation Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Categories Card */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500">
              <span className="text-xs font-bold text-gray-700">Product Categories</span>
              <Layers className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-3xl font-black text-gray-950">{m.activeCategories ?? 0}</span>
              <span className="text-xs text-gray-500 font-semibold">active of {m.totalCategories ?? 0} total</span>
            </div>
            <p className="text-[11px] text-gray-500 mt-1.5">
              Dynamic multi-category engine. Configurable without frontend deployments.
            </p>
          </div>
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('categories')}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors cursor-pointer"
            >
              <span>Manage Categories</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Locations Card */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500">
              <span className="text-xs font-bold text-gray-700">Operational Locations</span>
              <MapPin className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-3xl font-black text-gray-950">{m.activeCities ?? 0}</span>
              <span className="text-xs text-gray-500 font-semibold">active markets of {m.totalCities ?? 0}</span>
            </div>
            <p className="text-[11px] text-gray-500 mt-1.5">
              State-wise city directory with dependency checks to prevent orphan records.
            </p>
          </div>
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('locations')}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors cursor-pointer"
            >
              <span>Manage Locations</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Pending Location Requests Card */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500">
              <span className="text-xs font-bold text-gray-700">Pending City Requests</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-3xl font-black text-gray-950">{m.pendingLocationRequests ?? 0}</span>
              <span className="text-xs text-amber-700 font-semibold">awaiting operator review</span>
            </div>
            <p className="text-[11px] text-gray-500 mt-1.5">
              Towns submitted by public demand requests outside current coverage.
            </p>
          </div>
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('locations')}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 transition-colors cursor-pointer"
            >
              <span>Review Location Requests</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* System Status Banner */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-sm tracking-tight">Campaign & Pool Infrastructure Active</h3>
              <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                Core Operations Active
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-xl">
              Next.js 16 App Router on Cloudflare Workers (via OpenNext) backed by Cloudflare D1 SQLite. Category & Location lifecycle management fully operational.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Database Connected</span>
          </div>
        </div>
      </div>

      {/* Operational Pools Preview */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-gray-950 flex items-center gap-2">
              <Building className="w-4 h-4 text-gray-500" />
              <span>Operational Demand Aggregation Status</span>
            </h4>
            <p className="text-[11px] text-gray-500">
              Live statistics from Cloudflare D1. Multi-city campaigns and city pools lifecycle management operational.
            </p>
          </div>
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('campaigns')}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
            >
              Manage Campaigns & City Pools &rarr;
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 bg-slate-50 rounded-xl">
            <div className="text-xs text-gray-500">Open Pools</div>
            <div className="text-xl font-bold text-gray-950 mt-1">{m.totalOpenGroups}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <div className="text-xs text-gray-500">Target Reached</div>
            <div className="text-xl font-bold text-gray-950 mt-1">{m.totalTargetReached}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <div className="text-xs text-gray-500">Waitlist Candidates</div>
            <div className="text-xl font-bold text-gray-950 mt-1">{m.totalWaitlistPending}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <div className="text-xs text-gray-500">Completed Pools</div>
            <div className="text-xl font-bold text-gray-950 mt-1">{m.totalCompletedGroups}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
