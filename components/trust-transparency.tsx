import React from 'react';
import { ShieldCheck, AlertCircle, FileText, CheckCircle2, ExternalLink } from 'lucide-react';

export function TrustTransparency() {
  return (
    <section
      id="trust"
      className="scroll-mt-24 py-12 sm:py-16 bg-white border-b border-gray-100"
      aria-labelledby="trust-transparency-title"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-3 py-1 rounded-full text-xs font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            <span>Built on Transparency</span>
          </div>
          <h2
            id="trust-transparency-title"
            className="text-2xl sm:text-3xl font-extrabold text-gray-950 tracking-tight"
          >
            Trust, Disclaimers &amp; Transparency
          </h2>
          <p className="text-sm text-gray-600 mt-2">
            Clear facts about how group demand, pricing estimates, and government solar schemes work.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {/* Card 1: 100% Free & Non-Binding */}
          <div className="bg-slate-50/80 rounded-2xl p-6 border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-base font-bold text-gray-950 mb-2">
                Free &amp; Non-Binding Registration
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Joining a group buying pool expresses purchase intent without financial liability. There are zero signup fees, zero membership dues, and zero payment tokens. You are never obligated to purchase.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200/60 text-[11px] text-emerald-700 font-semibold">
              Zero customer payments in MVP
            </div>
          </div>

          {/* Card 2: Indicative Discounts vs Verified Quotations */}
          <div className="bg-slate-50/80 rounded-2xl p-6 border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
                <FileText className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-base font-bold text-gray-950 mb-2">
                Indicative Estimates vs. Verified Quotes
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Prices shown during the demand aggregation phase are indicative targets based on reasonable market benchmarks, not guaranteed offers. Only bids formally reviewed and verified with local suppliers carry the &ldquo;Verified Supplier Quote&rdquo; badge.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200/60 text-[11px] text-amber-800 font-semibold">
              Honest labeling at every stage
            </div>
          </div>

          {/* Card 3: PM Surya Ghar Central Scheme Clarification */}
          <div className="bg-slate-50/80 rounded-2xl p-6 border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-4">
                <AlertCircle className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-base font-bold text-gray-950 mb-2">
                Official Scheme Information
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                GroupBuying.store is an independent demand aggregation platform, not the official government subsidy portal. Central financial assistance (CFA) under PM Surya Ghar: Muft Bijli Yojana is subject to MNRE and DISCOM eligibility criteria.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200/60">
              <a
                href="https://pmsuryaghar.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900"
              >
                <span>Visit National Portal (pmsuryaghar.gov.in)</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* DPDP Compliance Notice */}
        <div className="mt-8 p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-xs text-emerald-900 max-w-4xl mx-auto flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Contact &amp; Privacy Protection:</strong> We collect only necessary contact information (name, WhatsApp number, pincode) strictly to coordinate demand and notify you about supplier quotations. In compliance with DPDP principles, your personal contact information is never sold or published publicly.
          </p>
        </div>
      </div>
    </section>
  );
}
