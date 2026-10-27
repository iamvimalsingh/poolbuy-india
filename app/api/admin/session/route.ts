import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAdminPasskey,
  createSignedSessionToken,
  ADMIN_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  isAdminConfigured,
} from '@/lib/admin-auth';
import { validateCsrfOrigin } from '@/lib/require-admin';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // CSRF Origin validation
  if (!validateCsrfOrigin(request)) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'ADMIN_FORBIDDEN', message: 'Invalid origin.' },
      },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (!isAdminConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CONFIG_MISSING',
          message:
            'Admin authentication is not configured on this server. Please set ADMIN_PASSKEY and ADMIN_SESSION_SECRET.',
        },
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const json = await request.json();
    const passkey = json.passkey;

    if (!passkey || typeof passkey !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Passkey is required.' },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const isValid = verifyAdminPasskey(passkey);
    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'ADMIN_AUTH_FAILED', message: 'Incorrect passkey.' },
        },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const token = createSignedSessionToken();

    const response = NextResponse.json(
      { success: true, data: { authenticated: true } },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );

    // Set signed HttpOnly session cookie
    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_DURATION_SECONDS,
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Login failed due to a server error.' },
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function DELETE(): Promise<NextResponse> {
  const response = NextResponse.json(
    { success: true, data: { authenticated: false } },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );

  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });

  return response;
}
