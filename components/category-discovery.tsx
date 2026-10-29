'use client';

import React from 'react';
import { Sun, BatteryCharging, Droplets, Laptop, Tv, Sparkles, ArrowRight, Layers } from 'lucide-react';
import { Category } from '@/types';

interface CategoryDiscoveryProps {
  categories: Category[];
  selectedCategory?: string;
  onSelectCategory?: (slug: string) => void;
  selectedCityName?: string | null;
}

// Icon mapper for categories
function getCategoryIcon(slug: string) {
  if (slug.includes('solar')) return Sun;
  if (slug.includes('power') || slug.includes('backup') || slug.includes('inverter')) return BatteryCharging;
  if (slug.includes('water') || slug.includes('softener')) return Droplets;
  if (slug.includes('laptop') || slug.includes('computer')) return Laptop;
  if (slug.includes('tv') || slug.includes('display')) return Tv;
  return Layers;
}

export function CategoryDiscovery({
  categories,
  selectedCategory = 'all',
  onSelectCategory,
  selectedCityName,
}: CategoryDiscoveryProps) {
  // Only display genuinely active categories
  const activeCategories = categories.filter((c) => c.isActive);

  // Identify solar category to feature as launch category
  const solarCategory = activeCategories.find((c) => c.slug.includes('solar'));
  const otherCategories = activeCategories.filter((c) => !c.slug.includes('solar'));

  return (
    <section id="categories" className="scroll-mt-24 py-10 sm:py-14 w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider bg-emerald-50 border border-emerald-200/60 px-3 py-1 rounded-full mb-3">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              <span>Multi-Category Aggregation</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-950 tracking-tight">
              {selectedCityName ? (
                <>
                  Product Categories in <span className="text-emerald-700">{selectedCityName}</span>
                </>
              ) : (
                'Explore Product Categories'
              )}
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1.5 max-w-2xl">
              Solar is our initial launch category. Additional categories activate city-by-city as community demand gathers.
            </p>
          </div>

          <a
            href="#request-pool"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 px-3.5 py-2 rounded-xl transition-all self-start md:self-auto shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Propose a New Category / Product</span>
          </a>
        </div>

        {/* Featured Solar Launch Card */}
        {solarCategory && (
          <div className="mb-6 bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-400/30">
                  <Sun className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Initial Launch Category • PM Surya Ghar Alignment</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Home Rooftop Solar Installation
                </h3>
                <p className="text-xs sm:text-sm text-emerald-100/80 leading-relaxed">
                  Collective residential demand for rooftop solar installations under PM Surya Ghar. Localized community demand helps secure transparent quotations and assistance from authorized solar installers in your city.
                </p>
                <div className="flex flex-wrap gap-2 text-[11px] text-emerald-200 pt-1">
                  <span className="bg-white/10 px-2.5 py-1 rounded-lg">100% Free Interest</span>
                  <span className="bg-white/10 px-2.5 py-1 rounded-lg">Central Subsidy Eligible</span>
                  <span className="bg-white/10 px-2.5 py-1 rounded-lg">City-Wise Independent Cohorts</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
                {onSelectCategory ? (
                  <button
                    type="button"
                    onClick={() => onSelectCategory(solarCategory.slug)}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
                  >
                    <span>View Solar Pools</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <a
                    href="#pools"
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
                  >
                    <span>View Solar Pools</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Other Active / Configured Categories Grid */}
        {otherCategories.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {otherCategories.map((cat) => {
              const Icon = getCategoryIcon(cat.slug);
              const isSelected = selectedCategory === cat.slug;

              return (
                <div
                  key={cat.id || cat.slug}
                  className={`rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-emerald-50/70 border-emerald-400 ring-1 ring-emerald-400'
                      : 'bg-white hover:bg-slate-50/80 border-gray-200/80 hover:border-gray-300'
                  }`}
                >
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 mb-3.5">
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <h4 className="font-bold text-sm text-gray-950 mb-1.5">{cat.label}</h4>
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-4">
                      {cat.description || 'Collective buying demand aggregation for local community discounts.'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                    {onSelectCategory ? (
                      <button
                        type="button"
                        onClick={() => onSelectCategory(cat.slug)}
                        className="text-emerald-700 font-semibold hover:text-emerald-900 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Filter Category</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <a
                        href="#pools"
                        className="text-emerald-700 font-semibold hover:text-emerald-900 inline-flex items-center gap-1"
                      >
                        <span>Explore</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <a
                      href="#request-pool"
                      className="text-[11px] text-gray-400 hover:text-gray-600"
                    >
                      Propose Group
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
