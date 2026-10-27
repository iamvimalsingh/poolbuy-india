import { isDemoMode } from './data-mode';
import { getAdminSupabase } from './supabase/admin';

export interface AuditLogEntry {
  id: string;
  action: string;
  targetType: 'POOL' | 'LEAD' | 'REQUEST' | 'CITY' | 'CATEGORY' | 'CONFIG';
  targetId: string;
  adminIdentifier: string;
  changesSummary: string;
  details?: Record<string, unknown> | null;
  createdAt: string;
}

interface GlobalAuditStore {
  __poolbuy_audit_logs?: AuditLogEntry[];
}

const g = globalThis as unknown as GlobalAuditStore;
if (!g.__poolbuy_audit_logs) {
  g.__poolbuy_audit_logs = [
    {
      id: 'audit-init-1',
      action: 'SYSTEM_INIT',
      targetType: 'CONFIG',
      targetId: 'system',
      adminIdentifier: 'system',
      changesSummary: 'GroupBuying MVP system initialized in local demo mode.',
      details: null,
      createdAt: '2026-10-26T00:00:00.000Z',
    },
  ];
}

export function getDemoAuditLogs(): AuditLogEntry[] {
  return g.__poolbuy_audit_logs || [];
}

export async function recordAdminAudit(entry: {
  action: string;
  targetType: 'POOL' | 'LEAD' | 'REQUEST' | 'CITY' | 'CATEGORY' | 'CONFIG';
  targetId: string;
  adminIdentifier?: string;
  changesSummary: string;
  details?: Record<string, unknown> | null;
}): Promise<void> {
  const timestamp = new Date().toISOString();
  const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const adminIdentifier = entry.adminIdentifier || 'admin_session';

  if (isDemoMode()) {
    if (!g.__poolbuy_audit_logs) {
      g.__poolbuy_audit_logs = [];
    }
    g.__poolbuy_audit_logs.unshift({
      id,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      adminIdentifier,
      changesSummary: entry.changesSummary,
      details: entry.details || null,
      createdAt: timestamp,
    });
    return;
  }

  try {
    const supabase = getAdminSupabase();
    await supabase.from('admin_audit_logs').insert({
      id,
      action: entry.action,
      target_type: entry.targetType,
      target_id: entry.targetId,
      admin_identifier: adminIdentifier,
      changes_summary: entry.changesSummary,
      details: entry.details || null,
      created_at: timestamp,
    });
  } catch (err) {
    console.warn('Failed to persist admin audit log:', err);
  }
}
