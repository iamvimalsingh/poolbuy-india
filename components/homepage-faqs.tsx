'use client';

import React from 'react';
import { HelpCircle } from 'lucide-react';
import { FaqAccordion, FaqItem } from './faq-accordion';

export const HOMEPAGE_FAQS: FaqItem[] = [
  {
    question: 'How does group buying work on GroupBuying.store?',
    answer:
      'Buyers in the same city register interest for a common product or service (e.g. Home Rooftop Solar). We aggregate local demand until the group reaches its target size, then seek volume-discounted quotations from authorized local suppliers. Members review quotations and decide independently whether to purchase.',
  },
  {
    question: 'Does registration cost anything?',
    answer:
      'No. Joining a buying group is 100% free. There are zero membership fees, zero token deposits, and zero platform charges in our MVP. You never pay GroupBuying.store to join or browse.',
  },
  {
    question: 'Does registration commit me to purchase?',
    answer:
      'No. Joining a pool is a non-binding expression of purchase interest. Once supplier bids are verified, you receive full commercial terms and decide independently whether to proceed directly with the supplier.',
  },
  {
    question: 'How are prices and discounts determined?',
    answer:
      'Prior to supplier bids, prices and discounts shown are indicative target estimates based on reasonable market benchmarks, clearly labeled as non-guaranteed. Once a pool fills, we negotiate with certified local suppliers. Bids that pass verification are published with the "Verified Supplier Quote" badge and clear validity dates.',
  },
  {
    question: 'What happens if my city has no active pool?',
    answer:
      'If your city or category has no live pool, you can propose one using the "Start a Pool" form. Submissions enter admin review, and new city pools are published once local demand justifies supplier outreach.',
  },
  {
    question: 'How are my contact details and consent protected?',
    answer:
      'We collect only essential details (name, WhatsApp number, locality, and 6-digit pincode) strictly to coordinate demand and communicate quote updates. We never display personal contact details publicly and adhere to DPDP data protection principles.',
  },
  {
    question: 'How are updates delivered through genuinely supported channels?',
    answer:
      'Updates regarding pool milestones, waitlist status, and supplier offers are sent via manual, transparent WhatsApp messages and verified links to groupbuying.store. We do not use aggressive bot spam or unexpected sales calls.',
  },
];

export function HomepageFaqs() {
  return (
    <section id="faqs" className="scroll-mt-24 py-12 sm:py-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-3 py-1 rounded-full text-xs font-semibold mb-3">
          <HelpCircle className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
          <span>Frequently Asked Questions</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-950 tracking-tight">
          Everything You Need to Know
        </h2>
        <p className="text-sm text-gray-600 mt-2">
          Clear answers about group buying, prices, privacy, and how we operate.
        </p>
      </div>

      <FaqAccordion items={HOMEPAGE_FAQS} title="" idPrefix="homepage-faq" />
    </section>
  );
}

