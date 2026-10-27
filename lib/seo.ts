import { Metadata } from 'next';
import { isDemoMode } from './data-mode';
import { PublicPool, BlogPost } from '@/types';
import { getPoolFallbackImage } from './pool-image-fallback';

/**
 * Returns the sanitized base site URL without trailing slashes.
 */
export function getSiteUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl && (envUrl.startsWith('http://') || envUrl.startsWith('https://'))) {
    return envUrl.replace(/\/+$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, '')}`;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }
  if (process.env.NODE_ENV === 'production') {
    return 'https://groupbuying.store';
  }
  return 'http://localhost:3000';
}

/**
 * Safely serializes data to a JSON string and escapes '<' to '\u003c'
 * to prevent XSS / script closing injection.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/**
 * Common robots metadata configuration respecting demo mode.
 */
export function getRobotsMetadata(isClosedOrDemo = false): Metadata['robots'] {
  if (isClosedOrDemo || isDemoMode()) {
    return {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        'max-video-preview': -1,
        'max-image-preview': 'none',
        'max-snippet': -1,
      },
    };
  }
  return {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  };
}

/**
 * Builds Schema.org Product JSON-LD object for a deal.
 * OMIT Offer unless price is verified to prevent search engine misinformation.
 */
export function buildProductJsonLd(pool: PublicPool) {
  const siteUrl = getSiteUrl();
  const dealUrl = `${siteUrl}/deals/${pool.citySlug}/${pool.slug}`;
  const fallbackImage = getPoolFallbackImage(pool.category, pool.categorySlug, pool.slug || pool.name);
  const imageUrl = pool.imageUrl?.startsWith('http')
    ? pool.imageUrl
    : `${siteUrl}${pool.imageUrl || fallbackImage}`;

  const productData: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: pool.name,
    description: pool.shortDescription || pool.longDescription || `${pool.name} Group Buying Pool in ${pool.city}`,
    image: imageUrl,
    url: dealUrl,
  };

  if (pool.productBrand) {
    productData.brand = {
      '@type': 'Brand',
      name: pool.productBrand,
    };
  }

  // Strictly adhere to blueprint: include Offer ONLY if price is verified!
  if (pool.priceIsVerified && pool.groupPrice && !isDemoMode()) {
    productData.offers = {
      '@type': 'Offer',
      price: pool.groupPrice,
      priceCurrency: 'INR',
      priceValidUntil: pool.deadline,
      availability: pool.status === 'ACTIVE'
        ? 'https://schema.org/InStock'
        : 'https://schema.org/Discontinued',
      url: dealUrl,
    };
  }

  return productData;
}

/**
 * Builds Schema.org FAQPage JSON-LD object.
 */
export function buildFaqJsonLd(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * Builds Schema.org BreadcrumbList JSON-LD object.
 */
export function buildBreadcrumbsJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Builds Schema.org Article / BlogPosting JSON-LD object.
 */
export function buildArticleJsonLd(post: BlogPost) {
  const siteUrl = getSiteUrl();
  const articleUrl = `${siteUrl}/blog/${post.slug}`;
  const imageUrl = post.coverImageUrl?.startsWith('http')
    ? post.coverImageUrl
    : `${siteUrl}${post.coverImageUrl || '/images/blog-default.svg'}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    image: imageUrl,
    url: articleUrl,
    datePublished: post.publishedAt || post.createdAt,
    dateModified: post.updatedAt,
    author: {
      '@type': 'Person',
      name: post.author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'GroupBuying.store',
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/images/logo.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl,
    },
    articleSection: post.topic,
    keywords: post.tags?.join(', '),
  };
}

/**
 * Builds Schema.org WebSite JSON-LD object for Google site identity.
 */
export function buildWebSiteJsonLd() {
  const siteUrl = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'GroupBuying.store',
    alternateName: 'GroupBuying Store',
    url: siteUrl,
  };
}

/**
 * Builds Schema.org Organization JSON-LD object.
 */
export function buildOrganizationJsonLd() {
  const siteUrl = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'GroupBuying.store',
    alternateName: 'PoolBuy India',
    url: siteUrl,
    logo: `${siteUrl}/images/logo.png`,
    description: 'Collective demand aggregation and local group-buying platform for solar, power backup, and water softeners in India.',
  };
}
