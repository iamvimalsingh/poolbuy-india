import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { requireD1Database } from '@/lib/d1/db';
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

    const db = await requireD1Database();
    const existing = await db
      .prepare('SELECT id FROM pool_requests WHERE id = ?')
      .bind(requestId)
      .first();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Request not found' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const now = new Date().toISOString();
    const reviewedAt = parsed.data.status && parsed.data.status !== 'REQUESTED' ? now : null;

    // Build update dynamically or coalesced
    await db
      .prepare(
        `UPDATE pool_requests
         SET status = COALESCE(?, status),
             admin_notes = COALESCE(?, admin_notes),
             conversion_status = COALESCE(?, conversion_status),
             reviewed_at = CASE WHEN ? IS NOT NULL THEN ? ELSE reviewed_at END,
             updated_at = ?
         WHERE id = ?`
      )
      .bind(
        parsed.data.status ?? null,
        parsed.data.adminNotes ?? null,
        parsed.data.conversionStatus ?? null,
        reviewedAt,
        reviewedAt,
        now,
        requestId
      )
      .run();

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
