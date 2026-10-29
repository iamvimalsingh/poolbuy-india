import { isDemoMode } from './data-mode';
import { getD1Database } from './d1/db';

export interface AuditLogEntry {
  id: string;
  action: string;
  targetType: 'POOL' | 'LEAD' | 'REQUEST' | 'CITY' | 'CATEGORY' | 'CONFIG' | 'QUOTE' | 'CAMPAIGN' | 'LOCATION_REQUEST';
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
  targetType: 'POOL' | 'LEAD' | 'REQUEST' | 'CITY' | 'CATEGORY' | 'CONFIG' | 'QUOTE' | 'CAMPAIGN' | 'LOCATION_REQUEST';
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
    const db = await getD1Database();
    if (!db) {
      console.warn('D1 database not available to record audit log');
      return;
    }

    const detailsJson = entry.details ? JSON.stringify(entry.details) : null;
    await db
      .prepare(
        'INSERT INTO admin_audit_logs (id, action, target_type, target_id, admin_identifier, changes_summary, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        id,
        entry.action,
        entry.targetType,
        entry.targetId,
        adminIdentifier,
        entry.changesSummary,
        detailsJson,
        timestamp
      )
      .run();
  } catch (err) {
    console.warn('Failed to persist admin audit log in D1:', err);
  }
}

export async function getAuditLogs(limit: number = 200): Promise<AuditLogEntry[]> {
  if (isDemoMode()) {
    return getDemoAuditLogs();
  }

  const db = await getD1Database();
  if (!db) return [];

  try {
    const { results } = await db
      .prepare('SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT ?')
      .bind(limit)
      .all<{
        id: string;
        action: string;
        target_type: string;
        target_id: string;
        admin_identifier: string;
        changes_summary: string;
        details: string | null;
        created_at: string;
      }>();

    type AuditRow = NonNullable<typeof results>[number];
    return (results || []).map((row: AuditRow) => {
      let parsedDetails: Record<string, unknown> | null = null;
      if (row.details) {
        try {
          parsedDetails = JSON.parse(row.details);
        } catch {
          parsedDetails = null;
        }
      }
      return {
        id: row.id,
        action: row.action,
        targetType: row.target_type as AuditLogEntry['targetType'],
        targetId: row.target_id,
        adminIdentifier: row.admin_identifier,
        changesSummary: row.changes_summary,
        details: parsedDetails,
        createdAt: row.created_at,
      };
    });
  } catch (err) {
    console.error('Failed to load audit logs from D1:', err);
    return [];
  }
}
