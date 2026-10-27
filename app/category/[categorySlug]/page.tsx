import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { connection } from 'next/server';
import { CATEGORIES, CATEGORY_SLUG_MAP, CITIES } from '@/lib/constants';
import { getPublicPools } from '@/lib/pools';
import { getOperationalCategories, getCategoryBySlug } from '@/lib/categories';
import { getSiteUrl, getRobotsMetadata } from '@/lib/seo';
import { PoolCard } from '@/components/pool-card';
import { EmptyState } from '@/components/empty-state';
import { FaqAccordion } from '@/components/faq-accordion';

interface CategoryPageProps {
  params: Promise<{ categorySlug: string }>;
}

export async function generateStaticParams() {
  const dynamicCategories = await getOperationalCategories();
  const slugs = new Set([...dynamicCategories.map((c) => c.slug), ...Object.keys(CATEGORY_SLUG_MAP)]);
  return Array.from(slugs).map((categorySlug) => ({
    categorySlug,
  }));
}

async function resolveCategoryInfo(slug: string) {
  if (slug === 'electronics') {
    return {
      name: 'Electronics & Computers',
      label: 'Electronics',
      description: 'Collective purchasing power for premium laptops, MacBooks, 4K Smart TVs, and consumer electronics.',
      slug: 'electronics',
    };
  }

  // Check dynamic categories from database or demo store
  const dynamicCat = await getCategoryBySlug(slug);
  if (dynamicCat && dynamicCat.isActive) {
    return {
      name: dynamicCat.label,
      label: dynamicCat.label,
      description: dynamicCat.description || `Collective purchasing power for ${dynamicCat.label} across Indian cities.`,
      slug: dynamicCat.slug,
    };
  }

  const found = CATEGORIES.find((c) => c.slug === slug);
  if (!found) return null;

  return {
    name: found.label,
    label: found.label,
    description: found.description,
    slug: found.slug,
  };
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  await connection();
  const { categorySlug } = await params;
  const info = await resolveCategoryInfo(categorySlug);
  if (!info) {
    return {
      title: 'Category Not Found | GroupBuying.store',
    };
  }

  const siteUrl = getSiteUrl();
  const canonicalUrl = `${siteUrl}/category/${info.slug}`;
  const title = `${info.name} Group Buying Deals in India | GroupBuying.store`;
  const description = `Register interest for ${info.name.toLowerCase()} group buying across Indian cities. Zero-cost registration to unlock institutional dealer bulk discounts.`;

  const pools = await getPublicPools({ categorySlug: info.slug });
  const isUnservedOrEmpty = pools.length === 0;

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
          alt: `GroupBuying.store - ${info.name}`,
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

export default async function CategoryPage({ params }: CategoryPageProps) {
  await connection();
  const { categorySlug } = await params;
  const info = await resolveCategoryInfo(categorySlug);

  if (!info) {
    notFound();
  }

  const pools = await getPublicPools({ categorySlug: info.slug });

  const categoryFaqs = [
    {
      question: `How do group buying pools for ${info.name} work?`,
      answer: `We group individual consumer orders together to present aggregate demand to authorized brand distributors and high-volume dealerships, unlocking institutional rates usually reserved for commercial buyers.`,
    },
    {
      question: `Are warranties and after-sales service valid?`,
      answer: `Yes, 100%. All vehicles, solar panels, and electronics purchased through PoolBuy unlocked deals carry full official manufacturer warranty, standard invoicing, and authorized dealer service network support.`,
    },
    {
      question: `Can I arrange loan / financing or trade-in?`,
      answer: `Yes. Once dealer terms are unlocked, participating authorized dealerships provide standard financing options through partnered banks (SBI, HDFC, ICICI, etc.) and exchange evaluation for old products.`,
    },
    {
      question: `Is my registration money at risk?`,
      answer: `There is zero registration fee to join a pool. You never pay any money on PoolBuy to express interest. When a deal reaches target, only a small refundable token (typically ₹499 to ₹999) on the dealer's secure gateway is requested to reserve your unit.`,
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
            <span className="text-slate-800 font-medium">Categories</span>
            <span>/</span>
            <span className="text-slate-900 font-semibold">{info.name}</span>
          </nav>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            {info.name} Group Buying Deals in India
          </h1>
          <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed">
            {info.description} Connect with buyers across Indian cities to reach wholesale tier pricing directly with authorized distributors.
          </p>

          {/* Quick category switcher */}
          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <span className="text-slate-500 font-medium">Other categories:</span>
            {CATEGORIES.filter((c) => c.slug !== info.slug).map((otherCat) => (
              <Link
                key={otherCat.slug}
                href={`/category/${otherCat.slug}`}
                className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 font-medium transition-colors"
              >
                {otherCat.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Pools Section */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            Active Deals in {info.name} ({pools.length})
          </h2>
          <Link
            href="/"
            className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
          >
            ← View All Categories
          </Link>
        </div>

        {pools.length === 0 ? (
          <EmptyState
            title={`No active deals currently open in ${info.name}`}
            description="Our team reviews community requests to negotiate with certified local distributors. Be the first to request a product in this category to launch a pool!"
            actionText="Request a New Pool"
            actionHref="/#request-pool"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pools.map((pool) => (
              <PoolCard key={pool.id} pool={pool} />
            ))}
          </div>
        )}

        {/* Cities Cross-Links */}
        <section className="mt-16 bg-white p-6 sm:p-8 rounded-2xl border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            Browse {info.name} Deals by City
          </h2>
          <p className="text-sm text-slate-600 mb-6">
            Group buy deals are fulfilled locally by certified brand dealers in each city. Select your city to check active quotas:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {CITIES.map((city) => (
              <Link
                key={city.slug}
                href={`/city/${city.slug}`}
                className="p-3 text-center rounded-xl bg-slate-50 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
              >
                <div className="text-sm font-semibold text-slate-800">{city.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{city.state}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* Category FAQs */}
        <section className="mt-16">
          <FaqAccordion
            items={categoryFaqs}
            title={`Frequently Asked Questions: ${info.name} Group Buying`}
            idPrefix={`faq-${info.slug}`}
          />
        </section>
      </main>
    </div>
  );
}
