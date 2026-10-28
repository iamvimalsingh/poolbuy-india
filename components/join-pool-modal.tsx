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
  const [locality, setLocality] = useState('');
  const [consentToContact, setConsentToContact] = useState(true);
  const [connectionOptIn, setConnectionOptIn] = useState(false);
  const [showAdditional, setShowAdditional] = useState(false);
  const [buyingTimeline, setBuyingTimeline] = useState<BuyingTimeline>('THIS_MONTH');
  const [hasExistingQuote, setHasExistingQuote] = useState(false);
  const [existingQuoteAmount, setExistingQuoteAmount] = useState<string>('');
  const [extraMessage, setExtraMessage] = useState('');
  const [connectionPreference, setConnectionPreference] = useState<'WHATSAPP_GROUP' | 'INDIVIDUAL_INTRO'>('WHATSAPP_GROUP');
  const [groupPrivacyAcknowledged, setGroupPrivacyAcknowledged] = useState(false);

  const isPoolFull = pool.currentBuyers >= pool.targetBuyers;

  // UI status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<JoinPoolResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!consentToContact) {
      setErrorMessage('Please consent to receiving WhatsApp updates about this group.');
      return;
    }

    if (connectionPreference === 'WHATSAPP_GROUP' && !groupPrivacyAcknowledged) {
      setErrorMessage('Please acknowledge that group members will see your phone number in WhatsApp, or choose 1-on-1 Introduction.');
      return;
    }

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
      connectionOptIn,
      vendorShareConsent: connectionOptIn,
      locality: locality.trim() || undefined,
      connectionPreference,
      groupPrivacyAcknowledged: connectionPreference === 'WHATSAPP_GROUP' ? groupPrivacyAcknowledged : true,
    };

    setIsSubmitting(true);

    try {
      const endpoint = isPoolFull ? `/api/pools/${pool.id}/waitlist` : `/api/pools/${pool.id}/join`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setErrorMessage(data.error?.message || 'Failed to submit interest. Please try again.');
        return;
      }

      if (isPoolFull) {
        const waitlistResult: JoinPoolResult = {
          leadId: data.data.waitlistId,
          poolId: pool.id,
          buyerNumber: data.data.sequenceNumber,
          currentBuyers: pool.currentBuyers,
          targetBuyers: pool.targetBuyers,
          remainingBuyers: 0,
          alreadyJoined: false,
          isWaitlisted: true,
        } as unknown as JoinPoolResult;
        setSuccessResult(waitlistResult);
        if (onSuccess) onSuccess(waitlistResult);
      } else {
        setSuccessResult(data.data);
        if (onSuccess) onSuccess(data.data);
      }
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
            <span
              className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border inline-block mb-2 ${
                isPoolFull
                  ? 'text-amber-800 bg-amber-50 border-amber-200'
                  : 'text-emerald-700 bg-emerald-50 border-emerald-100'
              }`}
            >
              {isPoolFull ? 'Target Reached • Join Priority Waitlist' : '100% Free • No Upfront Payment'}
            </span>
            <h2 id="join-modal-title" className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight">
              {isPoolFull ? 'Join Priority Waitlist' : 'Join Group Pool'}
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              {isPoolFull ? (
                <>
                  Target of <strong className="text-gray-900 font-semibold">{pool.targetBuyers} buyers</strong> reached for{' '}
                  <strong className="text-gray-900 font-semibold">{pool.name}</strong> in{' '}
                  <strong className="text-gray-900 font-semibold">{pool.city}</strong>. Join the FIFO queue to claim a spot if an existing buyer drops out or an expanded batch unlocks.
                </>
              ) : (
                <>
                  Registering for <strong className="text-gray-900 font-semibold">{pool.name}</strong> in{' '}
                  <strong className="text-gray-900 font-semibold">{pool.city}</strong>.
                </>
              )}
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

            {/* Locality / Colony (Optional) */}
            <div>
              <label htmlFor="locality" className="block text-xs font-semibold text-gray-800 mb-1">
                Colony / Area / Locality (Optional)
              </label>
              <input
                id="locality"
                type="text"
                value={locality}
                onChange={(e) => setLocality(e.target.value)}
                placeholder="e.g. Arera Colony, MP Nagar, Kothrud"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden transition-all"
              />
            </div>

            {/* City (read-only for this pool) */}
            <div>
              <label htmlFor="city-locked" className="block text-xs font-semibold text-gray-800 mb-1">
                City (Determined by group pool)
              </label>
              <input
                id="city-locked"
                type="text"
                readOnly
                value={pool.city}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed outline-hidden"
              />
            </div>

            {/* Explicit Communication & Connection Consents */}
            <div className="pt-2 border-t border-gray-100 space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  required
                  checked={consentToContact}
                  onChange={(e) => setConsentToContact(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300"
                />
                <span className="text-xs text-gray-700 leading-relaxed">
                  <strong>WhatsApp updates:</strong> I agree to receive WhatsApp notifications about this group&apos;s progress and demand milestones. <span className="text-rose-500">*</span>
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={connectionOptIn}
                  onChange={(e) => setConnectionOptIn(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300"
                />
                <span className="text-xs text-gray-700 leading-relaxed">
                  <strong>Post-target connection:</strong> When target is reached, invite me to connect and review verified vendor quotations.
                </span>
              </label>
            </div>

            {/* Connection Channel Preference */}
            <div className="pt-2 border-t border-gray-100 space-y-2">
              <label className="block text-xs font-semibold text-gray-800">
                Connection Preference <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2 ${
                  connectionPreference === 'WHATSAPP_GROUP'
                    ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="connectionPreference"
                    value="WHATSAPP_GROUP"
                    checked={connectionPreference === 'WHATSAPP_GROUP'}
                    onChange={() => setConnectionPreference('WHATSAPP_GROUP')}
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 mt-0.5"
                  />
                  <div>
                    <div className="font-bold text-gray-900">WhatsApp Group</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">Direct chat with verified buyers in {pool.city}</div>
                  </div>
                </label>

                <label className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2 ${
                  connectionPreference === 'INDIVIDUAL_INTRO'
                    ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="connectionPreference"
                    value="INDIVIDUAL_INTRO"
                    checked={connectionPreference === 'INDIVIDUAL_INTRO'}
                    onChange={() => setConnectionPreference('INDIVIDUAL_INTRO')}
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 mt-0.5"
                  />
                  <div>
                    <div className="font-bold text-gray-900">1-on-1 Introduction</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">Private coordinator & dealer intro without group chat</div>
                  </div>
                </label>
              </div>

              {connectionPreference === 'WHATSAPP_GROUP' && (
                <label className="flex items-start gap-2.5 cursor-pointer select-none bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5 mt-2">
                  <input
                    type="checkbox"
                    checked={groupPrivacyAcknowledged}
                    onChange={(e) => setGroupPrivacyAcknowledged(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-amber-600 focus:ring-amber-500 border-amber-300"
                  />
                  <span className="text-[11px] text-amber-900 leading-relaxed">
                    <strong>Privacy Notice:</strong> I understand that other members in the WhatsApp group will be able to see my mobile number. <span className="text-rose-500">*</span>
                  </span>
                </label>
              )}
            </div>

            {/* Collapsible Additional Preferences (Optional) */}
            <div className="pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowAdditional(!showAdditional)}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 focus:outline-hidden"
              >
                <span>{showAdditional ? '− Hide optional preferences' : '+ Add optional preferences (Timeline & notes)'}</span>
              </button>

              {showAdditional && (
                <div className="mt-3 space-y-3 pt-2">
                  {/* Buying Timeline */}
                  <div>
                    <label htmlFor="buying-timeline" className="block text-xs font-semibold text-gray-800 mb-1">
                      Expected Timeline
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
                  <div>
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
                      <div className="mt-2 pl-6">
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
                      Variant or Exchange Note
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
                </div>
              )}
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
                <strong>Privacy Statement:</strong> By registering, you agree that GroupBuying may use your contact details to coordinate this buying group. Dealer contact and lead sharing is handled only with separate consent and under DPDP Act compliance (Notice v{PRIVACY_NOTICE_VERSION}).
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
                  <span>{isPoolFull ? 'Joining Waitlist...' : 'Joining Group...'}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  <span>{isPoolFull ? 'Join Priority Waitlist Free' : 'Join Group Free'}</span>
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
