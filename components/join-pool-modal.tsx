'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { PublicPool, JoinPoolInput, JoinPoolResult, BuyingTimeline } from '@/types';
import { TIMELINE_LABELS, PRIVACY_NOTICE_VERSION } from '@/lib/constants';
import { normalizePhone, isValidIndianMobile } from '@/lib/format';
import { JoinSuccess } from './join-success';

interface JoinPoolModalProps {
  pool: PublicPool | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: JoinPoolResult) => void;
}

function JoinPoolDialogContent({
  pool,
  onClose,
  onSuccess,
}: {
  pool: PublicPool;
  onClose: () => void;
  onSuccess?: (result: JoinPoolResult) => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Form states initialized directly from pool props
  const [selectedKitOfferId, setSelectedKitOfferId] = useState<string>(
    pool.kitOffers && pool.kitOffers.length > 0 ? pool.kitOffers[0].id : ''
  );
  const [fullName, setFullName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [buyingTimeline, setBuyingTimeline] = useState<BuyingTimeline>('THIS_MONTH');
  const [hasExistingQuote, setHasExistingQuote] = useState(false);
  const [existingQuoteAmount, setExistingQuoteAmount] = useState<string>('');
  const [extraMessage, setExtraMessage] = useState('');

  // UI status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<JoinPoolResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Front-end validations
    const trimmedName = fullName.trim();
    if (trimmedName.length < 2) {
      setErrorMessage('Please enter your full name (at least 2 characters).');
      return;
    }

    const normalizedPhone = normalizePhone(whatsappNumber);
    if (!isValidIndianMobile(normalizedPhone)) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).');
      return;
    }

    let parsedQuote: number | null = null;
    if (hasExistingQuote && existingQuoteAmount.trim()) {
      const q = parseFloat(existingQuoteAmount);
      if (isNaN(q) || q < 0) {
        setErrorMessage('Existing quote amount must be a valid positive number.');
        return;
      }
      parsedQuote = q;
    }

    const payload: JoinPoolInput = {
      fullName: trimmedName,
      whatsappNumber: normalizedPhone,
      city: pool.city,
      buyingTimeline,
      hasExistingQuote,
      existingQuoteAmount: parsedQuote,
      extraMessage: extraMessage.trim(),
      selectedKitOfferId: selectedKitOfferId || undefined,
    };

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/pools/${pool.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setErrorMessage(data.error?.message || 'Failed to submit interest. Please try again.');
        return;
      }

      setSuccessResult(data.data);
      if (onSuccess) onSuccess(data.data);
    } catch {
      setErrorMessage('Network error occurred. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      ref={modalRef}
      className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-lg w-full max-h-[90vh] overflow-y-auto relative animate-scale-in"
    >
      {/* Close Button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100/80 hover:bg-gray-200/80 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
        aria-label="Close dialog"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>

      {successResult ? (
        <JoinSuccess
          pool={pool}
          result={successResult}
          onClose={onClose}
        />
      ) : (
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="mb-6">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 inline-block mb-2">
              100% Free • No Upfront Payment
            </span>
            <h2 id="join-modal-title" className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight">
              Join Group Pool
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Registering for <strong className="text-gray-900 font-semibold">{pool.name}</strong> in{' '}
              <strong className="text-gray-900 font-semibold">{pool.city}</strong>.
            </p>
          </div>

          {errorMessage && (
            <div
              className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 mb-5 flex items-start gap-2"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Predefined Kit Package Selection */}
            {pool.kitOffers && pool.kitOffers.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-800 mb-2">
                  Select Brand-Kit Package <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-2">
                  {pool.kitOffers.map((kit) => {
                    const isSelected = selectedKitOfferId === kit.id;
                    return (
                      <div
                        key={kit.id}
                        onClick={() => setSelectedKitOfferId(kit.id)}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-600'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="kitOfferSelection"
                              checked={isSelected}
                              onChange={() => setSelectedKitOfferId(kit.id)}
                              className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 mt-0.5"
                            />
                            <div>
                              <p className="text-xs font-bold text-gray-900">{kit.name}</p>
                              <p className="text-[11px] text-gray-500">{kit.model} • {kit.warranty}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-extrabold text-emerald-700">₹{kit.groupPrice.toLocaleString('en-IN')}</span>
                            {kit.subsidyEstimate ? (
                              <span className="block text-[10px] text-emerald-600 font-medium">Est. Subsidy: ₹{kit.subsidyEstimate.toLocaleString('en-IN')}</span>
                            ) : null}
                          </div>
                        </div>
                        {kit.inclusions && kit.inclusions.length > 0 && isSelected && (
                          <div className="mt-2.5 pt-2 border-t border-emerald-100 text-[11px] text-gray-600 space-y-1">
                            <p className="font-semibold text-gray-700 text-[10px] uppercase tracking-wider">Inclusions:</p>
                            <ul className="list-disc list-inside space-y-0.5 pl-1">
                              {kit.inclusions.slice(0, 3).map((inc, i) => (
                                <li key={i} className="truncate">{inc}</li>
                              ))}
                              {kit.inclusions.length > 3 && (
                                <li className="text-emerald-700 font-medium">+{kit.inclusions.length - 3} more items included</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Full Name */}
            <div>
              <label htmlFor="full-name" className="block text-xs font-semibold text-gray-800 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="full-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Vikram Sharma"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden transition-all"
              />
            </div>

            {/* WhatsApp Number */}
            <div>
              <label htmlFor="whatsapp-number" className="block text-xs font-semibold text-gray-800 mb-1">
                WhatsApp Mobile Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs font-semibold text-gray-500 select-none">
                  +91
                </span>
                <input
                  id="whatsapp-number"
                  type="tel"
                  required
                  maxLength={10}
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="9876543210"
                  className="w-full text-sm pl-12 pr-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden transition-all"
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                We use your number only to notify you when the pool reaches its target. No spam.
              </p>
            </div>

            {/* City (read-only for this pool) */}
            <div>
              <label htmlFor="city-locked" className="block text-xs font-semibold text-gray-800 mb-1">
                City
              </label>
              <input
                id="city-locked"
                type="text"
                readOnly
                value={pool.city}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed outline-hidden"
              />
            </div>

            {/* Buying Timeline */}
            <div>
              <label htmlFor="buying-timeline" className="block text-xs font-semibold text-gray-800 mb-1">
                When are you planning to buy? <span className="text-rose-500">*</span>
              </label>
              <select
                id="buying-timeline"
                value={buyingTimeline}
                onChange={(e) => setBuyingTimeline(e.target.value as BuyingTimeline)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden transition-all"
              >
                <option value="THIS_MONTH">{TIMELINE_LABELS.THIS_MONTH}</option>
                <option value="WITHIN_1_3_MONTHS">{TIMELINE_LABELS.WITHIN_1_3_MONTHS}</option>
                <option value="WITHIN_3_6_MONTHS">{TIMELINE_LABELS.WITHIN_3_6_MONTHS}</option>
                <option value="JUST_EXPLORING">{TIMELINE_LABELS.JUST_EXPLORING}</option>
              </select>
            </div>

            {/* Existing Quote Toggle */}
            <div className="pt-2 border-t border-gray-100">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasExistingQuote}
                  onChange={(e) => {
                    setHasExistingQuote(e.target.checked);
                    if (!e.target.checked) setExistingQuoteAmount('');
                  }}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300"
                />
                <span className="text-xs font-medium text-gray-700">
                  I already have a dealer quotation for this product
                </span>
              </label>

              {hasExistingQuote && (
                <div className="mt-3 pl-6">
                  <label htmlFor="quote-amount" className="block text-xs font-semibold text-gray-800 mb-1">
                    Current Quoted Amount (₹)
                  </label>
                  <input
                    id="quote-amount"
                    type="number"
                    min={0}
                    value={existingQuoteAmount}
                    onChange={(e) => setExistingQuoteAmount(e.target.value)}
                    placeholder="e.g. 135000"
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden"
                  />
                </div>
              )}
            </div>

            {/* Optional message / variant note */}
            <div>
              <label htmlFor="extra-message" className="block text-xs font-semibold text-gray-800 mb-1">
                Specific Variant, Color, or Exchange Needs (Optional)
              </label>
              <textarea
                id="extra-message"
                rows={2}
                maxLength={1000}
                value={extraMessage}
                onChange={(e) => setExtraMessage(e.target.value)}
                placeholder="e.g. Looking for Top Model in Grey, with 2-wheeler exchange"
                className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden resize-none"
              />
            </div>

            {/* Demo Mode Notice */}
            {!pool.priceIsVerified && (
              <div className="bg-amber-50/90 border border-amber-200/80 rounded-xl p-3 text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  <strong>Demo Mode Notice:</strong> This pool displays an illustrative demo estimate. Expressing interest stores demonstration data locally and is not transmitted to an authorized dealership until formal volume terms are verified.
                </span>
              </div>
            )}

            {/* Privacy Notice */}
            <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-3 text-[11px] text-gray-500 leading-relaxed">
              <p>
                <strong>Privacy statement:</strong> By registering, you agree that PoolBuy may use your contact details to coordinate this group-buy pool. Dealer contact and lead sharing is handled only under our verified terms and DPDP Act compliance (Notice v{PRIVACY_NOTICE_VERSION}). No spam or public directory.
              </p>
            </div>

            {/* Submit CTA */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 text-sm font-bold px-4 py-3.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 active:scale-98 transition-all shadow-sm shadow-emerald-600/20 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Confirming Interest...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  <span>Join Pool for Free</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function JoinPoolModal({ pool, isOpen, onClose, onSuccess }: JoinPoolModalProps) {
  // Trap Escape key and manage body scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !pool) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-modal-title"
    >
      <JoinPoolDialogContent
        key={pool.id}
        pool={pool}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </div>
  );
}
