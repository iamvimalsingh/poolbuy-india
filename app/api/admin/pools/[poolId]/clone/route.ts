import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/require-admin';
import { isDemoMode } from '@/lib/data-mode';
import { MOCK_ADMIN_POOLS, addDemoPool } from '@/lib/mock-data';
import { requireD1Database } from '@/lib/d1/db';
import { AdminPool } from '@/types';
import { z } from 'zod';
import { slugify } from '@/lib/format';
import { recordAdminAudit } from '@/lib/audit';

type RouteContext = {
  params: Promise<{ poolId: string }>;
};

const cloneSchema = z.object({
  targetCity: z.string().trim().min(2).max(80),
  targetCitySlug: z.string().trim().optional(),
  deadlineDays: z.number().min(1).max(180).default(14),
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
    const parsed = cloneSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: parsed.error.issues[0]?.message || 'Invalid clone parameters.',
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const { targetCity, targetCitySlug, deadlineDays } = parsed.data;
    const finalCitySlug = targetCitySlug ? slugify(targetCitySlug) : slugify(targetCity);
    const newDeadline = new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    if (isDemoMode()) {
      const source = MOCK_ADMIN_POOLS.find((p) => p.id === poolId);
      if (!source) {
        return NextResponse.json(
          { success: false, error: { code: 'POOL_NOT_FOUND', message: 'Source pool not found.' } },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const duplicate = MOCK_ADMIN_POOLS.find(
        (p) => p.citySlug.toLowerCase() === finalCitySlug.toLowerCase() && p.slug === source.slug
      );
      if (duplicate) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'DUPLICATE_SLUG',
              message: `A pool with slug "${source.slug}" already exists in ${targetCity}.`,
            },
          },
          { status: 409, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const clonedPool: AdminPool = {
        ...source,
        id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        city: targetCity,
        citySlug: finalCitySlug,
        currentBuyers: 0,
        deadline: newDeadline,
        status: 'ACTIVE',
        isPublished: false,
        targetReachedAt: null,
        targetReachedAcknowledgedAt: null,
        connectionStatus: 'NOT_ELIGIBLE',
        paymentConfigState: 'DISABLED',
        closureReason: null,
        closedAt: null,
        deletedAt: null,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      };

      addDemoPool(clonedPool);

      await recordAdminAudit({
        action: 'POOL_CLONED',
        targetType: 'POOL',
        targetId: clonedPool.id,
        changesSummary: `Cloned pool "${source.name}" from ${source.city} to ${targetCity} as an independent draft pool.`,
        details: { sourcePoolId: source.id, targetCity, newDeadline },
      });

      return NextResponse.json(
        { success: true, data: clonedPool },
        { status: 201, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Live D1 execution
    const db = await requireD1Database();

    const source = await db
      .prepare('SELECT * FROM pools WHERE id = ?')
      .bind(poolId)
      .first<Record<string, unknown>>();

    if (!source) {
      return NextResponse.json(
        { success: false, error: { code: 'POOL_NOT_FOUND', message: 'Source pool not found.' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const duplicate = await db
      .prepare('SELECT id FROM pools WHERE city_slug = ? AND slug = ? AND deleted_at IS NULL')
      .bind(finalCitySlug, source.slug)
      .first<{ id: string }>();

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DUPLICATE_SLUG',
            message: `A pool with slug "${source.slug}" already exists in ${targetCity}.`,
          },
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const newPoolId = `pool-${finalCitySlug}-${source.slug}-${Date.now().toString(36)}`;

    await db
      .prepare(
        `INSERT INTO pools (
          id, slug, name, short_description, long_description, category,
          city, city_slug, product_brand, product_model, image_url,
          market_price, group_price, target_buyers, current_buyers,
          deadline, status, is_published, price_is_verified, price_verified_at,
          market_price_type, group_price_type, savings_display_approved,
          connection_status, payment_config_state, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, 0,
          ?, 'ACTIVE', 0, ?, ?,
          ?, ?, 0,
          'NOT_ELIGIBLE', 'DISABLED', ?, ?
        )`
      )
      .bind(
        newPoolId,
        source.slug,
        source.name,
        source.short_description || '',
        source.long_description || '',
        source.category,
        targetCity,
        finalCitySlug,
        source.product_brand || '',
        source.product_model || '',
        source.image_url || null,
        source.market_price || null,
        source.group_price || null,
        source.target_buyers || 10,
        newDeadline,
        source.price_is_verified ? 1 : 0,
        source.price_verified_at || null,
        source.market_price_type || 'INDICATIVE_ESTIMATE',
        source.group_price_type || 'INDICATIVE_ESTIMATE',
        now,
        now
      )
      .run();

    const created = await db
      .prepare('SELECT * FROM pools WHERE id = ?')
      .bind(newPoolId)
      .first();

    await recordAdminAudit({
      action: 'POOL_CLONED',
      targetType: 'POOL',
      targetId: newPoolId,
      changesSummary: `Cloned pool "${source.name}" from ${source.city} to ${targetCity} as independent draft pool.`,
      details: { sourcePoolId: poolId, targetCity, newDeadline },
    });

    try {
      revalidatePath('/');
      revalidatePath(`/city/${finalCitySlug}`);
    } catch (e) {
      console.warn('Revalidation notice:', e);
    }

    return NextResponse.json(
      { success: true, data: created },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: e.message || 'Server error.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
