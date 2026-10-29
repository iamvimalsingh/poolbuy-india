'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Tag,
  MessageSquare,
  Plus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  FileText,
  Copy,
  Check,
} from 'lucide-react';
import { AdminPool, PoolQuotation } from '@/types';
import { formatINR } from '@/lib/format';
import {
  buildTargetReachedMessage,
  buildQuoteAvailableMessage,
  buildPaymentInstructionsMessage,
  buildWaitlistInvitationMessage,
} from '@/lib/whatsapp';

export function AdminQuotesTab() {
  const [pools, setPools] = useState<AdminPool[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState<string>('');
  const [quotes, setQuotes] = useState<PoolQuotation[]>([]);
  const [isLoadingPools, setIsLoadingPools] = useState(true);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New quote modal
  const [isAddingQuote, setIsAddingQuote] = useState(false);
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    vendorName: '',
    vendorContactRef: '',
    quotedAmount: '',
    quoteDate: '',
    validUntil: '',
    scope: 'Group supply and doorstep commissioning',
    inclusions: 'GST 18% Included, Standard Installation, OEM Warranty',
    exclusions: 'Structural modifications, Custom wiring beyond 5m',
    deliveryTerms: '7-10 business days upon cohort finalization',
    quantityCondition: 'Valid for full group cohort order',
    internalNotes: '',
  });

  const openAddQuoteModal = () => {
    const today = new Date().toISOString().split('T')[0];
    const twoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    setQuoteForm({
      vendorName: '',
      vendorContactRef: '',
      quotedAmount: '',
      quoteDate: today,
      validUntil: twoWeeks,
      scope: 'Group supply and doorstep commissioning',
      inclusions: 'GST 18% Included, Standard Installation, OEM Warranty',
      exclusions: 'Structural modifications, Custom wiring beyond 5m',
      deliveryTerms: '7-10 business days upon cohort finalization',
      quantityCondition: 'Valid for full group cohort order',
      internalNotes: '',
    });
    setIsAddingQuote(true);
  };

  // WhatsApp template preview state
  const [selectedTemplate, setSelectedTemplate] = useState<
    'TARGET_REACHED' | 'QUOTE_AVAILABLE' | 'SUPPLIER_COORDINATION' | 'WAITLIST_INVITE'
  >('QUOTE_AVAILABLE');
  const [customPhone, setCustomPhone] = useState('');
  const [buyerNamePreview, setBuyerNamePreview] = useState('Rahul Verma');
  const [copied, setCopied] = useState(false);

  // Fetch pools
  const loadPools = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/pools');
      const data = await res.json();
      if (res.ok && data.pools) {
        setPools(data.pools);
        if (data.pools.length > 0) {
          setSelectedPoolId((prev) => prev || data.pools[0].id);
        }
      }
    } catch {
      setErrorMessage('Failed to load pools for quotes management.');
    } finally {
      setIsLoadingPools(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    void (async () => {
      if (!ignore) {
        await loadPools();
      }
    })();
    return () => {
      ignore = true;
    };
  }, [loadPools]);

  // Fetch quotes when selected pool changes
  const loadQuotes = useCallback(async (poolId: string) => {
    if (!poolId) return;
    try {
      const res = await fetch(`/api/admin/pools/${poolId}/quotes`);
      const data = await res.json();
      if (res.ok && data.data) {
        setQuotes(data.data);
      } else {
        setQuotes([]);
      }
    } catch {
      setQuotes([]);
    } finally {
      setIsLoadingQuotes(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    if (selectedPoolId) {
      void (async () => {
        if (!ignore) {
          await loadQuotes(selectedPoolId);
        }
      })();
    }
    return () => {
      ignore = true;
    };
  }, [selectedPoolId, loadQuotes]);

  const selectedPool = useMemo(() => {
    return pools.find((p) => p.id === selectedPoolId) || null;
  }, [pools, selectedPoolId]);

  // Handle add quote
  const handleAddQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPoolId) return;

    const amount = Number(quoteForm.quotedAmount);
    if (!amount || amount <= 0) {
      setErrorMessage('Please enter a valid quotation amount in INR.');
      return;
    }

    setIsSubmittingQuote(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/admin/pools/${selectedPoolId}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceType: 'VENDOR_QUOTED',
          vendorName: quoteForm.vendorName,
          vendorContactRef: quoteForm.vendorContactRef || undefined,
          quotedAmount: amount,
          quoteDate: quoteForm.quoteDate,
          validUntil: quoteForm.validUntil,
          scope: quoteForm.scope,
          inclusions: quoteForm.inclusions.split(',').map((s) => s.trim()).filter(Boolean),
          exclusions: quoteForm.exclusions.split(',').map((s) => s.trim()).filter(Boolean),
          deliveryTerms: quoteForm.deliveryTerms,
          quantityCondition: quoteForm.quantityCondition,
          internalNotes: quoteForm.internalNotes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to record supplier quotation.');
      }

      setSuccessMessage(`Supplier quotation from "${quoteForm.vendorName}" recorded successfully!`);
      setIsAddingQuote(false);
      loadQuotes(selectedPoolId);
      loadPools();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error adding quotation.');
    } finally {
      setIsSubmittingQuote(false);
    }
  };

  // WhatsApp message generation
  const activeWhatsAppText = useMemo(() => {
    if (!selectedPool) return '';
    const groupPrice = selectedPool.groupPrice || 0;

    switch (selectedTemplate) {
      case 'QUOTE_AVAILABLE':
        return buildQuoteAvailableMessage(
          buyerNamePreview,
          selectedPool.name,
          selectedPool.city,
          groupPrice,
          selectedPool.deadline
        );
      case 'TARGET_REACHED':
        return buildTargetReachedMessage(
          buyerNamePreview,
          selectedPool.name,
          selectedPool.city,
          selectedPool.targetBuyers
        );
      case 'SUPPLIER_COORDINATION':
        return buildPaymentInstructionsMessage(
          buyerNamePreview,
          selectedPool.name,
          selectedPool.dealerName || 'Authorized Local Partner',
          'The authorized supplier will contact you directly for site consultation and official invoicing.\nZero platform fees collected by GroupBuying.'
        );
      case 'WAITLIST_INVITE':
        return buildWaitlistInvitationMessage(
          buyerNamePreview,
          selectedPool.name,
          selectedPool.city,
          1
        );
      default:
        return '';
    }
  }, [selectedPool, selectedTemplate, buyerNamePreview]);

  const whatsappDirectUrl = useMemo(() => {
    if (!customPhone) return '';
    const cleanPhone = customPhone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(activeWhatsAppText)}`;
  }, [customPhone, activeWhatsAppText]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(activeWhatsAppText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-500 hover:text-rose-700 font-bold"
          >
            &times;
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-500 hover:text-emerald-700 font-bold"
          >
            &times;
          </button>
        </div>
      )}

      {/* Header & Pool Selection */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-black text-slate-900 tracking-tight">
              Supplier Quotations & Cohort Messages
            </h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Maintain verified dealer quotes and generate DPDP-compliant WhatsApp cohort notifications.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <label htmlFor="pool-select" className="text-[10px] font-bold uppercase text-gray-500 mb-0.5">
              Active City Pool
            </label>
            <select
              id="pool-select"
              value={selectedPoolId}
              onChange={(e) => setSelectedPoolId(e.target.value)}
              disabled={isLoadingPools || pools.length === 0}
              className="text-xs px-3 py-2 rounded-xl border border-gray-300 bg-white font-medium text-slate-900 shadow-xs focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden min-w-[240px]"
            >
              {pools.length === 0 ? (
                <option value="">No Pools Available</option>
              ) : (
                pools.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.city})
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            type="button"
            onClick={openAddQuoteModal}
            disabled={!selectedPoolId}
            className="mt-4 md:mt-3 px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Record Supplier Quote</span>
          </button>
        </div>
      </div>

      {/* Quotation Management Section */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Quotations on Record ({quotes.length})
            </h3>
          </div>
          {selectedPool && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Current Published Price:</span>
              <span className="font-extrabold text-emerald-700 font-mono">
                {selectedPool.groupPrice ? formatINR(selectedPool.groupPrice) : 'Indicative'}
              </span>
              {selectedPool.priceIsVerified && (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                  Verified Supplier
                </span>
              )}
            </div>
          )}
        </div>

        {isLoadingQuotes ? (
          <div className="p-8 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading pool quotations...</span>
          </div>
        ) : quotes.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">
            No supplier quotations recorded yet for this pool. Click &quot;Record Supplier Quote&quot; to add one.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {quotes.map((q) => (
              <div key={q.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{q.vendorName}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        q.priceType === 'VENDOR_QUOTED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {q.priceType === 'VENDOR_QUOTED' ? '✓ Verified Supplier' : 'Indicative Estimate'}
                    </span>
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      Status: {q.status}
                    </span>
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 font-mono">
                    {formatINR(q.quotedAmount)}
                  </div>
                </div>

                <p className="text-xs text-gray-600 mb-2">{q.scope}</p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                  <div>
                    <span className="font-bold text-gray-700">Valid: </span>
                    <span>{q.quoteDate} to {q.validUntil}</span>
                  </div>
                  <div>
                    <span className="font-bold text-gray-700">Delivery: </span>
                    <span>{q.deliveryTerms || 'Standard'}</span>
                  </div>
                  <div>
                    <span className="font-bold text-gray-700">Quantity Rule: </span>
                    <span>{q.quantityCondition || 'Group minimum'}</span>
                  </div>
                </div>

                {q.inclusions && q.inclusions.length > 0 && (
                  <div className="mt-2 text-[11px] text-emerald-800 flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-gray-700">Inclusions:</span>
                    {q.inclusions.map((inc, i) => (
                      <span key={i} className="bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                        ✓ {inc}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* WhatsApp Cohort Messaging Station */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
          <MessageSquare className="w-5 h-5 text-emerald-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              WhatsApp Cohort Broadcast Studio (DPDP Compliant)
            </h3>
            <p className="text-[11px] text-gray-500">
              Generate standardized, non-marketing operational updates for confirmed pool buyers.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Controls */}
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-gray-700 block mb-1">
                Notification Template
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) =>
                  setSelectedTemplate(
                    e.target.value as
                      | 'TARGET_REACHED'
                      | 'QUOTE_AVAILABLE'
                      | 'SUPPLIER_COORDINATION'
                      | 'WAITLIST_INVITE'
                  )
                }
                className="w-full text-xs px-3 py-2 rounded-xl border border-gray-300 bg-white text-slate-800 font-medium"
              >
                <option value="QUOTE_AVAILABLE">Quote / Price Drop Available</option>
                <option value="TARGET_REACHED">Cohort Target Reached</option>
                <option value="SUPPLIER_COORDINATION">Supplier Connection &amp; Fulfillment</option>
                <option value="WAITLIST_INVITE">Waitlist Queue Slot Invitation</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-700 block mb-1">
                Sample Buyer Name
              </label>
              <input
                type="text"
                value={buyerNamePreview}
                onChange={(e) => setBuyerNamePreview(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-gray-300 bg-white text-slate-800"
                placeholder="Buyer Name"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-700 block mb-1">
                Target WhatsApp Number (10 digits)
              </label>
              <input
                type="tel"
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-gray-300 bg-white text-slate-800 font-mono"
                placeholder="9829000000"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="md:col-span-2 flex flex-col justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase text-slate-500">
                  Message Preview (Exact Text)
                </span>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 font-bold cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Text'}</span>
                </button>
              </div>
              <pre className="text-xs text-slate-800 font-sans whitespace-pre-wrap bg-white p-3 rounded-lg border border-slate-200/80 leading-relaxed max-h-48 overflow-y-auto">
                {activeWhatsAppText || 'Select a pool above to preview notification text.'}
              </pre>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
              <div className="text-[10px] text-gray-500">
                🔒 Protected under DPDP 2023. Never message buyers flagged with &quot;DO NOT CONTACT&quot;.
              </div>
              {customPhone ? (
                <a
                  href={whatsappDirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send via WhatsApp</span>
                </a>
              ) : (
                <span className="text-xs text-gray-400 italic">
                  Enter 10-digit number to launch WhatsApp link
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Record Supplier Quote Modal */}
      {isAddingQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Record Supplier Quotation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingQuote(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddQuote} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Vendor / Supplier Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={quoteForm.vendorName}
                    onChange={(e) => setQuoteForm({ ...quoteForm, vendorName: e.target.value })}
                    placeholder="e.g. Apex Solar Pvt Ltd"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Vendor Contact Ref
                  </label>
                  <input
                    type="text"
                    value={quoteForm.vendorContactRef}
                    onChange={(e) => setQuoteForm({ ...quoteForm, vendorContactRef: e.target.value })}
                    placeholder="e.g. GSTIN or Phone"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Quoted Amount (₹ INR) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={quoteForm.quotedAmount}
                    onChange={(e) => setQuoteForm({ ...quoteForm, quotedAmount: e.target.value })}
                    placeholder="e.g. 78000"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Quote Date
                  </label>
                  <input
                    type="date"
                    required
                    value={quoteForm.quoteDate}
                    onChange={(e) => setQuoteForm({ ...quoteForm, quoteDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Valid Until
                  </label>
                  <input
                    type="date"
                    required
                    value={quoteForm.validUntil}
                    onChange={(e) => setQuoteForm({ ...quoteForm, validUntil: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Scope of Supply *
                </label>
                <input
                  type="text"
                  required
                  value={quoteForm.scope}
                  onChange={(e) => setQuoteForm({ ...quoteForm, scope: e.target.value })}
                  placeholder="e.g. Complete 5kW DCR Module + Inverter + Net Metering setup"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Inclusions (Comma separated)
                  </label>
                  <input
                    type="text"
                    value={quoteForm.inclusions}
                    onChange={(e) => setQuoteForm({ ...quoteForm, inclusions: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Exclusions (Comma separated)
                  </label>
                  <input
                    type="text"
                    value={quoteForm.exclusions}
                    onChange={(e) => setQuoteForm({ ...quoteForm, exclusions: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Delivery Terms
                  </label>
                  <input
                    type="text"
                    value={quoteForm.deliveryTerms}
                    onChange={(e) => setQuoteForm({ ...quoteForm, deliveryTerms: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Quantity Condition
                  </label>
                  <input
                    type="text"
                    value={quoteForm.quantityCondition}
                    onChange={(e) => setQuoteForm({ ...quoteForm, quantityCondition: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddingQuote(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuote}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 flex items-center gap-1.5"
                >
                  {isSubmittingQuote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Save Quotation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
