-- Migration: 0006_location_requests.sql
-- Enables recording and administrative review of user-requested cities/locations

CREATE TABLE IF NOT EXISTS location_requests (
  id TEXT PRIMARY KEY,
  city_name TEXT NOT NULL,
  state_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  requested_by_phone TEXT,
  pool_request_id TEXT,
  admin_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_location_requests_status ON location_requests(status);
CREATE INDEX IF NOT EXISTS idx_location_requests_city_state ON location_requests(city_name, state_name);

