/**
 * Central data mode resolver for PoolBuy India.
 * Resolves whether the application runs in local mock mode or live Supabase mode.
 */

export function isDemoMode(): boolean {
  // If explicitly flagged as demo
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return true;
  }

  // If Supabase credentials are missing, we run in mock mode
  const hasSupabaseUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasSupabaseKey = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return !hasSupabaseUrl || !hasSupabaseKey;
}

export function getDataMode(): 'demo' | 'live' {
  return isDemoMode() ? 'demo' : 'live';
}
