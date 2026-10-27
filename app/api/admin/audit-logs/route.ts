import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/require-admin';
import { isDemoMode } from '@/lib/data-mode';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getDemoAuditLogs } from '@/lib/audit';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = await requireAdminSession(request);
  if (authError) return authError;

  if (isDemoMode()) {
    const logs = getDemoAuditLogs();
    return NextResponse.json(
      { success: true, data: logs },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const mapped = (data || []).map((row) => ({
      id: row.id,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      adminIdentifier: row.admin_identifier,
      changesSummary: row.changes_summary,
      details: row.details,
      createdAt: row.created_at,
    }));

    return NextResponse.json(
      { success: true, data: mapped },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: e.message || 'Server error.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
