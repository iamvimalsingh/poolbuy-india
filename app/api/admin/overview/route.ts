import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { isDemoMode } from '@/lib/data-mode';
import { getDemoOverviewMetrics } from '@/lib/mock-data';
import { requireD1Database } from '@/lib/d1/db';
import { AdminOverviewMetrics } from '@/types';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = await requireAdminSession(request);
  if (authError) return authError;

  if (isDemoMode()) {
    const metrics = getDemoOverviewMetrics();
    return NextResponse.json(
      { success: true, data: metrics },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // Live D1 queries
  try {
    const db = await requireD1Database();
    const nowIso = new Date().toISOString();

    const [
      draftsRow,
      openRow,
      targetReachedRow,
      waitlistRow,
      quotesRow,
      responsesRow,
      feesRow,
      connectionsRow,
      completedRow,
      archivedRow,
    ] = await Promise.all([
      db.prepare('SELECT COUNT(*) as c FROM pools WHERE is_published = 0 AND deleted_at IS NULL').first<{ c: number }>(),
      db.prepare("SELECT COUNT(*) as c FROM pools WHERE status = 'ACTIVE' AND deadline > ? AND is_published = 1 AND deleted_at IS NULL").bind(nowIso).first<{ c: number }>(),
      db.prepare("SELECT COUNT(*) as c FROM pools WHERE (status = 'UNLOCKED' OR connection_status = 'ADMIN_REVIEW_PENDING') AND deleted_at IS NULL").first<{ c: number }>(),
      db.prepare("SELECT COUNT(*) as c FROM pool_waitlist WHERE status IN ('WAITING', 'INVITED')").first<{ c: number }>(),
      db.prepare("SELECT COUNT(*) as c FROM pool_quotations WHERE status IN ('REQUESTED', 'RECEIVED')").first<{ c: number }>(),
      db.prepare("SELECT COUNT(*) as c FROM pool_leads WHERE quote_response = 'AWAITING_RESPONSE'").first<{ c: number }>(),
      db.prepare("SELECT COUNT(*) as c FROM pool_leads WHERE fee_status IN ('PAYMENT_REPORTED', 'DISCLOSED_PENDING')").first<{ c: number }>(),
      db.prepare("SELECT COUNT(*) as c FROM pool_leads WHERE member_connection_status IN ('OPTED_IN', 'ELIGIBLE_TO_CONNECT')").first<{ c: number }>(),
      db.prepare("SELECT COUNT(*) as c FROM pools WHERE connection_status = 'COMPLETED'").first<{ c: number }>(),
      db.prepare('SELECT COUNT(*) as c FROM pools WHERE is_archived = 1').first<{ c: number }>(),
    ]);

    const metrics: AdminOverviewMetrics = {
      totalDrafts: Number(draftsRow?.c || 0),
      totalOpenGroups: Number(openRow?.c || 0),
      totalTargetReached: Number(targetReachedRow?.c || 0),
      totalWaitlistPending: Number(waitlistRow?.c || 0),
      totalQuotesAwaitingReview: Number(quotesRow?.c || 0),
      totalMemberResponsesPending: Number(responsesRow?.c || 0),
      totalFeesPendingVerification: Number(feesRow?.c || 0),
      totalConnectionsPending: Number(connectionsRow?.c || 0),
      totalCompletedGroups: Number(completedRow?.c || 0),
      totalArchivedGroups: Number(archivedRow?.c || 0),
    };

    return NextResponse.json(
      { success: true, data: metrics },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error fetching overview metrics.';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
