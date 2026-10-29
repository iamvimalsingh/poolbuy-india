'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, ShieldCheck, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { PublicPool, JoinPoolInput, JoinPoolResult } from '@/types';
import { normalizePhone, isValidIndianMobile } from '@/lib/format';

interface JoinPoolModalProps {
  pool: PublicPool | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: JoinPoolResult) => void;
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
  const [pincode, setPincode] = useState('');
  const [existingQuote, setExistingQuote] = useState('');
  const [extraMessage, setExtraMessage] = useState('');
  const [consentToContact, setConsentToContact] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

    if (!consentToContact) {
      setErrorMessage('Please give explicit consent to receive WhatsApp updates.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: JoinPoolInput = {
        fullName: trimmedName,
        whatsappNumber: normalizedPhone,
        city: pool.city || 'India',
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
        setErrorMessage(data.error?.message || 'Failed to submit interest. Please try again.');
        return;
      }

      setResult(data.data);
      if (onSuccess) {
        onSuccess(data.data);
      }

      // Smoothly close the modal after brief visual confirmation (700ms)
      // allowing the success Toast notification to take focus seamlessly
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
    setFullName('');
    setWhatsappNumber('');
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
      {/* 1. Responsive Drawer/Modal Container (Bottom Sheet on mobile, Centered Modal on desktop) */}
      <div
        ref={modalRef}
        className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-3xl border-t md:border border-gray-200/90 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-slide-up md:animate-scale-in"
      >
        {/* 2. Mobile Visual Swipe Indicator */}
        <div className="md:hidden pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Scrollable Form Content */}
        <div className="overflow-y-auto p-6 sm:p-8 space-y-5 flex-1">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-full mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Free Interest • No Payment</span>
              </div>
              <h3 id="join-pool-modal-title" className="text-lg font-bold text-gray-950">
                {isWaitlistMode ? 'Join Shared Waitlist' : 'Join this Pool'}
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

          {/* Success View */}
          {result ? (
            <div className="text-center py-6 space-y-4 animate-scale-in">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <h4 className="text-base font-bold text-gray-950">
                  {result.status === 'WAITLISTED'
                    ? 'Added to Shared Waitlist!'
                    : result.alreadyJoined
                    ? 'Already Registered!'
                    : 'You Have Joined This Pool!'}
                </h4>
                <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                  {result.status === 'WAITLISTED'
                    ? `This pool has 10 active places. You are on the shared waitlist at position #${result.waitlistPosition || 1}. We will contact you if an active spot opens.`
                    : 'Your interest has been recorded. This records your interest; it is not a purchase or installation confirmation.'}
                </p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-3 text-xs text-gray-500 flex justify-between items-center font-medium">
                <span>Current Shared Status:</span>
                <span className="font-bold text-emerald-700 font-mono">
                  {result.status === 'WAITLISTED' ? 'WAITLISTED' : `Buyer #${result.buyerNumber}`}
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
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {errorMessage && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
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
                  placeholder="e.g. 211001"
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
                    <span>{isWaitlistMode ? 'Join Waitlist (Position Available)' : 'Join Pool (Free)'}</span>
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
