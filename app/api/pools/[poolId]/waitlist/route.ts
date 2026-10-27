import { NextRequest, NextResponse } from 'next/server';
import { joinPoolSchema } from '@/lib/validation';
import { isDemoMode } from '@/lib/data-mode';
import { MOCK_POOLS, addDemoWaitlistEntry } from '@/lib/mock-data';
import { getAdminSupabase } from '@/lib/supabase/admin';

type RouteContext = {
  params: Promise<{ poolId: string }>;
};

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { poolId } = await context.params;
    const json = await request.json();
    const parsed = joinPoolSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: parsed.error.issues[0]?.message || 'Invalid waitlist submission.',
          },
        },
        { status: 400 }
      );
    }

    const input = parsed.data;

    if (isDemoMode()) {
      const pool = MOCK_POOLS.find((p) => p.id === poolId);
      if (!pool) {
        return NextResponse.json(
          { success: false, error: { code: 'POOL_NOT_FOUND', message: 'Pool not found.' } },
          { status: 404 }
        );
      }

      const entry = addDemoWaitlistEntry(poolId, {
        fullName: input.fullName,
        whatsappNumber: input.whatsappNumber,
        city: pool.city,
        buyingTimeline: input.buyingTimeline,
        locality: input.locality,
        pinCode: input.pinCode,
        notes: input.extraMessage,
      });

      return NextResponse.json(
        {
          success: true,
          data: {
            waitlistId: entry.id,
            sequenceNumber: entry.sequenceNumber,
            message: `You are #${entry.sequenceNumber} on the waitlist for ${pool.name}. If a member declines or capacity expands, an operator will contact you via WhatsApp.`,
          },
        },
        { status: 201 }
      );
    }

    // Live Supabase
    const supabase = getAdminSupabase();

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
        city: input.city || 'National',
        buying_timeline: input.buyingTimeline,
        locality: input.locality,
        pin_code: input.pinCode,
        notes: input.extraMessage,
        status: 'WAITING',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Unique violation: buyer already on waitlist
        return NextResponse.json(
          {
            success: true,
            data: {
              alreadyOnWaitlist: true,
              message: 'You are already registered on the waitlist for this group.',
            },
          },
          { status: 200 }
        );
      }
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          waitlistId: data.id,
          sequenceNumber: data.sequence_number,
          message: `You are #${data.sequence_number} on the waitlist. We will notify you if a slot opens.`,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error joining waitlist.';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
