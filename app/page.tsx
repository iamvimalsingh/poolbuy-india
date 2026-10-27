import React from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { getPublicPools } from '@/lib/pools';
import { getOperationalCities } from '@/lib/cities';
import { getOperationalCategories } from '@/lib/categories';
import { PoolCatalog } from '@/components/pool-catalog';
import { PoolRequestForm } from '@/components/pool-request-form';

export default async function HomePage() {
  const [pools, operationalCities, operationalCategories] = await Promise.all([
    getPublicPools(),
    getOperationalCities(),
    getOperationalCategories(),
  ]);

  return (
    <div className="flex flex-col gap-12 sm:gap-16 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50/60 to-transparent border-b border-gray-100 pt-12 pb-16 sm:pt-20 sm:pb-24">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-tr from-emerald-100/40 via-teal-50/20 to-transparent blur-3xl -z-10 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Trust pill */}
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200/80 text-emerald-800 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-6 shadow-xs animate-fade-in">
            <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            <span>Zero-Risk Indian Group Buying • 100% Free to Express Interest</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-gray-950 tracking-tight max-w-4xl mx-auto leading-[1.15] mb-6">
            Get <span className="text-emerald-600">Bulk Dealer Quotations</span> on High-Ticket Products in Your City
          </h1>

          {/* Subheading */}
          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed mb-8">
            Express interest alongside verified local buyers in your city for Electric Scooters, Cars, Rooftop Solar, and Laptops. No upfront fees. No passwords.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="#pools"
              className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 active:scale-98 transition-all shadow-sm shadow-emerald-600/20"
            >
              <span>Explore Active Pools</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>

            <Link
              href="#how-it-works"
              className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span>How It Works</span>
            </Link>
          </div>

          {/* Metric highlights */}
          <div className="mt-12 pt-8 border-t border-gray-200/60 max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold text-gray-900">₹0</p>
              <p className="text-xs text-gray-500 font-medium">To Register Interest</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600">100%</p>
              <p className="text-xs text-gray-500 font-medium">Verified Showrooms</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-2xl sm:text-3xl font-extrabold text-gray-900">Direct</p>
              <p className="text-xs text-gray-500 font-medium">Dealer Invoice & Delivery</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pool Catalog with Interactive City/Category Filters & Join Modal */}
      <section id="pools" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full scroll-mt-24">
        <PoolCatalog initialPools={pools} initialCities={operationalCities} />
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="bg-white border-y border-gray-200/70 py-16 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 inline-block mb-3">
              Transparent & Verified
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-950 tracking-tight">
              How PoolBuy Works in 3 Simple Steps
            </h2>
            <p className="text-sm text-gray-600 mt-2">
              We aggregate buyer volume so verified local dealers offer authentic group pricing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="relative bg-gray-50/70 rounded-2xl p-6 border border-gray-200/70 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-base shadow-sm">
                1
              </div>
              <h3 className="font-bold text-gray-950 text-base">
                Express Free Interest
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Choose a product and your city. Enter your name and WhatsApp number. No accounts, no passwords, and zero upfront payment.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative bg-gray-50/70 rounded-2xl p-6 border border-gray-200/70 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-base shadow-sm">
                2
              </div>
              <h3 className="font-bold text-gray-950 text-base">
                Target Met & Terms Verified
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                When the pool hits its target threshold, our team secures signed commercial terms and group discount rates from verified local authorized dealerships.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative bg-gray-50/70 rounded-2xl p-6 border border-gray-200/70 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-base shadow-sm">
                3
              </div>
              <h3 className="font-bold text-gray-950 text-base">
                Unlock Token & Buy at Showroom
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                You receive the verified terms and a refundable token payment link (₹499–₹999) via WhatsApp. Pay directly at the authorized dealership for final invoice and delivery.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Demand Discovery Banner & Interactive PoolRequestForm */}
      <section id="request-pool" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full scroll-mt-24">
        <div className="bg-gradient-to-r from-emerald-900 to-teal-900 rounded-3xl p-6 sm:p-12 text-white relative overflow-hidden shadow-lg">
          <div className="relative z-10 max-w-2xl mb-8">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-400/30 mb-4">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              Demand Discovery
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Looking for a product not listed here?
            </h2>
            <p className="text-sm sm:text-base text-emerald-100/90 leading-relaxed mb-6">
              Tell us what you want to buy and in which city. If enough local buyers express interest, we will organize a verified group-buy pool with authorized dealers.
            </p>
            <div className="flex flex-wrap gap-4 items-center">
              <div className="text-xs text-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                <span>Zero obligation to purchase</span>
              </div>
              <div className="text-xs text-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                <span>Showroom terms verified upon demand</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 max-w-3xl">
            <PoolRequestForm
              initialCities={operationalCities}
              initialCategories={operationalCategories}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
