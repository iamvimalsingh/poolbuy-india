-- ==============================================================================
-- POOLBUY INDIA — ADDITIVE MIGRATION: FIXED KITS, PRICE TIERS & POOL LIFECYCLE
-- Migration ID: 20261026000003_fixed_kits_and_price_tiers.sql
-- ==============================================================================

-- 1. Additive lifecycle and archive fields on pools
alter table pools
  add column if not exists closed_at timestamptz,
  add column if not exists closure_reason text check (closure_reason is null or closure_reason in (
    'ADMIN_CLOSED',
    'AUTO_POOL_EXPIRED',
    'ADMIN_EXPIRED',
    'AUTO_OFFER_EXPIRED',
    'OFFER_EXPIRED',
    'VENDOR_UNAVAILABLE',
    'SUPPLIER_WITHDRAWN',
    'TARGET_ACHIEVED',
    'MANUAL_CLOSE',
    'OTHER'
  )),
  add column if not exists offer_valid_until timestamptz,
  add column if not exists is_archived boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text,
  add column if not exists deletion_reason text;

create index if not exists idx_pools_lifecycle on pools (status, is_archived, deleted_at, deadline);

-- 2. Predefined brand-kit packages for standardized pool offerings
create table if not exists pool_kit_offers (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  name text not null,
  sku text not null,
  brand text not null,
  model text not null,
  inclusions jsonb not null default '[]'::jsonb,
  exclusions jsonb not null default '[]'::jsonb,
  warranty text not null default '',
  market_price numeric(12, 2) not null check (market_price >= 0),
  group_price numeric(12, 2) not null check (group_price >= 0),
  subsidy_estimate numeric(12, 2) check (subsidy_estimate >= 0),
  subsidy_disclaimer text,
  target_buyers integer not null default 10 check (target_buyers > 0),
  current_buyers integer not null default 0 check (current_buyers >= 0),
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pool_kit_offers_pool on pool_kit_offers (pool_id, sort_order);

-- 3. Pre-approved vendor volume discount tiers
create table if not exists vendor_price_tiers (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  kit_offer_id uuid references pool_kit_offers(id) on delete set null,
  min_quantity integer not null check (min_quantity > 0),
  max_quantity integer check (max_quantity is null or max_quantity >= min_quantity),
  price_per_unit numeric(12, 2) not null check (price_per_unit >= 0),
  vendor_name text not null,
  valid_until timestamptz not null,
  is_approved boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_vendor_price_tiers_pool on vendor_price_tiers (pool_id, min_quantity);

-- 4. Auditable quote history
create table if not exists pool_price_history (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  kit_offer_id uuid references pool_kit_offers(id) on delete set null,
  vendor_name text not null,
  quoted_market_price numeric(12, 2) not null check (quoted_market_price >= 0),
  quoted_group_price numeric(12, 2) not null check (quoted_group_price >= 0),
  minimum_cohort_size integer not null default 5 check (minimum_cohort_size > 0),
  status text not null check (status in ('APPROVED', 'PENDING_REVIEW', 'EXPIRED', 'REJECTED')),
  recorded_at timestamptz not null default now(),
  notes text
);

create index if not exists idx_pool_price_history_pool on pool_price_history (pool_id, recorded_at desc);

-- 5. Add selected kit to pool_leads
alter table public.pool_leads
  add column if not exists selected_kit_offer_id uuid references pool_kit_offers(id) on delete set null,
  add column if not exists selected_kit_name text;

create index if not exists idx_pool_leads_kit on public.pool_leads (selected_kit_offer_id);

-- 6. RLS Policies
alter table pool_kit_offers enable row level security;
alter table vendor_price_tiers enable row level security;
alter table pool_price_history enable row level security;

-- Public can read available kit offers
create policy "Public can view available kit offers"
  on pool_kit_offers for select
  using (is_available = true);

-- Public can read approved vendor price tiers
create policy "Public can view approved price tiers"
  on vendor_price_tiers for select
  using (is_approved = true);

-- Service role full access
create policy "Service role manages pool kit offers"
  on pool_kit_offers for all
  using (auth.role() = 'service_role');

create policy "Service role manages vendor price tiers"
  on vendor_price_tiers for all
  using (auth.role() = 'service_role');

create policy "Service role manages price history"
  on pool_price_history for all
  using (auth.role() = 'service_role');

-- 7. Add V3 buying timeline enum values
alter type public.buying_timeline add value if not exists 'THIS_MONTH';
alter type public.buying_timeline add value if not exists 'WITHIN_1_3_MONTHS';
alter type public.buying_timeline add value if not exists 'WITHIN_3_6_MONTHS';
alter type public.buying_timeline add value if not exists 'JUST_EXPLORING';

-- 8. Update join_pool RPC to support selected_kit_offer_id and all timeline values
create or replace function public.join_pool(
  p_pool_id uuid,
  p_full_name text,
  p_whatsapp_number text,
  p_city text,
  p_buying_timeline text,
  p_has_existing_quote boolean default false,
  p_existing_quote_amount numeric default null,
  p_extra_message text default '',
  p_selected_kit_offer_id uuid default null
)
returns table (
  lead_id uuid,
  buyer_number integer,
  current_buyers integer,
  target_buyers integer,
  remaining_buyers integer,
  already_joined boolean,
  pool_status public.pool_status
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pool public.pools%rowtype;
  v_existing public.pool_leads%rowtype;
  v_new_lead_id uuid;
  v_buyer_number integer;
  v_current_buyers integer;
  v_kit_name text := null;
begin
  if p_pool_id is null then
    raise exception 'INVALID_POOL' using errcode = '22023';
  end if;
  if p_full_name is null or char_length(trim(p_full_name)) not between 2 and 100 then
    raise exception 'INVALID_NAME' using errcode = '22023';
  end if;
  if p_whatsapp_number is null or p_whatsapp_number !~ '^[6-9][0-9]{9}$' then
    raise exception 'INVALID_INDIAN_MOBILE' using errcode = '22023';
  end if;
  if p_city is null or char_length(trim(p_city)) not between 2 and 80 then
    raise exception 'INVALID_CITY' using errcode = '22023';
  end if;
  if p_buying_timeline is null or p_buying_timeline not in (
    'THIS_MONTH', 'WITHIN_1_3_MONTHS', 'WITHIN_3_6_MONTHS', 'JUST_EXPLORING',
    'WITHIN_7_DAYS', 'WITHIN_15_DAYS', 'WITHIN_30_45_DAYS'
  ) then
    raise exception 'INVALID_BUYING_TIMELINE' using errcode = '22023';
  end if;
  if p_existing_quote_amount is not null and p_existing_quote_amount < 0 then
    raise exception 'INVALID_QUOTE_AMOUNT' using errcode = '22023';
  end if;
  if coalesce(char_length(p_extra_message), 0) > 1000 then
    raise exception 'MESSAGE_TOO_LONG' using errcode = '22023';
  end if;
  if coalesce(p_has_existing_quote, false) = false and p_existing_quote_amount is not null then
    raise exception 'QUOTE_AMOUNT_REQUIRES_QUOTE_FLAG' using errcode = '22023';
  end if;

  -- Serializes joins for a given pool before the duplicate check and trigger increment.
  select * into v_pool
    from public.pools
   where id = p_pool_id
   for update;

  if not found then
    raise exception 'POOL_NOT_FOUND' using errcode = 'P0002';
  end if;

  if lower(trim(p_city)) <> lower(trim(v_pool.city)) then
    raise exception 'CITY_MUST_MATCH_POOL' using errcode = '22023';
  end if;

  select * into v_existing
    from public.pool_leads l
   where l.pool_id = p_pool_id
     and l.whatsapp_number = p_whatsapp_number;

  if found then
    return query
      select v_existing.id, v_existing.buyer_number, v_pool.current_buyers,
             v_pool.target_buyers,
             greatest(v_pool.target_buyers - v_pool.current_buyers, 0),
             true, v_pool.status;
    return;
  end if;

  if v_pool.status <> 'ACTIVE' or v_pool.deadline <= now() then
    raise exception 'POOL_NOT_OPEN' using errcode = 'P0001';
  end if;

  -- If kit offer provided, lookup kit name
  if p_selected_kit_offer_id is not null then
    select name into v_kit_name from public.pool_kit_offers where id = p_selected_kit_offer_id and pool_id = p_pool_id;
  end if;

  insert into public.pool_leads as inserted (
    pool_id, buyer_number, full_name, whatsapp_number, city,
    buying_timeline, has_existing_quote, existing_quote_amount,
    extra_message, consent_at, selected_kit_offer_id, selected_kit_name
  ) values (
    p_pool_id, 1, trim(p_full_name), p_whatsapp_number, trim(p_city),
    p_buying_timeline::public.buying_timeline,
    coalesce(p_has_existing_quote, false), p_existing_quote_amount,
    coalesce(trim(p_extra_message), ''), now(),
    p_selected_kit_offer_id, v_kit_name
  ) returning inserted.id, inserted.buyer_number
    into v_new_lead_id, v_buyer_number;

  select p.current_buyers, p.target_buyers, p.status
    into v_current_buyers, v_pool.target_buyers, v_pool.status
    from public.pools p
   where p.id = p_pool_id;

  return query
    select v_new_lead_id, v_buyer_number, v_current_buyers,
           v_pool.target_buyers,
           greatest(v_pool.target_buyers - v_current_buyers, 0),
           false, v_pool.status;
end;
$$;
