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
          <div className="flex items-start gap-3 text-xs text-gray-400">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Column */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
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
            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              Empowering Indian homeowners and consumers to access transparent bulk commercial pricing on rooftop solar, power backup, and water softeners through coordinated collective demand.
            </p>
            <div className="text-[11px] text-gray-500 font-mono">
              Engineered for India • Zero Signup Required
            </div>
          </div>

          {/* Popular Cities */}
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">
              Supported Cities
            </h4>
            <ul className="space-y-2 text-xs">
              {CITIES.map((city) => (
                <li key={city.slug}>
                  <Link
                    href={`/city/${city.slug}`}
                    className="hover:text-emerald-400 transition-colors"
                  >
                    Group Buying in {city.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Asset Categories */}
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">
              Deal Categories
            </h4>
            <ul className="space-y-2 text-xs">
              {CATEGORIES.map((cat) => (
                <li key={cat.slug}>
                  <Link
                    href={`/category/${cat.slug}`}
                    className="hover:text-emerald-400 transition-colors"
                  >
                    {cat.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Platform & Trust */}
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">
              Platform & Safety
            </h4>
            <ul className="space-y-2 text-xs text-gray-400">
              <li>
                <span className="text-gray-300 font-medium">Free Interest Registration</span>
              </li>
              <li>
                <span>No Advance Fees to Browse</span>
              </li>
              <li>
                <span>Refundable Token Upon Dealer Unlock</span>
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

        <div className="pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <p>© 2026 GroupBuying.store • PoolBuy India. All rights reserved.</p>
          <p className="text-center sm:text-right">
            Privacy Version: 2026-10-26-v1 • Respecting DPDP Act buyer privacy norms
          </p>
        </div>
      </div>
    </footer>
  );
}
