import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { connection } from 'next/server';
import { getCityBySlug } from '@/lib/cities';
import { getCategoryBySlug } from '@/lib/categories';
import { getPublicPools } from '@/lib/pools';
import { getSiteUrl, getRobotsMetadata, buildBreadcrumbsJsonLd, safeJsonLd } from '@/lib/seo';
import { PoolCard } from '@/components/pool-card';
import { EmptyState } from '@/components/empty-state';
import { MapPin, Layers, ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react';

interface CityCategoryPageProps {
  params: Promise<{ citySlug: string; categorySlug: string }>;
}

export async function generateMetadata({ params }: CityCategoryPageProps): Promise<Metadata> {
  await connection();
  const { citySlug, categorySlug } = await params;
  const [city, category] = await Promise.all([
    getCityBySlug(citySlug),
    getCategoryBySlug(categorySlug),
  ]);

  if (!city || !category) {
    return {
      title: 'Deals Not Found | GroupBuying.store',
    };
  }

  const siteUrl = getSiteUrl();
  const canonicalUrl = `${siteUrl}/city/${city.slug}/${category.slug}`;
  const title = `${category.label} in ${city.name}, ${city.state} | GroupBuying.store`;
  const description = `Join local buyers in ${city.name} for ${category.label}. 100% free interest registration to aggregate demand and unlock verified dealer pricing.`;

  const pools = await getPublicPools({ citySlug: city.slug, categorySlug: category.slug });
  const isThinOrEmpty = pools.length === 0;

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
    },
    // Noindex thin or empty city/category combinations to prevent search index pollution
    robots: getRobotsMetadata(isThinOrEmpty),
  };
}

export default async function CityCategoryPage({ params }: CityCategoryPageProps) {
  await connection();
  const { citySlug, categorySlug } = await params;
  const [city, category] = await Promise.all([
    getCityBySlug(citySlug),
    getCategoryBySlug(categorySlug),
  ]);

  if (!city || !category) {
    notFound();
  }

  const pools = await getPublicPools({
    citySlug: city.slug,
    categorySlug: category.slug,
  });

  const siteUrl = getSiteUrl();
  const breadcrumbsJsonLd = buildBreadcrumbsJsonLd([
    { name: 'Home', url: siteUrl },
    { name: 'Cities', url: `${siteUrl}/cities` },
    { name: city.name, url: `${siteUrl}/city/${city.slug}` },
    { name: category.label, url: `${siteUrl}/city/${city.slug}/${category.slug}` },
  ]);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbsJsonLd) }}
      />

      {/* Header */}
      <section className="bg-white border-b border-slate-200 py-10 md:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumbs Navigation */}
          <nav className="flex items-center gap-2 text-xs text-gray-500 mb-6 font-medium flex-wrap">
            <Link href="/" className="hover:text-emerald-700">Home</Link>
            <span>/</span>
            <Link href="/cities" className="hover:text-emerald-700">Cities</Link>
            <span>/</span>
            <Link href={`/city/${city.slug}`} className="hover:text-emerald-700">{city.name}</Link>
            <span>/</span>
            <span className="text-gray-900 font-semibold">{category.label}</span>
          </nav>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>{city.name}, {city.state}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>{category.label}</span>
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            {category.label} Buying Groups in {city.name}
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-3xl leading-relaxed">
            Aggregate local demand with fellow buyers in {city.name} to negotiate collective supplier pricing. Registering interest is 100% free with no purchase commitment.
          </p>

          <div className="mt-6 flex flex-wrap gap-4 text-xs font-medium text-slate-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Free to express interest</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Verified local dealership fulfillment</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content: Pools or Honest Empty State */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        {pools.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-950">
                Active Pools in {city.name} ({pools.length})
              </h2>
              <Link
                href={`/city/${city.slug}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>All {city.name} Categories</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pools.map((pool) => (
                <PoolCard key={pool.id} pool={pool} priorityImage={false} />
              ))}
            </div>
          </div>
        ) : (
          <div className="py-6">
            <EmptyState
              title={`No active ${category.label} buying group in ${city.name} yet`}
              description={`There isn't an active group for ${category.label.toLowerCase()} in ${city.name} right now. You can submit a demand proposal for our team to review.`}
              actionText={`Start a Pool for ${city.name}`}
              actionHref="/#request-pool"
            />
          </div>
        )}

        {/* Back Link */}
        <div className="mt-12 pt-6 border-t border-gray-200/80 flex items-center justify-between">
          <Link
            href={`/city/${city.slug}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-emerald-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {city.name} Directory</span>
          </Link>
          <Link
            href="/categories"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
          >
            <span>All Categories</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
