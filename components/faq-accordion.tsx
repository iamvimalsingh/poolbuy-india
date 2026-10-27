'use client';

import { useState } from 'react';

export interface FaqItem {
  question: string;
  answer: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
  title?: string;
  idPrefix?: string;
}

export function FaqAccordion({
  items,
  title = 'Frequently Asked Questions',
  idPrefix = 'faq',
}: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="w-full">
      {title && (
        <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-6">
          {title}
        </h2>
      )}
      <div className="space-y-3">
        {items.map((item, index) => {
          const isOpen = openIndex === index;
          const buttonId = `${idPrefix}-btn-${index}`;
          const panelId = `${idPrefix}-panel-${index}`;

          return (
            <div
              key={index}
              className="border border-slate-200 rounded-xl bg-white overflow-hidden transition-colors"
            >
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(index)}
                className="w-full flex items-center justify-between p-4 md:p-5 text-left font-medium text-slate-900 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset"
              >
                <span className="text-base md:text-lg">{item.question}</span>
                <span className="ml-4 shrink-0 text-slate-500 text-xl font-bold">
                  {isOpen ? '−' : '+'}
                </span>
              </button>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                hidden={!isOpen}
                className="px-4 pb-5 pt-1 md:px-5 text-sm md:text-base text-slate-600 leading-relaxed border-t border-slate-100"
              >
                {item.answer}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
