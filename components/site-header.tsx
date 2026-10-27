import React from 'react';
import Link from 'next/link';
import { Users2, ShieldCheck, Sparkles } from 'lucide-react';
import { LocationSelector } from './location-selector';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link
            href="/"
            className="flex items-center gap-2.5 text-gray-900 group transition-transform active:scale-95"
            aria-label="PoolBuy India Home"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm shadow-emerald-500/20 group-hover:shadow-md group-hover:shadow-emerald-500/30 transition-all">
              <Users2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg tracking-tight text-gray-950 font-sans">
                  PoolBuy<span className="text-emerald-600">.in</span>
                </span>
                <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                  India
                </span>
              </div>
              <p className="text-[11px] text-gray-500 hidden sm:block -mt-0.5">
                Zero-Risk Group Buying
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
            <Link
              href="/#pools"
              className="hover:text-emerald-600 transition-colors py-1"
            >
              Active Pools
            </Link>
            <Link
              href="/#how-it-works"
              className="hover:text-emerald-600 transition-colors py-1"
            >
              How It Works
            </Link>
            <Link
              href="/blog"
              className="hover:text-emerald-600 transition-colors py-1"
            >
              Blog & Guides
            </Link>
            <Link
              href="/#request-pool"
              className="hover:text-emerald-600 transition-colors py-1 flex items-center gap-1 text-gray-800"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              Request a Pool
            </Link>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <LocationSelector />

            <div className="hidden xl:flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              <span>100% Free Interest</span>
            </div>

            <Link
              href="/admin"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all"
            >
              Admin
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
