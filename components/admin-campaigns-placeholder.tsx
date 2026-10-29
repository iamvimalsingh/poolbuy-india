'use client';

import React from 'react';
import { Layers, Calendar, CheckCircle2, MapPin, ArrowRight } from 'lucide-react';

interface AdminCampaignsPlaceholderProps {
  onNavigateToCategories?: () => void;
  onNavigateToLocations?: () => void;
}

export function AdminCampaignsPlaceholder({
  onNavigateToCategories,
  onNavigateToLocations,
}: AdminCampaignsPlaceholderProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs p-6 sm:p-10 max-w-4xl">
        <div className="flex items-center gap-2.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full w-fit mb-4">
          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
          <span>Step 2 Implementation Scope</span>
        </div>

        <h2 className="text-2xl font-black text-gray-950 tracking-tight mb-2">
          Campaign Creation & Independent Multi-City Pools
        </h2>

        <p className="text-sm text-gray-600 leading-relaxed max-w-2xl mb-6">
          This module is reserved for Step 2 of the GroupBuying.store admin rebuild. In Step 1, the foundation, authentication, category lifecycle, and geographic market directory are completed and operational.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-8">
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-gray-950 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Step 1 Completed Prerequisites</span>
            </div>
            <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
              <li>Category CRUD, slug uniqueness, and safe deletion guard</li>
              <li>State & City location directory with dependency checks</li>
              <li>User-requested location review and approval workflow</li>
              <li>Public demand discovery form database integration</li>
            </ul>
          </div>

          <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-2xl p-5 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-emerald-950 text-sm">
              <Layers className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Step 2 Upcoming Scope</span>
            </div>
            <ul className="text-xs text-emerald-900/80 space-y-1.5 list-disc list-inside">
              <li>Multi-city campaign creation from active categories & locations</li>
              <li>Independent city pool capacity limits & isolation</li>
              <li>FIFO waitlist management & atomic capacity updates</li>
              <li>Admin pool conversion with explicit buyer consent</li>
            </ul>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 flex flex-wrap gap-3">
          {onNavigateToCategories && (
            <button
              type="button"
              onClick={onNavigateToCategories}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <span>Manage Categories</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          {onNavigateToLocations && (
            <button
              type="button"
              onClick={onNavigateToLocations}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>Manage Locations</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

