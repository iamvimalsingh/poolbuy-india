import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPublicPoolBySlug, getPublicPools } from '@/lib/pools';
import { getSiteUrl, getRobotsMetadata, buildProductJsonLd, buildFaqJsonLd } from '@/lib/seo';
import { STATUS_LABELS, CATEGORIES } from '@/lib/constants';
import { DealActionPanel } from '@/components/deal-action-panel';
import { FaqAccordion } from '@/components/faq-accordion';
import { JsonLd } from '@/components/json-ld';
import { PoolCard } from '@/components/pool-card';
import { PoolImage } from '@/components/pool-image';
import { getPoolFallbackImage } from '@/lib/pool-image-fallback';

interface DealPageProps {
  params: Promise<{ citySlug: string; poolSlug: string }>;
}

export async function generateMetadata({ params }: DealPageProps): Promise<Metadata> {
  const { citySlug, poolSlug } = await params;
  const pool = await getPublicPoolBySlug(citySlug, poolSlug);

  if (!pool || pool.citySlug !== citySlug) {
    notFound();
  }

  const siteUrl = getSiteUrl();
  const canonicalUrl = `${siteUrl}/deals/${pool.citySlug}/${pool.slug}`;
  const title = `${pool.name} Group Deal in ${pool.city} | PoolBuy India`;
  const description = `Join the group buying pool for ${pool.name} in ${pool.city}. Team up with local buyers to reach target volume for wholesale dealership bulk pricing.`;
  const isClosedOrFallback = pool.status === 'CLOSED' || pool.status === 'LEAD_FALLBACK';

  const fallbackImage = getPoolFallbackImage(pool.category, pool.categorySlug, pool.slug || pool.name);
  const imageUrl = pool.imageUrl?.startsWith('http')
    ? pool.imageUrl
    : `${siteUrl}${pool.imageUrl || fallbackImage}`;

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
      siteName: 'PoolBuy India',
      locale: 'en_IN',
      type: 'website',
      images: [
        {
          url: imageUrl,
          width: 800,
          height: 600,
          alt: pool.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
    robots: getRobotsMetadata(isClosedOrFallback),
  };
}

export default async function DealPage({ params }: DealPageProps) {
  const { citySlug, poolSlug } = await params;
  const pool = await getPublicPoolBySlug(citySlug, poolSlug);

  if (!pool || pool.citySlug !== citySlug) {
    notFound();
  }

  const isClosedOrFallback = pool.status === 'CLOSED' || pool.status === 'LEAD_FALLBACK';
  const categoryMeta = CATEGORIES.find((c) => c.category === pool.category);
  const statusMeta = STATUS_LABELS[pool.status];

  // Specific FAQs matching blueprint specifications
  const dealFaqs = [
    {
      question: `How can I get a better ${pool.name} price in ${pool.city}?`,
      answer: `Individual car and scooter buyers typically negotiate one vehicle at a time. PoolBuy aggregates ${pool.targetBuyers} verified buyers in ${pool.city} who intend to purchase in the same timeframe, enabling our team to present institutional fleet volume to authorized local dealerships for bulk price concessions.`,
    },
    {
      question: `Is joining PoolBuy free?`,
      answer: `Yes. Joining a pool is 100% free with zero upfront payment, registration fee, or banking credentials required. You register your intent with your verified WhatsApp number.`,
    },
    {
      question: `Is the group price guaranteed?`,
      answer: pool.priceIsVerified
        ? `This pool's pricing is backed by a verified dealer quotation. The discount terms are locked once the full buyer target is met.`
        : `The target price is an indicative estimate based on recent high-volume fleet quotations in ${pool.city}. Final dealer pricing is subject to confirmation when the buyer target is reached. We never claim unverified prices as guaranteed.`,
    },
    {
      question: `When is a token required?`,
      answer: `A refundable booking token (typically ₹499–₹999) is only requested AFTER the pool reaches the target number of buyers, dealer terms are verified, and the pool is marked UNLOCKED by our operations team. You will receive an official payment link directly to the dealer's secure checkout.`,
    },
    {
      question: `Who sells and delivers the ${pool.productModel || pool.name}?`,
      answer: `All transactions, formal GST invoicing, financing/loans, RTO vehicle registration, and official manufacturer warranty handover are conducted directly by certified, authorized brand dealerships located in ${pool.city}. PoolBuy is not a reseller or broker.`,
    },
  ];

  // Similar active pools in the same city or category
  const allCityPools = await getPublicPools({ citySlug: pool.citySlug });
  const similarPools = allCityPools
    .filter((p) => p.id !== pool.id && p.status === 'ACTIVE')
    .slice(0, 3);

  const productJsonLd = buildProductJsonLd(pool);
  const faqJsonLd = buildFaqJsonLd(dealFaqs);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Safe Structured Data */}
      <JsonLd data={productJsonLd} />
      {!isClosedOrFallback && <JsonLd data={faqJsonLd} />}

      {/* Breadcrumb Navigation */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="text-xs text-slate-500 flex items-center flex-wrap gap-2">
            <Link href="/" className="hover:text-emerald-600 transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link href={`/city/${pool.citySlug}`} className="hover:text-emerald-600 transition-colors">
              {pool.city}
            </Link>
            <span>/</span>
            {categoryMeta && (
              <>
                <Link href={`/category/${categoryMeta.slug}`} className="hover:text-emerald-600 transition-colors">
                  {categoryMeta.label}
                </Link>
                <span>/</span>
              </>
            )}
            <span className="text-slate-800 font-semibold truncate max-w-xs">{pool.name}</span>
          </nav>
        </div>
      </div>

      {/* Deal Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Product Details & FAQs */}
          <div className="lg:col-span-7 space-y-8">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusMeta.badgeClass}`}>
                  {statusMeta.label}
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                  📍 {pool.city}
                </span>
                {pool.productBrand && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800">
                    Brand: {pool.productBrand}
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
                {pool.name}
              </h1>

              {pool.shortDescription && (
                <p className="mt-3 text-base sm:text-lg text-slate-600 leading-relaxed">
                  {pool.shortDescription}
                </p>
              )}

              {/* Image with Category Fallback */}
              <div className="mt-6 aspect-video sm:aspect-16/9 bg-slate-100 rounded-xl overflow-hidden relative border border-slate-200">
                <PoolImage
                  src={pool.imageUrl}
                  alt={pool.name}
                  category={pool.category}
                  categorySlug={pool.categorySlug}
                  slugOrName={pool.slug || pool.name}
                  priority
                  className="object-cover"
                />
              </div>

              {/* Available Brand-Kit Packages */}
              {pool.kitOffers && pool.kitOffers.length > 0 && (
                <div className="mt-8 pt-8 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-900">
                      Standardized Predefined Brand-Kit Packages
                    </h2>
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      Fixed Inclusions • Zero Ambiguity
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mb-6">
                    Each kit package is standardized in advance with certified local vendors in {pool.city}. Customers select their exact package configuration when registering.
                  </p>

                  <div className="space-y-6">
                    {pool.kitOffers.map((kit) => (
                      <div
                        key={kit.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 sm:p-6 transition-all hover:border-emerald-300 hover:shadow-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-200">
                          <div>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                              SKU: {kit.sku} • {kit.brand}
                            </span>
                            <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                              {kit.name}
                            </h3>
                            <p className="text-xs text-slate-600 mt-1 font-medium">
                              Model: {kit.model} • Warranty: <span className="text-emerald-700 font-semibold">{kit.warranty}</span>
                            </p>
                          </div>
                          <div className="text-left sm:text-right shrink-0">
                            <div className="text-xs text-slate-500">Group Target Rate</div>
                            <div className="text-2xl font-extrabold text-slate-900">
                              ₹{kit.groupPrice.toLocaleString('en-IN')}
                            </div>
                            {kit.marketPrice > kit.groupPrice && (
                              <div className="text-xs text-slate-400 line-through">
                                ₹{kit.marketPrice.toLocaleString('en-IN')}
                              </div>
                            )}
                            {kit.subsidyEstimate ? (
                              <div className="mt-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full inline-block">
                                Central DBT Subsidy Est.: ₹{kit.subsidyEstimate.toLocaleString('en-IN')}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {kit.subsidyDisclaimer && (
                          <div className="mt-3 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 text-[11px] text-amber-900 leading-snug">
                            <strong>Subsidy Notice:</strong> {kit.subsidyDisclaimer} Total pre-subsidy package price is paid to the installer. Direct Benefit Transfer (DBT) is credited by the government to the registered consumer bank account post-inspection.
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-2">
                          {kit.inclusions && kit.inclusions.length > 0 && (
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <span className="text-emerald-600">✓</span> Included in Package:
                              </h4>
                              <ul className="space-y-1.5 text-xs text-slate-700">
                                {kit.inclusions.map((item, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <span className="text-emerald-600 shrink-0 font-bold">•</span>
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {kit.exclusions && kit.exclusions.length > 0 && (
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <span className="text-rose-500">✗</span> Excluded / Optional Add-ons:
                              </h4>
                              <ul className="space-y-1.5 text-xs text-slate-500">
                                {kit.exclusions.map((item, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <span className="text-slate-400 shrink-0 font-bold">•</span>
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detailed Specs and Overview */}
              <div className="mt-8 pt-8 border-t border-slate-100">
                <h2 className="text-xl font-bold text-slate-900 mb-4">
                  Deal Specification & Procurement Overview
                </h2>
                <div className="prose prose-slate max-w-none text-slate-700 text-sm sm:text-base leading-relaxed space-y-3">
                  <p>
                    {pool.longDescription ||
                      `This pool unites buyers in ${pool.city} seeking bulk terms for the ${pool.name}. By grouping consumer demand together before approaching certified local dealers, we negotiate institutional pricing concessions directly on vehicle ex-showroom, on-road accessories, or installation subsidies.`}
                  </p>
                  <p>
                    Interested buyers in {pool.city} register their buying timeline. There is zero financial liability during pool aggregation.
                  </p>
                </div>
              </div>

              {/* How It Works Steps */}
              <div className="mt-8 pt-8 border-t border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 mb-4">
                  How This Group Buy Works in 4 Steps
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm mb-2">
                      1
                    </div>
                    <div className="font-semibold text-slate-900 text-sm">Express Free Interest</div>
                    <div className="text-xs text-slate-600 mt-1">
                      Join this pool with zero upfront payment. We verify your 10-digit WhatsApp number.
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm mb-2">
                      2
                    </div>
                    <div className="font-semibold text-slate-900 text-sm">Reach Buyer Target</div>
                    <div className="text-xs text-slate-600 mt-1">
                      When {pool.targetBuyers} buyers in {pool.city} join, the deal triggers verified dealership negotiation.
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm mb-2">
                      3
                    </div>
                    <div className="font-semibold text-slate-900 text-sm">Unlock Dealer Pricing</div>
                    <div className="text-xs text-slate-600 mt-1">
                      Admin verifies dealer terms and issues an official WhatsApp unlock with refundable token instructions.
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm mb-2">
                      4
                    </div>
                    <div className="font-semibold text-slate-900 text-sm">Official Dealer Delivery</div>
                    <div className="text-xs text-slate-600 mt-1">
                      Complete delivery, registration, and invoice directly at the authorized showroom in {pool.city}.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Deal FAQs */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">
              <FaqAccordion
                items={dealFaqs}
                title={`Frequently Asked Questions about ${pool.name}`}
                idPrefix="deal-faq"
              />
            </div>
          </div>

          {/* Right Column: Pricing & Action Panel */}
          <div className="lg:col-span-5">
            <DealActionPanel pool={pool} />
          </div>
        </div>

        {/* Similar Pools in City */}
        {similarPools.length > 0 && (
          <section className="mt-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                Other Active Pools in {pool.city}
              </h2>
              <Link
                href={`/city/${pool.citySlug}`}
                className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
              >
                View all {pool.city} deals →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {similarPools.map((similar) => (
                <PoolCard key={similar.id} pool={similar} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
