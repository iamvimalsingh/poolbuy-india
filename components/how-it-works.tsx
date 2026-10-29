import React from 'react';
import { MapPin, Users, Tag, ShieldCheck, CheckCircle2 } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      step: '1',
      title: 'Choose & Register',
      icon: MapPin,
      text: 'Select your city and find the product you need. Register your interest for 100% free with zero upfront fees.',
      tag: 'City-Specific Demand',
    },
    {
      step: '2',
      title: 'Group Demand',
      icon: Users,
      text: 'We group you with neighbors who want the same thing, building massive community bargaining power.',
      tag: 'Volume Leverage',
    },
    {
      step: '3',
      title: 'Unlock Discounts',
      icon: Tag,
      text: 'Once the pool fills, authorized local dealers offer the group a bulk-discounted commercial price.',
      tag: 'Direct Local Fulfillment',
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
            <span>Community-Led Group Buying</span>
          </div>
          <h2
            id="how-it-works-title"
            className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-950 tracking-tight"
          >
            How Group Buying Works in 3 Steps
          </h2>
          <p className="text-sm sm:text-base text-gray-600 mt-2.5 max-w-xl mx-auto leading-relaxed">
            Aggregate local demand with verified neighbors in your city to unlock honest, volume-discounted quotations.
          </p>
        </div>

        {/* 3-Step Grid / Timeline */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {steps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="relative bg-white/90 backdrop-blur-sm rounded-2xl p-6 sm:p-7 border border-emerald-100/80 shadow-xs shadow-emerald-900/5 hover:shadow-md hover:border-emerald-200 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar with Number and Icon */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                      <Icon className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <span className="font-mono font-extrabold text-2xl text-emerald-600/30">
                      0{item.step}
                    </span>
                  </div>

                  {/* Step Title & Content */}
                  <div className="inline-block text-[11px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2.5 py-0.5 rounded-md mb-2">
                    {item.tag}
                  </div>
                  <h3 className="text-lg font-bold text-gray-950 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                    {item.text}
                  </p>
                </div>

                {/* Bottom Trust Microcopy */}
                <div className="pt-4 mt-4 border-t border-gray-100 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span>
                    {idx === 0
                      ? 'No card or payment details needed'
                      : idx === 1
                      ? 'Strictly isolated by your city'
                      : 'Delivered by certified local dealers'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Trust Guarantee Banner */}
        <div className="mt-8 p-4 rounded-2xl bg-white/80 border border-emerald-100 text-xs text-gray-600 text-center max-w-3xl mx-auto shadow-2xs leading-relaxed">
          <strong className="text-gray-900">100% Free &amp; Non-Binding:</strong> Joining a pool records your interest to aggregate local volume. You are never forced to purchase, and all contracts, warranties, and deliveries are handled directly by certified brand dealerships.
        </div>
      </div>
    </section>
  );
}

