'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { normalizePhone, isValidIndianMobile } from '@/lib/format';
import { City, Category } from '@/types';
import { useSelectedCity } from '@/lib/location-store';

export interface PoolRequestFormProps {
  initialCities?: City[];
  initialCategories?: Category[];
}

export function PoolRequestForm(props: PoolRequestFormProps) {
  void props;
  const [storeCity] = useSelectedCity();

  // Form fields
  const [requestedTitle, setRequestedTitle] = useState('');
  const [fullName, setFullName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [cityText, setCityText] = useState(storeCity ? storeCity.charAt(0).toUpperCase() + storeCity.slice(1) : '');
  const [stateText, setStateText] = useState('');
  const [notes, setNotes] = useState('');
  const [contactConsent, setContactConsent] = useState(true);

  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<{ id: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

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
      setErrorMessage('Please give consent to be contacted about this pool request.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        productName: titleTrimmed,
        requestedTitle: titleTrimmed,
        fullName: nameTrimmed,
        whatsappNumber: normalizedPhone,
        city: cityText.trim() || 'India',
        cityText: cityText.trim() || undefined,
        state: stateText.trim() || undefined,
        stateText: stateText.trim() || undefined,
        extraMessage: notes.trim(),
        contactConsent: true,
      };

      const res = await fetch('/api/pool-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
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
    setRequestedTitle('');
    setFullName('');
    setWhatsappNumber('');
    setNotes('');
    setSubmissionResult(null);
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
            Request a Pool
          </h2>
          <p className="text-emerald-100 text-sm mt-1 max-w-xl">
            Don&apos;t see what you need? Tell us what you want to buy. When enough buyers express interest, our team negotiates group pricing with verified suppliers.
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
                Request Recorded Successfully!
              </h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Request Reference ID:{' '}
                <code className="font-mono bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-xs font-bold">
                  {submissionResult.id}
                </code>
              </p>
              <p className="text-xs text-gray-600 max-w-md mx-auto leading-relaxed">
                Our team reviews every community proposal. As soon as enough interest is clustered in your area, you will receive an update on WhatsApp.
              </p>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs font-semibold px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
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

              {/* Requirement Text */}
              <div>
                <label htmlFor="req-title" className="block text-xs font-bold text-gray-800 mb-1.5">
                  What do you want to buy or install? <span className="text-emerald-600">*</span>
                </label>
                <input
                  id="req-title"
                  type="text"
                  required
                  value={requestedTitle}
                  onChange={(e) => setRequestedTitle(e.target.value)}
                  placeholder="e.g. 2 kW rooftop solar for my home, or 55-inch 4K OLED TV"
                  className="w-full text-xs sm:text-sm px-4 py-3 rounded-2xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 outline-hidden transition-all font-medium"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Describe what you need in plain words. No category or model code required.
                </p>
              </div>

              {/* Contact Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="req-name" className="block text-xs font-bold text-gray-800 mb-1.5">
                    Your Name <span className="text-emerald-600">*</span>
                  </label>
                  <input
                    id="req-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Rajesh Kumar"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 outline-hidden"
                  />
                </div>

                <div>
                  <label htmlFor="req-phone" className="block text-xs font-bold text-gray-800 mb-1.5">
                    WhatsApp Mobile Number <span className="text-emerald-600">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-semibold text-gray-400">
                      +91
                    </span>
                    <input
                      id="req-phone"
                      type="tel"
                      required
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="9876543210"
                      className="w-full text-xs pl-11 pr-3 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 outline-hidden font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Optional Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="req-city" className="block text-xs font-semibold text-gray-700 mb-1.5">
                    City / Town <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    id="req-city"
                    type="text"
                    value={cityText}
                    onChange={(e) => setCityText(e.target.value)}
                    placeholder="e.g. Baraut, Bhopal, or Jaipur"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 outline-hidden"
                  />
                </div>

                <div>
                  <label htmlFor="req-state" className="block text-xs font-semibold text-gray-700 mb-1.5">
                    State <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    id="req-state"
                    type="text"
                    value={stateText}
                    onChange={(e) => setStateText(e.target.value)}
                    placeholder="e.g. Uttar Pradesh"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 outline-hidden"
                  />
                </div>
              </div>

              {/* Optional Notes */}
              <div>
                <label htmlFor="req-notes" className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Additional Notes or Timing <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  id="req-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Planning to install before next summer, looking for 5 year warranty..."
                  className="w-full text-xs p-3 rounded-xl border border-gray-200 focus:border-emerald-500 outline-hidden resize-none"
                />
              </div>

              {/* Explicit Consent Checkbox */}
              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contactConsent}
                    onChange={(e) => setContactConsent(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-gray-600 leading-normal">
                    I give explicit consent to be contacted on WhatsApp regarding demand updates for this pool. Free interest only; no payment or commitment.
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
                      <span>Request a Pool</span>
                    </>
                  )}
                </button>
              </div>

              {/* Trust disclaimer */}
              <div className="flex items-center gap-2 text-[11px] text-gray-400 pt-2 border-t border-gray-100">
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
