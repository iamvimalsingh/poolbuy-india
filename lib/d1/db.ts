if (typeof window !== 'undefined') {
  throw new Error('D1 database access is strictly server-only and cannot run on the client.');
}
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { D1Database } from './types';

// In-memory or injected DB for unit/integration testing environments
let testD1Database: D1Database | null = null;

export function setTestD1Database(db: D1Database | null): void {
  testD1Database = db;
}

export function getTestD1Database(): D1Database | null {
  return testD1Database;
}

/**
 * Resolves the active Cloudflare D1 Database binding "DB".
 * Server-side only. Prepared statements must be used for all user inputs.
 */
export async function getD1Database(): Promise<D1Database | null> {
  if (testD1Database) {
    return testD1Database;
  }

  try {
    const ctx = await getCloudflareContext({ async: true });
    if (ctx?.env?.DB) {
      return ctx.env.DB;
    }
  } catch {
    // getCloudflareContext throws if called outside of worker/platform proxy
  }

  // Check fallback globalThis (used by some test harnesses or proxies)
  const g = globalThis as unknown as { DB?: D1Database; env?: { DB?: D1Database } };
  if (g.DB) return g.DB;
  if (g.env?.DB) return g.env.DB;

  return null;
}

/**
 * Returns D1 database or throws if unavailable (fail-closed security).
 */
export async function requireD1Database(): Promise<D1Database> {
  const db = await getD1Database();
  if (!db) {
    throw new Error('D1 database binding "DB" is not available on this server.');
  }
  return db;
}
