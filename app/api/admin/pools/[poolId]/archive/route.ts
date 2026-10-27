import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/require-admin';
import { isDemoMode } from '@/lib/data-mode';
import { archiveDemoPool, MOCK_ADMIN_POOLS } from '@/lib/mock-data';
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

      const archived = archiveDemoPool(poolId);

      await recordAdminAudit({
        action: 'POOL_ARCHIVED',
        targetType: 'POOL',
        targetId: poolId,
        changesSummary: `Archived group "${existing.name}". Moved to historical records.`,
      });

      try {
        revalidatePath('/');
        revalidatePath(`/city/${existing.citySlug}`);
      } catch {}

      return NextResponse.json(
        { success: true, data: archived },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Live Supabase
    const supabase = getAdminSupabase();
    const now = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from('pools')
      .update({
        is_archived: true,
        is_published: false,
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
      action: 'POOL_ARCHIVED',
      targetType: 'POOL',
      targetId: poolId,
      changesSummary: `Archived group "${updated.name}". Moved to historical records.`,
    });

    try {
      revalidatePath('/');
      revalidatePath(`/city/${updated.city_slug}`);
    } catch {}

    return NextResponse.json(
      { success: true, data: updated },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error archiving pool.';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
