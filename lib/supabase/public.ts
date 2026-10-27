import { createClient, SupabaseClient } from '@supabase/supabase-js';

let publicClient: SupabaseClient | null = null;

/**
 * Returns a browser/server safe public Supabase client.
 * Returns null if Supabase environment variables are not configured (mock mode).
 */
export function getPublicSupabase(): SupabaseClient | null {
  if (publicClient) return publicClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  publicClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return publicClient;
}
