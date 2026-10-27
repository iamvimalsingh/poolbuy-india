import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/require-admin';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { isDemoMode } from '@/lib/data-mode';
import { MOCK_ADMIN_POOLS, addDemoPool } from '@/lib/mock-data';
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

    if (isDemoMode()) {
      const source = MOCK_ADMIN_POOLS.find((p) => p.id === poolId);
      if (!source) {
        return NextResponse.json(
          { success: false, error: { code: 'POOL_NOT_FOUND', message: 'Source pool not found.' } },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      // Check duplicate slug in target city
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

      const now = new Date().toISOString();
      const clonedPool: AdminPool = {
        ...source,
        id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        city: targetCity,
        citySlug: finalCitySlug,
        currentBuyers: 0,
        deadline: newDeadline,
        status: 'ACTIVE',
        isPublished: false, // New clone starts as un-published draft
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

    // Live Supabase
    const supabase = getAdminSupabase();
    const { data: source, error: sourceErr } = await supabase
      .from('pools')
      .select('*')
      .eq('id', poolId)
      .maybeSingle();

    if (sourceErr || !source) {
      return NextResponse.json(
        { success: false, error: { code: 'POOL_NOT_FOUND', message: 'Source pool not found.' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const { data: created, error: insertErr } = await supabase
      .from('pools')
      .insert({
        slug: source.slug,
        name: source.name,
        short_description: source.short_description,
        long_description: source.long_description,
        category: source.category,
        city: targetCity,
        city_slug: finalCitySlug,
        product_brand: source.product_brand,
        product_model: source.product_model,
        image_url: source.image_url,
        market_price: source.market_price,
        group_price: source.group_price,
        target_buyers: source.target_buyers,
        current_buyers: 0,
        deadline: newDeadline,
        status: 'ACTIVE',
        is_published: false,
        price_is_verified: source.price_is_verified,
        price_verified_at: source.price_verified_at,
        market_price_type: source.market_price_type || 'INDICATIVE_ESTIMATE',
        group_price_type: source.group_price_type || 'INDICATIVE_ESTIMATE',
        savings_display_approved: false,
        connection_status: 'NOT_ELIGIBLE',
        payment_config_state: 'DISABLED',
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: insertErr.message } },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    await recordAdminAudit({
      action: 'POOL_CLONED',
      targetType: 'POOL',
      targetId: created.id,
      changesSummary: `Cloned pool "${source.name}" from ${source.city} to ${targetCity} as independent draft pool.`,
      details: { sourcePoolId: source.id, targetCity, newDeadline },
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
