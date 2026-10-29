import React from 'react';

export function PoolCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="bg-white rounded-2xl border border-gray-200/60 shadow-sm flex flex-col overflow-hidden animate-pulse select-none"
    >
      {/* 1. Image Header Section (matches relative h-48 w-full bg-slate-50/80) */}
      <div className="relative h-48 w-full bg-slate-100/90 flex items-center justify-center p-4 overflow-hidden">
        {/* Centered product placeholder */}
        <div className="w-28 h-28 rounded-2xl bg-slate-200/80" />

        {/* Floating badge placeholders */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
          <div className="h-5 w-20 rounded-full bg-slate-200/90" />
          <div className="h-5 w-20 rounded-full bg-slate-200/90" />
        </div>

        {/* Urgency badge placeholder */}
        <div className="absolute bottom-3 left-3 pointer-events-none">
          <div className="h-5 w-28 rounded-full bg-slate-200/90" />
        </div>
      </div>

      {/* 2. Body Content (matches p-5 space-y-4) */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-3">
          {/* Brand & Variant Badges */}
          <div className="flex items-center gap-1.5 mb-2.5">
            <div className="h-4 w-14 rounded-md bg-slate-200" />
            <div className="h-4 w-20 rounded-md bg-slate-200/70" />
          </div>

          {/* Title Line */}
          <div className="h-5 w-3/4 rounded-md bg-slate-200" />

          {/* Description Lines */}
          <div className="space-y-1.5">
            <div className="h-3 w-full rounded bg-slate-200/70" />
            <div className="h-3 w-4/5 rounded bg-slate-200/70" />
          </div>

          {/* Pricing Section (matches pt-3 border-t border-gray-100) */}
          <div className="pt-3 border-t border-gray-100 flex items-end justify-between gap-3">
            <div className="space-y-1.5">
              <div className="h-2.5 w-28 rounded bg-slate-200/60" />
              <div className="h-6 w-32 rounded-md bg-slate-200" />
            </div>
            <div className="h-5 w-20 rounded-full bg-slate-200/70" />
          </div>

          {/* Progress Bar Container (matches bg-slate-50/90 rounded-2xl p-3) */}
          <div className="bg-slate-50/90 rounded-2xl p-3 border border-slate-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-28 rounded bg-slate-200" />
              <div className="h-3.5 w-16 rounded bg-slate-200" />
            </div>
            {/* Progress bar line (h-3 rounded-full) */}
            <div className="w-full h-3 bg-slate-200 rounded-full" />
            {/* Waitlist row */}
            <div className="flex items-center justify-between pt-1 border-t border-gray-200/60">
              <div className="h-2.5 w-20 rounded bg-slate-200/60" />
              <div className="h-2.5 w-12 rounded bg-slate-200/60" />
            </div>
          </div>
        </div>

        {/* 3. CTA Button Area (matches pt-2 border-t border-gray-100) */}
        <div>
          <div className="pt-2 border-t border-gray-100">
            <div className="h-11 w-full rounded-xl bg-slate-200" />
          </div>
          <div className="h-2.5 w-44 mx-auto rounded bg-slate-200/50 mt-2.5" />
        </div>
      </div>
    </div>
  );
}

export function PoolCardSkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
      aria-busy="true"
      aria-label="Loading pools"
    >
      {Array.from({ length: count }).map((_, i) => (
        <PoolCardSkeleton key={`skeleton-${i}`} />
      ))}
    </div>
  );
}
