/**
 * Environment parsing and validation helpers for GroupBuying / PoolBuy India.
 */
import { isDemoMode } from './data-mode';
import { getSiteUrl } from './seo';

export interface AppEnv {
  siteUrl: string;
  isDemoMode: boolean;
  adminPasskey?: string;
  adminSessionSecret?: string;
  cronSecret?: string;
  supportWhatsApp?: string;
  supportEmail?: string;
}

export function getAppEnv(): AppEnv {
  const siteUrl = getSiteUrl();

  return {
    siteUrl,
    isDemoMode: isDemoMode(),
    adminPasskey: process.env.ADMIN_PASSKEY,
    adminSessionSecret: process.env.ADMIN_SESSION_SECRET,
    cronSecret: process.env.CRON_SECRET,
    supportWhatsApp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP,
    supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
  };
}

export function assertServerEnv(
  keys: Array<'ADMIN_PASSKEY' | 'ADMIN_SESSION_SECRET' | 'CRON_SECRET'>
): void {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required server environment variable(s): ${missing.join(', ')}. Configure them in secrets or platform settings.`
    );
  }
}
