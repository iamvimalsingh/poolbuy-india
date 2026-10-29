'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Users, Clock, FileQuestion, Search, ArrowUpRight, AlertCircle, Loader2 } from 'lucide-react';
import { AdminLeadsTab } from './admin-leads-tab';
import { AdminRequestsTab } from './admin-requests-tab';
import { formatDateTime } from '@/lib/format';

interface WaitlistRow {
  id: string;
  pool_id: string;
  pool_name?: string;
  pool_slug?: string;
  pool_city?: string;
  sequence_number: number;
  full_name: string;
  whatsapp_number: string;
  city?: string;
  locality?: string | null;
  pincode?: string | null;
  pin_code?: string | null;
  existing_quote?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
  promoted_at?: string | null;
}

export function AdminMembersRequestsTab() {
  const [subTab, setSubTab] = useState<'members' | 'waitlist' | 'requests'>('members');

  // Waitlist state
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistRow[]>([]);
  const [isWaitlistLoading, setIsWaitlistLoading] = useState(false);
  const [waitlistSearch, setWaitlistSearch] = useState('');
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [promoteMessage, setPromoteMessage] = useState<string | null>(null);

  const loadWaitlist = useCallback(async () => {
    setIsWaitlistLoading(true);
    setWaitlistError(null);
    try {
      const params = new URLSearchParams();
      if (waitlistSearch.trim()) params.set('search', waitlistSearch.trim());
      const res = await fetch(`/api/admin/waitlist?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setWaitlistEntries(data.data || []);
      } else {
        setWaitlistError(data.error?.message || 'Failed to load waitlist entries.');
      }
    } catch {
      setWaitlistError('Network error loading waitlist.');
    } finally {
      setIsWaitlistLoading(false);
    }
  }, [waitlistSearch]);

  useEffect(() => {
    let ignore = false;
    if (subTab === 'waitlist') {
      void (async () => {
        if (!ignore) {
          await loadWaitlist();
        }
      })();
    }
    return () => {
      ignore = true;
    };
  }, [subTab, loadWaitlist]);

  const handlePromoteNext = async (poolId: string, entryId: string) => {
    setPromotingId(entryId);
    setPromoteMessage(null);
    try {
      const res = await fetch(`/api/admin/pools/${poolId}/promote-next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setPromoteMessage(`Candidate promoted to Buyer #${data.data?.buyerNumber || ''}!`);
        await loadWaitlist();
      } else {
        alert(data.error?.message || 'Failed to promote candidate.');
      }
    } catch {
      alert('Network error promoting candidate.');
    } finally {
      setPromotingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Subtab Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            Member CRM & Demand Pipeline
          </h2>
          <p className="text-xs text-gray-500">
            Manage confirmed members, queue waitlists, and incoming product demand proposals separately.
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
          <button
            type="button"
            onClick={() => setSubTab('members')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              subTab === 'members'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-gray-600 hover:text-gray-950'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            <span>Confirmed Members ({'<AdminLeadsTab />'})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('waitlist')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              subTab === 'waitlist'
                ? 'bg-white text-amber-800 shadow-xs'
                : 'text-gray-600 hover:text-gray-950'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Waitlist Applicants</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('requests')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              subTab === 'requests'
                ? 'bg-white text-blue-800 shadow-xs'
                : 'text-gray-600 hover:text-gray-950'
            }`}
          >
            <FileQuestion className="w-3.5 h-3.5 text-blue-600" />
            <span>Demand Proposals</span>
          </button>
        </div>
      </div>

      {/* Active Tab View */}
      {subTab === 'members' && <AdminLeadsTab />}

      {subTab === 'waitlist' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="search"
                placeholder="Search candidate name, phone, or postal pincode..."
                value={waitlistSearch}
                onChange={(e) => setWaitlistSearch(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-hidden font-medium"
              />
            </div>
            <button
              type="button"
              onClick={() => void loadWaitlist()}
              className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors cursor-pointer"
            >
              Refresh Queue
            </button>
          </div>

          {promoteMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl p-3">
              {promoteMessage}
            </div>
          )}

          {waitlistError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{waitlistError}</span>
            </div>
          )}

          {isWaitlistLoading ? (
            <div className="py-12 text-center text-xs text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-amber-600 mb-2" />
              Loading waitlist queue...
            </div>
          ) : waitlistEntries.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-xs text-gray-500">
              No waitlist applicants found matching criteria.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-600 font-bold">
                    <th className="py-3 px-3.5">Queue #</th>
                    <th className="py-3 px-3.5">Candidate Details</th>
                    <th className="py-3 px-3.5">Pool / City</th>
                    <th className="py-3 px-3.5">Status</th>
                    <th className="py-3 px-3.5">Registered</th>
                    <th className="py-3 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {waitlistEntries.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3.5 font-bold text-amber-800 whitespace-nowrap">
                        #{item.sequence_number}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-gray-950">{item.full_name}</div>
                        <div className="text-[11px] font-mono text-gray-500">+91 {item.whatsapp_number}</div>
                        <div className="text-[11px] text-gray-600 flex items-center gap-1.5 flex-wrap mt-0.5">
                          {(item.locality || item.pincode || item.pin_code) && (
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px]">
                              {[item.locality, item.pincode || item.pin_code].filter(Boolean).join(' • ')}
                            </span>
                          )}
                          {item.existing_quote && (
                            <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded text-[10px]">
                              Reported: {item.existing_quote} <span className="text-[9px] text-amber-600 font-semibold">(Customer Reported)</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-semibold text-gray-900">{item.pool_name || item.pool_id}</div>
                        <div className="text-[10px] text-gray-500">{item.pool_city || item.city || 'India'}</div>
                      </td>
                      <td className="py-3 px-3.5">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.status === 'WAITING'
                              ? 'bg-amber-100 text-amber-800'
                              : item.status === 'PROMOTED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap text-[11px] text-gray-500">
                        {formatDateTime(item.created_at)}
                      </td>
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        {item.status === 'WAITING' && (
                          <button
                            type="button"
                            disabled={promotingId === item.id}
                            onClick={() => handlePromoteNext(item.pool_id, item.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <ArrowUpRight className="w-3 h-3" />
                            <span>{promotingId === item.id ? 'Promoting...' : 'Promote to Member'}</span>
                          </button>
                        )}
                        {item.status === 'PROMOTED' && (
                          <span className="text-[11px] text-emerald-700 font-bold">Promoted</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subTab === 'requests' && <AdminRequestsTab />}
    </div>
  );
}
