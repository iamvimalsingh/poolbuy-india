'use client';

import React, { useState, useEffect } from 'react';
import {
  Download,
  Search,
  MessageCircle,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
} from 'lucide-react';
import { PoolLead, LeadStatus } from '@/types';
import { CITIES, TIMELINE_LABELS } from '@/lib/constants';
import { formatDateTime, formatINR } from '@/lib/format';

export function AdminLeadsTab() {
  const [leads, setLeads] = useState<PoolLead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [cityFilter, setCityFilter] = useState('');
  const [timelineFilter, setTimelineFilter] = useState('');
  const [quoteFilter, setQuoteFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // WhatsApp modal state
  const [activeWhatsAppLead, setActiveWhatsAppLead] = useState<PoolLead | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<
    'UNLOCKED_TOKEN' | 'LEAD_FALLBACK' | 'QUOTE_FOLLOWUP' | 'TARGET_REACHED_INVITATION'
  >('TARGET_REACHED_INVITATION');
  const [generatedWhatsApp, setGeneratedWhatsApp] = useState<{ url: string; text: string } | null>(null);
  const [isGeneratingWhatsApp, setIsGeneratingWhatsApp] = useState(false);
  const [whatsAppError, setWhatsAppError] = useState<string | null>(null);

  const loadLeads = async (targetPage = page) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', targetPage.toString());
      params.set('pageSize', '15');
      if (cityFilter) params.set('city', cityFilter);
      if (timelineFilter) params.set('buyingTimeline', timelineFilter);
      if (quoteFilter) params.set('hasExistingQuote', quoteFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (searchFilter.trim()) params.set('search', searchFilter.trim());

      const res = await fetch(`/api/admin/leads?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setLeads(data.data.leads);
        setTotal(data.data.total);
        setPage(data.data.page);
        setTotalPages(data.data.totalPages || 1);
      }
    } catch (e) {
      console.error('Failed to load leads:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function fetchLeads() {
      try {
        const params = new URLSearchParams();
        params.set('page', '1');
        params.set('pageSize', '15');
        if (cityFilter) params.set('city', cityFilter);
        if (timelineFilter) params.set('buyingTimeline', timelineFilter);
        if (quoteFilter) params.set('hasExistingQuote', quoteFilter);
        if (statusFilter) params.set('status', statusFilter);

        const res = await fetch(`/api/admin/leads?${params.toString()}`);
        const data = await res.json();
        if (!ignore && data.success) {
          setLeads(data.data.leads);
          setTotal(data.data.total);
          setPage(data.data.page);
          setTotalPages(data.data.totalPages || 1);
        }
      } catch (e) {
        console.error('Failed to load leads:', e);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    fetchLeads();
    return () => {
      ignore = true;
    };
  }, [cityFilter, timelineFilter, quoteFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLeads(1);
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (cityFilter) params.set('city', cityFilter);
    if (timelineFilter) params.set('buyingTimeline', timelineFilter);
    if (quoteFilter) params.set('hasExistingQuote', quoteFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (searchFilter.trim()) params.set('search', searchFilter.trim());

    window.open(`/api/admin/leads/export?${params.toString()}`, '_blank');
  };

  const handleStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
        );
      }
    } catch (e) {
      console.error('Failed to update status:', e);
    }
  };

  const handleGenerateWhatsApp = async (lead: PoolLead, template = selectedTemplate) => {
    setActiveWhatsAppLead(lead);
    setSelectedTemplate(template);
    setIsGeneratingWhatsApp(true);
    setWhatsAppError(null);
    setGeneratedWhatsApp(null);

    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateType: template }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setWhatsAppError(data.error?.message || 'Failed to generate WhatsApp message.');
        return;
      }

      setGeneratedWhatsApp({
        url: data.data.whatsappUrl,
        text: data.data.messageText,
      });
    } catch {
      setWhatsAppError('Network error generating message.');
    } finally {
      setIsGeneratingWhatsApp(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar with Export and Counts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-950">Leads & Buyers CRM</h2>
          <p className="text-xs text-gray-500 mt-1">
            Total {total} verified buyer interests registered across all pools.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center justify-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-gray-950 text-white hover:bg-gray-800 active:scale-98 transition-all shadow-xs"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          <span>Export Filtered CSV</span>
        </button>
      </div>

      {/* Filter Row */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search by buyer name, phone, or notes..."
              className="w-full text-xs pl-10 pr-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-emerald-600 outline-hidden"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition-colors"
          >
            Search
          </button>
        </form>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {/* City filter */}
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 outline-hidden"
          >
            <option value="">All Cities</option>
            {CITIES.map((c) => (
              <option key={c.slug} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Timeline filter */}
          <select
            value={timelineFilter}
            onChange={(e) => setTimelineFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 outline-hidden"
          >
            <option value="">All Timelines</option>
            <option value="WITHIN_7_DAYS">Within 7 Days</option>
            <option value="WITHIN_15_DAYS">Within 15 Days</option>
            <option value="WITHIN_30_45_DAYS">Within 30–45 Days</option>
          </select>

          {/* Quote filter */}
          <select
            value={quoteFilter}
            onChange={(e) => setQuoteFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 outline-hidden"
          >
            <option value="">Quote Status (Any)</option>
            <option value="true">Has Existing Quote</option>
            <option value="false">No Quote</option>
          </select>

          {/* Lead Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 outline-hidden"
          >
            <option value="">All Lead Statuses</option>
            <option value="NEW">New Lead</option>
            <option value="CONTACTED">Contacted</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="CONVERTED">Converted</option>
            <option value="DO_NOT_CONTACT">Do Not Contact</option>
          </select>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-gray-400">Loading leads...</div>
        ) : leads.length === 0 ? (
          <div className="p-12 text-center text-xs text-gray-500">
            No leads found matching the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100">
                <tr>
                  <th className="py-3.5 px-4">Date / Buyer #</th>
                  <th className="py-3.5 px-4">Buyer Details</th>
                  <th className="py-3.5 px-4">Pool / City</th>
                  <th className="py-3.5 px-4">Timeline</th>
                  <th className="py-3.5 px-4">Existing Quote</th>
                  <th className="py-3.5 px-4">Notes</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">WhatsApp Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-extrabold text-emerald-700">Buyer #{lead.buyerNumber}</div>
                      <div className="text-[11px] text-gray-400">{formatDateTime(lead.createdAt)}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-gray-950 text-sm">{lead.fullName}</div>
                      <div className="text-[11px] text-gray-500 font-mono">+91 {lead.whatsappNumber}</div>
                      {lead.locality && (
                        <div className="text-[10px] text-gray-500">
                          {lead.locality} {lead.pinCode ? `(${lead.pinCode})` : ''}
                        </div>
                      )}
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {lead.connectionOptIn && (
                          <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                            Connect Opt-in
                          </span>
                        )}
                        {lead.vendorShareConsent && (
                          <span className="text-[9px] font-bold text-blue-800 bg-blue-100 px-1.5 py-0.2 rounded">
                            Vendor Share OK
                          </span>
                        )}
                        {lead.doNotContact && (
                          <span className="text-[9px] font-bold text-rose-800 bg-rose-100 px-1.5 py-0.2 rounded">
                            Do Not Contact
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-gray-900">{lead.poolName}</div>
                      <div className="text-[11px] text-gray-500">{lead.city}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="text-[11px] text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                        {TIMELINE_LABELS[lead.buyingTimeline]}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {lead.hasExistingQuote ? (
                        <span className="font-semibold text-emerald-700">
                          Yes {lead.existingQuoteAmount ? `(${formatINR(lead.existingQuoteAmount)})` : ''}
                        </span>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs truncate" title={lead.extraMessage}>
                      {lead.extraMessage || <span className="text-gray-300 italic">—</span>}
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={lead.status}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value as LeadStatus)}
                        className={`text-[11px] font-semibold px-2 py-1 rounded-md border outline-hidden ${
                          lead.status === 'CONVERTED'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : lead.status === 'DO_NOT_CONTACT' || lead.doNotContact
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                      >
                        <option value="NEW">NEW</option>
                        <option value="CONTACTED">CONTACTED</option>
                        <option value="QUALIFIED">QUALIFIED</option>
                        <option value="CONVERTED">CONVERTED</option>
                        <option value="DO_NOT_CONTACT">DO_NOT_CONTACT</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {lead.status === 'DO_NOT_CONTACT' || lead.doNotContact ? (
                        <span className="inline-flex text-[11px] font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                          Opted Out
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleGenerateWhatsApp(lead)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Follow Up</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>
            Page {page} of {totalPages} ({total} total leads)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => loadLeads(page - 1)}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => loadLeads(page + 1)}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* WhatsApp Message Preview Modal */}
      {activeWhatsAppLead && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-lg w-full p-6 sm:p-8 relative">
            <button
              type="button"
              onClick={() => {
                setActiveWhatsAppLead(null);
                setGeneratedWhatsApp(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>

            <h3 className="text-lg font-bold text-gray-950 mb-1">
              WhatsApp Message Follow-Up
            </h3>
            <p className="text-xs text-gray-500 mb-5">
              Target Buyer: <strong>{activeWhatsAppLead.fullName}</strong> (+91 {activeWhatsAppLead.whatsappNumber})
            </p>

            {/* Template Chooser */}
            <div className="space-y-2 mb-4">
              <label className="block text-xs font-semibold text-gray-800">Select Message Template</label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => handleGenerateWhatsApp(activeWhatsAppLead, 'UNLOCKED_TOKEN')}
                  className={`text-left text-xs p-3 rounded-xl border transition-all ${
                    selectedTemplate === 'UNLOCKED_TOKEN'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-semibold'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-bold">1. Pool Unlocked — Refundable Token Link</div>
                  <div className="text-[11px] text-gray-500">Requires unlocked status, verified terms & payment link.</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleGenerateWhatsApp(activeWhatsAppLead, 'LEAD_FALLBACK')}
                  className={`text-left text-xs p-3 rounded-xl border transition-all ${
                    selectedTemplate === 'LEAD_FALLBACK'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-semibold'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-bold">2. Lead Fallback — Direct Showroom Quotation</div>
                  <div className="text-[11px] text-gray-500">Introduces partner dealer offer if threshold was not reached.</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleGenerateWhatsApp(activeWhatsAppLead, 'QUOTE_FOLLOWUP')}
                  className={`text-left text-xs p-3 rounded-xl border transition-all ${
                    selectedTemplate === 'QUOTE_FOLLOWUP'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-semibold'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-bold">3. Quotation Follow-up</div>
                  <div className="text-[11px] text-gray-500">Invites buyer to share existing quote to match/beat.</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleGenerateWhatsApp(activeWhatsAppLead, 'TARGET_REACHED_INVITATION')}
                  className={`text-left text-xs p-3 rounded-xl border transition-all ${
                    selectedTemplate === 'TARGET_REACHED_INVITATION'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-semibold'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-bold">4. Target Reached — Quotation Review Invitation</div>
                  <div className="text-[11px] text-gray-500">
                    Notifies buyer that the group reached its buyer target and quotes are under review. No fee or commitment.
                  </div>
                </button>
              </div>
            </div>

            {whatsAppError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 mb-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{whatsAppError}</span>
              </div>
            )}

            {isGeneratingWhatsApp && (
              <div className="py-6 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Constructing verified message...</span>
              </div>
            )}

            {generatedWhatsApp && !isGeneratingWhatsApp && (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-gray-700 whitespace-pre-line font-mono max-h-48 overflow-y-auto">
                  {generatedWhatsApp.text}
                </div>

                <div className="bg-amber-50 border border-amber-200 text-amber-900 text-[11px] rounded-xl p-3">
                  <strong>Important:</strong> Clicking below opens WhatsApp with this prefilled message. It does not send automatically. Review the message in WhatsApp and press Send.
                </div>

                <a
                  href={generatedWhatsApp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 text-xs font-bold px-4 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                >
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                  <span>Open Prefilled Message in WhatsApp</span>
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
