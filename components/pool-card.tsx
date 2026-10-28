'use client';

import React from 'react';
import Link from 'next/link';
import { MapPin, ArrowRight, ShieldCheck, Users, Clock, CheckCircle2 } from 'lucide-react';
import { PublicPool } from '@/types';
import { getCountdownParts, formatINR } from '@/lib/format';
import { PoolImage } from './pool-image';

interface PoolCardProps {
  pool: PublicPool;
  onJoinClick?: (pool: PublicPool) => void;
  priorityImage?: boolean;
}

export function PoolCard({ pool, onJoinClick, priorityImage = false }: PoolCardProps) {
  // Authoritative status and deadline checks
  const isPastDeadline = getCountdownParts(pool.deadline).isExpired;
  const isClosed = pool.status === 'CLOSED';

  const activeCount = pool.currentBuyers ?? 0;
  const targetBuyers = pool.targetBuyers && pool.targetBuyers > 0 ? pool.targetBuyers : 10;
  const waitlistCount = pool.waitlistCount ?? 0;
  const maxWaitlistSize = pool.maxWaitlistSize !== undefined ? pool.maxWaitlistSize : 5;

  const isCapacityFull = activeCount >= targetBuyers;
  const isWaitlistFull = maxWaitlistSize > 0 ? waitlistCount >= maxWaitlistSize : false;
  const isCompletelyFull = isCapacityFull && isWaitlistFull;

  // Primary city
  const city = pool.city || 'India';

  // Action button label & state
  let actionLabel = 'Join Free';
  let isActionEnabled = true;

  if (isClosed) {
    actionLabel = 'Closed';
    isActionEnabled = false;
  } else if (isPastDeadline) {
    actionLabel = 'Concluded';
    isActionEnabled = false;
  } else if (isCompletelyFull) {
    actionLabel = 'Waitlist Full';
    isActionEnabled = false;
  } else if (isCapacityFull) {
    actionLabel = 'Join Waitlist';
    isActionEnabled = true;
  } else {
    actionLabel = 'Join Free';
    isActionEnabled = true;
  }

  const dealUrl = `/deals/${pool.citySlug}/${pool.slug}`;

  // Quote / pricing status evaluation
  const isVerifiedQuote = Boolean(pool.priceIsVerified || pool.groupPriceType === 'VENDOR_VERIFIED');
  const hasGroupPrice = typeof pool.groupPrice === 'number' && pool.groupPrice > 0;

  return (
    <article className="group bg-white rounded-3xl border border-gray-200/80 shadow-xs hover:shadow-md hover:border-emerald-200 transition-all duration-200 flex flex-col overflow-hidden">
      {/* Visual Header / Image with Fallback */}
      <div className="relative aspect-[16/9] w-full bg-gray-100 overflow-hidden">
        <PoolImage
          src={pool.imageUrl}
          alt={`${pool.productTitle || pool.name} in ${city}`}
          category={pool.category}
          categorySlug={pool.categorySlug}
          slugOrName={pool.slug || pool.name}
          priority={priorityImage}
          className="group-hover:scale-102 transition-transform duration-300"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />

        {/* Status overlay */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white/95 backdrop-blur-xs text-gray-800 px-2.5 py-1 rounded-full shadow-xs border border-gray-200/50">
            <MapPin className="w-3 h-3 text-emerald-600" aria-hidden="true" />
            <span className="truncate max-w-[130px]">{city}</span>
          </span>

          <span
            className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-xs backdrop-blur-xs ${
              isClosed
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : isPastDeadline
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            } bg-white/95`}
          >
            {isClosed ? 'Closed' : isPastDeadline ? 'Concluded' : 'Active Pool'}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Brand & Variant Badges */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
            {pool.productBrand && (
              <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                {pool.productBrand}
              </span>
            )}
            {pool.variantName && (
              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-2 py-0.5 rounded-md">
                {pool.variantName}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-bold text-gray-950 text-base sm:text-lg tracking-tight mb-2 line-clamp-1 group-hover:text-emerald-700 transition-colors">
            <Link href={dealUrl} className="focus:outline-hidden focus:underline">
              {pool.productTitle || pool.name}
            </Link>
          </h3>

          {/* Description */}
          <p className="text-xs text-gray-500 line-clamp-2 mb-3 leading-relaxed">
            {pool.shortDescription || 'Independent city-wise pool aggregating local demand for collective supplier pricing.'}
          </p>

          {/* Pricing & Quote Status Badge */}
          <div className="mb-4 pt-2 border-t border-gray-100 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {isVerifiedQuote
                  ? 'Verified Supplier Quote'
                  : hasGroupPrice
                  ? 'Indicative Target Price'
                  : 'Supplier Quote Status'}
              </div>
              <div className="text-sm font-extrabold text-gray-950 font-mono">
                {hasGroupPrice ? formatINR(pool.groupPrice) : 'Negotiation in Progress'}
              </div>
            </div>

            {isVerifiedQuote ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Verified
              </span>
            ) : (
              <span className="inline-flex items-center text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                Aggregating Demand
              </span>
            )}
          </div>

          {/* Member Counts & Capacity Box */}
          <div className="bg-slate-50/90 rounded-2xl p-3 border border-slate-200/70 mb-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-gray-700">
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                <span>Confirmed Members</span>
              </span>
              <span className="font-mono text-gray-950 font-bold">
                {activeCount} / {targetBuyers}
              </span>
            </div>

            {/* Active progress bar */}
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  activeCount >= targetBuyers ? 'bg-emerald-600' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, (activeCount / targetBuyers) * 100)}%` }}
              />
            </div>

            {maxWaitlistSize > 0 && (
              <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-200/60">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-500" />
                  <span>FIFO Waitlist</span>
                </span>
                <span className="font-mono font-semibold text-gray-700">
                  {waitlistCount} / {maxWaitlistSize}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div>
          <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
            {onJoinClick ? (
              <button
                type="button"
                disabled={!isActionEnabled}
                onClick={() => onJoinClick(pool)}
                className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                  isCompletelyFull
                    ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                    : !isActionEnabled
                    ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                    : isCapacityFull
                    ? 'bg-amber-600 hover:bg-amber-700 text-white active:scale-98'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-98'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{actionLabel}</span>
              </button>
            ) : (
              <Link
                href={dealUrl}
                className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 ${
                  isActionEnabled
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{actionLabel}</span>
              </Link>
            )}

            <Link
              href={dealUrl}
              className="p-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              title="View Details"
            >
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <p className="text-[10px] text-gray-400 text-center mt-2">
            {isCompletelyFull ? (
              <>
                Pool &amp; Waitlist full.{' '}
                <a href="#request-pool" className="text-emerald-700 underline font-semibold">
                  Request a new pool
                </a>
              </>
            ) : (
              '100% Free interest. No purchase commitment.'
            )}
          </p>
        </div>
      </div>
    </article>
  );
}
