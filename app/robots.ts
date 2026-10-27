import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo';
import { isDemoMode } from '@/lib/data-mode';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  if (isDemoMode()) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
      sitemap: `${siteUrl}/sitemap.xml`,
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/admin', '/api/', '/_next/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
