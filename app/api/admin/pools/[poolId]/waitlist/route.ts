import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { isDemoMode } from '@/lib/data-mode';
import { getDemoWaitlist, addDemoWaitlistEntry } from '@/lib/mock-data';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { createWaitlistSchema } from '@/lib/validation';
import { recordAdminAudit } from '@/lib/audit';

type RouteContext = {
  params: Promise<{ poolId: string }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request);
  if (authError) return authError;

  try {
    const { poolId } = await context.params;

    if (isDemoMode()) {
      const waitlist = getDemoWaitlist(poolId);
      return NextResponse.json(
        { success: true, data: waitlist },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from('pool_waitlist')
      .select('*')
      .eq('pool_id', poolId)
      .order('sequence_number', { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      { success: true, data: data || [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error loading waitlist.';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const { poolId } = await context.params;
    const json = await request.json();
    const parsed = createWaitlistSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: parsed.error.issues[0]?.message || 'Invalid waitlist input.',
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const input = parsed.data;

    if (isDemoMode()) {
      const entry = addDemoWaitlistEntry(poolId, input);

      await recordAdminAudit({
        action: 'WAITLIST_ENTRY_ADDED',
        targetType: 'LEAD',
        targetId: entry.id,
        changesSummary: `Added ${entry.fullName} to waitlist position #${entry.sequenceNumber} in pool ${poolId}.`,
        details: entry as unknown as Record<string, unknown>,
      });

      return NextResponse.json(
        { success: true, data: entry },
        { status: 201, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const supabase = getAdminSupabase();

    // Get current max sequence number
    const { count } = await supabase
      .from('pool_waitlist')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', poolId);

    const nextSeq = (count || 0) + 1;

    const { data, error } = await supabase
      .from('pool_waitlist')
      .insert({
        pool_id: poolId,
        sequence_number: nextSeq,
        full_name: input.fullName,
        whatsapp_number: input.whatsappNumber,
        city: input.city,
        buying_timeline: input.buyingTimeline,
        locality: input.locality,
        pin_code: input.pinCode,
        notes: input.notes,
        status: 'WAITING',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    await recordAdminAudit({
      action: 'WAITLIST_ENTRY_ADDED',
      targetType: 'LEAD',
      targetId: data.id,
      changesSummary: `Added ${data.full_name} to waitlist position #${data.sequence_number} in pool ${poolId}.`,
      details: data,
    });

    return NextResponse.json(
      { success: true, data },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error creating waitlist entry.';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
