import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getBlogPostBySlug, calculateReadingTime, safeRenderMarkdown } from '@/lib/blog';
import { getSiteUrl, getRobotsMetadata, safeJsonLd, buildArticleJsonLd, buildBreadcrumbsJsonLd } from '@/lib/seo';
import { Calendar, Clock, ArrowLeft, ShieldCheck } from 'lucide-react';

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);

  if (!post) {
    return {
      title: 'Article Not Found | GroupBuying.store',
    };
  }

  const siteUrl = getSiteUrl();
  const title = post.metaTitle || `${post.title} | GroupBuying.store`;
  const description = post.metaDescription || post.excerpt;
  const canonicalUrl = `${siteUrl}/blog/${post.slug}`;
  const imageUrl = post.coverImageUrl?.startsWith('http')
    ? post.coverImageUrl
    : `${siteUrl}${post.coverImageUrl || '/images/blog-default.svg'}`;

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
      type: 'article',
      publishedTime: post.publishedAt || post.createdAt,
      modifiedTime: post.updatedAt,
      authors: [post.author],
      section: post.topic,
      tags: post.tags,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: post.coverImageAlt || post.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
    robots: getRobotsMetadata(),
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const siteUrl = getSiteUrl();
  const readingTime = calculateReadingTime(post.content);
  const formattedDate = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const htmlContent = safeRenderMarkdown(post.content);

  const breadcrumbsJsonLd = buildBreadcrumbsJsonLd([
    { name: 'Home', url: siteUrl },
    { name: 'Blog', url: `${siteUrl}/blog` },
    { name: post.title, url: `${siteUrl}/blog/${post.slug}` },
  ]);

  const articleJsonLd = buildArticleJsonLd(post);

  return (
    <>
      {/* Schema.org Article Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(articleJsonLd) }}
      />
      {/* Schema.org Breadcrumbs Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbsJsonLd) }}
      />

      <div className="min-h-screen bg-slate-50/50 pb-20">
        <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          {/* Breadcrumb Navigation */}
          <nav className="text-xs text-slate-500 mb-6 flex items-center gap-2">
            <Link href="/" className="hover:text-emerald-600 transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link href="/blog" className="hover:text-emerald-600 transition-colors">
              Blog
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-medium truncate max-w-xs">{post.title}</span>
          </nav>

          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-600 mb-6 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to All Guides</span>
          </Link>

          {/* Topic & Title */}
          <div>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 mb-4">
              {post.topic}
            </span>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              {post.title}
            </h1>
          </div>

          {/* Metadata bar */}
          <div className="mt-6 flex flex-wrap items-center gap-4 sm:gap-6 py-4 border-y border-slate-200 text-xs text-slate-600">
            <div className="flex items-center gap-2 font-medium">
              <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                {post.author.charAt(0)}
              </div>
              <span className="text-slate-900 font-semibold">{post.author}</span>
            </div>

            {formattedDate && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                <span>{formattedDate}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              <span>{readingTime} min read</span>
            </div>
          </div>

          {/* Featured Image */}
          {post.coverImageUrl && (
            <div className="my-8 rounded-2xl overflow-hidden border border-slate-200 shadow-sm aspect-16/9 bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.coverImageUrl}
                alt={post.coverImageAlt || post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Lead Excerpt */}
          <div className="my-6 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <p className="text-sm sm:text-base text-slate-700 font-medium leading-relaxed italic">
              {post.excerpt}
            </p>
          </div>

          {/* Rendered HTML Content */}
          <div
            className="prose prose-slate max-w-none my-8 leading-relaxed text-slate-800"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="mt-10 pt-6 border-t border-slate-200">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tags:</span>
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sources and Editorial Disclosures */}
          {post.sources && post.sources.length > 0 && (
            <div className="mt-8 p-5 rounded-2xl bg-slate-100/80 border border-slate-200 text-xs text-slate-600">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                <span>Editorial Sources &amp; Verification</span>
              </div>
              <ul className="list-disc list-inside space-y-1">
                {post.sources.map((src, i) => (
                  <li key={i}>{src}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Related CTA Box */}
          <div className="mt-12 bg-gradient-to-br from-emerald-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-800/80 inline-block mb-3">
              Direct Group Buying
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Ready to unlock bulk dealer terms in your city?
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
              Join active residential pools for rooftop solar, power backup, or home appliances. No upfront payments or binding commitments.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/"
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-sm transition-all"
              >
                Browse Active Pools
              </Link>
              <Link
                href="/#request-pool"
                className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-white font-semibold text-xs border border-slate-700 transition-colors"
              >
                Request a Custom Deal
              </Link>
            </div>
          </div>
        </article>
      </div>
    </>
  );
}
