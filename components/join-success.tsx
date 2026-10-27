'use client';

import React from 'react';
import { CheckCircle2, Share2, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import { PublicPool, JoinPoolResult } from '@/types';
import { buildBuyerViralShareUrl } from '@/lib/whatsapp';
import { isDemoMode } from '@/lib/data-mode';
import { getSiteUrl } from '@/lib/seo';

interface JoinSuccessProps {
  pool: PublicPool;
  result: JoinPoolResult;
  onClose: () => void;
}

export function JoinSuccess({ pool, result, onClose }: JoinSuccessProps) {
  const isDemo = isDemoMode();
  const siteUrl = getSiteUrl();
  const shareUrl = buildBuyerViralShareUrl(pool, siteUrl);

  return (
    <div className="text-center py-6 px-2 sm:px-4 space-y-6">
      {/* Icon badge */}
      <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm animate-bounce-short">
        <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
      </div>

      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 inline-block mb-3">
          {result.alreadyJoined ? 'Already Registered' : 'Registration Confirmed'}
        </span>

        <h3 className="text-2xl font-extrabold text-gray-950 tracking-tight">
          {result.alreadyJoined ? (
            <>You are already registered!</>
          ) : (
            <>
              You are <span className="text-emerald-600">Buyer #{result.buyerNumber}</span>
            </>
          )}
        </h3>

        <p className="text-sm text-gray-600 max-w-sm mx-auto mt-2 leading-relaxed">
          {result.alreadyJoined
            ? `Your WhatsApp number is already recorded as Buyer #${result.buyerNumber} for ${pool.name} in ${pool.city}.`
            : `Your interest for ${pool.name} in ${pool.city} is successfully registered.`}
        </p>
      </div>

      {/* Progress update callout */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 max-w-sm mx-auto space-y-2 text-left">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-gray-600">Total Buyers Joined:</span>
          <span className="font-extrabold text-gray-900 text-sm">
            {result.currentBuyers} / {result.targetBuyers}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
          <span className="font-medium text-gray-600">Target Remaining:</span>
          <span className="font-semibold text-emerald-700">
            {result.remainingBuyers > 0
              ? `${result.remainingBuyers} more needed to unlock terms`
              : 'Target Met! Dealer review pending'}
          </span>
        </div>
      </div>

      {/* Demo Mode Notice */}
      {isDemo && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl p-3 max-w-sm mx-auto flex items-start gap-2 text-left">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            <strong>Demo Mode:</strong> This interest is recorded in the development session store and visible in the Admin CRM for verification.
          </span>
        </div>
      )}

      {/* Viral Share Callout */}
      <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 max-w-sm mx-auto text-left space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
          <Sparkles className="w-4 h-4 text-emerald-600" aria-hidden="true" />
          <span>Help reach the buyer target faster!</span>
        </div>
        <p className="text-xs text-emerald-950/80 leading-relaxed">
          Share this pool with friends, family, or colleagues in {pool.city}. The sooner {result.targetBuyers} buyers join, the faster authorized dealers unlock group pricing.
        </p>

        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 text-xs font-bold px-4 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 active:scale-98 transition-all shadow-xs"
        >
          <Share2 className="w-4 h-4" aria-hidden="true" />
          <span>Share Deal on WhatsApp</span>
        </a>
      </div>

      {/* Done button */}
      <div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors inline-flex items-center gap-1"
        >
          <span>Continue Browsing Pools</span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
