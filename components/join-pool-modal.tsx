'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, ShieldCheck, AlertCircle, Loader2, CheckCircle2, MapPin, AlertTriangle, Info } from 'lucide-react';
import { PublicPool, JoinPoolInput, JoinPoolResult } from '@/types';
import { normalizePhone, isValidIndianMobile } from '@/lib/format';

interface JoinPoolModalProps {
  pool: PublicPool | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: JoinPoolResult) => void;
}

interface CrossCityNotice {
  message: string;
  existingCity: string;
  targetCity: string;
  existingStatus: string;
}

export function JoinPoolModal({
  pool,
  isOpen,
  onClose,
  onSuccess,
}: JoinPoolModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [fullName, setFullName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [userCity, setUserCity] = useState('');
  const [confirmCityMismatch, setConfirmCityMismatch] = useState(false);
  const [pincode, setPincode] = useState('');
  const [existingQuote, setExistingQuote] = useState('');
  const [extraMessage, setExtraMessage] = useState('');
  const [consentToContact, setConsentToContact] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [crossCityNotice, setCrossCityNotice] = useState<CrossCityNotice | null>(null);
  const [result, setResult] = useState<JoinPoolResult | null>(null);

  // Close on Escape, click outside, and lock body scroll when open
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen || !pool) return null;

  const currentActive = pool.currentBuyers ?? 0;
  const isWaitlistMode = currentActive >= 10;
  const targetCityName = pool.city || 'India';

  const isMismatchDetected = Boolean(
    userCity.trim() &&
    userCity.trim().toLowerCase() !== targetCityName.toLowerCase() &&
    userCity.trim().toLowerCase() !== (pool.citySlug || '').toLowerCase()
  );

  const handleSubmit = async (e?: React.FormEvent, forceCrossCity = false) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const trimmedName = fullName.trim();
    if (trimmedName.length < 2) {
      setErrorMessage('Please enter your full name (at least 2 characters).');
      return;
    }

    const normalizedPhone = normalizePhone(whatsappNumber);
    if (!isValidIndianMobile(normalizedPhone)) {
      setErrorMessage('Please enter a valid 10-digit Indian WhatsApp mobile number.');
      return;
    }

    const trimmedPincode = pincode.trim();
    if (!/^[0-9]{6}$/.test(trimmedPincode)) {
      setErrorMessage('Please enter a valid 6-digit postal pincode.');
      return;
    }

    if (isMismatchDetected && !confirmCityMismatch) {
      setErrorMessage(`You are joining the ${targetCityName} pool, not the ${userCity.trim()} pool. Please confirm to proceed.`);
      return;
    }

    if (!consentToContact) {
      setErrorMessage('Please give explicit consent to receive WhatsApp updates.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: JoinPoolInput = {
        fullName: trimmedName,
        whatsappNumber: normalizedPhone,
        city: targetCityName,
        userCity: userCity.trim() || targetCityName,
        confirmCityMismatch: confirmCityMismatch || !isMismatchDetected,
        confirmCrossCity: forceCrossCity,
        pincode: trimmedPincode,
        pinCode: trimmedPincode,
        existing_quote: existingQuote.trim() || undefined,
        extraMessage: extraMessage.trim(),
        connectionOptIn: true,
        vendorShareConsent: true,
      };

      const res = await fetch(`/api/pools/${pool.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.error?.code === 'CROSS_CITY_DUPLICATE_NOTICE') {
          setCrossCityNotice({
            message: data.error.message,
            existingCity: data.error.existingCity,
            targetCity: data.error.targetCity || targetCityName,
            existingStatus: data.error.existingStatus || 'CONFIRMED',
          });
          return;
        }

        if (data.error?.code === 'CITY_MISMATCH') {
          setErrorMessage(data.error.message || `You are joining the ${targetCityName} pool, not the ${userCity} pool.`);
          return;
        }

        setErrorMessage(data.error?.message || 'Failed to submit interest. Please try again.');
        return;
      }

      setCrossCityNotice(null);
      setResult(data.data);
      if (onSuccess) {
        onSuccess(data.data);
      }

      // Smoothly close the modal after brief visual confirmation (700ms)
      autoCloseTimerRef.current = setTimeout(() => {
        handleClose();
      }, 700);
    } catch {
      setErrorMessage('Network error while joining pool. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    setResult(null);
    setErrorMessage(null);
    setCrossCityNotice(null);
    setFullName('');
    setWhatsappNumber('');
    setUserCity('');
    setConfirmCityMismatch(false);
    setPincode('');
    setExistingQuote('');
    setExtraMessage('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-pool-modal-title"
    >
      <div
        ref={modalRef}
        className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-3xl border-t md:border border-gray-200/90 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-slide-up md:animate-scale-in"
      >
        {/* Mobile Swipe Indicator */}
        <div className="md:hidden pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Scrollable Form Content */}
        <div className="overflow-y-auto p-6 sm:p-8 space-y-5 flex-1">
          {/* Header with prominent target city badge */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Cohort City: <strong>{targetCityName}</strong></span>
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Free Interest</span>
                </span>
              </div>
              <h3 id="join-pool-modal-title" className="text-lg font-bold text-gray-950">
                {isWaitlistMode ? `Join ${targetCityName} Waitlist` : `Join Pool (${targetCityName})`}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 font-medium">
                {pool.name}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Cross-City Duplicate Notice Interstitial */}
          {crossCityNotice ? (
            <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-2xl text-blue-950 space-y-3 animate-scale-in text-xs">
              <div className="flex items-start gap-2.5">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-blue-900">
                    Existing Registration in {crossCityNotice.existingCity}
                  </h4>
                  <p className="mt-1 text-blue-800 leading-relaxed">
                    {crossCityNotice.message}
                  </p>
                  <p className="mt-2 text-slate-600">
                    Your previous registration in <strong>{crossCityNotice.existingCity}</strong> will remain active and counted. Joining here creates a separate, independent interest in <strong>{targetCityName}</strong>.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-blue-100">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(undefined, true)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Confirm &amp; Join {targetCityName}</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setCrossCityNotice(null)}
                  className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : result ? (
            /* Success View */
            <div className="text-center py-6 space-y-4 animate-scale-in">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <h4 className="text-base font-bold text-gray-950">
                  {result.status === 'WAITLISTED'
                    ? `Added to ${targetCityName} Waitlist!`
                    : result.alreadyJoined
                    ? `Already Registered in ${targetCityName}!`
                    : `You Have Joined the ${targetCityName} Pool!`}
                </h4>
                <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                  {result.status === 'WAITLISTED'
                    ? `This pool has ${pool.targetBuyers || 10} confirmed places. You are on the ${targetCityName} waitlist at position #${result.waitlistPosition || 1}. We will contact you via WhatsApp if an active spot opens.`
                    : `Your non-binding interest for ${targetCityName} has been recorded. Direct dealership quotes and group terms will be shared once target volume is achieved.`}
                </p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-3 text-xs text-gray-500 flex justify-between items-center font-medium">
                <span>Cohort Status:</span>
                <span className="font-bold text-emerald-700 font-mono">
                  {result.status === 'WAITLISTED' ? 'WAITLISTED' : `Buyer #${result.buyerNumber} (${targetCityName})`}
                </span>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="w-full text-xs font-bold py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          ) : (
            /* Form View */
            <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4 text-xs">
              {errorMessage && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* City Mismatch Alert Banner */}
              {isMismatchDetected && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">
                        You are joining the {targetCityName} pool, not the {userCity.trim()} pool.
                      </p>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Supply, dealer quotation, and installation are strictly local to {targetCityName}.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmCityMismatch}
                      onChange={(e) => setConfirmCityMismatch(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-[11px] font-semibold text-amber-950">
                      I understand and confirm joining the {targetCityName} cohort
                    </span>
                  </label>
                </div>
              )}

              {/* Name */}
              <div>
                <label htmlFor="join-name" className="block font-bold text-slate-800 mb-1">
                  Your Full Name <span className="text-emerald-600">*</span>
                </label>
                <input
                  id="join-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ramesh Patel"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium"
                />
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="join-phone" className="block font-bold text-slate-800 mb-1">
                  WhatsApp Mobile Number <span className="text-emerald-600">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-semibold text-slate-400">
                    +91
                  </span>
                  <input
                    id="join-phone"
                    type="tel"
                    required
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="9876543210"
                    className="w-full pl-11 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-mono font-medium"
                  />
                </div>
              </div>

              {/* User City / Installation City */}
              <div>
                <label htmlFor="join-city" className="block font-bold text-slate-800 mb-1">
                  Your City / Town <span className="text-slate-400 font-normal">(Target Pool: {targetCityName})</span>
                </label>
                <input
                  id="join-city"
                  type="text"
                  value={userCity}
                  onChange={(e) => {
                    setUserCity(e.target.value);
                    setConfirmCityMismatch(false);
                  }}
                  placeholder={targetCityName}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium"
                />
              </div>

              {/* Pincode */}
              <div>
                <label htmlFor="join-pincode" className="block font-bold text-slate-800 mb-1">
                  Postal Pincode <span className="text-emerald-600">*</span>
                </label>
                <input
                  id="join-pincode"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="e.g. 462001"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-mono font-medium"
                />
                <p className="text-[10px] text-gray-500 mt-1">6-digit postal code to match local delivery and dealer clusters.</p>
              </div>

              {/* Existing Quote (Optional) */}
              <div>
                <label htmlFor="join-quote" className="block font-bold text-slate-800 mb-1">
                  Existing Quote or Market Price <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  id="join-quote"
                  type="text"
                  maxLength={500}
                  value={existingQuote}
                  onChange={(e) => setExistingQuote(e.target.value)}
                  placeholder="e.g. ₹4,25,000 including installation"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium"
                />
                <p className="text-[10px] text-gray-500 mt-1">Share any competitor quotation you already have to help negotiate better volume tiers.</p>
              </div>

              {/* Optional note */}
              <div>
                <label htmlFor="join-note" className="block font-bold text-slate-800 mb-1">
                  Optional Note <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  id="join-note"
                  type="text"
                  value={extraMessage}
                  onChange={(e) => setExtraMessage(e.target.value)}
                  placeholder="e.g. Preferred delivery month or requirement note"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium"
                />
              </div>

              {/* Consent */}
              <div className="pt-1">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentToContact}
                    onChange={(e) => setConsentToContact(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-gray-600 leading-tight text-[11px]">
                    I give consent to be contacted on WhatsApp regarding pool milestones and group pricing updates.
                  </span>
                </label>
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Interest...</span>
                    </>
                  ) : (
                    <span>{isWaitlistMode ? `Join ${targetCityName} Waitlist` : `Join ${targetCityName} Pool (Free)`}</span>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-gray-400 text-center">
                100% free interest. No customer login, password, or registration required.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
