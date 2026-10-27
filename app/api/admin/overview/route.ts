import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { isDemoMode } from '@/lib/data-mode';
import { getDemoOverviewMetrics } from '@/lib/mock-data';
import { getAdminSupabase } from '@/lib/supabase/admin';
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

  // Live Supabase query
  try {
    const supabase = getAdminSupabase();
    const nowIso = new Date().toISOString();

    const [
      { count: draftsCount },
      { count: openCount },
      { count: targetReachedCount },
      { count: waitlistCount },
      { count: quotesCount },
      { count: responsesCount },
      { count: feesCount },
      { count: connectionsCount },
      { count: completedCount },
      { count: archivedCount },
    ] = await Promise.all([
      supabase.from('pools').select('*', { count: 'exact', head: true }).eq('is_published', false).is('deleted_at', null),
      supabase.from('pools').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE').gt('deadline', nowIso).eq('is_published', true),
      supabase.from('pools').select('*', { count: 'exact', head: true }).or('status.eq.UNLOCKED,connection_status.eq.ADMIN_REVIEW_PENDING'),
      supabase.from('pool_waitlist').select('*', { count: 'exact', head: true }).in('status', ['WAITING', 'INVITED']),
      supabase.from('pool_quotations').select('*', { count: 'exact', head: true }).in('status', ['REQUESTED', 'RECEIVED']),
      supabase.from('pool_leads').select('*', { count: 'exact', head: true }).eq('quote_response', 'AWAITING_RESPONSE'),
      supabase.from('pool_leads').select('*', { count: 'exact', head: true }).in('fee_status', ['PAYMENT_REPORTED', 'DISCLOSED_PENDING']),
      supabase.from('pool_leads').select('*', { count: 'exact', head: true }).in('member_connection_status', ['OPTED_IN', 'ELIGIBLE_TO_CONNECT']),
      supabase.from('pools').select('*', { count: 'exact', head: true }).eq('connection_status', 'COMPLETED'),
      supabase.from('pools').select('*', { count: 'exact', head: true }).eq('is_archived', true),
    ]);

    const metrics: AdminOverviewMetrics = {
      totalDrafts: draftsCount || 0,
      totalOpenGroups: openCount || 0,
      totalTargetReached: targetReachedCount || 0,
      totalWaitlistPending: waitlistCount || 0,
      totalQuotesAwaitingReview: quotesCount || 0,
      totalMemberResponsesPending: responsesCount || 0,
      totalFeesPendingVerification: feesCount || 0,
      totalConnectionsPending: connectionsCount || 0,
      totalCompletedGroups: completedCount || 0,
      totalArchivedGroups: archivedCount || 0,
    };

    return NextResponse.json(
      { success: true, data: metrics },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to compute overview metrics.';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
