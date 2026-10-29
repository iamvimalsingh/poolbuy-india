import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { isDemoMode } from '@/lib/data-mode';
import { getDemoWaitlist, addDemoWaitlistEntry } from '@/lib/mock-data';
import { requireD1Database } from '@/lib/d1/db';
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

    const db = await requireD1Database();
    const { results } = await db
      .prepare('SELECT * FROM pool_waitlist WHERE pool_id = ? ORDER BY sequence_number ASC')
      .bind(poolId)
      .all();

    return NextResponse.json(
      { success: true, data: results || [] },
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
    const now = new Date().toISOString();

    if (isDemoMode()) {
      const entry = addDemoWaitlistEntry(poolId, {
        ...input,
        pinCode: input.pincode || input.pinCode || null,
        pincode: input.pincode || input.pinCode || null,
        existing_quote: input.existing_quote || input.existingQuote || null,
      });

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

    const db = await requireD1Database();

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
          city, buying_timeline, locality, pin_code, pincode, existing_quote, notes, status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WAITING', ?, ?)`
      )
      .bind(
        waitlistId,
        poolId,
        nextSeq,
        input.fullName.trim(),
        input.whatsappNumber,
        input.city,
        input.buyingTimeline || null,
        input.locality || null,
        effectivePincode,
        effectivePincode,
        effectiveQuote,
        input.notes || null,
        now,
        now
      )
      .run();

    const created = await db
      .prepare('SELECT * FROM pool_waitlist WHERE id = ?')
      .bind(waitlistId)
      .first();

    await recordAdminAudit({
      action: 'WAITLIST_ENTRY_ADDED',
      targetType: 'LEAD',
      targetId: waitlistId,
      changesSummary: `Added ${input.fullName} to waitlist position #${nextSeq} in pool ${poolId}.`,
      details: created as Record<string, unknown>,
    });

    return NextResponse.json(
      { success: true, data: created },
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
