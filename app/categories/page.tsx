import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { connection } from 'next/server';
import { getOperationalCategories } from '@/lib/categories';
import { getSiteUrl, getRobotsMetadata, buildBreadcrumbsJsonLd, safeJsonLd } from '@/lib/seo';
import {
  Sun,
  BatteryCharging,
  Droplets,
  Bike,
  Car,
  Laptop,
  Tv,
  Tractor,
  Layers,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'rooftop-solar': Sun,
  'home-power-backup': BatteryCharging,
  'water-softeners': Droplets,
  'ev-scooters': Bike,
  'cars': Car,
  'laptops': Laptop,
  'smart-tvs': Tv,
  'tractors-commercial': Tractor,
};

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = getSiteUrl();
  const title = 'Categories Directory | GroupBuying.store';
  const description =
    'Browse product categories available for demand aggregation in your city. Rooftop solar, home power backup, water softeners, electric scooters, and more.';
  const canonicalUrl = `${siteUrl}/categories`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'GroupBuying.store',
      locale: 'en_IN',
      type: 'website',
      images: [
        {
          url: `${siteUrl}/images/og-image.png`,
          width: 1200,
          height: 630,
          alt: 'GroupBuying.store Directory',
        },
        {
          url: `${siteUrl}/images/og-image.jpg`,
          width: 1200,
          height: 630,
          alt: 'GroupBuying.store Categories Directory',
        },
        {
          url: `${siteUrl}/images/og-image.svg`,
          width: 1200,
          height: 630,
          alt: 'GroupBuying.store Categories Directory',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${siteUrl}/images/og-image.png`, `${siteUrl}/images/og-image.jpg`, `${siteUrl}/images/og-image.svg`],
    },
    robots: getRobotsMetadata(false),
  };
}

export default async function CategoriesPage() {
  await connection();
  const siteUrl = getSiteUrl();
  const categories = await getOperationalCategories();

  const breadcrumbsJsonLd = buildBreadcrumbsJsonLd([
    { name: 'Home', url: siteUrl },
    { name: 'Categories', url: `${siteUrl}/categories` },
  ]);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbsJsonLd) }}
      />

      {/* Header */}
      <section className="bg-white border-b border-slate-200 py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 text-xs text-gray-500 mb-6 font-medium">
            <Link href="/" className="hover:text-emerald-700">Home</Link>
            <span>/</span>
            <span className="text-gray-900 font-semibold">Categories</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-4">
            <Layers className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            <span>Configured Categories Directory</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
            Explore Buying Categories
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed">
            GroupBuying aggregates collective demand for high-value home and commercial purchases across India. Select a category below to explore city-specific pools or submit a demand proposal.
          </p>

          <div className="mt-6 flex flex-wrap gap-4 text-xs font-medium text-slate-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>100% Free interest registration</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>City-isolated community pools</span>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.slug] || Layers;
            return (
              <Link
                key={cat.id}
                href={`/category/${cat.slug}`}
                className="group bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs hover:shadow-xl hover:shadow-emerald-950/5 hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <h2 className="text-base font-bold text-gray-950 group-hover:text-emerald-700 transition-colors mb-2">
                    {cat.label}
                  </h2>
                  <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed mb-4">
                    {cat.description || 'Community demand aggregation and verified supplier quotations.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-emerald-700 group-hover:text-emerald-800">
                  <span>Browse Pools</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Propose a Category Banner */}
        <div className="mt-12 bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Can&apos;t find what you need?</span>
            <h3 className="text-xl font-bold text-gray-950 mt-1">Propose a new group buy category or pool</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-xl">
              Organizing demand for an apartment complex, residential society, or commercial equipment? Submit a proposal for admin review.
            </p>
          </div>
          <Link
            href="/#request-pool"
            className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0 shadow-sm transition-all"
          >
            Start a Pool
          </Link>
        </div>
      </main>
    </div>
  );
}

