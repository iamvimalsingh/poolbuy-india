import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo';
import { CATEGORY_SLUG_MAP } from '@/lib/constants';
import { getPublicPools } from '@/lib/pools';
import { getOperationalCities } from '@/lib/cities';

import { getOperationalCategories } from '@/lib/categories';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();

  // Root landing page
  const routes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      changeFrequency: 'daily',
      priority: 1.0,
    },
  ];

  // Approved City landing pages from authoritative city directory
  try {
    const operationalCities = await getOperationalCities();
    for (const city of operationalCities) {
      routes.push({
        url: `${siteUrl}/city/${city.slug}`,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  } catch (err) {
    console.error('Error populating sitemap city routes:', err);
  }

  // Approved Category landing pages from authoritative categories directory
  try {
    const operationalCategories = await getOperationalCategories();
    const categorySlugs = new Set([
      ...operationalCategories.map((c) => c.slug),
      ...Object.keys(CATEGORY_SLUG_MAP),
    ]);
    for (const categorySlug of categorySlugs) {
      routes.push({
        url: `${siteUrl}/category/${categorySlug}`,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  } catch (err) {
    console.error('Error populating sitemap category routes:', err);
  }

  // Active or Unlocked public deals only
  try {
    const pools = await getPublicPools();
    const indexablePools = pools.filter(
      (p) => p.status === 'ACTIVE' || p.status === 'UNLOCKED'
    );

    for (const pool of indexablePools) {
      routes.push({
        url: `${siteUrl}/deals/${pool.citySlug}/${pool.slug}`,
        lastModified: pool.updatedAt ? new Date(pool.updatedAt) : undefined,
        changeFrequency: 'daily',
        priority: 0.9,
      });
    }
  } catch (err) {
    console.error('Error populating sitemap deal routes:', err);
  }

  // Published Educational Blog Articles
  try {
    const { getPublishedBlogPosts } = await import('@/lib/blog');
    const publishedPosts = await getPublishedBlogPosts();

    // Blog index
    routes.push({
      url: `${siteUrl}/blog`,
      changeFrequency: 'daily',
      priority: 0.8,
    });

    for (const post of publishedPosts) {
      routes.push({
        url: `${siteUrl}/blog/${post.slug}`,
        lastModified: post.updatedAt ? new Date(post.updatedAt) : undefined,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
    }
  } catch (err) {
    console.error('Error populating sitemap blog routes:', err);
  }

  return routes;
}
