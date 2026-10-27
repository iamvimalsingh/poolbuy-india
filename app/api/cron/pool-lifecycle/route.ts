import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isDemoMode } from '@/lib/data-mode';
import { expireDemoPools } from '@/lib/mock-data';
import { requireD1Database } from '@/lib/d1/db';
import { isAuthenticatedAdmin } from '@/lib/admin-auth';
import { ApiResponse } from '@/types';
import crypto from 'crypto';

interface ExpiryResponseData {
  timestamp: string;
  expiredByDeadlineCount: number;
  expiredByOfferCount: number;
  totalClosedCount: number;
  expiredPoolIds?: string[];
  executionMode: 'demo' | 'd1';
}

/**
 * Validates whether the caller is authorized via CRON_SECRET or an authenticated admin session.
 * Fails closed if CRON_SECRET is not set in the environment and caller has no admin session.
 */
async function isAuthorizedCaller(request: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    // 1. Check Bearer Token
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token.length === cronSecret.length) {
        const bufA = Buffer.from(token);
        const bufB = Buffer.from(cronSecret);
        if (crypto.timingSafeEqual(bufA, bufB)) return true;
      }
    }

    // 2. Check query parameter ?secret=... or ?key=...
    const url = new URL(request.url);
    const secretParam = url.searchParams.get('secret') || url.searchParams.get('key');
    if (secretParam && secretParam.length === cronSecret.length) {
      const bufA = Buffer.from(secretParam);
      const bufB = Buffer.from(cronSecret);
      if (crypto.timingSafeEqual(bufA, bufB)) return true;
    }
  }

  // 3. Check Admin session cookie (allow dashboard manual trigger)
  return await isAuthenticatedAdmin();
}

async function handleLifecycleExpiry(
  request: NextRequest
): Promise<NextResponse<ApiResponse<ExpiryResponseData>>> {
  const authorized = await isAuthorizedCaller(request);
  if (!authorized) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Valid CRON_SECRET or admin authorization required to execute lifecycle scheduler.',
        },
      },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    if (isDemoMode()) {
      const demoResult = expireDemoPools();

      try {
        revalidatePath('/');
      } catch (revalErr) {
        console.warn('Revalidation notice:', revalErr);
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            ...demoResult,
            executionMode: 'demo',
          },
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Live D1 Execution
    const db = await requireD1Database();
    const nowIso = new Date().toISOString();

    // 1. Find and update expired deadlines
    const expiredDeadlines = await db
      .prepare(
        "SELECT id FROM pools WHERE status = 'ACTIVE' AND deadline < ? AND deleted_at IS NULL"
      )
      .bind(nowIso)
      .all<{ id: string }>();

    const deadlineIds = (expiredDeadlines.results || []).map((r: { id: string }) => r.id);
    if (deadlineIds.length > 0) {
      await db
        .prepare(
          `UPDATE pools
              SET status = 'CLOSED',
                  closure_reason = 'AUTO_POOL_EXPIRED',
                  closed_at = ?,
                  updated_at = ?
            WHERE status = 'ACTIVE'
              AND deadline < ?
              AND deleted_at IS NULL`
        )
        .bind(nowIso, nowIso, nowIso)
        .run();
    }

    // 2. Find and update expired offers
    const expiredOffers = await db
      .prepare(
        "SELECT id FROM pools WHERE status = 'ACTIVE' AND offer_valid_until IS NOT NULL AND offer_valid_until < ? AND deleted_at IS NULL"
      )
      .bind(nowIso)
      .all<{ id: string }>();

    const offerIds = (expiredOffers.results || []).map((r: { id: string }) => r.id);
    if (offerIds.length > 0) {
      await db
        .prepare(
          `UPDATE pools
              SET status = 'CLOSED',
                  closure_reason = 'OFFER_EXPIRED',
                  closed_at = ?,
                  updated_at = ?
            WHERE status = 'ACTIVE'
              AND offer_valid_until IS NOT NULL
              AND offer_valid_until < ?
              AND deleted_at IS NULL`
        )
        .bind(nowIso, nowIso, nowIso)
        .run();
    }

    try {
      revalidatePath('/');
    } catch (revalErr) {
      console.warn('Revalidation notice:', revalErr);
    }

    const deadlineCount = deadlineIds.length;
    const offerCount = offerIds.length;

    return NextResponse.json(
      {
        success: true,
        data: {
          timestamp: nowIso,
          expiredByDeadlineCount: deadlineCount,
          expiredByOfferCount: offerCount,
          totalClosedCount: deadlineCount + offerCount,
          expiredPoolIds: [...deadlineIds, ...offerIds],
          executionMode: 'd1',
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Lifecycle scheduler error:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SCHEDULER_ERROR',
          message: err.message || 'Error executing lifecycle expiry scheduler.',
        },
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleLifecycleExpiry(request);
}

export async function POST(request: NextRequest) {
  return handleLifecycleExpiry(request);
}
