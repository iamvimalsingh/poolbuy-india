/**
 * Central data mode resolver for GroupBuying / PoolBuy India.
 * Resolves whether the application runs in local mock mode or live D1 mode.
 */

export function isDemoMode(): boolean {
  // If explicitly flagged as demo
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return true;
  }

  // In production or staging, demo mode is disabled unless explicitly enabled via NEXT_PUBLIC_DEMO_MODE=true
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  // In development, if NEXT_PUBLIC_DEMO_MODE=false is specified, run in live D1 mode
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'false') {
    return false;
  }

  // Default to demo mode in local development unless NEXT_PUBLIC_DEMO_MODE=false is provided
  return true;
}

export function getDataMode(): 'demo' | 'live' {
  return isDemoMode() ? 'demo' : 'live';
}
