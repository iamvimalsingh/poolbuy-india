import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { requireD1Database } from '@/lib/d1/db';
import { isDemoMode } from '@/lib/data-mode';
import { getDemoWaitlist, promoteDemoWaitlistEntry } from '@/lib/mock-data';
import { recordAdminAudit } from '@/lib/audit';

type RouteContext = {
  params: Promise<{ poolId: string }>;
};

interface D1WaitlistRow {
  id: string;
  pool_id: string;
  sequence_number: number;
  full_name: string;
  whatsapp_number: string;
  city: string;
  buying_timeline: string | null;
  locality: string | null;
  pin_code: string | null;
  pincode: string | null;
  existing_quote: string | null;
  status: string;
  created_at: string;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const { poolId } = await context.params;
    const now = new Date().toISOString();

    if (isDemoMode()) {
      const waitlist = getDemoWaitlist(poolId).filter((w) => w.status === 'WAITING');
      if (waitlist.length === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'NO_WAITLISTED_MEMBERS', message: 'No waiting members to promote.' } },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const earliest = waitlist.sort((a, b) => a.sequenceNumber - b.sequenceNumber)[0];
      const result = promoteDemoWaitlistEntry(earliest.id);
      if (!result) {
        return NextResponse.json(
          { success: false, error: { code: 'PROMOTION_FAILED', message: 'Could not promote waitlist entry.' } },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      await recordAdminAudit({
        action: 'WAITLIST_ENTRY_PROMOTED',
        targetType: 'LEAD',
        targetId: result.lead.id,
        changesSummary: `Promoted ${earliest.fullName} from waitlist to active Buyer #${result.lead.buyerNumber} in pool ${poolId}.`,
        details: { waitlistId: earliest.id, leadId: result.lead.id, buyerNumber: result.lead.buyerNumber },
      });

      return NextResponse.json(
        { success: true, data: result },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const db = await requireD1Database();

    // 1. Check pool existence and target capacity
    const poolRow = await db
      .prepare('SELECT id, current_buyers, target_buyers, status FROM pools WHERE id = ?')
      .bind(poolId)
      .first<{ id: string; current_buyers: number; target_buyers: number; status: string }>();

    if (!poolRow) {
      return NextResponse.json(
        { success: false, error: { code: 'POOL_NOT_FOUND', message: 'Pool not found.' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 2. Count current authoritative active members
    const activeRow = await db
      .prepare("SELECT COUNT(*) as c FROM pool_leads WHERE pool_id = ? AND (member_connection_status IS NULL OR member_connection_status != 'EXCLUDED')")
      .bind(poolId)
      .first<{ c: number }>();

    const activeCount = Number(activeRow?.c ?? poolRow.current_buyers);
    if (activeCount >= poolRow.target_buyers) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CAPACITY_REACHED',
            message: `Cannot promote waitlist entry. Active capacity (${poolRow.target_buyers}) is full. Remove an active member first.`,
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 3. Find the oldest eligible FIFO waitlisted member
    const earliest = await db
      .prepare("SELECT * FROM pool_waitlist WHERE pool_id = ? AND status = 'WAITING' ORDER BY sequence_number ASC, created_at ASC LIMIT 1")
      .bind(poolId)
      .first<D1WaitlistRow>();

    if (!earliest) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_WAITLISTED_MEMBERS', message: 'No eligible waitlisted members found for this pool.' } },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const newLeadId = `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const nextBuyerNumber = activeCount + 1;

    // 4. Atomically promote
    const effectivePincode = earliest.pincode || earliest.pin_code || null;
    await db.batch([
      db.prepare(
        `INSERT INTO pool_leads (
          id, pool_id, buyer_number, full_name, whatsapp_number, city,
          buying_timeline, status, locality, pin_code, pincode, existing_quote, admin_notes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'NEW', ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        newLeadId,
        poolId,
        nextBuyerNumber,
        earliest.full_name,
        earliest.whatsapp_number,
        earliest.city,
        earliest.buying_timeline || 'THIS_MONTH',
        earliest.locality || null,
        effectivePincode,
        effectivePincode,
        earliest.existing_quote || null,
        `FIFO Promoted from waitlist position #${earliest.sequence_number}`,
        now,
        now
      ),
      db.prepare('UPDATE pools SET current_buyers = ?, updated_at = ? WHERE id = ?')
        .bind(nextBuyerNumber, now, poolId),
      db.prepare(
        `UPDATE pool_waitlist
         SET status = 'PROMOTED',
             promoted_at = ?,
             promoted_lead_id = ?,
             updated_at = ?
         WHERE id = ?`
      ).bind(now, newLeadId, now, earliest.id),
    ]);

    await recordAdminAudit({
      action: 'WAITLIST_ENTRY_PROMOTED',
      targetType: 'LEAD',
      targetId: newLeadId,
      changesSummary: `Promoted ${earliest.full_name} from waitlist to active Buyer #${nextBuyerNumber} in pool ${poolId}.`,
      details: { waitlistId: earliest.id, leadId: newLeadId, buyerNumber: nextBuyerNumber },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          promoted: true,
          leadId: newLeadId,
          waitlistId: earliest.id,
          buyerNumber: nextBuyerNumber,
          activeCount: nextBuyerNumber,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error('Waitlist promotion error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Promotion failed.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

