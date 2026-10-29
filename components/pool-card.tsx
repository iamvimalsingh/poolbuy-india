'use client';

import React from 'react';
import Link from 'next/link';
import { MapPin, ArrowRight, ShieldCheck, Users, Clock, CheckCircle2 } from 'lucide-react';
import { PublicPool } from '@/types';
import { getCountdownParts, formatINR } from '@/lib/format';
import { PoolImage } from './pool-image';

export { PoolCardSkeleton, PoolCardSkeletonGrid } from './pool-card-skeleton';

interface PoolCardProps {
  pool: PublicPool;
  onJoinClick?: (pool: PublicPool) => void;
  priorityImage?: boolean;
}

export function PoolCard({ pool, onJoinClick, priorityImage = false }: PoolCardProps) {
  // Authoritative status and deadline checks safely handling undefined or invalid values
  const deadlineStr = pool.deadline || (pool as unknown as { endDate?: string }).endDate;
  const countdown = deadlineStr ? getCountdownParts(deadlineStr) : null;
  const isPastDeadline = countdown ? countdown.isExpired : false;
  const daysRemaining = countdown && !countdown.isExpired ? countdown.days : null;
  const isClosed = pool.status === 'CLOSED';
  const isDraft = pool.status === 'DRAFT';
  const isPaused = (pool.status as string) === 'PAUSED';

  const activeCount = pool.currentBuyers ?? 0;
  const targetBuyers = pool.targetBuyers && pool.targetBuyers > 0 ? pool.targetBuyers : 10;
  const remainingSpots = Math.max(0, targetBuyers - activeCount);
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
  } else if (isDraft) {
    actionLabel = 'Draft';
    isActionEnabled = false;
  } else if (isPaused) {
    actionLabel = 'Paused';
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
  const hasMarketPrice = typeof pool.marketPrice === 'number' && pool.marketPrice > 0;
  const showMarketDiscount = hasGroupPrice && hasMarketPrice && (pool.marketPrice as number) > (pool.groupPrice as number);
  const discountPercent = showMarketDiscount
    ? Math.round((((pool.marketPrice as number) - (pool.groupPrice as number)) / (pool.marketPrice as number)) * 100)
    : 0;

  // Dynamic progress bar calculation
  const percentFull = Math.min(100, Math.round((activeCount / targetBuyers) * 100));
  const progressBarColor =
    percentFull >= 80
      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
      : percentFull >= 50
      ? 'bg-emerald-600'
      : 'bg-emerald-500';

  // Dynamic Urgency & FOMO evaluation
  let urgencyBadge: { label: string; className: string } | null = null;

  if (!isClosed && !isPastDeadline && !isDraft && !isPaused && !isCompletelyFull) {
    if (percentFull >= 80 && remainingSpots > 0) {
      urgencyBadge = {
        label: `🔥 Fast filling - Only ${remainingSpots} ${remainingSpots === 1 ? 'spot' : 'spots'} left!`,
        className: 'bg-rose-100/90 text-rose-800 border-rose-200/90 shadow-rose-950/5',
      };
    } else if (daysRemaining !== null && daysRemaining < 5 && daysRemaining >= 0) {
      const timeLabel =
        daysRemaining === 0
          ? 'today'
          : daysRemaining === 1
          ? 'in 1 day'
          : `in ${daysRemaining} days`;
      urgencyBadge = {
        label: `⏳ Closing ${timeLabel}`,
        className: 'bg-amber-100/90 text-amber-800 border-amber-200/90 shadow-amber-950/5',
      };
    }
  }

  return (
    <article className="group bg-white rounded-2xl border border-gray-200/60 shadow-sm hover:shadow-xl hover:shadow-emerald-900/5 hover:-translate-y-1.5 transition-all duration-300 ease-out flex flex-col overflow-hidden">
      {/* 2. Image Header Section (Premium Display with Dedicated Background) */}
      <div className="relative h-48 w-full bg-slate-50/80 bg-gradient-to-b from-slate-50/90 to-slate-100/50 overflow-hidden flex items-center justify-center p-4">
        <Link href={dealUrl} className="relative w-full h-full block focus:outline-hidden" tabIndex={-1} aria-hidden="true">
          <PoolImage
            src={pool.imageUrl}
            alt={`${pool.productTitle || pool.name} in ${city}`}
            category={pool.category}
            categorySlug={pool.categorySlug}
            slugOrName={pool.slug || pool.name}
            priority={priorityImage}
            objectFit="contain"
            className="group-hover:scale-105 transition-transform duration-300 ease-out"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </Link>

        {/* Status overlay with Glassmorphism Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold backdrop-blur-md bg-white/80 text-gray-800 px-2.5 py-1 rounded-full shadow-xs border border-gray-200/50">
            <MapPin className="w-3 h-3 text-emerald-600" aria-hidden="true" />
            <span className="truncate max-w-[130px]">{city}</span>
          </span>

          <span
            className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border shadow-xs backdrop-blur-md ${
              isClosed
                ? 'bg-rose-50/80 text-rose-700 border-rose-200/80'
                : isDraft
                ? 'bg-amber-50/80 text-amber-700 border-amber-200/80'
                : isPaused
                ? 'bg-slate-100/90 text-slate-700 border-slate-300/80'
                : isPastDeadline
                ? 'bg-amber-50/80 text-amber-700 border-amber-200/80'
                : 'bg-white/80 text-emerald-700 border-emerald-200/80'
            }`}
          >
            {isClosed ? 'Closed' : isDraft ? 'Draft' : isPaused ? 'Paused' : isPastDeadline ? 'Concluded' : 'Active Pool'}
          </span>
        </div>

        {/* Urgency & FOMO Overlay Badge */}
        {urgencyBadge && (
          <div className="absolute bottom-3 left-3 pointer-events-none z-10">
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border shadow-xs backdrop-blur-md ${urgencyBadge.className}`}
            >
              <span>{urgencyBadge.label}</span>
            </span>
          </div>
        )}
      </div>

      {/* Body Content */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
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
          <p className="text-xs text-gray-500 line-clamp-2 mb-3.5 leading-relaxed">
            {pool.shortDescription || 'Independent city-wise pool aggregating local demand for collective supplier pricing.'}
          </p>

          {/* 4. Typography & Pricing: Prominent Target Price + Crossed-out Market Price */}
          <div className="mb-3.5 pt-3 border-t border-gray-100 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                {isVerifiedQuote
                  ? 'Verified Supplier Quote'
                  : hasGroupPrice
                  ? 'Indicative target price — subject to supplier confirmation'
                  : 'Supplier Quote Status'}
              </span>
              {isVerifiedQuote ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Verified Quote
                </span>
              ) : (
                <span className="inline-flex items-center text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                  Aggregating Demand
                </span>
              )}
            </div>

            <div className="flex items-baseline flex-wrap gap-2">
              <span className="text-2xl font-extrabold text-gray-950 font-mono tracking-tight">
                {hasGroupPrice ? formatINR(pool.groupPrice) : 'Negotiation in Progress'}
              </span>
              {showMarketDiscount && (
                <span className="text-sm font-semibold text-gray-400 line-through decoration-gray-400/80 font-mono">
                  {formatINR(pool.marketPrice)}
                </span>
              )}
              {showMarketDiscount ? (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded">
                  {discountPercent}% OFF (Estimated — not guaranteed)
                </span>
              ) : !hasMarketPrice && hasGroupPrice ? (
                <span className="text-[10px] text-gray-400 font-medium">
                  Discount being negotiated
                </span>
              ) : null}
            </div>

            {pool.quoteValidUntil && isVerifiedQuote && (
              <p className="text-[10px] text-emerald-700 font-medium">
                Quote valid until: {new Date(pool.quoteValidUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>

          {/* 3. Progress Bar (Visual Urgency - Thicker h-3 & Dynamic Color Gradient) */}
          <div className="bg-slate-50/90 rounded-2xl p-3 border border-slate-200/70 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-gray-700">
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                <span>Confirmed Members</span>
              </span>
              <span className="font-mono text-gray-950 font-bold">
                {activeCount} / {targetBuyers} ({percentFull}%)
              </span>
            </div>

            {/* Thicker h-3 progress bar with dynamic gradient */}
            <div className="w-full h-3 bg-gray-200/80 rounded-full overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${progressBarColor}`}
                style={{ width: `${percentFull}%` }}
              />
            </div>

            {/* Show FIFO Waitlist ONLY when confirmed member capacity is full and waitlisting is allowed */}
            {isCapacityFull && maxWaitlistSize > 0 && (
              <div className="flex items-center justify-between text-[11px] text-amber-800 bg-amber-50/90 px-2.5 py-1.5 rounded-xl border border-amber-200/70 pt-1 mt-1">
                <span className="flex items-center gap-1 font-medium">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>FIFO Waitlist Queue</span>
                </span>
                <span className="font-mono font-bold text-amber-900">
                  {waitlistCount} / {maxWaitlistSize} spots
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Next Step Clarity */}
          <div className="text-[11px] text-gray-500 bg-gray-50/80 rounded-xl px-2.5 py-1.5 border border-gray-100 flex items-center gap-1.5 mb-2.5">
            <span className="font-semibold text-gray-700 shrink-0">Next Step:</span>
            <span className="truncate">
              {isCompletelyFull
                ? 'Pool & Waitlist are full. Submit a proposal.'
                : isCapacityFull
                ? 'Target reached. Join waitlist for vacancies.'
                : isVerifiedQuote
                ? 'Verified supplier offer confirmed.'
                : 'Free to join. Group bids sought at target.'}
            </span>
          </div>

          {/* 5. CTA Button (Full Width with Hover Translate Icon) */}
        <div>
          <div className="pt-2 border-t border-gray-100">
            {onJoinClick ? (
              <button
                type="button"
                disabled={!isActionEnabled}
                onClick={() => onJoinClick(pool)}
                className={`group/btn w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
                  isCompletelyFull
                    ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                    : !isActionEnabled
                    ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                    : isCapacityFull
                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20 active:scale-[0.98]'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 hover:shadow-md hover:shadow-emerald-600/25 active:scale-[0.98]'
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>{actionLabel}</span>
                <ArrowRight className="w-4 h-4 shrink-0 group-hover/btn:translate-x-1 transition-transform duration-200" />
              </button>
            ) : (
              <Link
                href={dealUrl}
                className={`group/btn w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 shadow-sm flex items-center justify-center gap-2 ${
                  isActionEnabled
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 hover:shadow-md hover:shadow-emerald-600/25 active:scale-[0.98]'
                    : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>{actionLabel}</span>
                <ArrowRight className="w-4 h-4 shrink-0 group-hover/btn:translate-x-1 transition-transform duration-200" />
              </Link>
            )}
          </div>

          <p className="text-[10px] text-gray-400 text-center mt-2.5">
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
