import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/require-admin';
import { isDemoMode } from '@/lib/data-mode';
import { completeDemoPool, MOCK_ADMIN_POOLS } from '@/lib/mock-data';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { recordAdminAudit } from '@/lib/audit';

type RouteContext = {
  params: Promise<{ poolId: string }>;
};

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const { poolId } = await context.params;

    if (isDemoMode()) {
      const existing = MOCK_ADMIN_POOLS.find((p) => p.id === poolId);
      if (!existing) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Pool not found.' } },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const completed = completeDemoPool(poolId);

      await recordAdminAudit({
        action: 'POOL_COMPLETED',
        targetType: 'POOL',
        targetId: poolId,
        changesSummary: `Marked group "${existing.name}" as COMPLETED. Removed from active discovery.`,
      });

      try {
        revalidatePath('/');
        revalidatePath(`/city/${existing.citySlug}`);
        revalidatePath(`/deals/${existing.citySlug}/${existing.slug}`);
      } catch {}

      return NextResponse.json(
        { success: true, data: completed },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Live Supabase
    const supabase = getAdminSupabase();
    const now = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from('pools')
      .update({
        status: 'CLOSED',
        connection_status: 'COMPLETED',
        closure_reason: 'TARGET_ACHIEVED',
        is_published: false,
        closed_at: now,
        updated_at: now,
      })
      .eq('id', poolId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    await recordAdminAudit({
      action: 'POOL_COMPLETED',
      targetType: 'POOL',
      targetId: poolId,
      changesSummary: `Marked group "${updated.name}" as COMPLETED. Removed from active discovery.`,
    });

    try {
      revalidatePath('/');
      revalidatePath(`/city/${updated.city_slug}`);
      revalidatePath(`/deals/${updated.city_slug}/${updated.slug}`);
    } catch {}

    return NextResponse.json(
      { success: true, data: updated },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error completing pool.';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
