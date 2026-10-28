'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  Info,
  Users,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { normalizePhone, isValidIndianMobile } from '@/lib/format';
import { City, Category } from '@/types';
import { INDIA_LOCATION_DIRECTORY } from '@/lib/location-directory';
import { useSelectedCity } from '@/lib/location-store';

export interface PoolRequestFormProps {
  initialCities?: City[];
  initialCategories?: Category[];
}

const APPROVED_CATALOGUE_PRODUCTS = [
  {
    id: 'prod-rooftop-solar-3kw',
    name: '3 kW Rooftop Solar Complete Kit',
    category: 'ROOFTOP_SOLAR',
    categoryName: 'Rooftop Solar',
    brand: 'Tier-1 Mono PERC / TopCon',
    model: '3 kW Residential On-Grid',
  },
  {
    id: 'prod-rooftop-solar-5kw',
    name: '5 kW Rooftop Solar Complete Kit',
    category: 'ROOFTOP_SOLAR',
    categoryName: 'Rooftop Solar',
    brand: 'Tier-1 High-Efficiency',
    model: '5 kW Residential Dual-MPPT Package',
  },
  {
    id: 'prod-power-backup-combo',
    name: 'Home Power-Backup Combo (Inverter + 200 Ah Battery)',
    category: 'ROOFTOP_SOLAR',
    categoryName: 'Power Backup',
    brand: 'Pure Sine Wave Inverter + Tubular Battery',
    model: '1100VA Inverter + 200 Ah Battery',
  },
  {
    id: 'prod-water-softener',
    name: 'Whole-House Water Softener Kit',
    category: 'ROOFTOP_SOLAR',
    categoryName: 'Water Softener',
    brand: 'Automatic Food-Grade Ion Exchange',
    model: 'Automatic 28L Resin Residential Softener',
  },
];

function findInitialLocation(citySlug: string | null) {
  if (!citySlug) return null;
  for (const st of INDIA_LOCATION_DIRECTORY) {
    const found = st.cities.find((c) => c.slug === citySlug);
    if (found) {
      return { stateCode: st.code, cityName: found.name, citySlug: found.slug };
    }
  }
  return null;
}

export function PoolRequestForm(props: PoolRequestFormProps) {
  void props;
  const [storeCity] = useSelectedCity();

  // Determine initial location from storeCity
  const initialLocation = findInitialLocation(storeCity);

  // State & City selection using canonical INDIA_LOCATION_DIRECTORY
  const [userStateCode, setUserStateCode] = useState<string | null>(null);
  const [userCityName, setUserCityName] = useState<string | null>(null);
  const [userCitySlug, setUserCitySlug] = useState<string | null>(null);

  const selectedStateCode = userStateCode ?? initialLocation?.stateCode ?? '';
  const selectedCityName = userCityName ?? initialLocation?.cityName ?? '';
  const selectedCitySlug = userCitySlug ?? initialLocation?.citySlug ?? '';

  // Selected State object
  const currentState = useMemo(() => {
    return INDIA_LOCATION_DIRECTORY.find((s) => s.code === selectedStateCode) || null;
  }, [selectedStateCode]);

  // Cities in selected State
  const stateCities = useMemo(() => {
    return currentState ? currentState.cities : [];
  }, [currentState]);

  // Form fields
  const [poolTitle, setPoolTitle] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(APPROVED_CATALOGUE_PRODUCTS[0].id);
  const [requirementsSummary, setRequirementsSummary] = useState('');
  const [targetBuyersRequested, setTargetBuyersRequested] = useState<number>(10);
  const [requestedDeadlineDays, setRequestedDeadlineDays] = useState<number>(30);
  const [fullName, setFullName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [extraMessage, setExtraMessage] = useState('');
  const [contactConsent, setContactConsent] = useState(true);
  const [acknowledgedReview, setAcknowledgedReview] = useState(true);

  // Existing pool check derived directly from selected city
  const hasExistingPool = Boolean(selectedCitySlug && ['bhopal', 'indore', 'pune'].includes(selectedCitySlug));
  const existingPoolUrl = hasExistingPool ? `/city/${selectedCitySlug}` : null;

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<{ id: string; isDemo: boolean } | null>(null);

  const selectedProduct = useMemo(() => {
    return (
      APPROVED_CATALOGUE_PRODUCTS.find((p) => p.id === selectedProductId) ||
      APPROVED_CATALOGUE_PRODUCTS[0]
    );
  }, [selectedProductId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedTitle = poolTitle.trim();
    if (trimmedTitle.length < 3) {
      setErrorMessage('Please provide a descriptive pool title (at least 3 characters, e.g. "Silver Oak Society Solar Group").');
      return;
    }

    if (!selectedStateCode || !selectedCityName) {
      setErrorMessage('Please select both your State and City from the directory.');
      return;
    }

    let normalizedPhone = '';
    if (whatsappNumber.trim()) {
      normalizedPhone = normalizePhone(whatsappNumber);
      if (!isValidIndianMobile(normalizedPhone)) {
        setErrorMessage('Please enter a valid 10-digit Indian WhatsApp mobile number (e.g. 9876543210).');
        return;
      }
    } else {
      setErrorMessage('Please provide a WhatsApp contact number so our team can coordinate this proposal.');
      return;
    }

    if (!contactConsent) {
      setErrorMessage('Please consent to contact regarding this pool proposal.');
      return;
    }

    if (!acknowledgedReview) {
      setErrorMessage('Please acknowledge that proposals undergo Admin review before being published as live pools.');
      return;
    }

    const requestedDeadline = new Date(Date.now() + requestedDeadlineDays * 86400000).toISOString();

    const payload = {
      productName: `${trimmedTitle} — ${selectedProduct.name}`,
      category: selectedProduct.category,
      categoryName: selectedProduct.categoryName,
      brandPreference: selectedProduct.brand,
      modelPreference: selectedProduct.model,
      city: selectedCityName,
      state: currentState?.name || selectedStateCode,
      fullName: fullName.trim() || 'Community Organizer',
      whatsappNumber: normalizedPhone,
      extraMessage: extraMessage.trim(),
      requirementsSummary: requirementsSummary.trim() || undefined,
      targetBuyersRequested: Number(targetBuyersRequested) || 10,
      requestedDeadline,
      contactConsent: true,
      requestType: 'GROUP_PROPOSAL' as const,
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
    return (
      <div className="bg-white rounded-2xl p-6 sm:p-8 text-slate-900 shadow-xl border border-emerald-100 animate-fade-in space-y-4">
        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div className="text-center space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            Pending Admin Review
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold text-slate-950 pt-2">
            Pool Proposal Submitted Successfully
          </h3>
          <p className="text-xs text-slate-500">
            Reference ID: <span className="font-mono font-bold text-slate-800">{submissionResult.id}</span>
          </p>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-500">Proposed Title:</span>
            <span className="font-semibold text-slate-900">{poolTitle}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Approved Product:</span>
            <span className="font-semibold text-slate-900">{selectedProduct.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Location:</span>
            <span className="font-semibold text-slate-900">{selectedCityName}, {currentState?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Target Cohort:</span>
            <span className="font-semibold text-slate-900">{targetBuyersRequested} Buyers</span>
          </div>
        </div>

        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
          <p className="font-bold flex items-center gap-1.5 mb-1">
            <Info className="w-4 h-4 text-amber-700 shrink-0" />
            <span>What Happens Next:</span>
          </p>
          <p>
            Your proposal is not yet a live public pool. The GroupBuying operations team will review supplier feasibility, local grid net-metering parameters in {selectedCityName}, and reach out to you via WhatsApp at <strong>+91 {whatsappNumber}</strong> to coordinate next steps.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSubmissionResult(null);
            setPoolTitle('');
            setRequirementsSummary('');
            setExtraMessage('');
          }}
          className="w-full py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
        >
          Submit Another Proposal
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 text-slate-900 shadow-xl border border-slate-100">
      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Existing Pool Notification Banner */}
      {hasExistingPool && existingPoolUrl && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs space-y-2">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-950">
                A Solar Pool is already collecting interest in {selectedCityName}!
              </p>
              <p className="text-slate-600 text-[11px] mt-0.5">
                Joining the existing general pool brings buyers together faster for volume negotiation.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Link
              href={existingPoolUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white font-semibold text-xs hover:bg-amber-700 transition-colors shadow-2xs"
            >
              <span>Explore Existing {selectedCityName} Deals</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <span className="text-[11px] text-slate-500">
              Or continue proposing a distinct society pool below:
            </span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 1. Proposed Pool Title */}
        <div>
          <label htmlFor="pool-title" className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
            1. Proposed Pool / Community Title <span className="text-rose-500">*</span>
          </label>
          <input
            id="pool-title"
            type="text"
            required
            placeholder="e.g. Green Acres Society Rooftop Solar Group, Arera Colony Collective"
            value={poolTitle}
            onChange={(e) => setPoolTitle(e.target.value)}
            className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden transition-all"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Free text title representing your society, commercial cluster, or neighborhood campaign.
          </p>
        </div>

        {/* 2. Product from Approved Catalogue */}
        <div>
          <label htmlFor="approved-product" className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
            2. Approved Product Category <span className="text-rose-500">*</span>
          </label>
          <select
            id="approved-product"
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium"
          >
            {APPROVED_CATALOGUE_PRODUCTS.map((prod) => (
              <option key={prod.id} value={prod.id}>
                {prod.name} ({prod.brand})
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500 mt-1">
            Initial national rollout is active for Solar &amp; Power products. Admin manages additional product launches.
          </p>
        </div>

        {/* 3. Canonical Location: State & City */}
        <div>
          <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
            3. Operational Location (28 States &amp; 8 UTs) <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* State selector */}
            <div>
              <label htmlFor="req-state" className="block text-[11px] font-semibold text-slate-600 mb-1">
                State / Union Territory
              </label>
              <select
                id="req-state"
                value={selectedStateCode}
                onChange={(e) => {
                  const newCode = e.target.value;
                  setUserStateCode(newCode);
                  const st = INDIA_LOCATION_DIRECTORY.find((s) => s.code === newCode);
                  if (st && st.cities.length > 0) {
                    setUserCityName(st.cities[0].name);
                    setUserCitySlug(st.cities[0].slug);
                  } else {
                    setUserCityName('');
                    setUserCitySlug('');
                  }
                }}
                required
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden"
              >
                <option value="">Select State / UT</option>
                {INDIA_LOCATION_DIRECTORY.map((st) => (
                  <option key={st.code} value={st.code}>
                    {st.name} ({st.type === 'UNION_TERRITORY' ? 'UT' : 'State'})
                  </option>
                ))}
              </select>
            </div>

            {/* City selector */}
            <div>
              <label htmlFor="req-city" className="block text-[11px] font-semibold text-slate-600 mb-1">
                Urban Centre / City
              </label>
              <select
                id="req-city"
                value={selectedCitySlug}
                onChange={(e) => {
                  const slug = e.target.value;
                  setUserCitySlug(slug);
                  const match = stateCities.find((c) => c.slug === slug);
                  if (match) setUserCityName(match.name);
                }}
                disabled={!selectedStateCode}
                required
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">{selectedStateCode ? 'Select City' : 'Choose State First'}</option>
                {stateCities.map((city) => (
                  <option key={city.slug} value={city.slug}>
                    {city.name} ({city.placeType})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Canonical location directory covers all 28 Indian States &amp; 8 UTs. Local supplier readiness is evaluated per city.
          </p>
        </div>

        {/* 4. Community Need / Description */}
        <div>
          <label htmlFor="req-summary" className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
            4. Community Need &amp; Requirements
          </label>
          <textarea
            id="req-summary"
            rows={3}
            placeholder="e.g. We have 12 independent bungalows looking for 3 kW on-grid solar systems with net-metering. Roof access is available."
            value={requirementsSummary}
            onChange={(e) => setRequirementsSummary(e.target.value)}
            className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden transition-all resize-none"
          />
        </div>

        {/* 5. Target Cohort Size & Timeline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="req-target" className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
              Target Buyers Requested
            </label>
            <div className="relative">
              <Users className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                id="req-target"
                type="number"
                min={2}
                max={500}
                value={targetBuyersRequested}
                onChange={(e) => setTargetBuyersRequested(parseInt(e.target.value, 10) || 10)}
                className="w-full text-sm pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Recommended: 10 buyers for optimal quotation leverage.</p>
          </div>

          <div>
            <label htmlFor="req-days" className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
              Desired Aggregation Window
            </label>
            <div className="relative">
              <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <select
                id="req-days"
                value={requestedDeadlineDays}
                onChange={(e) => setRequestedDeadlineDays(parseInt(e.target.value, 10) || 30)}
                className="w-full text-sm pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden"
              >
                <option value={14}>14 Days (Fast Track)</option>
                <option value={30}>30 Days (Standard Community)</option>
                <option value={45}>45 Days (Large Housing Society)</option>
                <option value={60}>60 Days (Commercial Cluster)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 6. Contact Information */}
        <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="req-name" className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
              Organizer / Contact Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="req-name"
              type="text"
              required
              placeholder="e.g. Ramesh Patel"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden"
            />
          </div>

          <div>
            <label htmlFor="req-whatsapp" className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
              WhatsApp Mobile Number <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-xs font-semibold text-slate-500 select-none">
                +91
              </span>
              <input
                id="req-whatsapp"
                type="tel"
                required
                maxLength={10}
                placeholder="9876543210"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className="w-full text-sm pl-12 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* 7. Disclosures & Legal Consents */}
        <div className="space-y-3 pt-2 border-t border-slate-200">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              required
              checked={acknowledgedReview}
              onChange={(e) => setAcknowledgedReview(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
            />
            <span className="text-xs text-slate-700 leading-relaxed">
              <strong>Admin Review Acknowledged:</strong> I understand that submitting this proposal enters our operations review queue. It is <em>not</em> published as a live pool automatically. <span className="text-rose-500">*</span>
            </span>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              required
              checked={contactConsent}
              onChange={(e) => setContactConsent(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
            />
            <span className="text-xs text-slate-700 leading-relaxed">
              <strong>Consent to Contact:</strong> I agree to receive WhatsApp communication from the GroupBuying team regarding feasibility and review for this proposal. <span className="text-rose-500">*</span>
            </span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 active:scale-98 transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Submitting Proposal for Review...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Submit Pool Proposal for Admin Review</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
