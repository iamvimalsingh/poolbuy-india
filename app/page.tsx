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
import { connection } from 'next/server';
import { PoolCatalog } from '@/components/pool-catalog';
import { PoolRequestForm } from '@/components/pool-request-form';

export default async function HomePage() {
  await connection();
  const [pools, operationalCities, operationalCategories] = await Promise.all([
    getPublicPools(),
    getOperationalCities(),
    getOperationalCategories(),
  ]);

  return (
    <div className="flex flex-col gap-12 sm:gap-16 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white/80 via-slate-50/50 to-transparent border-b border-gray-100/80 pt-12 pb-16 sm:pt-20 sm:pb-24">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-tr from-emerald-100/35 via-teal-50/20 to-transparent blur-3xl -z-10 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Trust pill */}
          <div className="inline-flex items-center gap-2 bg-emerald-50/90 border border-emerald-200/80 text-emerald-800 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-6 shadow-xs animate-fade-in-up">
            <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            <span>Community-Led Group Buying in India • 100% Free to Join or Propose</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-sans font-extrabold text-gray-950 tracking-tight max-w-4xl mx-auto leading-[1.12] sm:leading-[1.1] mb-6 animate-fade-in-up animate-delay-100">
            Bring local buyers together.
          </h1>

          {/* Supporting copy */}
          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed mb-8 animate-fade-in-up animate-delay-200">
            Start or join a buying group in your city. Build collective demand, explore available quotations and decide together where to buy.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 animate-fade-in-up animate-delay-200">
            <Link
              href="#request-pool"
              className="group inline-flex items-center gap-2 text-sm font-semibold px-6 py-3.5 rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/25 ring-1 ring-emerald-500/30 hover:bg-emerald-500 hover:shadow-xl hover:shadow-emerald-500/40 hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 ease-out"
            >
              <Sparkles className="w-4 h-4 transition-transform duration-200 group-hover:rotate-12" aria-hidden="true" />
              <span>Start a Pool</span>
            </Link>

            <Link
              href="#pools"
              className="group inline-flex items-center gap-2 text-sm font-semibold px-6 py-3.5 rounded-xl border border-gray-200/90 bg-white text-gray-800 shadow-xs shadow-slate-900/5 hover:border-emerald-300 hover:text-emerald-950 hover:bg-white hover:shadow-lg hover:shadow-emerald-900/10 hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 ease-out"
            >
              <span>Explore Pools</span>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all duration-200" aria-hidden="true" />
            </Link>

            <Link
              href="#how-it-works"
              className="inline-flex items-center gap-2 text-sm font-medium px-4 py-3.5 text-gray-500 hover:text-gray-900 hover:bg-white/80 rounded-xl transition-all duration-150"
            >
              <span>How It Works</span>
            </Link>
          </div>

          {/* Metric highlights */}
          <div className="mt-12 pt-8 border-t border-gray-200/60 max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-3 gap-6 text-center">
            <div className="animate-fade-in-up animate-delay-300">
              <p className="text-2xl sm:text-3xl font-extrabold text-gray-900">₹0</p>
              <p className="text-xs text-gray-500 font-medium">To Join or Propose a Pool</p>
            </div>
            <div className="animate-fade-in-up animate-delay-400">
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600">Local</p>
              <p className="text-xs text-gray-500 font-medium">City-First Collective Demand</p>
            </div>
            <div className="col-span-2 sm:col-span-1 animate-fade-in-up animate-delay-500">
              <p className="text-2xl sm:text-3xl font-extrabold text-gray-900">Direct</p>
              <p className="text-xs text-gray-500 font-medium">Members Decide Where to Buy</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pool Catalog with Interactive City/Category Filters & Join Modal */}
      <section id="pools" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full scroll-mt-24">
        <PoolCatalog
          initialPools={pools}
          initialCities={operationalCities}
          initialCategories={operationalCategories}
        />
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="bg-white border-y border-gray-200/70 py-16 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 inline-block mb-3">
              Community Group Buying
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-950 tracking-tight">
              How Group Buying Works in 4 Steps
            </h2>
            <p className="text-sm text-gray-600 mt-2">
              GroupBuying coordinates local buyer interest so you can negotiate or choose quotations with real volume leverage.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="relative bg-gray-50/70 rounded-2xl p-6 border border-gray-200/70 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                1
              </div>
              <h3 className="font-bold text-gray-950 text-sm">
                Choose City &amp; Product
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Discover active pools in your city or start a new group buy proposal for a product you need.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative bg-gray-50/70 rounded-2xl p-6 border border-gray-200/70 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                2
              </div>
              <h3 className="font-bold text-gray-950 text-sm">
                Start or Join Free
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                No customer login, password, or upfront fees. Enter your name and WhatsApp number to register interest.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative bg-gray-50/70 rounded-2xl p-6 border border-gray-200/70 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                3
              </div>
              <h3 className="font-bold text-gray-950 text-sm">
                Build Local Demand
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Your group aggregates verified community demand towards a clear buyer target before the pool deadline.
              </p>
            </div>

            {/* Step 4 */}
            <div className="relative bg-gray-50/70 rounded-2xl p-6 border border-gray-200/70 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                4
              </div>
              <h3 className="font-bold text-gray-950 text-sm">
                Review Offers &amp; Connect
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                When the target milestone is met, review available vendor quotations and choose whether and how to connect.
              </p>
            </div>
          </div>

          {/* Trust and Independence Disclosure */}
          <div className="mt-10 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 text-center max-w-3xl mx-auto leading-relaxed">
            <strong>Facilitator Disclosure:</strong> GroupBuying facilitates local demand coordination. We are not an escrow agent, manufacturer, or seller. Participation is free before target milestones. Targets do not guarantee manufacturer discounts. Participants and suppliers decide contracts, payments, and fulfilment directly.
          </div>
        </div>
      </section>

      {/* Demand Discovery Banner & Interactive PoolRequestForm */}
      <section id="request-pool" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full scroll-mt-24">
        <div className="bg-gradient-to-r from-emerald-900 to-teal-900 rounded-3xl p-6 sm:p-12 text-white relative overflow-hidden shadow-lg">
          <div className="relative z-10 max-w-2xl mb-8">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-400/30 mb-4">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              Start a Pool (Proposal for Admin Review)
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Propose a collective buying pool for your community
            </h2>
            <p className="text-sm sm:text-base text-emerald-100/90 leading-relaxed mb-6">
              Organizing for an apartment society, residential colony, or commercial group? Propose a group-buy pool in your city. Submissions enter Admin review and are published after approval so local neighbors can join.
            </p>
            <div className="flex flex-wrap gap-4 items-center">
              <div className="text-xs text-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                <span>100% Free to propose or join</span>
              </div>
              <div className="text-xs text-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                <span>Reviewed before public listing</span>
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
