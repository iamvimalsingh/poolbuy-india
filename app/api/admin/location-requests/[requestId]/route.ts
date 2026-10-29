import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/require-admin';
import { approveLocationRequest, rejectLocationRequest } from '@/lib/location-requests';
import { z } from 'zod';

const actionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  notes: z.string().trim().max(500).optional(),
});

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authError = await requireAdminSession(request, { checkCsrf: true });
  if (authError) return authError;

  const { requestId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_JSON', message: 'Request body must be JSON' } },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Validation failed',
        },
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    if (parsed.data.action === 'APPROVE') {
      const result = await approveLocationRequest(requestId, parsed.data.notes);
      revalidatePath('/');
      revalidatePath('/admin');
      return NextResponse.json(
        { success: true, data: result },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    } else {
      const result = await rejectLocationRequest(requestId, parsed.data.notes);
      return NextResponse.json(
        { success: true, data: result },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to process location request';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message } },
      { status, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

