import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { isDemoMode } from '@/lib/data-mode';
import { updateDemoWaitlistEntry, promoteDemoWaitlistEntry, getDemoWaitlist } from '@/lib/mock-data';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { updateWaitlistSchema } from '@/lib/validation';
import { recordAdminAudit } from '@/lib/audit';

type RouteContext = {
  params: Promise<{ poolId: string; waitlistId: string }>;
};

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

    // Live Supabase
    const supabase = getAdminSupabase();

    if (updates.status === 'PROMOTED') {
      // Find waitlist entry
      const { data: wl, error: wlErr } = await supabase
        .from('pool_waitlist')
        .select('*')
        .eq('id', waitlistId)
        .eq('pool_id', poolId)
        .single();

      if (wlErr || !wl) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Waitlist entry not found.' } },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      // Lock pool and increment current_buyers
      const { data: poolRow, error: pErr } = await supabase
        .from('pools')
        .select('current_buyers')
        .eq('id', poolId)
        .single();

      if (pErr) {
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: pErr.message } },
          { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const nextCount = (poolRow?.current_buyers || 0) + 1;

      // Insert new lead
      const { data: leadData, error: leadErr } = await supabase
        .from('pool_leads')
        .insert({
          pool_id: poolId,
          full_name: wl.full_name,
          whatsapp_number: wl.whatsapp_number,
          city: wl.city,
          buying_timeline: wl.buying_timeline || 'THIS_MONTH',
          buyer_number: nextCount,
          status: 'NEW',
          locality: wl.locality,
          pin_code: wl.pin_code,
          admin_notes: `Promoted from waitlist position #${wl.sequence_number}`,
        })
        .select()
        .single();

      if (leadErr) {
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: leadErr.message } },
          { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      // Update pool current_buyers
      await supabase
        .from('pools')
        .update({ current_buyers: nextCount, updated_at: now })
        .eq('id', poolId);

      // Update waitlist entry
      const { data: updatedWl, error: upErr } = await supabase
        .from('pool_waitlist')
        .update({
          status: 'PROMOTED',
          promoted_at: now,
          promoted_lead_id: leadData.id,
          updated_at: now,
        })
        .eq('id', waitlistId)
        .select()
        .single();

      if (upErr) {
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: upErr.message } },
          { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      await recordAdminAudit({
        action: 'WAITLIST_ENTRY_PROMOTED',
        targetType: 'LEAD',
        targetId: leadData.id,
        changesSummary: `Promoted ${wl.full_name} from waitlist to active Buyer #${nextCount} in pool ${poolId}.`,
        details: { waitlistId, leadId: leadData.id, buyerNumber: nextCount },
      });

      return NextResponse.json(
        { success: true, data: { lead: leadData, waitlist: updatedWl } },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Standard waitlist update
    const dbPayload: Record<string, unknown> = {
      updated_at: now,
      ...(updates.status && { status: updates.status }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
      ...(updates.removalReason !== undefined && { removal_reason: updates.removalReason }),
    };

    if (updates.status === 'INVITED') {
      dbPayload.invited_at = now;
      dbPayload.invitation_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    } else if (updates.status === 'DECLINED') {
      dbPayload.response_at = now;
    }

    const { data: updated, error } = await supabase
      .from('pool_waitlist')
      .update(dbPayload)
      .eq('id', waitlistId)
      .eq('pool_id', poolId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    await recordAdminAudit({
      action: 'WAITLIST_ENTRY_UPDATED',
      targetType: 'LEAD',
      targetId: waitlistId,
      changesSummary: `Updated waitlist entry #${updated.sequence_number} status to ${updates.status || 'updated'}.`,
      details: dbPayload,
    });

    return NextResponse.json(
      { success: true, data: updated },
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
