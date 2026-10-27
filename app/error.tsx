'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log sanitized error in client console
    console.error('Application runtime error:', error.message);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-6 shadow-xs">
        <AlertTriangle className="w-7 h-7" aria-hidden="true" />
      </div>

      <h1 className="text-2xl font-bold text-gray-950 mb-2">
        Something went wrong
      </h1>
      <p className="text-sm text-gray-600 mb-8 max-w-md mx-auto leading-relaxed">
        We encountered an unexpected error while loading this page. Please try again, or return to the home page.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          <span>Try Again</span>
        </button>

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Home className="w-4 h-4" aria-hidden="true" />
          <span>Back to Home</span>
        </Link>
      </div>
    </div>
  );
}
