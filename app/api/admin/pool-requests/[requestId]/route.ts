import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { requireD1Database } from '@/lib/d1/db';
import { isDemoMode } from '@/lib/data-mode';
import { poolRequestStatusEnum } from '@/lib/validation';
import { updateDemoRequest, getDemoRequests } from '@/lib/mock-data';
import { recordAdminAudit } from '@/lib/audit';
import { z } from 'zod';

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

const updateRequestSchema = z.object({
  status: poolRequestStatusEnum.optional(),
  adminNotes: z.string().max(2000).optional(),
  conversionStatus: z.enum(['PENDING', 'CONVERTED', 'DISMISSED']).optional(),
});

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request);
  if (authError) return authError;

  try {
    const { requestId } = await context.params;

    if (isDemoMode()) {
      const found = getDemoRequests().find((r) => r.id === requestId);
      if (!found) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Request not found.' } },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return NextResponse.json(
        { success: true, data: found },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const db = await requireD1Database();
    const row = await db
      .prepare('SELECT * FROM pool_requests WHERE id = ?')
      .bind(requestId)
      .first();

    if (!row) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Request not found.' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      { success: true, data: row },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching request.';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const { requestId } = await context.params;
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_JSON', message: 'Body must be valid JSON.' } },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

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
      .prepare('SELECT id, status FROM pool_requests WHERE id = ?')
      .bind(requestId)
      .first<{ id: string; status: string }>();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Request not found' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const now = new Date().toISOString();
    const reviewedAt = parsed.data.status && parsed.data.status !== 'REQUESTED' ? now : null;

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

    await recordAdminAudit({
      action: 'REQUEST_UPDATED',
      targetType: 'REQUEST',
      targetId: requestId,
      changesSummary: `Updated request ${requestId} to status ${parsed.data.status || 'notes'}.`,
      details: parsed.data as Record<string, unknown>,
    });

    return NextResponse.json(
      { success: true, data: { updated: true, id: requestId, status: parsed.data.status } },
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

export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  try {
    const { requestId } = await context.params;

    if (isDemoMode()) {
      const updated = updateDemoRequest(requestId, {
        status: 'ARCHIVED',
        conversionStatus: 'DISMISSED',
      });
      if (!updated) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Request not found.' } },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return NextResponse.json(
        { success: true, data: { archived: true, id: requestId } },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const db = await requireD1Database();
    const existing = await db
      .prepare('SELECT id, resulting_pool_id, status FROM pool_requests WHERE id = ?')
      .bind(requestId)
      .first<{ id: string; resulting_pool_id: string | null; status: string }>();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Request not found.' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const now = new Date().toISOString();

    // Default safe behavior: soft-delete/archive with audit/history preserved.
    // If request already converted into a pool, we preserve the linked pool and history.
    await db
      .prepare(
        `UPDATE pool_requests
         SET status = 'ARCHIVED',
             is_archived = 1,
             archived_at = ?,
             conversion_status = CASE WHEN resulting_pool_id IS NOT NULL THEN conversion_status ELSE 'DISMISSED' END,
             updated_at = ?
         WHERE id = ?`
      )
      .bind(now, now, requestId)
      .run();

    await recordAdminAudit({
      action: 'REQUEST_ARCHIVED',
      targetType: 'REQUEST',
      targetId: requestId,
      changesSummary: `Archived request ${requestId} (soft-delete with history preserved).`,
      details: { requestId },
    });

    return NextResponse.json(
      { success: true, data: { archived: true, id: requestId } },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Request archive/delete error:', err);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err.message || 'Failed to archive request.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
