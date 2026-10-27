import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { isDemoMode } from '@/lib/data-mode';
import { updateDemoWaitlistEntry, promoteDemoWaitlistEntry, getDemoWaitlist } from '@/lib/mock-data';
import { requireD1Database } from '@/lib/d1/db';
import { updateWaitlistSchema } from '@/lib/validation';
import { recordAdminAudit } from '@/lib/audit';

type RouteContext = {
  params: Promise<{ poolId: string; waitlistId: string }>;
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
  status: string;
  invited_at: string | null;
  invitation_expires_at: string | null;
  response_at: string | null;
  promoted_at: string | null;
  promoted_lead_id: string | null;
  removal_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const { poolId, waitlistId } = await context.params;
    const json = await request.json();
    const parsed = updateWaitlistSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: parsed.error.issues[0]?.message || 'Invalid waitlist update parameters.',
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const updates = parsed.data;
    const now = new Date().toISOString();

    if (isDemoMode()) {
      const existing = getDemoWaitlist(poolId).find((w) => w.id === waitlistId);
      if (!existing) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Waitlist entry not found.' } },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      if (updates.status === 'PROMOTED') {
        const result = promoteDemoWaitlistEntry(waitlistId);
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
          changesSummary: `Promoted ${existing.fullName} from waitlist to active Buyer #${result.lead.buyerNumber} in pool ${poolId}.`,
          details: { waitlistId, leadId: result.lead.id, buyerNumber: result.lead.buyerNumber },
        });

        return NextResponse.json(
          { success: true, data: result },
          { headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const enriched: Record<string, unknown> = {
        ...(updates.status && { status: updates.status }),
        ...(updates.notes !== undefined && { notes: updates.notes }),
        ...(updates.removalReason !== undefined && { removalReason: updates.removalReason }),
      };

      if (updates.status === 'INVITED') {
        enriched.invitedAt = now;
        enriched.invitationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      } else if (updates.status === 'DECLINED') {
        enriched.responseAt = now;
      }

      const updated = updateDemoWaitlistEntry(waitlistId, enriched);

      await recordAdminAudit({
        action: 'WAITLIST_ENTRY_UPDATED',
        targetType: 'LEAD',
        targetId: waitlistId,
        changesSummary: `Updated waitlist entry #${existing.sequenceNumber} (${existing.fullName}) status to ${updates.status || 'notes'}.`,
        details: enriched,
      });

      return NextResponse.json(
        { success: true, data: updated },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Live D1 execution
    const db = await requireD1Database();

    const wl = await db
      .prepare('SELECT * FROM pool_waitlist WHERE id = ? AND pool_id = ?')
      .bind(waitlistId, poolId)
      .first<D1WaitlistRow>();

    if (!wl) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Waitlist entry not found.' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (updates.status === 'PROMOTED') {
      const poolRow = await db
        .prepare('SELECT current_buyers, target_buyers FROM pools WHERE id = ?')
        .bind(poolId)
        .first<{ current_buyers: number; target_buyers: number }>();

      const nextCount = (poolRow?.current_buyers || 0) + 1;
      const newLeadId = `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      // Execute promotional transaction batch
      await db.batch([
        db.prepare(
          `INSERT INTO pool_leads (
            id, pool_id, buyer_number, full_name, whatsapp_number, city,
            buying_timeline, status, locality, pin_code, admin_notes,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'NEW', ?, ?, ?, ?, ?)`
        ).bind(
          newLeadId,
          poolId,
          nextCount,
          wl.full_name,
          wl.whatsapp_number,
          wl.city,
          wl.buying_timeline || 'THIS_MONTH',
          wl.locality || null,
          wl.pin_code || null,
          `Promoted from waitlist position #${wl.sequence_number}`,
          now,
          now
        ),
        db.prepare(
          'UPDATE pools SET current_buyers = ?, updated_at = ? WHERE id = ?'
        ).bind(nextCount, now, poolId),
        db.prepare(
          'UPDATE pool_waitlist SET status = ?, promoted_at = ?, promoted_lead_id = ?, updated_at = ? WHERE id = ?'
        ).bind('PROMOTED', now, newLeadId, now, waitlistId),
      ]);

      const updatedWl = await db
        .prepare('SELECT * FROM pool_waitlist WHERE id = ?')
        .bind(waitlistId)
        .first();

      const createdLead = await db
        .prepare('SELECT * FROM pool_leads WHERE id = ?')
        .bind(newLeadId)
        .first();

      await recordAdminAudit({
        action: 'WAITLIST_ENTRY_PROMOTED',
        targetType: 'LEAD',
        targetId: newLeadId,
        changesSummary: `Promoted ${wl.full_name} from waitlist to active Buyer #${nextCount} in pool ${poolId}.`,
        details: { waitlistId, leadId: newLeadId, buyerNumber: nextCount },
      });

      return NextResponse.json(
        {
          success: true,
          data: {
            waitlist: updatedWl,
            lead: createdLead,
          },
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const setClauses: string[] = ['updated_at = ?'];
    const values: unknown[] = [now];

    if (updates.status) {
      setClauses.push('status = ?');
      values.push(updates.status);

      if (updates.status === 'INVITED') {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        setClauses.push('invited_at = ?', 'invitation_expires_at = ?');
        values.push(now, expiresAt);
      } else if (updates.status === 'DECLINED') {
        setClauses.push('response_at = ?');
        values.push(now);
      }
    }
    if (updates.notes !== undefined) {
      setClauses.push('notes = ?');
      values.push(updates.notes);
    }
    if (updates.removalReason !== undefined) {
      setClauses.push('removal_reason = ?');
      values.push(updates.removalReason);
    }

    values.push(waitlistId, poolId);

    await db
      .prepare(`UPDATE pool_waitlist SET ${setClauses.join(', ')} WHERE id = ? AND pool_id = ?`)
      .bind(...values)
      .run();

    const updatedRow = await db
      .prepare('SELECT * FROM pool_waitlist WHERE id = ? AND pool_id = ?')
      .bind(waitlistId, poolId)
      .first();

    await recordAdminAudit({
      action: 'WAITLIST_ENTRY_UPDATED',
      targetType: 'LEAD',
      targetId: waitlistId,
      changesSummary: `Updated waitlist entry #${wl.sequence_number} (${wl.full_name}) status to ${updates.status || 'notes'}.`,
      details: updates as Record<string, unknown>,
    });

    return NextResponse.json(
      { success: true, data: updatedRow },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error updating waitlist entry.';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
