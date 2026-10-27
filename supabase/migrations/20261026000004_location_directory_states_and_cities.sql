-- ==============================================================================
-- POOLBUY INDIA — ADDITIVE MIGRATION: 28 STATES + 8 UTs LOCATION DIRECTORY
-- Migration ID: 20261026000004_location_directory_states_and_cities.sql
-- ==============================================================================

-- 1. Create normalized states table
create table if not exists states (
  code text primary key,
  name text not null,
  slug text not null unique,
  type text not null check (type in ('STATE', 'UNION_TERRITORY')),
  created_at timestamptz not null default now()
);

-- 2. Add columns to cities table
alter table cities
  add column if not exists state_code text references states(code),
  add column if not exists place_type text not null default 'CITY' check (place_type in ('CITY', 'TOWN', 'ISLAND_CENTRE', 'SERVICE_ZONE')),
  add column if not exists is_selectable boolean not null default true,
  add column if not exists availability_state text not null default 'NOT_YET_AVAILABLE' check (availability_state in ('ACTIVE', 'DEMAND_COLLECTING', 'NOT_YET_AVAILABLE', 'INACTIVE'));

create index if not exists idx_cities_availability on cities (availability_state, is_active);

-- 3. RLS for states
alter table states enable row level security;

create policy "Public can read states"
  on states for select
  using (true);

create policy "Service role manages states"
  on states for all
  using (auth.role() = 'service_role');
