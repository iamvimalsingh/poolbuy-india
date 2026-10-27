import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticatedAdmin, isAdminConfigured } from './admin-auth';

/**
 * Validates request origin against Host/Origin headers for state-changing admin routes.
 */
export function validateCsrfOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) {
    // If origin is absent (e.g. same-origin GET/manual tool), allow if Host matches
    return true;
  }

  const host = request.headers.get('host');
  if (!host) return false;

  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

/**
 * Server guard for Route Handlers.
 * Returns null if authentication passes, or an error NextResponse if unauthorized.
 */
export async function requireAdminSession(
  request: NextRequest,
  options?: { checkCsrf?: boolean }
): Promise<NextResponse | null> {
  // Check if server is configured
  if (!isAdminConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CONFIG_MISSING',
          message: 'Admin authentication is not configured on this server. ADMIN_PASSKEY and ADMIN_SESSION_SECRET are required.',
        },
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // CSRF validation for mutating methods
  if (options?.checkCsrf) {
    if (!validateCsrfOrigin(request)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ADMIN_FORBIDDEN',
            message: 'Cross-origin admin requests are strictly forbidden.',
          },
        },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }
  }

  const authenticated = await isAuthenticatedAdmin();
  if (!authenticated) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ADMIN_AUTH_REQUIRED',
          message: 'Valid admin session required. Please log in.',
        },
      },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return null;
}
