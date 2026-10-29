import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { getAllLocationRequests } from '@/lib/location-requests';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = await requireAdminSession(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status') || undefined;

  try {
    const requests = await getAllLocationRequests(statusParam);
    return NextResponse.json(
      { success: true, data: requests },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch location requests';
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

