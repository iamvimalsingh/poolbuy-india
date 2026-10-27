import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { isDemoMode } from '@/lib/data-mode';
import { restoreDemoPool, MOCK_ADMIN_POOLS } from '@/lib/mock-data';
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

      const restored = restoreDemoPool(poolId);

      await recordAdminAudit({
        action: 'POOL_RESTORED',
        targetType: 'POOL',
        targetId: poolId,
        changesSummary: `Restored group "${existing.name}" from archive/soft-delete (retains unpublished status).`,
      });

      return NextResponse.json(
        { success: true, data: restored },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Live D1 execution
    const db = await requireD1Database();
    const now = new Date().toISOString();

    const existing = await db
      .prepare('SELECT name FROM pools WHERE id = ?')
      .bind(poolId)
      .first<{ name: string }>();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Pool not found.' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    await db
      .prepare(
        'UPDATE pools SET is_archived = 0, deleted_at = NULL, is_published = 0, updated_at = ? WHERE id = ?'
      )
      .bind(now, poolId)
      .run();

    const updated = await db
      .prepare('SELECT * FROM pools WHERE id = ?')
      .bind(poolId)
      .first();

    await recordAdminAudit({
      action: 'POOL_RESTORED',
      targetType: 'POOL',
      targetId: poolId,
      changesSummary: `Restored group "${existing.name}" from archive/soft-delete (retains unpublished status).`,
    });

    return NextResponse.json(
      { success: true, data: updated },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error restoring pool.';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
