'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Users2, ShieldCheck, Sparkles, Menu, X, HelpCircle, Layers, Info } from 'lucide-react';
import { LocationSelector } from './location-selector';

export function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link
            href="/"
            className="flex items-center gap-2.5 text-gray-900 group transition-transform active:scale-98"
            aria-label="GroupBuying Home"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm shadow-emerald-500/20 group-hover:shadow-md group-hover:shadow-emerald-500/30 transition-all">
              <Users2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg tracking-tight text-gray-950 font-sans">
                  GroupBuying<span className="text-gray-400 font-normal text-xs ml-0.5">.store</span>
                </span>
                <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-1.5 py-0.5 rounded-full tracking-wider hidden sm:inline-block">
                  PoolBuy India
                </span>
              </div>
              <p className="text-[11px] text-gray-500 hidden sm:block -mt-0.5">
                Community-Led Local Group Buying
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600" aria-label="Main Navigation">
            <Link
              href="/#categories"
              className="hover:text-emerald-600 transition-colors py-1 flex items-center gap-1.5"
            >
              <Layers className="w-4 h-4 text-gray-400" aria-hidden="true" />
              <span>Categories</span>
            </Link>
            <Link
              href="/#how-it-works"
              className="hover:text-emerald-600 transition-colors py-1 flex items-center gap-1.5"
            >
              <Info className="w-4 h-4 text-gray-400" aria-hidden="true" />
              <span>How It Works</span>
            </Link>
            <Link
              href="/#faqs"
              className="hover:text-emerald-600 transition-colors py-1 flex items-center gap-1.5"
            >
              <HelpCircle className="w-4 h-4 text-gray-400" aria-hidden="true" />
              <span>FAQs</span>
            </Link>
            <Link
              href="/#request-pool"
              className="hover:text-emerald-600 transition-colors py-1 flex items-center gap-1 text-gray-900 font-semibold"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              <span>Start a Pool</span>
            </Link>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <LocationSelector />

            <div className="hidden xl:flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              <span>100% Free Interest</span>
            </div>

            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-gray-600 hover:text-gray-950 hover:bg-gray-100 transition-colors"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Responsive Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100 bg-white/95 animate-fade-in-down">
            <nav className="flex flex-col gap-2.5 text-sm font-medium text-gray-700" aria-label="Mobile Navigation">
              <Link
                href="/#categories"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-xl hover:bg-emerald-50 hover:text-emerald-800 transition-colors flex items-center gap-2"
              >
                <Layers className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                <span>Categories</span>
              </Link>
              <Link
                href="/#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-xl hover:bg-emerald-50 hover:text-emerald-800 transition-colors flex items-center gap-2"
              >
                <Info className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                <span>How It Works</span>
              </Link>
              <Link
                href="/#faqs"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-xl hover:bg-emerald-50 hover:text-emerald-800 transition-colors flex items-center gap-2"
              >
                <HelpCircle className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                <span>FAQs</span>
              </Link>
              <Link
                href="/#request-pool"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-900 font-semibold flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                <span>Start a Pool</span>
              </Link>
            </nav>
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-500 px-3">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
              <span>Free to express interest • No purchase commitment</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
