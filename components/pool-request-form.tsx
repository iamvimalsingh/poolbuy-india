'use client';

import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  ShieldCheck,
  Building2,
  ClipboardList,
} from 'lucide-react';
import { normalizePhone, isValidIndianMobile } from '@/lib/format';
import { City, Category } from '@/types';
import { useSelectedCity } from '@/lib/location-store';
import { CATEGORIES as FALLBACK_CATEGORIES } from '@/lib/constants';

export interface PoolRequestFormProps {
  initialCities?: City[];
  initialCategories?: Category[];
}

export function PoolRequestForm({
  initialCategories,
}: PoolRequestFormProps) {
  const [storeCity] = useSelectedCity();

  // Categories available for dropdown
  const categoryOptions = useMemo(() => {
    if (initialCategories && initialCategories.length > 0) {
      return initialCategories.filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return FALLBACK_CATEGORIES.map((c, idx) => ({
      id: `cat-${c.slug}`,
      slug: c.slug,
      label: c.label,
      description: c.description,
      isActive: true,
      sortOrder: idx + 1,
      createdAt: '',
      updatedAt: '',
    }));
  }, [initialCategories]);

  // Form fields
  const [categorySlug, setCategorySlug] = useState<string>('');
  const [requestedTitle, setRequestedTitle] = useState('');
  const [brandPreference, setBrandPreference] = useState('');
  const [modelPreference, setModelPreference] = useState('');
  const [fullName, setFullName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [cityText, setCityText] = useState(
    storeCity ? storeCity.charAt(0).toUpperCase() + storeCity.slice(1) : ''
  );
  const [stateText, setStateText] = useState('');
  const [locality, setLocality] = useState('');
  const [notes, setNotes] = useState('');
  const [contactConsent, setContactConsent] = useState(true);
  const [joinPoolConsent, setJoinPoolConsent] = useState(false);

  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    existingRequestId?: string;
    message: string;
  } | null>(null);
  const [submissionResult, setSubmissionResult] = useState<{ id: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setDuplicateInfo(null);

    const titleTrimmed = requestedTitle.trim();
    if (titleTrimmed.length < 2) {
      setErrorMessage('Please describe what you want to buy or install (at least 2 characters).');
      return;
    }

    const nameTrimmed = fullName.trim();
    if (nameTrimmed.length < 2) {
      setErrorMessage('Please enter your full name (at least 2 characters).');
      return;
    }

    const normalizedPhone = normalizePhone(whatsappNumber);
    if (!isValidIndianMobile(normalizedPhone)) {
      setErrorMessage('Please enter a valid 10-digit Indian WhatsApp mobile number.');
      return;
    }

    if (!contactConsent) {
      setErrorMessage('Please give consent to be contacted on WhatsApp about this pool request.');
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedCategoryObj = categoryOptions.find((c) => c.slug === categorySlug);

      const payload = {
        productName: titleTrimmed,
        requestedTitle: titleTrimmed,
        category: categorySlug ? categorySlug : undefined,
        categorySlug: categorySlug ? categorySlug : undefined,
        categoryName: selectedCategoryObj ? selectedCategoryObj.label : undefined,
        brandPreference: brandPreference.trim() || undefined,
        modelPreference: modelPreference.trim() || undefined,
        fullName: nameTrimmed,
        whatsappNumber: normalizedPhone,
        city: cityText.trim() || 'India',
        cityText: cityText.trim() || undefined,
        state: stateText.trim() || undefined,
        stateText: stateText.trim() || undefined,
        locality: locality.trim() || undefined,
        extraMessage: notes.trim(),
        contactConsent: true,
        joinPoolConsent: joinPoolConsent,
      };

      const res = await fetch('/api/pool-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.error?.code === 'DUPLICATE_ACTIVE_REQUEST') {
          setDuplicateInfo({
            existingRequestId: data.error.existingRequestId,
            message: data.error.message || 'An active pool request already exists for this mobile number, product, and city.',
          });
          return;
        }
        setErrorMessage(data.error?.message || 'Unable to submit your request. Please try again.');
        return;
      }

      setSubmissionResult({ id: data.data.id });
    } catch {
      setErrorMessage('Network error submitting request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setCategorySlug('');
    setRequestedTitle('');
    setBrandPreference('');
    setModelPreference('');
    setFullName('');
    setWhatsappNumber('');
    setLocality('');
    setNotes('');
    setJoinPoolConsent(false);
    setSubmissionResult(null);
    setDuplicateInfo(null);
    setErrorMessage(null);
  };

  return (
    <div id="request-pool" className="scroll-mt-24">
      <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm overflow-hidden max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-8 sm:px-10 text-white">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-xs px-3 py-1 rounded-full text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Demand Aggregation • 100% Free</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Start a Pool (Community Demand Proposal)
          </h2>
          <p className="text-emerald-100 text-sm mt-1 max-w-xl">
            Propose collective buying demand for your community, society, or city. Submissions are reviewed by our team and published as official pools once sufficient local interest is registered.
          </p>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-10">
          {submissionResult ? (
            <div className="text-center py-8 space-y-4 animate-scale-in">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-950">
                Demand Proposal Recorded Successfully!
              </h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Request Reference ID:{' '}
                <code className="font-mono bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-xs font-bold">
                  {submissionResult.id}
                </code>
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 max-w-md mx-auto text-left text-xs text-slate-700 space-y-2">
                <div className="flex items-start gap-2">
                  <ClipboardList className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Next Step:</strong> Our operations team reviews your demand and coordinates with local suppliers in your city.</span>
                </div>
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Zero Obligation:</strong> You will receive a WhatsApp notification when an official pool is published or quotes are ready. No payment is required.</span>
                </div>
              </div>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs font-semibold px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
                >
                  Submit Another Request
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMessage && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl p-4 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {duplicateInfo && (
                <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl p-4 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-950">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Active Request Already Registered</span>
                  </div>
                  <p>
                    {duplicateInfo.message}
                  </p>
                  {duplicateInfo.existingRequestId && (
                    <p className="font-medium">
                      Request Reference ID:{' '}
                      <code className="font-mono bg-white px-2 py-0.5 rounded border border-amber-200 font-bold text-amber-950">
                        {duplicateInfo.existingRequestId}
                      </code>
                    </p>
                  )}
                  <p className="text-[11px] text-amber-800">
                    Your interest is safely recorded and our team is actively reviewing supplier quotations. You will be notified on WhatsApp when an official pool is published.
                  </p>
                </div>
              )}

              {/* Proposal Distinction Banner */}
              <div className="bg-emerald-50/60 border border-emerald-200/70 rounded-2xl p-3.5 text-xs text-emerald-950 flex items-start gap-2.5">
                <Building2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Admin-Reviewed Proposal:</strong> This request proposes demand to start a pool. It requires review before becoming an official public pool. 100% free with no purchase commitment.
                </span>
              </div>

              {/* Category Dropdown & Product Requirement */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="req-category" className="block text-xs font-bold text-slate-800 mb-1.5">
                    Product Category <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <select
                    id="req-category"
                    value={categorySlug}
                    onChange={(e) => setCategorySlug(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden bg-white text-slate-900 font-medium"
                  >
                    <option value="">Select Category (or Propose Any Product)</option>
                    {categoryOptions.map((cat) => (
                      <option key={cat.slug} value={cat.slug}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="req-title" className="block text-xs font-bold text-slate-800 mb-1.5">
                    What do you want to buy? <span className="text-emerald-600">*</span>
                  </label>
                  <input
                    id="req-title"
                    type="text"
                    required
                    value={requestedTitle}
                    onChange={(e) => setRequestedTitle(e.target.value)}
                    placeholder="e.g. 3kW On-Grid Solar, or Ather 450X"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium"
                  />
                </div>
              </div>

              {/* Optional Brand & Model Preferences */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="req-brand" className="block text-xs font-bold text-slate-800 mb-1.5">
                    Preferred Brand <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    id="req-brand"
                    type="text"
                    value={brandPreference}
                    onChange={(e) => setBrandPreference(e.target.value)}
                    placeholder="e.g. Tata Power, Luminous, Ather, Apple"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium"
                  />
                </div>

                <div>
                  <label htmlFor="req-model" className="block text-xs font-bold text-slate-800 mb-1.5">
                    Model or Specification <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    id="req-model"
                    type="text"
                    value={modelPreference}
                    onChange={(e) => setModelPreference(e.target.value)}
                    placeholder="e.g. Bi-facial half-cut panels, 200 Ah battery"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium"
                  />
                </div>
              </div>

              {/* Contact Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="req-name" className="block text-xs font-bold text-slate-800 mb-1.5">
                    Your Full Name <span className="text-emerald-600">*</span>
                  </label>
                  <input
                    id="req-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Rajesh Kumar"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium"
                  />
                </div>

                <div>
                  <label htmlFor="req-phone" className="block text-xs font-bold text-slate-800 mb-1.5">
                    WhatsApp Mobile Number <span className="text-emerald-600">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-semibold text-slate-400">
                      +91
                    </span>
                    <input
                      id="req-phone"
                      type="tel"
                      required
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="9876543210"
                      className="w-full text-xs pl-11 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-mono font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Location Fields: City, State, Locality */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="req-city" className="block text-xs font-bold text-slate-800 mb-1.5">
                    City / Town <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    id="req-city"
                    type="text"
                    value={cityText}
                    onChange={(e) => setCityText(e.target.value)}
                    placeholder="e.g. Bhopal, Pune, Baraut"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium"
                  />
                </div>

                <div>
                  <label htmlFor="req-state" className="block text-xs font-bold text-slate-800 mb-1.5">
                    State <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    id="req-state"
                    type="text"
                    value={stateText}
                    onChange={(e) => setStateText(e.target.value)}
                    placeholder="e.g. Madhya Pradesh"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium"
                  />
                </div>

                <div>
                  <label htmlFor="req-locality" className="block text-xs font-bold text-slate-800 mb-1.5">
                    Society / Colony <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    id="req-locality"
                    type="text"
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    placeholder="e.g. Arera Colony"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium"
                  />
                </div>
              </div>

              {/* Optional Notes */}
              <div>
                <label htmlFor="req-notes" className="block text-xs font-bold text-slate-800 mb-1.5">
                  Additional Notes or Timing <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  id="req-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Gathering 5 neighbors in our apartment complex, planning for next month..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden resize-none font-medium"
                />
              </div>

              {/* Explicit Consent & Membership Consent Checkboxes */}
              <div className="space-y-3 pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contactConsent}
                    onChange={(e) => setContactConsent(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-slate-700 leading-normal">
                    I give explicit consent to be contacted on WhatsApp regarding demand updates for this pool. Free interest only; no payment or commitment.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <input
                    type="checkbox"
                    checked={joinPoolConsent}
                    onChange={(e) => setJoinPoolConsent(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-slate-800 leading-normal">
                    <strong className="text-emerald-800">Auto-Enroll as Buyer #1:</strong> If an authorized admin launches this pool in my city, automatically register my interest as confirmed member #1. (100% free; no payment or purchase commitment).
                  </span>
                </label>
              </div>

              {/* Submit CTA */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm font-bold px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white shadow-sm shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Recording Request...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit Pool Proposal</span>
                    </>
                  )}
                </button>
              </div>

              {/* Trust disclaimer */}
              <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Your contact details are kept strictly private and used only for pool aggregation updates.</span>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
