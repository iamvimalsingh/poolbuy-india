import React from 'react';
import Link from 'next/link';
import { FileQuestion, Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 border border-gray-200 text-gray-400 flex items-center justify-center mx-auto mb-6 shadow-xs">
        <FileQuestion className="w-8 h-8" aria-hidden="true" />
      </div>

      <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 inline-block mb-3">
        404 Not Found
      </span>

      <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-950 mb-3 tracking-tight">
        Page Not Found
      </h1>

      <p className="text-sm text-gray-600 mb-8 max-w-sm mx-auto leading-relaxed">
        The deal, city, or page you requested could not be found or has expired. Explore active group buying pools in your city.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
        >
          <Home className="w-4 h-4" aria-hidden="true" />
          <span>Browse Active Pools</span>
        </Link>

        <Link
          href="/#request-pool"
          className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Search className="w-4 h-4" aria-hidden="true" />
          <span>Request a New Deal</span>
        </Link>
      </div>
    </div>
  );
}
