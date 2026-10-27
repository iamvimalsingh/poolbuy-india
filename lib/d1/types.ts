/**
 * Cloudflare D1 Database TypeScript declarations.
 * Provides type-safety for D1 SQLite operations without polluting the global DOM fetch types.
 */

export interface D1Meta {
  changes?: number;
  duration?: number;
  last_row_id?: number;
  served_by?: string;
  queries_executed?: number;
  rows_read?: number;
  rows_written?: number;
  size_after?: number;
  changed_db?: boolean;
}

export interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
  meta: D1Meta;
  error?: string;
}

export interface D1ExecResult {
  count: number;
  duration: number;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
  dump?(): Promise<ArrayBuffer>;
}

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    ADMIN_PASSKEY?: string;
    ADMIN_SESSION_SECRET?: string;
    CRON_SECRET?: string;
  }
}
