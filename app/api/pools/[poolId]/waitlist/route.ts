import { NextRequest, NextResponse } from 'next/server';
import { joinPoolSchema } from '@/lib/validation';
import { isDemoMode } from '@/lib/data-mode';
import { MOCK_POOLS, addDemoWaitlistEntry, getDemoWaitlist } from '@/lib/mock-data';
import { requireD1Database } from '@/lib/d1/db';

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

      const existingWaitlist = (getDemoWaitlist(poolId) || []).filter(
        (w) => w.status === 'WAITING' || w.status === 'INVITED'
      );
      const maxWl = pool.maxWaitlistSize !== undefined ? pool.maxWaitlistSize : Math.ceil(((pool as unknown as { targetBuyers?: number }).targetBuyers || 10) / 2);
      if (existingWaitlist.length >= maxWl) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'WAITLIST_FULL', message: 'Waitlist is currently full for this group.' },
          },
          { status: 400 }
        );
      }

      const effectivePincode = input.pincode || input.pinCode || null;
      const effectiveQuote = input.existing_quote || input.existingQuote || null;
      const entry = addDemoWaitlistEntry(poolId, {
        fullName: input.fullName,
        whatsappNumber: input.whatsappNumber,
        city: pool.city,
        buyingTimeline: input.buyingTimeline,
        locality: input.locality,
        pinCode: effectivePincode,
        pincode: effectivePincode,
        existing_quote: effectiveQuote,
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

    // Live D1 Execution
    const db = await requireD1Database();
    const now = new Date().toISOString();

    // Check pool existence
    const pool = await db
      .prepare('SELECT id, name, target_buyers, max_waitlist_size FROM pools WHERE id = ? AND deleted_at IS NULL')
      .bind(poolId)
      .first<{ id: string; name: string; target_buyers?: number | null; max_waitlist_size?: number | null }>();

    if (!pool) {
      return NextResponse.json(
        { success: false, error: { code: 'POOL_NOT_FOUND', message: 'Pool not found.' } },
        { status: 404 }
      );
    }

    // Capacity limit check
    const activeWaitlistCount = await db
      .prepare("SELECT COUNT(*) as total FROM pool_waitlist WHERE pool_id = ? AND status IN ('WAITING', 'INVITED')")
      .bind(poolId)
      .first<{ total: number }>();

    const targetBuyers = pool.target_buyers ? Number(pool.target_buyers) : 10;
    const maxWaitlist = pool.max_waitlist_size === 0 ? 0 : Math.ceil(targetBuyers / 2);
    if (activeWaitlistCount && activeWaitlistCount.total >= maxWaitlist) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'WAITLIST_FULL', message: 'Waitlist is currently full for this group.' },
        },
        { status: 400 }
      );
    }

    if (!pool) {
      return NextResponse.json(
        { success: false, error: { code: 'POOL_NOT_FOUND', message: 'Pool not found.' } },
        { status: 404 }
      );
    }

    // Check unique waitlist registration
    const existing = await db
      .prepare('SELECT id, sequence_number FROM pool_waitlist WHERE pool_id = ? AND whatsapp_number = ?')
      .bind(poolId, input.whatsappNumber)
      .first<{ id: string; sequence_number: number }>();

    if (existing) {
      return NextResponse.json(
        {
          success: true,
          data: {
            alreadyOnWaitlist: true,
            waitlistId: existing.id,
            sequenceNumber: existing.sequence_number,
            message: 'You are already registered on the waitlist for this group.',
          },
        },
        { status: 200 }
      );
    }

    // Calculate next FIFO sequence number
    const countRow = await db
      .prepare('SELECT COUNT(*) as total FROM pool_waitlist WHERE pool_id = ?')
      .bind(poolId)
      .first<{ total: number }>();

    const nextSeq = (countRow?.total || 0) + 1;
    const waitlistId = `wl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const effectivePincode = input.pincode?.trim() || input.pinCode?.trim() || null;
    const effectiveQuote = input.existing_quote?.trim() || input.existingQuote?.trim() || null;

    await db
      .prepare(
        `INSERT INTO pool_waitlist (
          id, pool_id, sequence_number, full_name, whatsapp_number,
          city, buying_timeline, locality, pin_code, pincode, existing_quote, status, notes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WAITING', ?, ?, ?)`
      )
      .bind(
        waitlistId,
        poolId,
        nextSeq,
        input.fullName.trim(),
        input.whatsappNumber,
        input.city || 'National',
        input.buyingTimeline || 'THIS_MONTH',
        input.locality?.trim() || null,
        effectivePincode,
        effectivePincode,
        effectiveQuote,
        input.extraMessage?.trim() || null,
        now,
        now
      )
      .run();

    return NextResponse.json(
      {
        success: true,
        data: {
          waitlistId,
          sequenceNumber: nextSeq,
          message: `You are #${nextSeq} on the waitlist. We will notify you if a slot opens.`,
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
