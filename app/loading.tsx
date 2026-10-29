import React from 'react';
import { PoolCardSkeleton } from '@/components/pool-card-skeleton';

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full animate-pulse">
      {/* Hero skeleton */}
      <div className="max-w-3xl mx-auto text-center mb-12 space-y-4">
        <div className="h-6 bg-emerald-100/70 rounded-full w-48 mx-auto" />
        <div className="h-10 bg-gray-200 rounded-xl w-3/4 mx-auto" />
        <div className="h-4 bg-gray-200 rounded-lg w-1/2 mx-auto" />
      </div>

      {/* Grid skeleton with modern card shape */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <PoolCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
