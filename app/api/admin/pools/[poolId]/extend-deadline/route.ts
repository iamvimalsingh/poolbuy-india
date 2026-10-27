import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/require-admin';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { isDemoMode } from '@/lib/data-mode';
import { MOCK_ADMIN_POOLS, updateDemoPool } from '@/lib/mock-data';
import { z } from 'zod';
import { recordAdminAudit } from '@/lib/audit';

type RouteContext = {
  params: Promise<{ poolId: string }>;
};

const extendDeadlineSchema = z.object({
  newDeadline: z.string().datetime(),
  reason: z.string().trim().min(5).max(500),
});

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const { poolId } = await context.params;
    const json = await request.json();
    const parsed = extendDeadlineSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: parsed.error.issues[0]?.message || 'Invalid deadline parameters.',
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const { newDeadline, reason } = parsed.data;
    const newDeadlineMs = new Date(newDeadline).getTime();
    if (newDeadlineMs <= Date.now()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_DEADLINE',
            message: 'New deadline must be in the future.',
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (isDemoMode()) {
      const pool = MOCK_ADMIN_POOLS.find((p) => p.id === poolId);
      if (!pool) {
        return NextResponse.json(
          { success: false, error: { code: 'POOL_NOT_FOUND', message: 'Pool not found.' } },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const prevDeadline = pool.deadline;
      const updated = updateDemoPool(poolId, {
        deadline: newDeadline,
        status: pool.status === 'CLOSED' && pool.closureReason === 'AUTO_POOL_EXPIRED' ? 'ACTIVE' : pool.status,
        closureReason: pool.closureReason === 'AUTO_POOL_EXPIRED' ? null : pool.closureReason,
        closedAt: pool.closureReason === 'AUTO_POOL_EXPIRED' ? null : pool.closedAt,
      });

      await recordAdminAudit({
        action: 'DEADLINE_EXTENDED',
        targetType: 'POOL',
        targetId: poolId,
        changesSummary: `Extended deadline from ${prevDeadline} to ${newDeadline}. Reason: ${reason}`,
        details: { previousDeadline: prevDeadline, newDeadline, reason },
      });

      try {
        revalidatePath('/');
        revalidatePath(`/deals/${pool.citySlug}/${pool.slug}`);
      } catch (e) {
        console.warn('Revalidation notice:', e);
      }

      return NextResponse.json(
        { success: true, data: updated },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Live Supabase
    const supabase = getAdminSupabase();
    const { data: pool, error: fetchErr } = await supabase
      .from('pools')
      .select('deadline, status, closure_reason, slug, city_slug')
      .eq('id', poolId)
      .maybeSingle();

    if (fetchErr || !pool) {
      return NextResponse.json(
        { success: false, error: { code: 'POOL_NOT_FOUND', message: 'Pool not found.' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const prevDeadline = pool.deadline;
    const updates: Record<string, unknown> = {
      deadline: newDeadline,
      updated_at: new Date().toISOString(),
    };

    if (pool.status === 'CLOSED' && pool.closure_reason === 'AUTO_POOL_EXPIRED') {
      updates.status = 'ACTIVE';
      updates.closure_reason = null;
      updates.closed_at = null;
    }

    const { data: updated, error: updateErr } = await supabase
      .from('pools')
      .update(updates)
      .eq('id', poolId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: updateErr.message } },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    await recordAdminAudit({
      action: 'DEADLINE_EXTENDED',
      targetType: 'POOL',
      targetId: poolId,
      changesSummary: `Extended deadline from ${prevDeadline} to ${newDeadline}. Reason: ${reason}`,
      details: { previousDeadline: prevDeadline, newDeadline, reason },
    });

    try {
      revalidatePath('/');
      revalidatePath(`/deals/${pool.city_slug}/${pool.slug}`);
    } catch (e) {
      console.warn('Revalidation notice:', e);
    }

    return NextResponse.json(
      { success: true, data: updated },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: e.message || 'Server error.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
