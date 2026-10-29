import { getSiteUrl } from './seo';

export interface PoolShareData {
  id?: string;
  name: string;
  city: string;
  citySlug: string;
  slug: string;
  productTitle?: string;
  category?: string;
  marketPrice?: number | null;
  groupPrice?: number | null;
  priceIsVerified?: boolean;
  currentBuyers?: number;
  targetBuyers?: number;
}

export interface ShareContentResult {
  title: string;
  text: string;
  url: string;
  fullMessage: string;
  whatsAppUrl: string;
}

/**
 * Builds canonical sharing parameters and honest message copy for a city pool.
 *
 * Rules:
 * - Always references the exact pool and city.
 * - Appends safe, non-sensitive referral attribution (`?ref=share`) without user PII.
 * - Explicitly states that interest registration is 100% free and non-binding.
 * - Does not claim discounts are guaranteed without verified dealer quotations.
 */
export function buildPoolShareContent(pool: PoolShareData, siteUrl?: string): ShareContentResult {
  const base = (siteUrl || getSiteUrl()).replace(/\/+$/, '');
  const canonicalUrl = `${base}/deals/${pool.citySlug}/${pool.slug}?ref=share`;
  const poolName = pool.productTitle || pool.name;

  const title = `${poolName} in ${pool.city} | GroupBuying.store`;
  const text = `I’m interested in this GroupBuying.store pool for ${poolName} in ${pool.city}. If you’re interested too, see the details and register your interest for free. Joining is non-binding:`;
  const fullMessage = `${text} ${canonicalUrl}`;
  const whatsAppUrl = `https://wa.me/?text=${encodeURIComponent(fullMessage)}`;

  return {
    title,
    text,
    url: canonicalUrl,
    fullMessage,
    whatsAppUrl,
  };
}

/**
 * Safe browser sharing helper. Attempts Web Share API when supported;
 * returns a boolean indicating whether native share succeeded or modal fallback is needed.
 */
export async function triggerNativeShare(shareData: {
  title: string;
  text: string;
  url: string;
}): Promise<'SHARED' | 'UNSUPPORTED' | 'CANCELLED' | 'ERROR'> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return 'UNSUPPORTED';
  }

  try {
    await navigator.share(shareData);
    return 'SHARED';
  } catch (err: unknown) {
    if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'))) {
      return 'CANCELLED';
    }
    return 'ERROR';
  }
}

/**
 * Fallback clipboard copy with safe exception handling.
 */
export async function copyShareLinkToClipboard(url: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      // Fall through to fallback
    }
  }

  try {
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      return successful;
    }
  } catch {
    return false;
  }

  return false;
}
