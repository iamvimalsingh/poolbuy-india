import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isDemoMode } from '@/lib/data-mode';
import { expireDemoPools } from '@/lib/mock-data';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { isAuthenticatedAdmin } from '@/lib/admin-auth';
import { ApiResponse } from '@/types';

import crypto from 'crypto';

interface ExpiryResponseData {
  timestamp: string;
  expiredByDeadlineCount: number;
  expiredByOfferCount: number;
  totalClosedCount: number;
  expiredPoolIds?: string[];
  executionMode: 'demo' | 'supabase';
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

      // Trigger cache revalidations
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

    // Live Supabase Execution
    const supabase = getAdminSupabase();
    const nowIso = new Date().toISOString();

    // Call idempotent stored procedure if available, or execute direct updates
    const { data: rpcResult, error: rpcError } = await supabase.rpc('process_pool_expiry');

    if (!rpcError && rpcResult) {
      try {
        revalidatePath('/');
      } catch (revalErr) {
        console.warn('Revalidation notice:', revalErr);
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            timestamp: rpcResult.timestamp || nowIso,
            expiredByDeadlineCount: Number(rpcResult.expiredByDeadlineCount || 0),
            expiredByOfferCount: Number(rpcResult.expiredByOfferCount || 0),
            totalClosedCount: Number(rpcResult.totalClosedCount || 0),
            executionMode: 'supabase',
          },
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Direct fallback updates if RPC not yet created in remote DB
    const { data: expiredDeadlines, error: deadlineErr } = await supabase
      .from('pools')
      .update({
        status: 'CLOSED',
        closure_reason: 'AUTO_POOL_EXPIRED',
        closed_at: nowIso,
        updated_at: nowIso,
      })
      .eq('status', 'ACTIVE')
      .lt('deadline', nowIso)
      .is('deleted_at', null)
      .select('id');

    if (deadlineErr) {
      throw new Error(`Failed to update expired pool deadlines: ${deadlineErr.message}`);
    }

    const { data: expiredOffers, error: offerErr } = await supabase
      .from('pools')
      .update({
        status: 'CLOSED',
        closure_reason: 'OFFER_EXPIRED',
        closed_at: nowIso,
        updated_at: nowIso,
      })
      .eq('status', 'ACTIVE')
      .not('offer_valid_until', 'is', null)
      .lt('offer_valid_until', nowIso)
      .is('deleted_at', null)
      .select('id');

    if (offerErr) {
      throw new Error(`Failed to update expired offers: ${offerErr.message}`);
    }

    try {
      revalidatePath('/');
    } catch (revalErr) {
      console.warn('Revalidation notice:', revalErr);
    }

    const deadlineCount = expiredDeadlines?.length || 0;
    const offerCount = expiredOffers?.length || 0;

    return NextResponse.json(
      {
        success: true,
        data: {
          timestamp: nowIso,
          expiredByDeadlineCount: deadlineCount,
          expiredByOfferCount: offerCount,
          totalClosedCount: deadlineCount + offerCount,
          expiredPoolIds: [
            ...(expiredDeadlines?.map((p) => p.id) || []),
            ...(expiredOffers?.map((p) => p.id) || []),
          ],
          executionMode: 'supabase',
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
