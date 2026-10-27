import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/require-admin';
import { isDemoMode } from '@/lib/data-mode';
import { completeDemoPool, MOCK_ADMIN_POOLS } from '@/lib/mock-data';
import { requireD1Database } from '@/lib/d1/db';
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

    // Live D1 execution
    const db = await requireD1Database();
    const now = new Date().toISOString();

    const existing = await db
      .prepare('SELECT name, city_slug, slug FROM pools WHERE id = ?')
      .bind(poolId)
      .first<{ name: string; city_slug: string; slug: string }>();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Pool not found.' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    await db
      .prepare(
        `UPDATE pools
            SET status = 'CLOSED',
                connection_status = 'COMPLETED',
                closure_reason = 'TARGET_ACHIEVED',
                is_published = 0,
                closed_at = ?,
                updated_at = ?
          WHERE id = ?`
      )
      .bind(now, now, poolId)
      .run();

    const updated = await db
      .prepare('SELECT * FROM pools WHERE id = ?')
      .bind(poolId)
      .first();

    await recordAdminAudit({
      action: 'POOL_COMPLETED',
      targetType: 'POOL',
      targetId: poolId,
      changesSummary: `Marked group "${existing.name}" as COMPLETED. Removed from active discovery.`,
    });

    try {
      revalidatePath('/');
      revalidatePath(`/city/${existing.city_slug}`);
      revalidatePath(`/deals/${existing.city_slug}/${existing.slug}`);
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
