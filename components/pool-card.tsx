import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, ArrowRight, ShieldCheck, Tag } from 'lucide-react';
import { PublicPool } from '@/types';
import { CATEGORIES, STATUS_LABELS } from '@/lib/constants';
import { formatINR } from '@/lib/format';
import { PoolProgress } from './pool-progress';
import { Countdown } from './countdown';

interface PoolCardProps {
  pool: PublicPool;
  onJoinClick?: (pool: PublicPool) => void;
  priorityImage?: boolean;
}

export function PoolCard({ pool, onJoinClick, priorityImage = false }: PoolCardProps) {
  const categoryMeta = CATEGORIES.find((c) => c.category === pool.category);
  const statusMeta = STATUS_LABELS[pool.status] || STATUS_LABELS.ACTIVE;

  const isJoinable = pool.status === 'ACTIVE';

  // Savings calculation
  const hasSavings =
    pool.marketPrice !== null &&
    pool.groupPrice !== null &&
    pool.marketPrice > pool.groupPrice;
  const savingsAmount = hasSavings && pool.marketPrice && pool.groupPrice
    ? pool.marketPrice - pool.groupPrice
    : 0;

  // Truthful urgency message
  let urgencyText = '';
  if (pool.status === 'CLOSED') {
    urgencyText = 'Pool closed — registration ended';
  } else if (pool.currentBuyers >= pool.targetBuyers) {
    urgencyText = 'Target reached — dealer confirmation pending';
  } else {
    const remaining = pool.targetBuyers - pool.currentBuyers;
    urgencyText = `Only ${remaining} more buyer${remaining === 1 ? '' : 's'} needed`;
  }

  const dealUrl = `/deals/${pool.citySlug}/${pool.slug}`;

  return (
    <article className="group bg-white rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md hover:border-emerald-200 transition-all duration-200 flex flex-col overflow-hidden">
      {/* Visual Header / Image */}
      <div className="relative aspect-[16/9] w-full bg-gray-100 overflow-hidden">
        <Image
          src={pool.imageUrl || '/images/pool-default.svg'}
          alt={`${pool.name} in ${pool.city}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          priority={priorityImage}
          className="object-cover group-hover:scale-102 transition-transform duration-300"
        />

        {/* Status / Category Badges overlay */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white/95 backdrop-blur-xs text-gray-800 px-2.5 py-1 rounded-full shadow-xs border border-gray-200/50">
            <MapPin className="w-3 h-3 text-emerald-600" aria-hidden="true" />
            {pool.city}
          </span>

          <span
            className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-xs backdrop-blur-xs ${statusMeta.badgeClass} bg-white/95`}
          >
            {statusMeta.label}
          </span>
        </div>

        {/* Demo Indicator Pill */}
        {!pool.priceIsVerified && (
          <div className="absolute bottom-2.5 left-3">
            <span className="text-[10px] font-medium bg-gray-900/80 text-white backdrop-blur-xs px-2 py-0.5 rounded-md flex items-center gap-1">
              <Tag className="w-2.5 h-2.5 text-amber-300" aria-hidden="true" />
              Demo Estimate
            </span>
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Category Label */}
          <p className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider mb-1">
            {categoryMeta?.label || pool.category}
          </p>

          {/* Product Name */}
          <h3 className="font-bold text-gray-950 text-base sm:text-lg tracking-tight mb-2 line-clamp-1 group-hover:text-emerald-700 transition-colors">
            <Link href={dealUrl} className="focus:outline-hidden focus:underline">
              {pool.name}
            </Link>
          </h3>

          <p className="text-xs text-gray-500 line-clamp-2 mb-4 leading-relaxed">
            {pool.shortDescription}
          </p>

          {/* Pricing Row */}
          <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-100 mb-4">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <span className="text-[10px] uppercase font-semibold text-gray-400 block tracking-wider">
                  Group Target Price
                </span>
                <span className="text-lg sm:text-xl font-extrabold text-gray-950">
                  {formatINR(pool.groupPrice)}
                </span>
              </div>

              {pool.marketPrice && (
                <div className="text-right">
                  <span className="text-[10px] uppercase font-semibold text-gray-400 block tracking-wider">
                    MRP / Market
                  </span>
                  <span className="text-xs text-gray-400 line-through">
                    {formatINR(pool.marketPrice)}
                  </span>
                </div>
              )}
            </div>

            {hasSavings && (
              <div className="mt-2 pt-2 border-t border-gray-200/60 flex items-center justify-between text-xs">
                <span className="text-[11px] text-gray-500">Estimated Saving:</span>
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-100">
                  Save ~{formatINR(savingsAmount)}
                </span>
              </div>
            )}
          </div>

          {/* Progress Component */}
          <PoolProgress
            currentBuyers={pool.currentBuyers}
            targetBuyers={pool.targetBuyers}
            className="mb-4"
          />

          {/* Urgency & Timer */}
          <div className="flex items-center justify-between gap-2 text-xs text-gray-500 mb-5 pt-1">
            <Countdown deadline={pool.deadline} />

            <span className="text-[11px] text-gray-600 truncate max-w-[170px]" title={urgencyText}>
              {urgencyText}
            </span>
          </div>
        </div>

        {/* Card Actions */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
          <Link
            href={dealUrl}
            className="inline-flex items-center justify-center gap-1 text-xs font-semibold px-3 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            <span>Details</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>

          {onJoinClick ? (
            <button
              type="button"
              disabled={!isJoinable}
              onClick={() => onJoinClick(pool)}
              className={`inline-flex items-center justify-center gap-1 text-xs font-semibold px-3 py-2.5 rounded-xl transition-all shadow-xs ${
                isJoinable
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-98'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isJoinable ? 'Join Free' : 'Closed'}</span>
            </button>
          ) : (
            <Link
              href={dealUrl}
              className={`inline-flex items-center justify-center gap-1 text-xs font-semibold px-3 py-2.5 rounded-xl transition-all shadow-xs ${
                isJoinable
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isJoinable ? 'Join Free' : 'Closed'}</span>
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
