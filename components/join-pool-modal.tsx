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

  const [fullName, setFullName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [extraMessage, setExtraMessage] = useState('');
  const [consentToContact, setConsentToContact] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<JoinPoolResult | null>(null);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
    } catch {
      setErrorMessage('Network error while joining pool. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setErrorMessage(null);
    setFullName('');
    setWhatsappNumber('');
    setExtraMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        ref={modalRef}
        className="bg-white rounded-3xl border border-gray-200 shadow-2xl max-w-md w-full p-6 sm:p-8 space-y-5 animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-full mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Free Interest • No Payment</span>
            </div>
            <h3 className="text-lg font-bold text-gray-950">
              {isWaitlistMode ? 'Join Shared Waitlist' : 'Join this Pool'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 font-medium">
              {pool.name}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
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
              className="w-full text-xs font-bold py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
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
              <label htmlFor="join-name" className="block font-bold text-gray-800 mb-1">
                Your Full Name <span className="text-emerald-600">*</span>
              </label>
              <input
                id="join-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Ramesh Patel"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 outline-hidden font-medium"
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="join-phone" className="block font-bold text-gray-800 mb-1">
                WhatsApp Mobile Number <span className="text-emerald-600">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 font-semibold text-gray-400">
                  +91
                </span>
                <input
                  id="join-phone"
                  type="tel"
                  required
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="9876543210"
                  className="w-full pl-11 pr-3 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 outline-hidden font-mono"
                />
              </div>
            </div>

            {/* Optional note */}
            <div>
              <label htmlFor="join-note" className="block font-semibold text-gray-700 mb-1">
                Optional Note <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                id="join-note"
                type="text"
                value={extraMessage}
                onChange={(e) => setExtraMessage(e.target.value)}
                placeholder="e.g. Preferred delivery month or requirement note"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 outline-hidden"
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
  );
}
