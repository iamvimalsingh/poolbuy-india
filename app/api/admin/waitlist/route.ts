import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { getD1Database, requireD1Database } from '@/lib/d1/db';
import { isDemoMode } from '@/lib/data-mode';
import { getDemoWaitlist, MOCK_ADMIN_POOLS } from '@/lib/mock-data';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = await requireAdminSession(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId') || undefined;
    const search = searchParams.get('search')?.trim().toLowerCase() || undefined;

    const db = await getD1Database();
    if (!db && isDemoMode()) {
      let entries = poolId
        ? getDemoWaitlist(poolId)
        : MOCK_ADMIN_POOLS.flatMap((p) => getDemoWaitlist(p.id));

      if (search) {
        entries = entries.filter(
          (e) =>
            e.fullName.toLowerCase().includes(search) ||
            e.whatsappNumber.includes(search) ||
            (e.pincode && e.pincode.includes(search)) ||
            (e.pinCode && e.pinCode.includes(search))
        );
      }
      return NextResponse.json(
        { success: true, data: entries },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const realDb = db || (await requireD1Database());
    const whereClauses: string[] = ['1=1'];
    const params: unknown[] = [];

    if (poolId) {
      whereClauses.push('w.pool_id = ?');
      params.push(poolId);
    }
    if (search) {
      whereClauses.push(
        '(LOWER(w.full_name) LIKE ? OR w.whatsapp_number LIKE ? OR w.pincode LIKE ? OR w.pin_code LIKE ? OR LOWER(w.existing_quote) LIKE ?)'
      );
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }

    const sql = `
      SELECT
        w.*,
        p.name as pool_name,
        p.slug as pool_slug,
        p.city as pool_city
      FROM pool_waitlist w
      LEFT JOIN pools p ON w.pool_id = p.id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY w.created_at DESC
    `;

    const { results } = await realDb.prepare(sql).bind(...params).all();
    return NextResponse.json(
      { success: true, data: results || [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch waitlist.';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

