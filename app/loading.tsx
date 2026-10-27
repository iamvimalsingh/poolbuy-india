import React from 'react';

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full animate-pulse">
      {/* Hero skeleton */}
      <div className="max-w-3xl mx-auto text-center mb-12 space-y-4">
        <div className="h-6 bg-emerald-100 rounded-full w-48 mx-auto" />
        <div className="h-10 bg-gray-200 rounded-xl w-3/4 mx-auto" />
        <div className="h-4 bg-gray-200 rounded-lg w-1/2 mx-auto" />
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4 shadow-xs">
            <div className="aspect-[16/9] bg-gray-200 rounded-xl" />
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded w-1/4" />
              <div className="h-5 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-full" />
            </div>
            <div className="h-14 bg-gray-100 rounded-xl" />
            <div className="h-3 bg-gray-200 rounded-full" />
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="h-9 bg-gray-200 rounded-xl" />
              <div className="h-9 bg-gray-200 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
