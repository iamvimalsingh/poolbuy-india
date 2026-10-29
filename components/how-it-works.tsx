import React from 'react';
import { MapPin, Search, Users, FileCheck2, ShieldCheck, CheckCircle2 } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      step: '1',
      title: 'Choose Your City',
      icon: MapPin,
      text: 'Select your city to connect with local buyers or propose a new group buying cohort for your area.',
      tag: 'Local Cohort',
    },
    {
      step: '2',
      title: 'Explore & Express Interest',
      icon: Search,
      text: 'Browse broad product categories like Home Rooftop Solar. Register your interest for free with zero upfront fees.',
      tag: '100% Free Interest',
    },
    {
      step: '3',
      title: 'Demand is Aggregated',
      icon: Users,
      text: 'Verified demand from neighbors in your city is combined to build transparent collective bargaining power.',
      tag: 'Volume Aggregation',
    },
    {
      step: '4',
      title: 'Supplier Quotes & Review',
      icon: FileCheck2,
      text: 'Supplier quotations may be sought and verified. You review the offer and decide independently whether to proceed.',
      tag: 'Independent Decision',
    },
  ];

  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 py-12 sm:py-16 bg-gradient-to-b from-emerald-50/40 via-emerald-50/20 to-transparent border-y border-emerald-100/60"
      aria-labelledby="how-it-works-title"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mx-auto text-center mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-1.5 bg-emerald-100/70 border border-emerald-200/80 text-emerald-900 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
            <span>How GroupBuying Works</span>
          </div>
          <h2
            id="how-it-works-title"
            className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-950 tracking-tight"
          >
            A Simple, Honest 4-Step Journey
          </h2>
          <p className="text-sm sm:text-base text-gray-600 mt-2.5 max-w-xl mx-auto leading-relaxed">
            Bringing local demand together to unlock transparent supplier quotations. Free to express interest with zero purchase commitments.
          </p>
        </div>

        {/* 4-Step Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {steps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="relative bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-emerald-100/80 shadow-xs shadow-emerald-900/5 hover:shadow-md hover:border-emerald-200 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar with Number and Icon */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-11 h-11 rounded-2xl bg-white border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs">
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <span className="font-mono font-extrabold text-xl text-emerald-600/30">
                      0{item.step}
                    </span>
                  </div>

                  {/* Step Title & Content */}
                  <div className="inline-block text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-md mb-2">
                    {item.tag}
                  </div>
                  <h3 className="text-base font-bold text-gray-950 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {item.text}
                  </p>
                </div>

                {/* Bottom Trust Microcopy */}
                <div className="pt-3 mt-4 border-t border-gray-100 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span>
                    {idx === 0
                      ? 'No location lock-in'
                      : idx === 1
                      ? 'No upfront fees or tokens'
                      : idx === 2
                      ? 'Demand aggregated locally'
                      : 'You always choose whether to buy'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Disclaimer Callout */}
        <div className="mt-8 text-center text-xs text-gray-500 max-w-2xl mx-auto">
          <p>
            * Note: GroupBuying.store coordinates collective demand. Indicative discounts are estimates. Supplier quotations are sought only when sufficient demand aggregates and are never guaranteed.
          </p>
        </div>
      </div>
    </section>
  );
}
