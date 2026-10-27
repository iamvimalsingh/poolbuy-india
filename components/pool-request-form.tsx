'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, AlertCircle, Loader2, Send, Info, Users, Clock } from 'lucide-react';
import { normalizePhone, isValidIndianMobile } from '@/lib/format';
import { City, Category } from '@/types';

interface PoolRequestFormProps {
  initialCities?: City[];
  initialCategories?: Category[];
}

export function PoolRequestForm({ initialCities, initialCategories }: PoolRequestFormProps) {
  const [cities, setCities] = useState<City[]>(initialCities || []);
  const [categories, setCategories] = useState<Category[]>(initialCategories || []);

  const [requestType, setRequestType] = useState<'GROUP_PROPOSAL' | 'PRODUCT_SUGGESTION'>('GROUP_PROPOSAL');
  const [productName, setProductName] = useState('');
  const [selectedCity, setSelectedCity] = useState(cities[0]?.name || 'Bhopal');
  const [customCity, setCustomCity] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [customCategory, setCustomCategory] = useState('');
  const [requirementsSummary, setRequirementsSummary] = useState('');
  const [targetBuyersRequested, setTargetBuyersRequested] = useState<number>(10);
  const [requestedDeadlineDays, setRequestedDeadlineDays] = useState<number>(30);
  const [brandPreference, setBrandPreference] = useState('');
  const [modelPreference, setModelPreference] = useState('');
  const [fullName, setFullName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [extraMessage, setExtraMessage] = useState('');
  const [contactConsent, setContactConsent] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<{ id: string; isDemo: boolean } | null>(null);

  // Fetch operational cities and categories on mount if not provided
  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        if (!initialCities || initialCities.length === 0) {
          const res = await fetch('/api/cities');
          const data = await res.json();
          if (!ignore && data.success && Array.isArray(data.data)) {
            setCities(data.data);
            if (data.data.length > 0 && !selectedCity) {
              setSelectedCity(data.data[0].name);
            }
          }
        }
        if (!initialCategories || initialCategories.length === 0) {
          const res = await fetch('/api/categories');
          const data = await res.json();
          if (!ignore && data.success && Array.isArray(data.data)) {
            setCategories(data.data);
          }
        }
      } catch (err) {
        console.error('Error fetching cities/categories for request form:', err);
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, [initialCities, initialCategories, selectedCity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedProduct = productName.trim();
    if (trimmedProduct.length < 2) {
      setErrorMessage('Please enter a valid product name (at least 2 characters).');
      return;
    }

    const effectiveCity = selectedCity === '__OTHER__' ? customCity.trim() : selectedCity.trim();
    if (!effectiveCity || effectiveCity.length < 2) {
      setErrorMessage('Please specify a valid city name (at least 2 characters).');
      return;
    }

    let normalizedPhone = '';
    if (whatsappNumber.trim()) {
      normalizedPhone = normalizePhone(whatsappNumber);
      if (!isValidIndianMobile(normalizedPhone)) {
        setErrorMessage('Please enter a valid 10-digit Indian WhatsApp number, or leave it blank.');
        return;
      }
    }

    if (!contactConsent && normalizedPhone) {
      setErrorMessage('Please consent to contact regarding this proposal, or clear the phone field.');
      return;
    }

    const effectiveCategory = selectedCategory === '__OTHER__' ? null : selectedCategory || null;
    const effectiveCategoryName =
      selectedCategory === '__OTHER__' ? customCategory.trim() : null;

    const requestedDeadline = new Date(Date.now() + requestedDeadlineDays * 86400000).toISOString();

    const payload = {
      productName: trimmedProduct,
      category: effectiveCategory,
      categoryName: effectiveCategoryName || null,
      city: effectiveCity,
      brandPreference: brandPreference.trim() || null,
      modelPreference: modelPreference.trim() || null,
      fullName: fullName.trim() || null,
      whatsappNumber: normalizedPhone || null,
      extraMessage: extraMessage.trim(),
      requirementsSummary: requirementsSummary.trim() || undefined,
      targetBuyersRequested: Number(targetBuyersRequested) || 10,
      requestedDeadline,
      contactConsent,
      requestType,
    };

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/pool-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setErrorMessage(data.error?.message || 'Unable to submit your proposal. Please try again.');
        return;
      }

      setSubmissionResult(data.data);
    } catch {
      setErrorMessage('Network error occurred. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submissionResult) {
    const finalCityDisplay = selectedCity === '__OTHER__' ? customCity : selectedCity;
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 text-center text-white space-y-4">
        <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
        </div>
        <h3 className="text-xl font-bold">
          {requestType === 'GROUP_PROPOSAL' ? 'Group Buy Proposal Submitted!' : 'Product Suggestion Received!'}
        </h3>
        <p className="text-sm text-emerald-100 max-w-md mx-auto leading-relaxed">
          Thank you for proposing <strong>{productName}</strong> in <strong>{finalCityDisplay}</strong>.
          Your submission is in the <strong>Admin Review Queue</strong>. Once community demand and local availability are reviewed, an official buying group will be published.
        </p>

        {submissionResult.isDemo ? (
          <div className="inline-block bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs px-3.5 py-1.5 rounded-lg">
            Demo Mode: Proposal recorded in session demo store (ID: {submissionResult.id}). Visible in Admin Command Center.
          </div>
        ) : (
          <div className="inline-block bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs px-3.5 py-1.5 rounded-lg">
            Proposal ID: {submissionResult.id} (Status: PENDING REVIEW)
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={() => {
              setSubmissionResult(null);
              setProductName('');
              setCustomCity('');
              setCustomCategory('');
              setBrandPreference('');
              setModelPreference('');
              setRequirementsSummary('');
              setExtraMessage('');
            }}
            className="text-xs font-semibold px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors"
          >
            Submit Another Proposal
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6 sm:p-8 text-white space-y-4">
      {/* Mode Switcher Tabs */}
      <div className="flex items-center gap-2 pb-3 border-b border-white/15">
        <button
          type="button"
          onClick={() => setRequestType('GROUP_PROPOSAL')}
          className={`text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all ${
            requestType === 'GROUP_PROPOSAL'
              ? 'bg-emerald-500 text-gray-950 shadow-xs'
              : 'bg-white/10 text-emerald-100 hover:bg-white/15'
          }`}
        >
          Start a Group Buy (Proposal)
        </button>
        <button
          type="button"
          onClick={() => setRequestType('PRODUCT_SUGGESTION')}
          className={`text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all ${
            requestType === 'PRODUCT_SUGGESTION'
              ? 'bg-emerald-500 text-gray-950 shadow-xs'
              : 'bg-white/10 text-emerald-100 hover:bg-white/15'
          }`}
        >
          Suggest a Product
        </button>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-emerald-400" aria-hidden="true" />
        <h3 className="text-lg font-bold text-white">
          {requestType === 'GROUP_PROPOSAL' ? 'Propose a Local Group Buy' : 'Suggest a Product for Your City'}
        </h3>
      </div>
      <p className="text-xs text-emerald-100/80 -mt-2 mb-3 leading-relaxed">
        {requestType === 'GROUP_PROPOSAL'
          ? 'Visitors can propose a buying group for any product. Proposals enter admin review before publication. No customer account required.'
          : 'Suggest a product you would like to see listed in your city. Demand is aggregated and reviewed by operators.'}
      </p>

      {errorMessage && (
        <div className="bg-rose-500/20 border border-rose-400/40 text-rose-200 text-xs rounded-xl p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Product / Group Title */}
        <div className="sm:col-span-2">
          <label htmlFor="req-product" className="block text-xs font-semibold text-emerald-100 mb-1">
            Product or Group Title <span className="text-emerald-400">*</span>
          </label>
          <input
            id="req-product"
            type="text"
            required
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="e.g. 5kW Rooftop Solar Installation, Electric Scooter Bulk Deal, Whole-House Water Softener"
            className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-emerald-200/50 focus:border-emerald-400 focus:bg-white/15 outline-hidden transition-all"
          />
        </div>

        {/* City Selector */}
        <div>
          <label htmlFor="req-city" className="block text-xs font-semibold text-emerald-100 mb-1">
            Target City <span className="text-emerald-400">*</span>
          </label>
          <select
            id="req-city"
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-gray-900 border border-white/20 text-white focus:border-emerald-400 outline-hidden"
          >
            {cities.map((c) => (
              <option key={c.slug} value={c.name} className="bg-gray-900 text-white">
                {c.name} ({c.state})
              </option>
            ))}
            <option value="__OTHER__" className="bg-gray-900 text-white">
              + Other city / town (Not in directory)
            </option>
          </select>
        </div>

        {/* Category Selector */}
        <div>
          <label htmlFor="req-category" className="block text-xs font-semibold text-emerald-100 mb-1">
            Category (Optional)
          </label>
          <select
            id="req-category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-gray-900 border border-white/20 text-white focus:border-emerald-400 outline-hidden"
          >
            <option value="" className="bg-gray-900 text-white">Select Category...</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug} className="bg-gray-900 text-white">
                {c.label}
              </option>
            ))}
            <option value="__OTHER__" className="bg-gray-900 text-white">
              + Other / Free-text Category
            </option>
          </select>
        </div>

        {/* Other City Input (conditional) */}
        {selectedCity === '__OTHER__' && (
          <div className="sm:col-span-2 bg-white/5 border border-white/10 rounded-xl p-3 space-y-1.5">
            <label htmlFor="req-custom-city" className="block text-xs font-semibold text-emerald-200">
              Enter Your City / Town Name <span className="text-emerald-400">*</span>
            </label>
            <input
              id="req-custom-city"
              type="text"
              required
              value={customCity}
              onChange={(e) => setCustomCity(e.target.value)}
              placeholder="e.g. Lucknow, Nagpur, Surat, Coimbatore"
              className="w-full text-sm px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-emerald-200/50 focus:border-emerald-400 outline-hidden"
            />
            <p className="text-[11px] text-emerald-100/70 flex items-start gap-1 mt-1">
              <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                New cities are reviewed by operators. Official groups open only after local serviceability is verified.
              </span>
            </p>
          </div>
        )}

        {/* Other Category Input (conditional) */}
        {selectedCategory === '__OTHER__' && (
          <div className="sm:col-span-2 bg-white/5 border border-white/10 rounded-xl p-3 space-y-1.5">
            <label htmlFor="req-custom-category" className="block text-xs font-semibold text-emerald-200">
              Custom Category or Product Type
            </label>
            <input
              id="req-custom-category"
              type="text"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="e.g. Electric Bicycles, Inverters, Commercial Equipment"
              className="w-full text-sm px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-emerald-200/50 focus:border-emerald-400 outline-hidden"
            />
          </div>
        )}

        {/* Target Group Size (bounded 2 - 10000) */}
        <div>
          <label htmlFor="req-target" className="block text-xs font-semibold text-emerald-100 mb-1">
            Target Group Size (Buyers)
          </label>
          <div className="relative">
            <Users className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              id="req-target"
              type="number"
              min={2}
              max={10000}
              value={targetBuyersRequested}
              onChange={(e) => setTargetBuyersRequested(Math.max(2, Math.min(10000, parseInt(e.target.value, 10) || 10)))}
              className="w-full text-sm pl-9 pr-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white focus:border-emerald-400 outline-hidden"
            />
          </div>
        </div>

        {/* Requested Timeline / Days */}
        <div>
          <label htmlFor="req-deadline" className="block text-xs font-semibold text-emerald-100 mb-1">
            Desired Timeline
          </label>
          <div className="relative">
            <Clock className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <select
              id="req-deadline"
              value={requestedDeadlineDays}
              onChange={(e) => setRequestedDeadlineDays(parseInt(e.target.value, 10) || 30)}
              className="w-full text-sm pl-9 pr-3.5 py-2.5 rounded-xl bg-gray-900 border border-white/20 text-white focus:border-emerald-400 outline-hidden"
            >
              <option value={14} className="bg-gray-900 text-white">14 Days (Fast cohort)</option>
              <option value={30} className="bg-gray-900 text-white">30 Days (Standard 1 Month)</option>
              <option value={60} className="bg-gray-900 text-white">60 Days (2 Months)</option>
              <option value={90} className="bg-gray-900 text-white">90 Days (Quarterly pool)</option>
            </select>
          </div>
        </div>

        {/* Short Requirements Description */}
        <div className="sm:col-span-2">
          <label htmlFor="req-summary" className="block text-xs font-semibold text-emerald-100 mb-1">
            Requirements / Package Summary
          </label>
          <textarea
            id="req-summary"
            rows={2}
            maxLength={1000}
            value={requirementsSummary}
            onChange={(e) => setRequirementsSummary(e.target.value)}
            placeholder="e.g. Seeking turnkey rooftop solar installation with net-metering liaison, or TopCon bifacial kit option"
            className="w-full text-sm px-3.5 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-emerald-200/50 focus:border-emerald-400 focus:bg-white/15 outline-hidden resize-none"
          />
        </div>

        {/* Contact Info (for proposal follow-up) */}
        <div>
          <label htmlFor="req-name" className="block text-xs font-semibold text-emerald-100 mb-1">
            Your Name (Organizer / Proposer)
          </label>
          <input
            id="req-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Vikram Sharma"
            className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-emerald-200/50 focus:border-emerald-400 focus:bg-white/15 outline-hidden"
          />
        </div>

        <div>
          <label htmlFor="req-phone" className="block text-xs font-semibold text-emerald-100 mb-1">
            WhatsApp Number (For Proposal Review)
          </label>
          <input
            id="req-phone"
            type="tel"
            maxLength={10}
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            placeholder="9876543210"
            className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-emerald-200/50 focus:border-emerald-400 focus:bg-white/15 outline-hidden"
          />
        </div>

        {/* Proposal Consent Checkbox */}
        <div className="sm:col-span-2 bg-emerald-950/40 border border-emerald-500/20 rounded-xl p-3">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              required
              checked={contactConsent}
              onChange={(e) => setContactConsent(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded text-emerald-500 focus:ring-emerald-400 border-gray-400"
            />
            <span className="text-xs text-emerald-100/90 leading-relaxed">
              <strong>Proposal Acknowledgement &amp; Consent:</strong> I understand that this is a proposal that will be reviewed before public listing. If provided, my contact details may be used on WhatsApp to verify or moderate this group buy proposal.
            </span>
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center justify-center gap-2 text-xs font-bold px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-sans shadow-sm transition-all disabled:opacity-50 active:scale-98"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            <span>Submitting Proposal...</span>
          </>
        ) : (
          <>
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{requestType === 'GROUP_PROPOSAL' ? 'Submit Group Buy Proposal' : 'Submit Product Suggestion'}</span>
          </>
        )}
      </button>
    </form>
  );
}
