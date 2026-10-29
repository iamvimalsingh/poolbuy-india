'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Shield,
  Layers,
  ShoppingBag,
  MapPin,
  Users,
  MessageSquare,
  FileText,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { AuditLogEntry } from '@/lib/audit';

export function AdminActivityTab() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/admin/audit-logs');
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error?.message || 'Failed to load audit logs.');
        return;
      }
      setLogs(Array.isArray(data.data) ? data.data : []);
    } catch {
      setErrorMessage('Network error fetching audit logs.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/admin/audit-logs');
        const data = await res.json();
        if (isMounted) {
          if (res.ok && data.success) {
            setLogs(Array.isArray(data.data) ? data.data : []);
          } else {
            setErrorMessage(data.error?.message || 'Failed to load audit logs.');
          }
        }
      } catch {
        if (isMounted) setErrorMessage('Network error fetching audit logs.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (targetTypeFilter !== 'ALL' && log.targetType !== targetTypeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesAction = log.action.toLowerCase().includes(q);
        const matchesSummary = log.changesSummary.toLowerCase().includes(q);
        const matchesTargetId = log.targetId.toLowerCase().includes(q);
        const matchesActor = log.adminIdentifier.toLowerCase().includes(q);
        return matchesAction || matchesSummary || matchesTargetId || matchesActor;
      }
      return true;
    });
  }, [logs, targetTypeFilter, searchQuery]);

  const getTargetIcon = (targetType: string) => {
    switch (targetType) {
      case 'CAMPAIGN':
        return <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />;
      case 'POOL':
        return <Layers className="w-3.5 h-3.5 text-emerald-600" />;
      case 'CITY':
      case 'LOCATION_REQUEST':
        return <MapPin className="w-3.5 h-3.5 text-amber-600" />;
      case 'CATEGORY':
        return <Layers className="w-3.5 h-3.5 text-purple-600" />;
      case 'LEAD':
      case 'REQUEST':
        return <Users className="w-3.5 h-3.5 text-indigo-600" />;
      case 'QUOTE':
        return <MessageSquare className="w-3.5 h-3.5 text-rose-600" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-gray-500" />;
    }
  };

  const getActionBadgeColor = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('CREATE') || act.includes('ADD') || act.includes('APPROVE')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('EXTEND') || act.includes('PRICING')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (act.includes('DELETE') || act.includes('REJECT') || act.includes('EXCLUDE') || act.includes('PAUSE')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-950 tracking-tight">System Activity Log</h2>
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Authoritative D1 Audit Trail
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Immutable record of administrative mutations, pricing updates, and member status transitions.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchLogs}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors shadow-2xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800 font-medium">{errorMessage}</div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by action, summary, actor, or target ID..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-hidden focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <select
            value={targetTypeFilter}
            onChange={(e) => setTargetTypeFilter(e.target.value)}
            className="text-xs rounded-xl border border-gray-200 bg-white text-gray-700 py-2 px-2.5 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
          >
            <option value="ALL">All Target Types</option>
            <option value="CAMPAIGN">Campaigns</option>
            <option value="POOL">City Pools</option>
            <option value="LEAD">Leads / Members</option>
            <option value="REQUEST">Proposals / Requests</option>
            <option value="QUOTE">Quotes & Pricing</option>
            <option value="CITY">Cities</option>
            <option value="CATEGORY">Categories</option>
            <option value="LOCATION_REQUEST">Location Requests</option>
            <option value="CONFIG">Configuration</option>
          </select>
        </div>
      </div>

      {/* Table / List */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-gray-500 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
            <span>Loading audit log entries...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-xs text-gray-500 space-y-1">
            <Activity className="w-6 h-6 text-gray-300 mx-auto mb-2" />
            <p className="font-semibold text-gray-700">No activity log entries found</p>
            <p className="text-gray-400">Try adjusting your search terms or filter selection.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200/80 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4 w-40">Timestamp</th>
                  <th className="py-3 px-4 w-36">Action</th>
                  <th className="py-3 px-4 w-32">Target</th>
                  <th className="py-3 px-4 w-32">Operator</th>
                  <th className="py-3 px-4">Summary</th>
                  <th className="py-3 px-4 w-16 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const dateStr = new Date(log.createdAt).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-gray-400 shrink-0" />
                            {dateStr}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${getActionBadgeColor(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[10px] font-medium">
                            {getTargetIcon(log.targetType)}
                            <span className="font-semibold">{log.targetType}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-gray-600 whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            <Shield className="w-3 h-3 text-emerald-600 shrink-0" />
                            {log.adminIdentifier}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-800 font-medium">
                          {log.changesSummary}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {log.details ? (
                            <button
                              type="button"
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="text-gray-400 hover:text-gray-700 p-1 rounded-md transition-colors cursor-pointer"
                              title={isExpanded ? 'Collapse details' : 'Expand details'}
                              aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && log.details && (
                        <tr className="bg-slate-50/90 border-b border-gray-100">
                          <td colSpan={6} className="py-3 px-6">
                            <div className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-[11px] overflow-x-auto shadow-inner">
                              <pre className="whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
