import { NextResponse } from 'next/server';
import { getPublishedBlogPosts } from '@/lib/blog';
import { getSiteUrl } from '@/lib/seo';

export async function GET() {
  const siteUrl = getSiteUrl();
  const posts = await getPublishedBlogPosts();

  const escapeXml = (unsafe: string) =>
    unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const itemsXml = posts
    .map((post) => {
      const postUrl = `${siteUrl}/blog/${post.slug}`;
      const pubDate = post.publishedAt
        ? new Date(post.publishedAt).toUTCString()
        : new Date(post.createdAt).toUTCString();

      return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <description>${escapeXml(post.excerpt)}</description>
      <category>${escapeXml(post.topic)}</category>
      <author>${escapeXml(post.author)}</author>
      <pubDate>${pubDate}</pubDate>
    </item>`;
    })
    .join('');

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>PoolBuy India — Educational Guides &amp; Market Insights</title>
    <link>${siteUrl}/blog</link>
    <description>Practical, unbiased consumer guides on PM Surya Ghar rooftop solar, inverters, deep-cycle batteries, water treatment, and community group buying dynamics across Indian cities.</description>
    <language>en-IN</language>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    ${itemsXml}
  </channel>
</rss>`;

  return new NextResponse(rssXml.trim(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
