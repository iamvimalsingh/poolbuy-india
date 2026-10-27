import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { isDemoMode } from '@/lib/data-mode';
import { recordManualWhatsAppSent, getDemoLeads } from '@/lib/mock-data';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { recordWhatsAppSentSchema } from '@/lib/validation';
import { recordAdminAudit } from '@/lib/audit';

type RouteContext = {
  params: Promise<{ leadId: string }>;
};

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const { leadId } = await context.params;
    const json = await request.json();
    const parsed = recordWhatsAppSentSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: parsed.error.issues[0]?.message || 'Invalid WhatsApp sent confirmation.',
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const { templateType, notes } = parsed.data;
    const now = new Date().toISOString();

    if (isDemoMode()) {
      const existing = getDemoLeads().find((l) => l.id === leadId);
      if (!existing) {
        return NextResponse.json(
          { success: false, error: { code: 'LEAD_NOT_FOUND', message: 'Lead not found in demo records.' } },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const updated = recordManualWhatsAppSent(leadId, templateType, notes);

      await recordAdminAudit({
        action: 'WHATSAPP_MANUALLY_SENT',
        targetType: 'LEAD',
        targetId: leadId,
        changesSummary: `Operator manually sent "${templateType}" WhatsApp message to member #${existing.buyerNumber} (${existing.fullName}).`,
        details: { templateType, notes, sentAt: now },
      });

      return NextResponse.json(
        { success: true, data: updated },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Live Supabase
    const supabase = getAdminSupabase();
    const noteText = notes || `Manually sent ${templateType} via WhatsApp.`;

    const { data: updated, error } = await supabase
      .from('pool_leads')
      .update({
        last_contact_at: now,
        last_contact_status: 'SENT',
        last_contact_note: noteText,
        status: 'CONTACTED',
      })
      .eq('id', leadId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    await recordAdminAudit({
      action: 'WHATSAPP_MANUALLY_SENT',
      targetType: 'LEAD',
      targetId: leadId,
      changesSummary: `Operator manually sent "${templateType}" WhatsApp message to member #${updated.buyer_number} (${updated.full_name}).`,
      details: { templateType, notes: noteText, sentAt: now },
    });

    return NextResponse.json(
      { success: true, data: updated },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error recording WhatsApp sent status.';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
