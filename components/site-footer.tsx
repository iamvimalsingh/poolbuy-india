import React from 'react';
import Link from 'next/link';
import { ShieldAlert, Users2 } from 'lucide-react';
import { CITIES, CATEGORIES } from '@/lib/constants';

export function SiteFooter() {
  return (
    <footer className="bg-gray-900 text-gray-300 border-t border-gray-800 mt-auto">
      {/* Disclaimer Banner */}
      <div className="border-b border-gray-800/80 bg-gray-950/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-start gap-3 text-xs text-slate-400">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="leading-relaxed">
              <strong>Legal Disclaimer:</strong> GroupBuying.store (PoolBuy India) is an interest-aggregation discovery platform.
              We are not an authorized automobile dealer, manufacturer, solar installer, financial lender, escrow service, or direct seller.
              Joining a group deal expresses non-binding purchase intent. Group discounts are subject to reaching minimum buyer thresholds
              and written verification of commercial terms by licensed local dealerships. Illustrative prices shown in demo
              modes are estimates and do not constitute legal quotations.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10 mb-12">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
                <Users2 className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <span className="font-bold text-white text-lg tracking-tight block">
                  GroupBuying<span className="text-emerald-400">.store</span>
                </span>
                <span className="text-[10px] text-emerald-400/80 font-medium">
                  PoolBuy India
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Empowering Indian homeowners and consumers to access transparent bulk commercial pricing on rooftop solar, power backup, and water softeners through coordinated collective demand.
            </p>
            <div className="text-[11px] text-slate-500 font-mono">
              Engineered for India • Zero Signup Required
            </div>
          </div>

          {/* Supported Cities (Dense Multi-Column Grid) */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                Supported Cities
              </h4>
              <span className="text-[10px] text-slate-500 font-medium font-mono">
                {CITIES.length} Hubs
              </span>
            </div>
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
              {CITIES.map((city) => (
                <li key={city.slug} className="min-w-0">
                  <Link
                    href={`/city/${city.slug}`}
                    className="text-slate-400 hover:text-emerald-400 transition-colors truncate block py-0.5"
                    title={`Group Buying in ${city.name}`}
                  >
                    <span className="sr-only">Group Buying in </span>
                    {city.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Deal Categories */}
          <div className="lg:col-span-1">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">
              Deal Categories
            </h4>
            <ul className="space-y-1.5 text-xs">
              {CATEGORIES.map((cat) => (
                <li key={cat.slug}>
                  <Link
                    href={`/category/${cat.slug}`}
                    className="text-slate-400 hover:text-emerald-400 transition-colors block py-0.5"
                  >
                    {cat.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Platform & Safety */}
          <div className="lg:col-span-1">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">
              Platform & Safety
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <span className="text-slate-300 font-medium">Free Interest Registration</span>
              </li>
              <li>
                <span>No Advance Fees to Browse</span>
              </li>
              <li>
                <span>Coordination Fee Only After Pool Target &amp; Quote Verified</span>
              </li>
              <li>
                <span>Direct Delivery by Authorized Showrooms</span>
              </li>
              <li className="pt-2">
                <Link
                  href="/admin"
                  className="inline-block text-xs text-emerald-400 hover:text-emerald-300 hover:underline"
                >
                  Admin / Operator Login →
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 GroupBuying.store • PoolBuy India. All rights reserved.</p>
          <p className="text-center sm:text-right">
            Privacy Version: 2026-10-26-v1 • Respecting DPDP Act buyer privacy norms
          </p>
        </div>
      </div>
    </footer>
  );
}
