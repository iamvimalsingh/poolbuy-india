'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, AlertCircle, Loader2, Send, Info } from 'lucide-react';
import { normalizePhone, isValidIndianMobile } from '@/lib/format';
import { City, Category } from '@/types';

interface PoolRequestFormProps {
  initialCities?: City[];
  initialCategories?: Category[];
}

export function PoolRequestForm({ initialCities, initialCategories }: PoolRequestFormProps) {
  const [cities, setCities] = useState<City[]>(initialCities || []);
  const [categories, setCategories] = useState<Category[]>(initialCategories || []);

  const [productName, setProductName] = useState('');
  const [selectedCity, setSelectedCity] = useState(cities[0]?.name || 'Bhopal');
  const [customCity, setCustomCity] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [customCategory, setCustomCategory] = useState('');
  const [brandPreference, setBrandPreference] = useState('');
  const [modelPreference, setModelPreference] = useState('');
  const [fullName, setFullName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [extraMessage, setExtraMessage] = useState('');

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

    const effectiveCategory = selectedCategory === '__OTHER__' ? null : selectedCategory || null;
    const effectiveCategoryName =
      selectedCategory === '__OTHER__' ? customCategory.trim() : null;

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
        setErrorMessage(data.error?.message || 'Unable to submit your request. Please try again.');
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
        <h3 className="text-xl font-bold">Demand Request Confirmed!</h3>
        <p className="text-sm text-emerald-100 max-w-md mx-auto leading-relaxed">
          Thank you for requesting <strong>{productName}</strong> in <strong>{finalCityDisplay}</strong>.
          We aggregate interest in this product and review local dealer availability. When feasible, an official group-buying pool will be launched.
        </p>

        {submissionResult.isDemo ? (
          <div className="inline-block bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs px-3.5 py-1.5 rounded-lg">
            Demo Mode: Request recorded in session demo store (ID: {submissionResult.id}).
          </div>
        ) : (
          <div className="inline-block bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs px-3.5 py-1.5 rounded-lg">
            Request ID: {submissionResult.id}
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
              setExtraMessage('');
            }}
            className="text-xs font-semibold px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors"
          >
            Request Another Product
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6 sm:p-8 text-white space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-emerald-400" aria-hidden="true" />
        <h3 className="text-lg font-bold text-white">Request a New Group-Buy Pool</h3>
      </div>
      <p className="text-xs text-emerald-100/80 -mt-2 mb-3">
        Looking for a specific vehicle, gadget, or equipment not yet listed? Request it below. We aggregate local community interest before negotiating verified dealer terms.
      </p>

      {errorMessage && (
        <div className="bg-rose-500/20 border border-rose-400/40 text-rose-200 text-xs rounded-xl p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Product Name */}
        <div className="sm:col-span-2">
          <label htmlFor="req-product" className="block text-xs font-semibold text-emerald-100 mb-1">
            Product or Package Name <span className="text-emerald-400">*</span>
          </label>
          <input
            id="req-product"
            type="text"
            required
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="e.g. Ather 450X, 5kW Rooftop Solar, Tata Punch EV, MacBook Pro M3"
            className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-emerald-200/50 focus:border-emerald-400 focus:bg-white/15 outline-hidden transition-all"
          />
        </div>

        {/* City Selector */}
        <div>
          <label htmlFor="req-city" className="block text-xs font-semibold text-emerald-100 mb-1">
            Requested City <span className="text-emerald-400">*</span>
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
              + Other city (Not listed yet)
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
              + Other / Not listed
            </option>
          </select>
        </div>

        {/* Other City Input (conditional) */}
        {selectedCity === '__OTHER__' && (
          <div className="sm:col-span-2 bg-white/5 border border-white/10 rounded-xl p-3 space-y-1.5">
            <label htmlFor="req-custom-city" className="block text-xs font-semibold text-emerald-200">
              Enter Your City Name <span className="text-emerald-400">*</span>
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
                Submitting a new city registers local demand. Official pools open only after authorized dealer supply and fulfillment paths are confirmed in that city.
              </span>
            </p>
          </div>
        )}

        {/* Other Category Input (conditional) */}
        {selectedCategory === '__OTHER__' && (
          <div className="sm:col-span-2 bg-white/5 border border-white/10 rounded-xl p-3 space-y-1.5">
            <label htmlFor="req-custom-category" className="block text-xs font-semibold text-emerald-200">
              Category or Product Type Description
            </label>
            <input
              id="req-custom-category"
              type="text"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="e.g. Drones, Electric Bicycles, Home Gym Equipment, Dental Implants"
              className="w-full text-sm px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-emerald-200/50 focus:border-emerald-400 outline-hidden"
            />
          </div>
        )}

        {/* Brand & Model Preference */}
        <div>
          <label htmlFor="req-brand" className="block text-xs font-semibold text-emerald-100 mb-1">
            Brand Preference (Optional)
          </label>
          <input
            id="req-brand"
            type="text"
            value={brandPreference}
            onChange={(e) => setBrandPreference(e.target.value)}
            placeholder="e.g. Apple, Ather, Tata, DJI, Sony"
            className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-emerald-200/50 focus:border-emerald-400 focus:bg-white/15 outline-hidden"
          />
        </div>

        <div>
          <label htmlFor="req-model" className="block text-xs font-semibold text-emerald-100 mb-1">
            Model / Variant Preference (Optional)
          </label>
          <input
            id="req-model"
            type="text"
            value={modelPreference}
            onChange={(e) => setModelPreference(e.target.value)}
            placeholder="e.g. 450X 3.7kWh, M3 16GB, Fly More Combo"
            className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-emerald-200/50 focus:border-emerald-400 focus:bg-white/15 outline-hidden"
          />
        </div>

        {/* Full Name */}
        <div>
          <label htmlFor="req-name" className="block text-xs font-semibold text-emerald-100 mb-1">
            Your Name (Optional)
          </label>
          <input
            id="req-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Rahul Verma"
            className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-emerald-200/50 focus:border-emerald-400 focus:bg-white/15 outline-hidden"
          />
        </div>

        {/* WhatsApp Mobile */}
        <div>
          <label htmlFor="req-phone" className="block text-xs font-semibold text-emerald-100 mb-1">
            WhatsApp Number (Optional)
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

        {/* Contact info notice */}
        <div className="sm:col-span-2 text-[11px] text-emerald-200/70 bg-emerald-950/40 border border-emerald-500/20 rounded-xl p-2.5 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            <strong>Privacy Guarantee:</strong> If supplied, your contact details are solely used to notify you if an official pool opens in your city. PoolBuy will never share your personal lead data with dealerships without your separate explicit consent.
          </span>
        </div>

        {/* Extra Note */}
        <div className="sm:col-span-2">
          <label htmlFor="req-note" className="block text-xs font-semibold text-emerald-100 mb-1">
            Additional Note or Price Target (Optional)
          </label>
          <textarea
            id="req-note"
            rows={2}
            maxLength={1000}
            value={extraMessage}
            onChange={(e) => setExtraMessage(e.target.value)}
            placeholder="e.g. Have 3 colleagues ready to join; target price under ₹1.35 Lakh on-road"
            className="w-full text-sm px-3.5 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-emerald-200/50 focus:border-emerald-400 focus:bg-white/15 outline-hidden resize-none"
          />
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
            <span>Submitting Request...</span>
          </>
        ) : (
          <>
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Submit Pool Request</span>
          </>
        )}
      </button>
    </form>
  );
}
