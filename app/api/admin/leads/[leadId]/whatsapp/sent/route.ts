import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { isDemoMode } from '@/lib/data-mode';
import { recordManualWhatsAppSent, getDemoLeads } from '@/lib/mock-data';
import { requireD1Database } from '@/lib/d1/db';
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

    // Live D1
    const db = await requireD1Database();
    const noteText = notes || `Manually sent ${templateType} via WhatsApp.`;

    const existing = await db
      .prepare('SELECT id, buyer_number, full_name FROM pool_leads WHERE id = ?')
      .bind(leadId)
      .first<{ id: string; buyer_number: number; full_name: string }>();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'LEAD_NOT_FOUND', message: 'Lead not found.' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    await db
      .prepare(
        `UPDATE pool_leads
         SET last_contact_at = ?,
             last_contact_status = 'SENT',
             last_contact_note = ?,
             status = 'CONTACTED',
             updated_at = ?
         WHERE id = ?`
      )
      .bind(now, noteText, now, leadId)
      .run();

    await recordAdminAudit({
      action: 'WHATSAPP_MANUALLY_SENT',
      targetType: 'LEAD',
      targetId: leadId,
      changesSummary: `Operator manually sent "${templateType}" WhatsApp message to member #${existing.buyer_number} (${existing.full_name}).`,
      details: { templateType, notes: noteText, sentAt: now },
    });

    return NextResponse.json(
      { success: true, data: { updated: true, id: leadId, lastContactStatus: 'SENT' } },
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
