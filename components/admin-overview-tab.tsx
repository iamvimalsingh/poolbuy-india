'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Clock,
  DollarSign,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { AdminOverviewMetrics } from '@/types';

interface AdminOverviewTabProps {
  onNavigateTab?: (tab: 'pools' | 'leads' | 'requests' | 'cities' | 'blog' | 'settings') => void;
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
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-950 tracking-tight">Operations Overview & Action Queues</h2>
        <p className="text-xs text-gray-500 mt-1">
          High-priority administrative queues requiring manual operator review, verification, and WhatsApp communication.
        </p>
      </div>

      {/* Main Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Open Groups */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-medium">Open Groups</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-gray-950 mt-2">{m.totalOpenGroups}</div>
          <div className="text-[11px] text-gray-400 mt-1">Accepting joins</div>
        </div>

        {/* Target Reached */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-medium">Target Reached</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-gray-950 mt-2">{m.totalTargetReached}</div>
          <div className="text-[11px] text-blue-700 font-semibold mt-1">Ready for quote verification</div>
        </div>

        {/* Waitlist Pending */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-medium">Waitlist Candidates</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-gray-950 mt-2">{m.totalWaitlistPending}</div>
          <div className="text-[11px] text-gray-400 mt-1">Awaiting invitation</div>
        </div>

        {/* Fees Pending Verification */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-medium">Fees to Verify</span>
            <DollarSign className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-gray-950 mt-2">{m.totalFeesPendingVerification}</div>
          <div className="text-[11px] text-purple-700 font-semibold mt-1">Manual checks needed</div>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs">
          <div className="text-xs text-gray-500">Quotes Awaiting Review</div>
          <div className="text-xl font-bold text-gray-900 mt-1">{m.totalQuotesAwaitingReview}</div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs">
          <div className="text-xs text-gray-500">Member Responses Pending</div>
          <div className="text-xl font-bold text-gray-900 mt-1">{m.totalMemberResponsesPending}</div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs">
          <div className="text-xs text-gray-500">Connections Ready</div>
          <div className="text-xl font-bold text-gray-900 mt-1">{m.totalConnectionsPending}</div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs">
          <div className="text-xs text-gray-500">Completed / Archived</div>
          <div className="text-xl font-bold text-gray-900 mt-1">
            {m.totalCompletedGroups} / {m.totalArchivedGroups}
          </div>
        </div>
      </div>

      {/* Action Queues Callouts */}
      <div className="bg-white rounded-3xl border border-gray-200/80 p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-gray-950">Immediate Operational Checklists</h3>

        <div className="divide-y divide-gray-100 text-xs">
          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <div>
                <span className="font-bold text-gray-950">Target-Reached Groups:</span> Review quotations and initiate member review.
              </div>
            </div>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('pools')}
                className="inline-flex items-center gap-1 text-emerald-700 font-bold hover:underline"
              >
                <span>View Groups</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-amber-600" />
              <div>
                <span className="font-bold text-gray-950">FIFO Waitlists:</span> Capacity slots available for waitlist invitations.
              </div>
            </div>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('pools')}
                className="inline-flex items-center gap-1 text-emerald-700 font-bold hover:underline"
              >
                <span>Manage Waitlist</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-purple-600" />
              <div>
                <span className="font-bold text-gray-950">Manual Fee Verification:</span> Compare claimed UPI references against bank statements.
              </div>
            </div>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('leads')}
                className="inline-flex items-center gap-1 text-emerald-700 font-bold hover:underline"
              >
                <span>Open CRM</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
