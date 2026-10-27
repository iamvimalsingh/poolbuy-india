import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { isDemoMode } from '@/lib/data-mode';
import { poolRequestStatusEnum } from '@/lib/validation';
import { updateDemoRequest } from '@/lib/mock-data';
import { z } from 'zod';

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

const updateRequestSchema = z.object({
  status: poolRequestStatusEnum.optional(),
  adminNotes: z.string().max(2000).optional(),
  conversionStatus: z.enum(['PENDING', 'CONVERTED', 'DISMISSED']).optional(),
});

export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const { requestId } = await context.params;
    const json = await request.json();
    const parsed = updateRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message || 'Invalid fields.' },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (isDemoMode()) {
      const updated = updateDemoRequest(requestId, parsed.data);
      if (!updated) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Request not found' } },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return NextResponse.json(
        { success: true, data: { updated: true, request: updated } },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const supabase = getAdminSupabase();
    if (!supabase) {
      const updated = updateDemoRequest(requestId, parsed.data);
      return NextResponse.json(
        { success: true, data: { updated: true, request: updated } },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (parsed.data.status !== undefined) {
      updatePayload.status = parsed.data.status;
      if (parsed.data.status !== 'REQUESTED') {
        updatePayload.reviewed_at = new Date().toISOString();
      }
    }
    if (parsed.data.adminNotes !== undefined) {
      updatePayload.admin_notes = parsed.data.adminNotes;
    }
    if (parsed.data.conversionStatus !== undefined) {
      updatePayload.conversion_status = parsed.data.conversionStatus;
    }

    const { data, error } = await supabase
      .from('pool_requests')
      .update(updatePayload)
      .eq('id', requestId)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Request not found' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      { success: true, data: { updated: true } },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err.message || 'Failed to update request.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
