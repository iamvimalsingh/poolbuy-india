'use client';

import React from 'react';
import Link from 'next/link';
import { MapPin, ArrowRight, ShieldCheck, Users, Clock } from 'lucide-react';
import { PublicPool } from '@/types';
import { getCountdownParts } from '@/lib/format';
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
  const waitlistCount = (pool as unknown as { waitlistCount?: number }).waitlistCount ?? 0;
  const isCapacityFull = activeCount >= 10;
  const isWaitlistFull = waitlistCount >= 5;
  const isCompletelyFull = isCapacityFull && isWaitlistFull;

  // City labels
  const cityLabels: string[] = (pool as unknown as { cityLabels?: string[] }).cityLabels || [pool.city];

  // Action button label & state
  let actionLabel = 'Join Pool';
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
    actionLabel = 'Join Pool';
    isActionEnabled = true;
  }

  const dealUrl = `/deals/${pool.citySlug}/${pool.slug}`;

  return (
    <article className="group bg-white rounded-3xl border border-gray-200/80 shadow-xs hover:shadow-md hover:border-emerald-200 transition-all duration-200 flex flex-col overflow-hidden">
      {/* Visual Header / Image with Fallback */}
      <div className="relative aspect-[16/9] w-full bg-gray-100 overflow-hidden">
        <PoolImage
          src={pool.imageUrl}
          alt={`${pool.name} in ${pool.city}`}
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
            <span className="truncate max-w-[120px]">{cityLabels[0] || pool.city}</span>
            {cityLabels.length > 1 && (
              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-1 rounded-full">
                +{cityLabels.length - 1}
              </span>
            )}
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
          {/* City Visibility Labels */}
          <div className="flex flex-wrap gap-1 mb-2.5">
            {cityLabels.slice(0, 4).map((city) => (
              <span
                key={city}
                className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md"
              >
                {city}
              </span>
            ))}
            {cityLabels.length > 4 && (
              <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">
                +{cityLabels.length - 4} more
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-bold text-gray-950 text-base sm:text-lg tracking-tight mb-2 line-clamp-1 group-hover:text-emerald-700 transition-colors">
            <Link href={dealUrl} className="focus:outline-hidden focus:underline">
              {pool.name}
            </Link>
          </h3>

          {/* Description */}
          <p className="text-xs text-gray-500 line-clamp-2 mb-4 leading-relaxed">
            {pool.shortDescription || 'Community demand pool aggregating buyers across cities for verified group pricing.'}
          </p>

          {/* Shared Global Counts Box */}
          <div className="bg-slate-50/90 rounded-2xl p-3 border border-slate-200/70 mb-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-gray-700">
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                <span>Shared Active Members</span>
              </span>
              <span className="font-mono text-gray-950 font-bold">
                {activeCount} / 10
              </span>
            </div>

            {/* Active progress bar */}
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  activeCount >= 10 ? 'bg-emerald-600' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, (activeCount / 10) * 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-200/60">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-500" />
                <span>FIFO Waitlist</span>
              </span>
              <span className="font-mono font-semibold text-gray-700">
                {waitlistCount} / 5
              </span>
            </div>
          </div>
        </div>

        {/* Action Button */}
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

        {isCompletelyFull && (
          <p className="text-[10px] text-gray-400 text-center mt-2">
            Pool &amp; Waitlist full.{' '}
            <a href="#request-pool" className="text-emerald-700 underline font-semibold">
              Request a new pool
            </a>
          </p>
        )}
      </div>
    </article>
  );
}
