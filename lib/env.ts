/**
 * Environment parsing and validation helpers for PoolBuy India.
 */

export interface AppEnv {
  siteUrl: string;
  isDemoMode: boolean;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  supabaseServiceRoleKey?: string;
  adminPasskey?: string;
  adminSessionSecret?: string;
  cronSecret?: string;
  supportWhatsApp?: string;
  supportEmail?: string;
}

export function getAppEnv(): AppEnv {
  const isDemo =
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return {
    siteUrl,
    isDemoMode: isDemo,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    adminPasskey: process.env.ADMIN_PASSKEY,
    adminSessionSecret: process.env.ADMIN_SESSION_SECRET,
    cronSecret: process.env.CRON_SECRET,
    supportWhatsApp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP,
    supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
  };
}

export function assertServerEnv(
  keys: Array<
    'SUPABASE_SERVICE_ROLE_KEY' | 'ADMIN_PASSKEY' | 'ADMIN_SESSION_SECRET' | 'CRON_SECRET'
  >
): void {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required server environment variable(s): ${missing.join(', ')}. Configure them in .env.local or platform settings.`
    );
  }
}
