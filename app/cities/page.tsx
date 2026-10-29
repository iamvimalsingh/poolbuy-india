import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { connection } from 'next/server';
import { getOperationalCities } from '@/lib/cities';
import { getPublicPools } from '@/lib/pools';
import { getSiteUrl, getRobotsMetadata, buildBreadcrumbsJsonLd, safeJsonLd } from '@/lib/seo';
import { MapPin, ArrowRight, ShieldCheck, Sparkles, Building2 } from 'lucide-react';

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = getSiteUrl();
  const title = 'Operational Cities Directory | GroupBuying.store';
  const description =
    'Find active community group buying pools across 28 Indian cities. Aggregate local demand for rooftop solar, power backup, and consumer goods.';
  const canonicalUrl = `${siteUrl}/cities`;

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
          url: `${siteUrl}/images/og-image.svg`,
          width: 1200,
          height: 630,
          alt: 'GroupBuying.store Operational Cities Directory',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${siteUrl}/images/og-image.svg`],
    },
    robots: getRobotsMetadata(false),
  };
}

export default async function CitiesDirectoryPage() {
  await connection();
  const siteUrl = getSiteUrl();
  const [cities, allPools] = await Promise.all([
    getOperationalCities(),
    getPublicPools(),
  ]);

  // Count active pools per city
  const poolCountByCity = new Map<string, number>();
  for (const pool of allPools) {
    if (pool.citySlug) {
      poolCountByCity.set(pool.citySlug, (poolCountByCity.get(pool.citySlug) || 0) + 1);
    }
  }

  // Group cities by State
  const citiesByState: Record<string, typeof cities> = {};
  for (const city of cities) {
    const st = city.state || 'Other';
    if (!citiesByState[st]) citiesByState[st] = [];
    citiesByState[st].push(city);
  }

  const sortedStates = Object.keys(citiesByState).sort();

  const breadcrumbsJsonLd = buildBreadcrumbsJsonLd([
    { name: 'Home', url: siteUrl },
    { name: 'Cities', url: `${siteUrl}/cities` },
  ]);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbsJsonLd) }}
      />

      {/* Hero Header */}
      <section className="bg-white border-b border-slate-200 py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 text-xs text-gray-500 mb-6 font-medium">
            <Link href="/" className="hover:text-emerald-700">Home</Link>
            <span>/</span>
            <span className="text-gray-900 font-semibold">Cities</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-4">
            <Building2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            <span>28 Operational Indian Cities</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
            City-Wise Group Buying Directory
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed">
            Every city pool operates strictly within its local geographic cohort. Select your city to explore active pools, connect with local buyers, and unlock institutional pricing from certified area dealerships.
          </p>

          <div className="mt-6 flex flex-wrap gap-4 text-xs font-medium text-slate-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Independent city cohorts</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Zero customer fees or advance token gating</span>
            </div>
          </div>
        </div>
      </section>

      {/* Cities by State */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 space-y-10">
        {sortedStates.map((state) => {
          const stateCities = citiesByState[state];
          return (
            <div key={state} className="bg-white rounded-3xl border border-gray-200/80 p-6 sm:p-8 shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-950 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                  <span>{state}</span>
                </h2>
                <span className="text-xs text-gray-500 font-medium">
                  {stateCities.length} {stateCities.length === 1 ? 'City' : 'Cities'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {stateCities.map((city) => {
                  const poolCount = poolCountByCity.get(city.slug) || 0;
                  return (
                    <Link
                      key={city.id}
                      href={`/city/${city.slug}`}
                      className="group p-4 rounded-2xl border border-gray-100 hover:border-emerald-300 bg-slate-50/50 hover:bg-emerald-50/40 transition-all flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-sm text-gray-950 group-hover:text-emerald-800 transition-colors">
                          {city.name}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {poolCount > 0 ? (
                            <span className="text-emerald-700 font-semibold">{poolCount} active {poolCount === 1 ? 'pool' : 'pools'}</span>
                          ) : (
                            <span>Demand aggregating</span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-700 group-hover:translate-x-1 transition-all" />
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Not in your city? */}
        <div className="bg-gradient-to-r from-emerald-900 to-teal-900 rounded-3xl p-8 sm:p-10 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Unserved Locations</span>
            <h3 className="text-xl sm:text-2xl font-bold text-white mt-1">Want to start a group buy in your town?</h3>
            <p className="text-xs sm:text-sm text-emerald-100/80 mt-1 max-w-xl">
              We accept demand proposals from all towns across India. Proposals enter admin review before community launch.
            </p>
          </div>
          <Link
            href="/#request-pool"
            className="px-6 py-3 rounded-xl bg-white text-emerald-950 hover:bg-emerald-50 font-bold text-xs shrink-0 shadow-md transition-all"
          >
            Start a Pool
          </Link>
        </div>
      </main>
    </div>
  );
}

