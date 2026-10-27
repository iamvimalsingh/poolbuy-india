import 'server-only';
import crypto from 'crypto';
import { cookies } from 'next/headers';

export const ADMIN_COOKIE_NAME = 'poolbuy-admin-session';
export const SESSION_DURATION_SECONDS = 8 * 60 * 60; // 8 hours

export interface AdminSessionPayload {
  issuedAt: number;
  exp: number;
  nonce: string;
}

/**
 * Returns whether admin credentials are configured in the environment.
 */
export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSKEY && process.env.ADMIN_SESSION_SECRET);
}

/**
 * Constant-time comparison of passkey against ADMIN_PASSKEY.
 * Hashes both strings with SHA-256 before timingSafeEqual to ensure identical buffer lengths.
 */
export function verifyAdminPasskey(passkey: string): boolean {
  const adminSecret = process.env.ADMIN_PASSKEY;
  if (!adminSecret || !passkey) {
    return false;
  }

  const hashProvided = crypto.createHash('sha256').update(passkey).digest();
  const hashExpected = crypto.createHash('sha256').update(adminSecret).digest();

  return crypto.timingSafeEqual(hashProvided, hashExpected);
}

/**
 * Creates an HMAC signature for a serialized session payload.
 */
function createSignature(payloadString: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payloadString).digest('base64url');
}

/**
 * Signs and serializes an admin session token: payload.signature
 */
export function createSignedSessionToken(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET is not configured on the server.');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    issuedAt: now,
    exp: now + SESSION_DURATION_SECONDS,
    nonce: crypto.randomBytes(16).toString('hex'),
  };

  const payloadString = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createSignature(payloadString, secret);

  return `${payloadString}.${signature}`;
}

/**
 * Validates a signed session token. Returns true if signature is valid and not expired.
 */
export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;

  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [payloadString, providedSignature] = parts;

  // Verify HMAC signature in constant time
  const expectedSignature = createSignature(payloadString, secret);
  const sigBufferProvided = Buffer.from(providedSignature);
  const sigBufferExpected = Buffer.from(expectedSignature);

  if (sigBufferProvided.length !== sigBufferExpected.length) {
    return false;
  }

  if (!crypto.timingSafeEqual(sigBufferProvided, sigBufferExpected)) {
    return false;
  }

  // Parse and verify expiration
  try {
    const payload: AdminSessionPayload = JSON.parse(
      Buffer.from(payloadString, 'base64url').toString('utf8')
    );
    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now;
  } catch {
    return false;
  }
}

/**
 * Checks if the current request has a valid authenticated admin session cookie.
 */
export async function isAuthenticatedAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
