'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Users,
  Clock,
  DollarSign,
  Activity,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  ExternalLink,
  Shield,
  UserX,
  Lock,
  Tag,
  Plus,
} from 'lucide-react';
import {
  AdminPool,
  PoolLead,
  WaitlistEntry,
  PoolQuotation,
  AdminAuditLog,
  ConnectionFeeStatus,
  WhatsAppTemplateType,
} from '@/types';
import { formatINR, getCountdownParts } from '@/lib/format';
import { calculateSuggestedConnectionFee, CURRENT_FEE_RULE_VERSION } from '@/lib/fee';

interface AdminGroupDetailModalProps {
  pool: AdminPool;
  isOpen: boolean;
  onClose: () => void;
  onPoolUpdated?: (updated: AdminPool) => void;
}

export function AdminGroupDetailModal({
  pool,
  isOpen,
  onClose,
  onPoolUpdated,
}: AdminGroupDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'waitlist' | 'quotes' | 'fees' | 'audit'>('overview');

  // Members state
  const [members, setMembers] = useState<PoolLead[]>([]);
  const [membersTotal, setMembersTotal] = useState(0);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResponseFilter, setMemberResponseFilter] = useState('');
  const [memberFeeFilter, setMemberFeeFilter] = useState('');

  // Waitlist state
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [isLoadingWaitlist, setIsLoadingWaitlist] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);

  // Member decision summary state
  const [memberSummary, setMemberSummary] = useState<{
    totalMembers: number;
    interestedCount: number;
    declinedCount: number;
    awaitingCount: number;
    needsInfoCount: number;
    noResponseCount: number;
    connectedCount: number;
    excludedCount: number;
    optedOutCount: number;
  } | null>(null);

  // Quotes state
  const [quotes, setQuotes] = useState<PoolQuotation[]>([]);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [isAddingQuote, setIsAddingQuote] = useState(false);
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);
  const [quoteFormError, setQuoteFormError] = useState<string | null>(null);
  const [quoteForm, setQuoteForm] = useState({
    vendorName: '',
    vendorContactRef: '',
    quotedAmount: '',
    quoteDate: '',
    validUntil: '',
    scope: '',
    inclusions: 'GST 18% Included, Standard Installation, OEM Warranty',
    exclusions: 'Structural modifications, Extended wiring',
    deliveryTerms: 'Doorstep delivery within 7-10 business days upon group confirmation',
    quantityCondition: 'Valid for minimum cohort of confirmed buyers',
    internalNotes: '',
  });

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // WhatsApp manual modal state
  const [activeWhatsAppLead, setActiveWhatsAppLead] = useState<PoolLead | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplateType>('TARGET_REACHED_INVITATION');
  const [generatedWhatsApp, setGeneratedWhatsApp] = useState<{ url: string; text: string } | null>(null);
  const [isGeneratingWhatsApp, setIsGeneratingWhatsApp] = useState(false);
  const [whatsAppNote, setWhatsAppNote] = useState('');
  const [isRecordingSent, setIsRecordingSent] = useState(false);
  const [sentSuccessMessage, setSentSuccessMessage] = useState<string | null>(null);

  // Exclusion modal state
  const [excludingLead, setExcludingLead] = useState<PoolLead | null>(null);
  const [exclusionReason, setExclusionReason] = useState('');
  const [isSubmittingExclusion, setIsSubmittingExclusion] = useState(false);

  // Fee payment verification modal state
  const [verifyingFeeLead, setVerifyingFeeLead] = useState<PoolLead | null>(null);
  const [paymentRefInput, setPaymentRefInput] = useState('');
  const [feeStatusInput, setFeeStatusInput] = useState<ConnectionFeeStatus>('PAID_VERIFIED');
  const [feeWaiverReason, setFeeWaiverReason] = useState('');

  // Load pool members
  const loadMembers = useCallback(async () => {
    setIsLoadingMembers(true);
    try {
      const params = new URLSearchParams();
      if (memberSearch) params.set('search', memberSearch);
      if (memberResponseFilter) params.set('quoteResponse', memberResponseFilter);
      if (memberFeeFilter) params.set('feeStatus', memberFeeFilter);
      const res = await fetch(`/api/admin/pools/${pool.id}/members?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setMembers(data.data.members);
        setMembersTotal(data.data.total);
        if (data.data.summary) {
          setMemberSummary(data.data.summary);
        }
      }
    } catch (e) {
      console.error('Failed to load members:', e);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [pool.id, memberSearch, memberResponseFilter, memberFeeFilter]);

  // Load waitlist
  const loadWaitlist = useCallback(async () => {
    setIsLoadingWaitlist(true);
    try {
      const res = await fetch(`/api/admin/pools/${pool.id}/waitlist`);
      const data = await res.json();
      if (data.success) {
        setWaitlist(data.data);
      }
    } catch (e) {
      console.error('Failed to load waitlist:', e);
    } finally {
      setIsLoadingWaitlist(false);
    }
  }, [pool.id]);

  // Load quotations
  const loadQuotes = useCallback(async () => {
    setIsLoadingQuotes(true);
    try {
      const res = await fetch(`/api/admin/pools/${pool.id}/quotes`);
      const data = await res.json();
      if (data.success) {
        setQuotes(data.data);
      }
    } catch (e) {
      console.error('Failed to load quotes:', e);
    } finally {
      setIsLoadingQuotes(false);
    }
  }, [pool.id]);

  // Load audit logs
  const loadAuditLogs = useCallback(async () => {
    setIsLoadingAudit(true);
    try {
      const res = await fetch(`/api/admin/audit-logs?targetType=POOL&targetId=${pool.id}`);
      const data = await res.json();
      if (data.success) {
        setAuditLogs(data.data);
      }
    } catch (e) {
      console.error('Failed to load audit logs:', e);
    } finally {
      setIsLoadingAudit(false);
    }
  }, [pool.id]);

  useEffect(() => {
    if (!isOpen) return;
    let ignore = false;

    void Promise.resolve().then(async () => {
      if (ignore) return;
      await Promise.all([
        loadMembers(),
        loadWaitlist(),
        loadQuotes(),
        loadAuditLogs(),
      ]);
    });

    return () => {
      ignore = true;
    };
  }, [isOpen, loadMembers, loadWaitlist, loadQuotes, loadAuditLogs]);

  if (!isOpen) return null;

  // Handle member decision updates
  const handleUpdateMemberDecision = async (leadId: string, updates: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/admin/pools/${pool.id}/members/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success) {
        loadMembers();
        loadAuditLogs();
      }
    } catch (e) {
      console.error('Failed to update member decision:', e);
    }
  };

  // Handle Waitlist Promotion
  const handlePromoteWaitlist = async (waitlistId: string) => {
    setWaitlistError(null);
    try {
      const res = await fetch(`/api/admin/pools/${pool.id}/waitlist/${waitlistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PROMOTED' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setWaitlistError(data.error?.message || 'Failed to promote waitlist member.');
        return;
      }
      loadWaitlist();
      loadMembers();
      loadAuditLogs();
      if (onPoolUpdated) {
        onPoolUpdated({ ...pool, currentBuyers: pool.currentBuyers + 1 });
      }
    } catch {
      setWaitlistError('Network error promoting waitlist entry.');
    }
  };

  // Handle Waitlist Invite
  const handleInviteWaitlist = async (waitlistId: string) => {
    try {
      await fetch(`/api/admin/pools/${pool.id}/waitlist/${waitlistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'INVITED' }),
      });
      loadWaitlist();
      loadAuditLogs();
    } catch (e) {
      console.error('Failed to invite waitlist entry:', e);
    }
  };

  // Handle Quote Publish / Unpublish
  const handleTogglePublishQuote = async (quote: PoolQuotation) => {
    try {
      const nextPublished = !quote.isCurrentPublished;
      await fetch(`/api/admin/pools/${pool.id}/quotes/${quote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isCurrentPublished: nextPublished,
          status: nextPublished ? 'PUBLISHED' : 'RECEIVED',
        }),
      });
      loadQuotes();
      loadAuditLogs();
      if (onPoolUpdated) {
        if (nextPublished) {
          onPoolUpdated({
            ...pool,
            groupPrice: quote.quotedAmount,
            groupPriceType: quote.priceType === 'VENDOR_QUOTED' ? 'VENDOR_QUOTED' : 'INDICATIVE_ESTIMATE',
            dealerName: quote.vendorName,
            priceIsVerified: true,
          });
        } else {
          onPoolUpdated({
            ...pool,
            priceIsVerified: false,
            groupPriceType: 'INDICATIVE_ESTIMATE',
            dealerName: null,
          });
        }
      }
    } catch (e) {
      console.error('Failed to update quote publication:', e);
    }
  };

  // Handle Create Quote
  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteForm.vendorName.trim() || !quoteForm.quotedAmount || !quoteForm.scope.trim()) {
      setQuoteFormError('Vendor name, quoted amount, and scope are required.');
      return;
    }
    const amount = Number(quoteForm.quotedAmount);
    if (isNaN(amount) || amount <= 0) {
      setQuoteFormError('Please enter a valid quoted amount in INR.');
      return;
    }

    setQuoteFormError(null);
    setIsSubmittingQuote(true);

    try {
      const payload = {
        vendorName: quoteForm.vendorName.trim(),
        vendorContactRef: quoteForm.vendorContactRef.trim() || undefined,
        quotedAmount: amount,
        currency: 'INR',
        quoteDate: new Date(quoteForm.quoteDate).toISOString(),
        validUntil: new Date(quoteForm.validUntil).toISOString(),
        scope: quoteForm.scope.trim(),
        inclusions: quoteForm.inclusions
          ? quoteForm.inclusions.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        exclusions: quoteForm.exclusions
          ? quoteForm.exclusions.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        deliveryTerms: quoteForm.deliveryTerms.trim() || undefined,
        quantityCondition: quoteForm.quantityCondition.trim() || undefined,
        internalNotes: quoteForm.internalNotes.trim() || undefined,
        status: 'RECEIVED',
      };

      const res = await fetch('/api/admin/pools/' + pool.id + '/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setQuoteFormError(data.error?.message || 'Failed to record quotation.');
        return;
      }

      setIsAddingQuote(false);
      setQuoteForm({
        vendorName: '',
        vendorContactRef: '',
        quotedAmount: '',
        quoteDate: new Date().toISOString().split('T')[0],
        validUntil: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        scope: '',
        inclusions: 'GST 18% Included, Standard Installation, OEM Warranty',
        exclusions: 'Structural modifications, Extended wiring',
        deliveryTerms: 'Doorstep delivery within 7-10 business days upon group confirmation',
        quantityCondition: 'Valid for minimum cohort of confirmed buyers',
        internalNotes: '',
      });
      loadQuotes();
      loadAuditLogs();
    } catch {
      setQuoteFormError('Network error while recording quotation.');
    } finally {
      setIsSubmittingQuote(false);
    }
  };

  // Handle WhatsApp Link Generation
  const handleGenerateWhatsApp = async (lead: PoolLead, template = selectedTemplate) => {
    setActiveWhatsAppLead(lead);
    setSelectedTemplate(template);
    setIsGeneratingWhatsApp(true);
    setGeneratedWhatsApp(null);
    setSentSuccessMessage(null);

    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateType: template }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedWhatsApp({
          url: data.data.whatsappUrl,
          text: data.data.messageText,
        });
      }
    } catch (e) {
      console.error('Failed to generate WhatsApp:', e);
    } finally {
      setIsGeneratingWhatsApp(false);
    }
  };

  // Handle Explicit Manual SENT confirmation
  const handleConfirmSentWhatsApp = async () => {
    if (!activeWhatsAppLead) return;
    setIsRecordingSent(true);
    setSentSuccessMessage(null);
    try {
      const res = await fetch(`/api/admin/leads/${activeWhatsAppLead.id}/whatsapp/sent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateType: selectedTemplate,
          notes: whatsAppNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSentSuccessMessage('Communication recorded as SENT. Audit log updated.');
        loadMembers();
        loadAuditLogs();
      }
    } catch (e) {
      console.error('Failed to record sent status:', e);
    } finally {
      setIsRecordingSent(false);
    }
  };

  // Suggested connection fee
  const approvedBasis = pool.groupPrice || pool.marketPrice || null;
  const suggestedFee = approvedBasis ? calculateSuggestedConnectionFee(approvedBasis) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-gray-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl border border-gray-200/80 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Bar */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-gray-200/80 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                {pool.city} • {pool.category}
              </span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                pool.status === 'UNLOCKED'
                  ? 'bg-blue-100 text-blue-800'
                  : pool.status === 'ACTIVE'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {pool.status}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-gray-950 tracking-tight mt-1">
              {pool.name}
            </h2>
            <p className="text-xs text-gray-500">
              Capacity: {pool.currentBuyers} / {pool.targetBuyers} Buyers • Deadline: {new Date(pool.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Tab Strip */}
        <div className="flex border-b border-gray-200 bg-white px-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 py-3.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'overview'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Overview & State</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-1.5 py-3.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'members'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Accepted Members ({membersTotal})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('waitlist')}
            className={`flex items-center gap-1.5 py-3.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'waitlist'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>FIFO Waitlist ({waitlist.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('quotes')}
            className={`flex items-center gap-1.5 py-3.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'quotes'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Quotations ({quotes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('fees')}
            className={`flex items-center gap-1.5 py-3.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'fees'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Connection & Fees</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-1.5 py-3.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'audit'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Activity History</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/30">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs">
                  <div className="text-xs text-gray-500 font-medium">Progress & Target</div>
                  <div className="text-2xl font-black text-gray-950 mt-1">
                    {pool.currentBuyers} / {pool.targetBuyers}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {pool.currentBuyers >= pool.targetBuyers
                      ? 'Target capacity reached. Regular joins closed.'
                      : `${pool.targetBuyers - pool.currentBuyers} more buyers needed to unlock.`}
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mt-3 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.round((pool.currentBuyers / pool.targetBuyers) * 100))}%` }}
                    />
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs">
                  <div className="text-xs text-gray-500 font-medium">Active Price Label</div>
                  <div className="text-2xl font-black text-gray-950 mt-1">
                    {pool.groupPrice ? formatINR(pool.groupPrice) : 'Estimating'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Type: <span className="font-semibold text-gray-800">{pool.groupPriceType || 'INDICATIVE_ESTIMATE'}</span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-2">
                    Market Ref: {pool.marketPrice ? formatINR(pool.marketPrice) : 'Not specified'}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs">
                  <div className="text-xs text-gray-500 font-medium">Connection Status</div>
                  <div className="text-lg font-bold text-gray-900 mt-1">
                    {pool.connectionStatus || 'NOT_ELIGIBLE'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Payment Gateway: <span className="font-semibold text-rose-700">DISABLED (No Token Gate)</span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-2">
                    Published: {pool.isPublished ? 'Yes (Public)' : 'No (Draft/Private)'}
                  </div>
                </div>
              </div>

              {/* Operational Next Steps */}
              <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-950">
                <div className="font-bold flex items-center gap-1.5 text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Manual Operations Protocol (MVP Contract)</span>
                </div>
                <p className="mt-1 leading-relaxed text-amber-900/90">
                  Target reached does not automatically imply a quotation is accepted, a fee is collected, or members are connected.
                  Use the <strong>Quotes</strong> tab to publish verified supplier terms, the <strong>Members</strong> tab to contact buyers via WhatsApp, and record member confirmation manually before connection.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: MEMBERS */}
          {activeTab === 'members' && (
            <div className="space-y-4">
              {/* Persisted Member Decision Lifecycle Summary */}
              {memberSummary && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
                    <div className="text-[11px] font-medium text-slate-500">Confirmed</div>
                    <div className="text-lg font-bold text-slate-900">{memberSummary.totalMembers}</div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-2.5">
                    <div className="text-[11px] font-medium text-emerald-700">Interested</div>
                    <div className="text-lg font-bold text-emerald-800">{memberSummary.interestedCount}</div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-2.5">
                    <div className="text-[11px] font-medium text-amber-700">Declined</div>
                    <div className="text-lg font-bold text-amber-800">{memberSummary.declinedCount}</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200/80 rounded-xl p-2.5">
                    <div className="text-[11px] font-medium text-blue-700">Awaiting</div>
                    <div className="text-lg font-bold text-blue-800">{memberSummary.awaitingCount + memberSummary.needsInfoCount + memberSummary.noResponseCount}</div>
                  </div>
                  <div className="bg-purple-50 border border-purple-200/80 rounded-xl p-2.5 col-span-2 sm:col-span-1">
                    <div className="text-[11px] font-medium text-purple-700">Connected</div>
                    <div className="text-lg font-bold text-purple-800">{memberSummary.connectedCount}</div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
                <div className="relative flex-1 max-w-sm w-full">
                  <input
                    type="search"
                    placeholder="Search member name or phone..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="w-full text-xs pl-3.5 pr-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium"
                  />
                </div>

                <div className="flex gap-2">
                  <select
                    value={memberResponseFilter}
                    onChange={(e) => setMemberResponseFilter(e.target.value)}
                    className="text-xs px-2.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 font-medium"
                  >
                    <option value="">All Quote Responses</option>
                    <option value="NOT_SENT">Not Sent</option>
                    <option value="AWAITING_RESPONSE">Awaiting Response</option>
                    <option value="INTERESTED">Interested</option>
                    <option value="DECLINED">Declined</option>
                    <option value="NEEDS_INFORMATION">Needs Info</option>
                    <option value="NO_RESPONSE">No Response</option>
                  </select>

                  <select
                    value={memberFeeFilter}
                    onChange={(e) => setMemberFeeFilter(e.target.value)}
                    className="text-xs px-2.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 font-medium"
                  >
                    <option value="">All Fee States</option>
                    <option value="NOT_REQUESTED">Fee Not Requested</option>
                    <option value="DISCLOSED_PENDING">Disclosed Pending</option>
                    <option value="PAYMENT_REPORTED">Payment Reported</option>
                    <option value="PAID_VERIFIED">Paid Verified</option>
                    <option value="WAIVED">Waived</option>
                  </select>
                </div>
              </div>

              {isLoadingMembers ? (
                <div className="py-12 text-center text-xs text-gray-500">Loading group members...</div>
              ) : members.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-xs text-gray-500">
                  No members matched the filter.
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-600 font-bold">
                        <th className="py-3 px-3.5">#</th>
                        <th className="py-3 px-3.5">Buyer</th>
                        <th className="py-3 px-3.5">WhatsApp</th>
                        <th className="py-3 px-3.5">Quote Response</th>
                        <th className="py-3 px-3.5">Fee Status</th>
                        <th className="py-3 px-3.5">Connection</th>
                        <th className="py-3 px-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {members.map((lead) => (
                        <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-3.5 font-bold text-gray-700">
                            #{lead.buyerNumber}
                          </td>
                          <td className="py-3 px-3.5">
                            <div className="font-bold text-gray-950">{lead.fullName}</div>
                            <div className="text-[11px] text-gray-400">
                              Joined {new Date(lead.createdAt).toLocaleDateString('en-IN')}
                            </div>
                            <div className="text-[11px] text-gray-600 flex items-center gap-1.5 flex-wrap mt-0.5">
                              {(lead.locality || lead.pincode || lead.pinCode) && (
                                <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px]">
                                  {[lead.locality, lead.pincode || lead.pinCode].filter(Boolean).join(' • ')}
                                </span>
                              )}
                              {(lead.existingQuote || lead.existing_quote) && (
                                <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded text-[10px]">
                                  Existing: {lead.existingQuote || lead.existing_quote} <span className="text-[9px] text-amber-600 font-semibold">(Customer Reported)</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3.5 font-mono text-gray-800">
                            {lead.doNotContact ? (
                              <span className="text-rose-700 font-bold flex items-center gap-1">
                                <Lock className="w-3 h-3" /> DO NOT CONTACT
                              </span>
                            ) : (
                              `+91 ${lead.whatsappNumber}`
                            )}
                          </td>
                          <td className="py-3 px-3.5">
                            <select
                              value={lead.quoteResponse || 'NOT_SENT'}
                              onChange={(e) => handleUpdateMemberDecision(lead.id, { quoteResponse: e.target.value })}
                              className="text-[11px] px-2 py-1 rounded-lg border border-gray-200 bg-white font-medium"
                            >
                              <option value="NOT_SENT">Not Sent</option>
                              <option value="AWAITING_RESPONSE">Awaiting Response</option>
                              <option value="INTERESTED">Interested</option>
                              <option value="DECLINED">Declined</option>
                              <option value="NEEDS_INFORMATION">Needs Info</option>
                              <option value="NO_RESPONSE">No Response</option>
                            </select>
                          </td>
                          <td className="py-3 px-3.5">
                            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              lead.feeStatus === 'PAID_VERIFIED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : lead.feeStatus === 'PAYMENT_REPORTED'
                                ? 'bg-amber-100 text-amber-800'
                                : lead.feeStatus === 'WAIVED'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {lead.feeStatus || 'NOT_REQUESTED'}
                            </span>
                            {lead.paymentReference && (
                              <div className="text-[10px] font-mono text-gray-500 mt-0.5">
                                Ref: {lead.paymentReference}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3.5">
                            <select
                              value={lead.connectionStatus || 'NOT_READY'}
                              onChange={(e) => handleUpdateMemberDecision(lead.id, { connectionStatus: e.target.value })}
                              className="text-[11px] px-2 py-1 rounded-lg border border-gray-200 bg-white font-medium"
                            >
                              <option value="NOT_READY">Not Ready</option>
                              <option value="OPTED_IN">Opted In</option>
                              <option value="ELIGIBLE_TO_CONNECT">Eligible</option>
                              <option value="CONNECTED">Connected</option>
                              <option value="OPTED_OUT">Opted Out</option>
                              <option value="EXCLUDED">Excluded</option>
                            </select>
                          </td>
                          <td className="py-3 px-3.5 text-right space-x-1">
                            <button
                              type="button"
                              onClick={() => handleGenerateWhatsApp(lead)}
                              disabled={lead.doNotContact}
                              className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                              title="Open WhatsApp click-to-chat"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setVerifyingFeeLead(lead);
                                setPaymentRefInput(lead.paymentReference || '');
                                setFeeStatusInput(lead.feeStatus || 'PAID_VERIFIED');
                              }}
                              className="p-1.5 rounded-lg text-blue-700 hover:bg-blue-50 transition-colors"
                              title="Record / Verify Payment"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setExcludingLead(lead);
                                setExclusionReason('');
                              }}
                              className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-50 transition-colors"
                              title="Exclude Member with reason"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FIFO WAITLIST */}
          {activeTab === 'waitlist' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-gray-950">FIFO Priority Waitlist Queue</h3>
                  <p className="text-xs text-gray-500">
                    Buyers are ordered strictly by registration sequence. When a slot opens, invite or promote the next candidate.
                  </p>
                </div>
              </div>

              {waitlistError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{waitlistError}</span>
                </div>
              )}

              {isLoadingWaitlist ? (
                <div className="py-12 text-center text-xs text-gray-500">Loading waitlist...</div>
              ) : waitlist.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-xs text-gray-500">
                  No buyers currently on the waitlist for this pool.
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-600 font-bold">
                        <th className="py-3 px-3.5">Queue #</th>
                        <th className="py-3 px-3.5">Candidate</th>
                        <th className="py-3 px-3.5">WhatsApp</th>
                        <th className="py-3 px-3.5">Status</th>
                        <th className="py-3 px-3.5">Joined Waitlist</th>
                        <th className="py-3 px-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {waitlist.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-3.5 font-bold text-emerald-800">
                            #{item.sequenceNumber}
                          </td>
                          <td className="py-3 px-3.5">
                            <div className="font-bold text-gray-950">{item.fullName}</div>
                            <div className="text-[11px] text-gray-600 flex items-center gap-1.5 flex-wrap mt-0.5">
                              {(item.locality || item.pincode || item.pinCode) && (
                                <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px]">
                                  {[item.locality, item.pincode || item.pinCode].filter(Boolean).join(' • ')}
                                </span>
                              )}
                              {item.existing_quote && (
                                <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded text-[10px]">
                                  Existing: {item.existing_quote} <span className="text-[9px] text-amber-600 font-semibold">(Customer Reported)</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3.5 font-mono text-gray-800">
                            +91 {item.whatsappNumber}
                          </td>
                          <td className="py-3 px-3.5">
                            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              item.status === 'WAITING'
                                ? 'bg-amber-100 text-amber-800'
                                : item.status === 'INVITED'
                                ? 'bg-blue-100 text-blue-800'
                                : item.status === 'PROMOTED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-gray-500">
                            {new Date(item.createdAt).toLocaleDateString('en-IN')}
                          </td>
                          <td className="py-3 px-3.5 text-right space-x-2">
                            {item.status === 'WAITING' && (
                              <button
                                type="button"
                                onClick={() => handleInviteWaitlist(item.id)}
                                className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-[11px]"
                              >
                                Send Invitation
                              </button>
                            )}
                            {item.status !== 'PROMOTED' && (
                              <button
                                type="button"
                                onClick={() => handlePromoteWaitlist(item.id)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-semibold text-[11px]"
                              >
                                Promote to Member
                              </button>
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

          {/* TAB 4: QUOTATIONS */}
          {activeTab === 'quotes' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-gray-950">Group Supplier Quotations</h3>
                  <p className="text-xs text-gray-500">
                    Manage vendor quotes, taxes, warranties, delivery terms, and public verification publication.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQuoteFormError(null);
                    const now = new Date();
                    const validDate = new Date(now.getTime() + 30 * 86400000);
                    setQuoteForm((prev) => ({
                      ...prev,
                      quoteDate: now.toISOString().split('T')[0],
                      validUntil: validDate.toISOString().split('T')[0],
                    }));
                    setIsAddingQuote(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Record Quotation</span>
                </button>
              </div>

              {isLoadingQuotes ? (
                <div className="py-12 text-center text-xs text-gray-500">Loading quotations...</div>
              ) : quotes.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-xs text-gray-500">
                  No quotations recorded yet. Click &quot;Record Quotation&quot; to add a supplier offer.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {quotes.map((q) => {
                    const isExpired = getCountdownParts(q.validUntil).isExpired;
                    return (
                      <div
                        key={q.id}
                        className={`rounded-2xl border p-4 bg-white shadow-xs transition-all space-y-3 ${
                          q.isCurrentPublished
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                            : isExpired
                            ? 'border-gray-200 opacity-80'
                            : 'border-gray-200'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              q.priceType === 'VENDOR_QUOTED' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {q.priceType}
                            </span>
                            <h4 className="text-sm font-bold text-gray-950 mt-1">{q.vendorName}</h4>
                          </div>
                          <div className="text-right">
                            <div className="text-base font-black text-gray-950">{formatINR(q.quotedAmount)}</div>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                              q.status === 'PUBLISHED' && !isExpired
                                ? 'bg-emerald-100 text-emerald-800'
                                : isExpired
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {isExpired ? 'EXPIRED' : q.status}
                            </span>
                          </div>
                        </div>

                        <div className="text-xs text-gray-700">
                          {q.scope}
                        </div>

                        {/* Inclusions & Exclusions */}
                        {((q.inclusions && q.inclusions.length > 0) || (q.exclusions && q.exclusions.length > 0)) && (
                          <div className="space-y-1.5 pt-1 text-[11px]">
                            {q.inclusions && q.inclusions.length > 0 && (
                              <div className="flex flex-wrap gap-1 items-center">
                                <span className="font-semibold text-emerald-700">Includes:</span>
                                {q.inclusions.map((inc, i) => (
                                  <span key={i} className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-100">
                                    {inc}
                                  </span>
                                ))}
                              </div>
                            )}
                            {q.exclusions && q.exclusions.length > 0 && (
                              <div className="flex flex-wrap gap-1 items-center">
                                <span className="font-semibold text-rose-600">Excludes:</span>
                                {q.exclusions.map((exc, i) => (
                                  <span key={i} className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100">
                                    {exc}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Delivery & Quantity Condition */}
                        {(q.deliveryTerms || q.quantityCondition) && (
                          <div className="text-[11px] text-gray-500 bg-gray-50 p-2 rounded-xl space-y-0.5">
                            {q.deliveryTerms && <div><strong>Delivery:</strong> {q.deliveryTerms}</div>}
                            {q.quantityCondition && <div><strong>Condition:</strong> {q.quantityCondition}</div>}
                          </div>
                        )}

                        <div className="text-[11px] text-gray-400 flex items-center justify-between pt-1">
                          <span className={isExpired ? 'text-rose-600 font-semibold' : ''}>
                            Valid until: {new Date(q.validUntil).toLocaleDateString('en-IN')} {isExpired && '(Expired)'}
                          </span>
                          {q.isCurrentPublished && !isExpired && (
                            <span className="font-bold text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Published Live
                            </span>
                          )}
                        </div>

                        <div className="pt-2 border-t border-gray-100 flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={isExpired && !q.isCurrentPublished}
                            onClick={() => handleTogglePublishQuote(q)}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors ${
                              q.isCurrentPublished
                                ? 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                : isExpired
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700'
                            }`}
                          >
                            {q.isCurrentPublished ? 'Unpublish Quote' : isExpired ? 'Cannot Publish (Expired)' : 'Publish to Group'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: CONNECTION & FEES */}
          {activeTab === 'fees' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-sm font-bold text-gray-950">Proposed Connection Fee Calculation</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-gray-500">Approved Fee Basis</div>
                    <div className="text-base font-bold text-gray-900 mt-0.5">{approvedBasis ? formatINR(approvedBasis) : <span className="text-amber-700 text-xs font-semibold">Not Set</span>}</div>
                    <div className="text-[11px] text-gray-400 mt-1">Based on active group quotation</div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-gray-500">Suggested Fee ({CURRENT_FEE_RULE_VERSION})</div>
                    <div className="text-base font-bold text-emerald-700 mt-0.5">{suggestedFee !== null ? formatINR(suggestedFee) : <span className="text-amber-700 text-xs font-medium">Fee calculation disabled — set approved quotation basis first</span>}</div>
                    <div className="text-[11px] text-gray-400 mt-1">Formula: max(₹99, 0.10% × basis)</div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-gray-500">Payment Collection Mode</div>
                    <div className="text-base font-bold text-rose-700 mt-0.5">DISABLED (MVP Rule)</div>
                    <div className="text-[11px] text-gray-400 mt-1">No payment gateway active</div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 text-blue-900 text-xs rounded-xl p-3">
                  <strong>Operational Policy:</strong> Connection fees are never charged silently or before the buyer target is reached. Admin manually records member-reported transaction references or waives fee with logged reason.
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-950">Activity History for Pool</h3>

              {isLoadingAudit ? (
                <div className="py-12 text-center text-xs text-gray-500">Loading audit history...</div>
              ) : auditLogs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-xs text-gray-500">
                  No activity logs recorded yet.
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs divide-y divide-gray-100">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-3.5 text-xs hover:bg-slate-50/50 transition-colors">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-gray-900">{log.action}</span>
                        <span className="text-[11px] text-gray-400 font-mono">
                          {new Date(log.createdAt).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="text-gray-600 mt-1">
                        {log.details?.changesSummary ? String(log.details.changesSummary) : 'Operator mutation recorded.'}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono mt-1">
                        Actor: {log.actor || 'admin_session'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Exclusion Modal Sub-dialog */}
        {excludingLead && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-gray-950/50">
            <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-xl space-y-4">
              <h4 className="text-sm font-bold text-gray-950">Exclude Member with Reason</h4>
              <p className="text-xs text-gray-500">
                Excluding #{excludingLead.buyerNumber} ({excludingLead.fullName}) releases their capacity slot. A mandatory reason is logged to the audit trail.
              </p>
              <textarea
                value={exclusionReason}
                onChange={(e) => setExclusionReason(e.target.value)}
                placeholder="Reason for exclusion (e.g. Member opted out, unresponsive after deadline)..."
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-hidden font-medium"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setExcludingLead(null)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!exclusionReason.trim()) return;
                    setIsSubmittingExclusion(true);
                    try {
                      const res = await fetch(`/api/admin/pools/${pool.id}/members/${excludingLead.id}`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ exclusionReason: exclusionReason.trim() }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        await Promise.all([loadMembers(), loadAuditLogs()]);
                        if (onPoolUpdated && typeof data.data?.currentBuyers === 'number') {
                          onPoolUpdated({ ...pool, currentBuyers: data.data.currentBuyers });
                        }
                      }
                    } catch (e) {
                      console.error('Failed to exclude member:', e);
                    } finally {
                      setIsSubmittingExclusion(false);
                      setExcludingLead(null);
                    }
                  }}
                  disabled={!exclusionReason.trim() || isSubmittingExclusion}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingExclusion ? 'Excluding...' : 'Confirm Exclusion'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Fee Verification Modal Sub-dialog */}
        {verifyingFeeLead && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-gray-950/50">
            <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-xl space-y-4">
              <h4 className="text-sm font-bold text-gray-950">Record / Verify Connection Fee</h4>
              <p className="text-xs text-gray-500">
                Buyer: #{verifyingFeeLead.buyerNumber} ({verifyingFeeLead.fullName})
              </p>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Fee Status</label>
                  <select
                    value={feeStatusInput}
                    onChange={(e) => setFeeStatusInput(e.target.value as ConnectionFeeStatus)}
                    className="w-full p-2.5 rounded-xl border border-gray-200 bg-white"
                  >
                    <option value="PAID_VERIFIED">Paid Verified (Admin Confirmed)</option>
                    <option value="PAYMENT_REPORTED">Payment Reported (Pending Verification)</option>
                    <option value="DISCLOSED_PENDING">Disclosed Pending Agreement</option>
                    <option value="WAIVED">Waived (Fee Waived)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Payment Reference (UPI / UTR / Receipt)</label>
                  <input
                    type="text"
                    value={paymentRefInput}
                    onChange={(e) => setPaymentRefInput(e.target.value)}
                    placeholder="e.g. UPI-20261027-123456"
                    className="w-full p-2.5 rounded-xl border border-gray-200 font-mono"
                  />
                </div>

                {feeStatusInput === 'WAIVED' && (
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Reason for Waiver</label>
                    <input
                      type="text"
                      value={feeWaiverReason}
                      onChange={(e) => setFeeWaiverReason(e.target.value)}
                      placeholder="e.g. Promotional pilot cohort waiver"
                      className="w-full p-2.5 rounded-xl border border-gray-200"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVerifyingFeeLead(null)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await handleUpdateMemberDecision(verifyingFeeLead.id, {
                      feeStatus: feeStatusInput,
                      paymentReference: paymentRefInput.trim() || undefined,
                      paymentWaiverReason: feeWaiverReason.trim() || undefined,
                    });
                    setVerifyingFeeLead(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                >
                  Save Verification
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RECORD QUOTATION MODAL */}
        {isAddingQuote && (
          <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <h4 className="text-sm font-bold text-gray-950">Record Supplier Quotation</h4>
                <button type="button" onClick={() => setIsAddingQuote(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {quoteFormError && (
                <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
                  {quoteFormError}
                </div>
              )}

              <form onSubmit={handleCreateQuote} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Supplier / Dealer Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Authorized Tata Motors EV Dealership..."
                    value={quoteForm.vendorName}
                    onChange={(e) => setQuoteForm({ ...quoteForm, vendorName: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-gray-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Quoted Price (₹) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="e.g. 145000"
                      value={quoteForm.quotedAmount}
                      onChange={(e) => setQuoteForm({ ...quoteForm, quotedAmount: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-gray-200 font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Valid Until Date *</label>
                    <input
                      type="date"
                      required
                      value={quoteForm.validUntil}
                      onChange={(e) => setQuoteForm({ ...quoteForm, validUntil: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-gray-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Quotation Scope & Specifications *</label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Detailed package scope (e.g. 5kW On-Grid Solar System with Bi-Facial Panels & Net-metering setup)..."
                    value={quoteForm.scope}
                    onChange={(e) => setQuoteForm({ ...quoteForm, scope: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-gray-200"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Inclusions (Taxes, Warranty, Delivery - comma separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. 18% GST Included, 5-Year Inverter Warranty, Free Doorstep Delivery..."
                    value={quoteForm.inclusions}
                    onChange={(e) => setQuoteForm({ ...quoteForm, inclusions: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-gray-200"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Exclusions (comma separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Extended cabling beyond 15m, Civil foundation work..."
                    value={quoteForm.exclusions}
                    onChange={(e) => setQuoteForm({ ...quoteForm, exclusions: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-gray-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Delivery Terms</label>
                    <input
                      type="text"
                      placeholder="e.g. Delivery in 7-10 days..."
                      value={quoteForm.deliveryTerms}
                      onChange={(e) => setQuoteForm({ ...quoteForm, deliveryTerms: e.target.value })}
                      className="w-full p-2 rounded-xl border border-gray-200"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Quantity Condition</label>
                    <input
                      type="text"
                      placeholder="e.g. Cohort of 10+ buyers..."
                      value={quoteForm.quantityCondition}
                      onChange={(e) => setQuoteForm({ ...quoteForm, quantityCondition: e.target.value })}
                      className="w-full p-2 rounded-xl border border-gray-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Vendor Contact Reference (Private)</label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Kumar (GM Sales, 9826012345)..."
                    value={quoteForm.vendorContactRef}
                    onChange={(e) => setQuoteForm({ ...quoteForm, vendorContactRef: e.target.value })}
                    className="w-full p-2 rounded-xl border border-gray-200"
                  />
                </div>

                <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingQuote(false)}
                    className="px-4 py-2 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingQuote}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isSubmittingQuote ? 'Recording...' : 'Record Quotation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* WHATSAPP CLICK-TO-CHAT & SENT TRACKER MODAL */}
        {activeWhatsAppLead && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-gray-950/50">
            <div className="bg-white rounded-3xl p-5 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-gray-950">WhatsApp Click-to-Chat & Manual Sent Tracker</h4>
                <button type="button" onClick={() => setActiveWhatsAppLead(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-gray-600">
                To: <span className="font-bold text-gray-950">{activeWhatsAppLead.fullName}</span> (+91 {activeWhatsAppLead.whatsappNumber})
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Select Message Template</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => handleGenerateWhatsApp(activeWhatsAppLead, e.target.value as WhatsAppTemplateType)}
                  className="w-full text-xs p-2.5 rounded-xl border border-gray-200 bg-white"
                >
                  <option value="TARGET_REACHED_INVITATION">1. Target Reached — Quotation Review Invitation</option>
                  <option value="QUOTE_AVAILABLE">2. Quotation Available — Request Decision (Interested/Declined)</option>
                  <option value="RESPONSE_REMINDER">3. Response Reminder — Group Finalization</option>
                  <option value="CONNECTION_FEE_DISCLOSURE">4. Connection Fee Disclosure & Terms</option>
                  <option value="PAYMENT_INSTRUCTIONS">5. Payment Instructions (UPI / UTR)</option>
                  <option value="WAITLIST_INVITATION">6. Waitlist Capacity Invitation</option>
                  <option value="WAITLIST_PROMOTION">7. Waitlist Promoted to Active Member</option>
                  <option value="EXCLUSION_NOTICE">8. Exclusion Notice</option>
                  <option value="GROUP_COMPLETED">9. Group Buy Round Completed</option>
                  <option value="OPT_OUT_CONFIRMATION">10. Opt-out Confirmation (Do Not Contact)</option>
                </select>
              </div>

              {isGeneratingWhatsApp ? (
                <div className="py-6 text-center text-xs text-gray-500">Generating verified message...</div>
              ) : generatedWhatsApp ? (
                <div className="space-y-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-gray-800 whitespace-pre-line max-h-40 overflow-y-auto">
                    {generatedWhatsApp.text}
                  </div>

                  <a
                    href={generatedWhatsApp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open in WhatsApp (Manual Review & Send)</span>
                  </a>

                  {/* Manual Sent Confirmation */}
                  <div className="pt-3 border-t border-gray-100 space-y-2">
                    <label className="text-[11px] font-bold text-gray-700 block">
                      After pressing Send in WhatsApp, record manual sent status:
                    </label>
                    <input
                      type="text"
                      placeholder="Optional operator notes (e.g. Sent via WhatsApp Desktop)..."
                      value={whatsAppNote}
                      onChange={(e) => setWhatsAppNote(e.target.value)}
                      className="w-full text-xs p-2 rounded-xl border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={handleConfirmSentWhatsApp}
                      disabled={isRecordingSent}
                      className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>{isRecordingSent ? 'Recording...' : 'Mark Communication as SENT'}</span>
                    </button>
                    {sentSuccessMessage && (
                      <div className="text-[11px] text-emerald-700 font-medium text-center">{sentSuccessMessage}</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
