-- ==============================================================================
-- PoolBuy India — Phase B: Multi-City Catalog & City-Specific Pools Migration
-- Migration: 20261026000001_cities_and_multicity_pools.sql
-- ==============================================================================

-- 1. Create persistent cities directory table
create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  state text not null check (char_length(trim(state)) between 2 and 80),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for public active cities lookup
create index if not exists cities_active_slug_idx on public.cities (slug) where is_active = true;

-- Enable RLS on cities
alter table public.cities enable row level security;

-- Public read policy for active cities
drop policy if exists cities_public_read on public.cities;
create policy cities_public_read on public.cities
for select to anon, authenticated
using (is_active = true);

grant select on public.cities to anon, authenticated;

-- Seed initial operational cities idempotently
insert into public.cities (name, slug, state, is_active) values
  ('Bhopal', 'bhopal', 'Madhya Pradesh', true),
  ('Indore', 'indore', 'Madhya Pradesh', true),
  ('Pune', 'pune', 'Maharashtra', true),
  ('Delhi', 'delhi', 'Delhi NCR', true),
  ('Mumbai', 'mumbai', 'Maharashtra', true),
  ('Banda', 'banda', 'Uttar Pradesh', true),
  ('Jaipur', 'jaipur', 'Rajasthan', true)
on conflict (slug) do update set
  name = excluded.name,
  state = excluded.state,
  is_active = excluded.is_active;

-- 2. Relax pools table slug uniqueness from global unique to composite (city_slug, slug)
-- This allows the same standardized product slug (e.g. '3kw-rooftop-solar') in multiple cities.
do $$
begin
  alter table public.pools drop constraint if exists pools_slug_key;
exception when others then null;
end $$;

-- Add composite unique constraint
alter table public.pools drop constraint if exists pools_city_slug_pool_slug_key;
alter table public.pools add constraint pools_city_slug_pool_slug_key unique (city_slug, slug);

-- Index for deal route resolution by city_slug and slug
create index if not exists pools_city_slug_pool_slug_idx on public.pools (city_slug, slug);

-- Maintain updated_at trigger on cities
drop trigger if exists cities_set_updated_at on public.cities;
create trigger cities_set_updated_at before update on public.cities
for each row execute function public.set_updated_at();
