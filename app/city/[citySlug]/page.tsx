import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CATEGORIES } from '@/lib/constants';
import { getPublicPools } from '@/lib/pools';
import { getCityBySlug, getOperationalCities } from '@/lib/cities';
import { getSiteUrl, getRobotsMetadata } from '@/lib/seo';
import { PoolCard } from '@/components/pool-card';
import { FaqAccordion } from '@/components/faq-accordion';

interface CityPageProps {
  params: Promise<{ citySlug: string }>;
}

export async function generateStaticParams() {
  const cities = await getOperationalCities();
  return cities.map((city) => ({
    citySlug: city.slug,
  }));
}

export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const { citySlug } = await params;
  const city = await getCityBySlug(citySlug);

  if (!city) {
    return {
      title: 'Group Buying Deals | GroupBuying.store',
      description: 'Discover collective buying deals across Indian cities.',
    };
  }

  const siteUrl = getSiteUrl();
  const canonicalUrl = `${siteUrl}/city/${city.slug}`;
  const title = `Group Buying Deals in ${city.name} | GroupBuying.store`;
  const description = `Register interest for group-buying deals in ${city.name}, ${city.state}. Connect with fellow local buyers for rooftop solar, power backup, and water softener bulk quotations.`;

  const pools = await getPublicPools({ citySlug: city.slug });
  const isUnservedOrEmpty = !city.isActive || pools.length === 0;

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
          url: `${siteUrl}/images/category-default.svg`,
          width: 800,
          height: 600,
          alt: `GroupBuying.store - ${city.name}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: getRobotsMetadata(isUnservedOrEmpty),
  };
}

export default async function CityPage({ params }: CityPageProps) {
  const { citySlug } = await params;
  const city = await getCityBySlug(citySlug);

  if (!city) {
    notFound();
  }

  const [pools, operationalCities] = await Promise.all([
    getPublicPools({ citySlug: city.slug }),
    getOperationalCities(),
  ]);

  const otherCities = operationalCities.filter((c) => c.slug !== city.slug);

  const cityFaqs = [
    {
      question: `How does group buying work in ${city.name}?`,
      answer: `Buyers in ${city.name} register free interest in a specific product pool. When the target number of interested buyers is reached, our team negotiates institutional bulk pricing directly with certified local dealerships in ${city.name}.`,
    },
    {
      question: `Is there any cost or commitment to join a pool in ${city.name}?`,
      answer: `No. Joining a pool is 100% free with zero upfront payment. You only provide your name, timeline, and WhatsApp number so we can notify you once bulk dealer pricing is unlocked.`,
    },
    {
      question: `Who delivers the vehicle or product in ${city.name}?`,
      answer: `Deliveries, billing, warranties, and RTO registrations are handled directly by authorized local dealers in ${city.name} or nearby authorized brand distribution hubs.`,
    },
    {
      question: `What if the pool doesn't reach the target number of buyers?`,
      answer: `If a pool deadline passes without reaching the full buyer target, we can either extend the timeline or connect interested buyers directly to dealer partners for exclusive individual counter-offers. You are never obligated to purchase.`,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Hero Header */}
      <section className="bg-white border-b border-slate-200 py-10 md:py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="text-xs text-slate-500 mb-4 flex items-center gap-2">
            <Link href="/" className="hover:text-emerald-600 transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-medium">Cities</span>
            <span>/</span>
            <span className="text-slate-900 font-semibold">{city.name}</span>
          </nav>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            Group Buying Pools & Bulk Quotations in {city.name}
          </h1>
          <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed">
            Local group buying directory for {city.name}, {city.state}. Connect with verified
            local buyers to unlock genuine bulk terms on rooftop solar, power backup, electric vehicles, and appliances.
          </p>

          {/* Quick city switcher */}
          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <span className="text-slate-500 font-medium">Operational hubs:</span>
            {otherCities.map((otherCity) => (
              <Link
                key={otherCity.slug}
                href={`/city/${otherCity.slug}`}
                className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 font-medium transition-colors"
              >
                {otherCity.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Pools Section */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            {pools.length > 0
              ? `Open Pools in ${city.name} (${pools.length})`
              : `Operational Status in ${city.name}`}
          </h2>
          <Link
            href="/"
            className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
          >
            ← View All Cities
          </Link>
        </div>

        {pools.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-xs">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 mb-4">
              📍 {city.placeType || 'City'} Directory Entry • Demand Discovery Phase
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              No active group pools in {city.name} right now
            </h3>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              We never fabricate dealer coverage or list unverified supplier offers. We launch operational pools in {city.name} only after local buyer demand reaches threshold and local fulfillment terms are verified.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={`/#request-pool?city=${encodeURIComponent(city.name)}`}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm transition-all"
              >
                Request a Pool in {city.name} →
              </Link>
              <Link
                href="/"
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors"
              >
                Browse Active Hubs
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pools.map((pool) => (
              <PoolCard key={pool.id} pool={pool} />
            ))}
          </div>
        )}

        {/* Categories Cross-Links */}
        <section className="mt-16 bg-white p-6 sm:p-8 rounded-2xl border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            Explore Categories in {city.name}
          </h2>
          <p className="text-sm text-slate-600 mb-6">
            Looking for a specific product vertical? Browse deals by category across India.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="p-3 text-center rounded-xl bg-slate-50 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
              >
                <div className="text-xs font-semibold text-slate-800">{cat.label}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* Local FAQs */}
        <section className="mt-16">
          <FaqAccordion
            items={cityFaqs}
            title={`Frequently Asked Questions about PoolBuy in ${city.name}`}
            idPrefix={`faq-${city.slug}`}
          />
        </section>
      </main>
    </div>
  );
}
