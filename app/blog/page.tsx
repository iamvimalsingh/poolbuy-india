import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { getPublishedBlogPosts, calculateReadingTime } from '@/lib/blog';
import { getSiteUrl, getRobotsMetadata } from '@/lib/seo';
import { BookOpen, Calendar, Clock, User, ArrowRight } from 'lucide-react';

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = getSiteUrl();
  const title = 'Educational Guides & Market Insights | GroupBuying.store';
  const description =
    'Practical, unbiased consumer guides on PM Surya Ghar rooftop solar, inverters, deep-cycle batteries, water treatment, and community group buying dynamics across Indian cities.';

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/blog`,
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/blog`,
      siteName: 'GroupBuying.store',
      locale: 'en_IN',
      type: 'website',
      images: [
        {
          url: `${siteUrl}/images/blog-default.svg`,
          width: 1200,
          height: 630,
          alt: 'GroupBuying Guides & Market Insights',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Educational Guides & Market Insights | GroupBuying.store',
      description: 'Practical, unbiased consumer guides on rooftop solar, inverters, deep-cycle batteries, water treatment, and community group buying dynamics across Indian cities.',
      images: [`${siteUrl}/images/blog-default.svg`],
    },
    robots: getRobotsMetadata(),
  };
}

export default async function BlogIndexPage() {
  const posts = await getPublishedBlogPosts();

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Hero Header */}
      <section className="bg-white border-b border-slate-200 py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-4">
            <BookOpen className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            <span>Unbiased Consumer Intelligence</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
            PoolBuy Insights &amp; Guides
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed">
            Deep-dive specifications, government subsidy economics, technical equipment teardowns, and verified market pricing strategies for Indian homeowners.
          </p>

          <div className="mt-6 flex flex-wrap gap-2 text-xs font-medium text-slate-500">
            <span>Core Verticals:</span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700">Rooftop Solar</span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700">Power Backup</span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700">Water Treatment</span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700">Group Buying Economics</span>
          </div>
        </div>
      </section>

      {/* Articles Grid */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        {posts.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto">
            <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900">Articles Coming Soon</h2>
            <p className="mt-2 text-sm text-slate-600">
              Our research team is currently drafting verified consumer guides. Check back soon or explore active group pools.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs"
            >
              Browse Active Pools
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => {
              const readingTime = calculateReadingTime(post.content);
              const formattedDate = post.publishedAt
                ? new Date(post.publishedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : null;

              return (
                <article
                  key={post.id}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col group"
                >
                  {post.coverImageUrl && (
                    <div className="relative aspect-16/9 w-full bg-slate-100 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={post.coverImageUrl}
                        alt={post.coverImageAlt || post.title}
                        className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                        loading="lazy"
                      />
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-[11px] font-bold bg-white/95 text-slate-800 shadow-xs backdrop-blur-xs">
                        {post.topic}
                      </span>
                    </div>
                  )}

                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      {!post.coverImageUrl && (
                        <div className="mb-3">
                          <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800">
                            {post.topic}
                          </span>
                        </div>
                      )}

                      <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight group-hover:text-emerald-700 transition-colors line-clamp-2">
                        <Link href={`/blog/${post.slug}`} className="focus:outline-hidden">
                          {post.title}
                        </Link>
                      </h2>

                      <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3">
                        {post.excerpt}
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-3">
                        <span className="flex items-center gap-1 font-medium truncate max-w-[160px]">
                          <User className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
                          <span className="truncate">{post.author}</span>
                        </span>
                        <div className="flex items-center gap-3 shrink-0">
                          {formattedDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
                              <span>{formattedDate}</span>
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
                            <span>{readingTime} min</span>
                          </span>
                        </div>
                      </div>

                      <Link
                        href={`/blog/${post.slug}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 group-hover:translate-x-0.5 transition-all"
                      >
                        <span>Read Full Guide</span>
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
