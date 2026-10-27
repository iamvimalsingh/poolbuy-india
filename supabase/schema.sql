-- PoolBuy India — initial schema for a fresh Supabase PostgreSQL project.
-- Price values in the seed section are illustrative only and are not dealer quotations.

create extension if not exists pgcrypto;

do $$ begin
  create type public.pool_category as enum (
    'EV_SCOOTERS',
    'CARS',
    'ROOFTOP_SOLAR',
    'LAPTOPS',
    'SMART_TVS',
    'TRACTORS_COMMERCIAL'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pool_status as enum (
    'ACTIVE',
    'UNLOCKED',
    'LEAD_FALLBACK',
    'CLOSED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.buying_timeline as enum (
    'WITHIN_7_DAYS',
    'WITHIN_15_DAYS',
    'WITHIN_30_45_DAYS'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pool_request_status as enum (
    'REQUESTED',
    'REVIEWING',
    'APPROVED',
    'REJECTED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_status as enum (
    'NEW',
    'CONTACTED',
    'QUALIFIED',
    'CONVERTED',
    'DO_NOT_CONTACT'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.pools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(trim(name)) between 3 and 180),
  short_description text not null default '' check (char_length(short_description) <= 300),
  long_description text not null default '' check (char_length(long_description) <= 10000),
  category public.pool_category not null,
  city text not null check (char_length(trim(city)) between 2 and 80),
  city_slug text not null check (city_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  product_brand text not null default '' check (char_length(product_brand) <= 100),
  product_model text not null default '' check (char_length(product_model) <= 150),
  image_url text,
  market_price numeric(12,2) check (market_price is null or market_price >= 0),
  group_price numeric(12,2) check (group_price is null or group_price >= 0),
  target_buyers integer not null default 10 check (target_buyers between 2 and 10000),
  current_buyers integer not null default 0 check (current_buyers >= 0),
  deadline timestamptz not null,
  status public.pool_status not null default 'ACTIVE',
  price_is_verified boolean not null default false,
  price_verified_at timestamptz,
  dealer_name text check (dealer_name is null or char_length(dealer_name) <= 180),
  token_amount numeric(8,2) check (token_amount is null or token_amount between 499 and 999),
  token_payment_url text,
  dealer_offer_url text,
  dealer_terms text check (dealer_terms is null or char_length(dealer_terms) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pool_group_price_not_above_market check (
    market_price is null or group_price is null or group_price <= market_price
  ),
  constraint verified_price_has_timestamp check (
    price_is_verified = false or price_verified_at is not null
  ),
  constraint token_link_requires_unlocked_pool check (
    token_payment_url is null or status = 'UNLOCKED'
  )
);

create table if not exists public.pool_leads (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete restrict,
  buyer_number integer not null check (buyer_number >= 1),
  full_name text not null check (char_length(trim(full_name)) between 2 and 100),
  whatsapp_number text not null check (whatsapp_number ~ '^[6-9][0-9]{9}$'),
  city text not null check (char_length(trim(city)) between 2 and 80),
  buying_timeline public.buying_timeline not null,
  has_existing_quote boolean not null default false,
  existing_quote_amount numeric(12,2) check (existing_quote_amount is null or existing_quote_amount >= 0),
  extra_message text not null default '' check (char_length(extra_message) <= 1000),
  status public.lead_status not null default 'NEW',
  consent_at timestamptz not null default now(),
  privacy_notice_version text not null default '2026-10-26-v1' check (char_length(privacy_notice_version) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_pool_whatsapp unique (pool_id, whatsapp_number),
  constraint unique_pool_buyer_number unique (pool_id, buyer_number)
);

create table if not exists public.pool_requests (
  id uuid primary key default gen_random_uuid(),
  product_name text not null check (char_length(trim(product_name)) between 2 and 180),
  category public.pool_category,
  city text not null check (char_length(trim(city)) between 2 and 80),
  full_name text check (full_name is null or char_length(trim(full_name)) between 2 and 100),
  whatsapp_number text check (
    whatsapp_number is null or whatsapp_number = '' or whatsapp_number ~ '^[6-9][0-9]{9}$'
  ),
  extra_message text not null default '' check (char_length(extra_message) <= 1000),
  status public.pool_request_status not null default 'REQUESTED',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pools_public_listing_idx
  on public.pools (status, city_slug, category, deadline);
create index if not exists pools_city_status_idx
  on public.pools (city_slug, status, deadline);
create index if not exists pools_category_status_idx
  on public.pools (category, status, deadline);
create index if not exists pools_deadline_idx
  on public.pools (deadline) where status = 'ACTIVE';
create index if not exists pool_leads_pool_created_idx
  on public.pool_leads (pool_id, created_at desc);
create index if not exists pool_leads_city_timeline_idx
  on public.pool_leads (city, buying_timeline, has_existing_quote);
create index if not exists pool_leads_status_created_idx
  on public.pool_leads (status, created_at desc);
create index if not exists pool_requests_status_created_idx
  on public.pool_requests (status, created_at desc);
create index if not exists pool_requests_city_idx
  on public.pool_requests (city);

-- Keep updated_at consistent for administrative edits.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists pools_set_updated_at on public.pools;
create trigger pools_set_updated_at before update on public.pools
for each row execute function public.set_updated_at();

drop trigger if exists pool_leads_set_updated_at on public.pool_leads;
create trigger pool_leads_set_updated_at before update on public.pool_leads
for each row execute function public.set_updated_at();

drop trigger if exists pool_requests_set_updated_at on public.pool_requests;
create trigger pool_requests_set_updated_at before update on public.pool_requests
for each row execute function public.set_updated_at();

-- Assign buyer_number and increment the aggregate counter in the same transaction as the insert.
-- The join RPC locks/checks the pool before inserting, which prevents duplicate requests from
-- incrementing this count twice. Do not grant direct anonymous INSERT access to pool_leads.
create or replace function public.assign_pool_buyer_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next_count integer;
begin
  update public.pools
     set current_buyers = current_buyers + 1,
         updated_at = now()
   where id = new.pool_id
     and status = 'ACTIVE'
     and deadline > now()
  returning current_buyers into v_next_count;

  if not found then
    raise exception 'POOL_NOT_OPEN' using errcode = 'P0001';
  end if;

  new.buyer_number := v_next_count;
  return new;
end;
$$;

drop trigger if exists pool_leads_assign_buyer_number on public.pool_leads;
create trigger pool_leads_assign_buyer_number
before insert on public.pool_leads
for each row execute function public.assign_pool_buyer_number();

-- Expose safe columns only. Never include token_payment_url, dealer_offer_url, dealer_terms,
-- or other admin-only fields in this view.
create or replace view public.public_pools
with (security_invoker = true)
as
select
  id, slug, name, short_description, long_description, category,
  city, city_slug, product_brand, product_model, image_url,
  market_price, group_price, target_buyers, current_buyers,
  deadline, status, price_is_verified, price_verified_at,
  created_at, updated_at
from public.pools
where status in ('ACTIVE', 'UNLOCKED');

-- Explicit schema usage keeps the required public RPC/view surface available on fresh projects.
grant usage on schema public to anon, authenticated, service_role;

-- RLS is enabled on every table. Public users can read only the safe pool columns above.
alter table public.pools enable row level security;
alter table public.pool_leads enable row level security;
alter table public.pool_requests enable row level security;

drop policy if exists pools_public_read on public.pools;
create policy pools_public_read on public.pools
for select to anon, authenticated
using (status in ('ACTIVE', 'UNLOCKED'));

-- No anon/authenticated SELECT, INSERT, UPDATE or DELETE policies for pool_leads or pool_requests.
-- Admin access is server-mediated after a signed passkey session, through service-role helpers.

-- Column-level grants prevent a direct table query from revealing dealer/token private fields.
revoke all on public.pools from anon, authenticated;
grant select (
  id, slug, name, short_description, long_description, category,
  city, city_slug, product_brand, product_model, image_url,
  market_price, group_price, target_buyers, current_buyers,
  deadline, status, price_is_verified, price_verified_at,
  created_at, updated_at
) on public.pools to anon, authenticated;
grant select on public.public_pools to anon, authenticated;

revoke all on public.pool_leads from anon, authenticated;
revoke all on public.pool_requests from anon, authenticated;

-- RPC: validated, idempotent buyer interest submission. The result includes no buyer PII.
create or replace function public.join_pool(
  p_pool_id uuid,
  p_full_name text,
  p_whatsapp_number text,
  p_city text,
  p_buying_timeline text,
  p_has_existing_quote boolean default false,
  p_existing_quote_amount numeric default null,
  p_extra_message text default ''
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
  if p_buying_timeline is null or p_buying_timeline not in ('WITHIN_7_DAYS', 'WITHIN_15_DAYS', 'WITHIN_30_45_DAYS') then
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

  insert into public.pool_leads as inserted (
    pool_id, buyer_number, full_name, whatsapp_number, city,
    buying_timeline, has_existing_quote, existing_quote_amount,
    extra_message, consent_at
  ) values (
    p_pool_id, 1, trim(p_full_name), p_whatsapp_number, trim(p_city),
    p_buying_timeline::public.buying_timeline,
    coalesce(p_has_existing_quote, false), p_existing_quote_amount,
    coalesce(trim(p_extra_message), ''), now()
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

-- RPC: a public demand-discovery submission. It returns only the new request UUID.
create or replace function public.submit_pool_request(
  p_product_name text,
  p_city text,
  p_category text default null,
  p_full_name text default null,
  p_whatsapp_number text default null,
  p_extra_message text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_category public.pool_category;
  v_phone text := nullif(trim(coalesce(p_whatsapp_number, '')), '');
begin
  if p_product_name is null or char_length(trim(p_product_name)) not between 2 and 180 then
    raise exception 'INVALID_PRODUCT_NAME' using errcode = '22023';
  end if;
  if p_city is null or char_length(trim(p_city)) not between 2 and 80 then
    raise exception 'INVALID_CITY' using errcode = '22023';
  end if;
  if p_full_name is not null and trim(p_full_name) <> '' and char_length(trim(p_full_name)) not between 2 and 100 then
    raise exception 'INVALID_NAME' using errcode = '22023';
  end if;
  if v_phone is not null and v_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'INVALID_INDIAN_MOBILE' using errcode = '22023';
  end if;
  if coalesce(char_length(p_extra_message), 0) > 1000 then
    raise exception 'MESSAGE_TOO_LONG' using errcode = '22023';
  end if;

  if p_category is not null and trim(p_category) <> '' then
    begin
      v_category := trim(p_category)::public.pool_category;
    exception when invalid_text_representation then
      raise exception 'INVALID_CATEGORY' using errcode = '22023';
    end;
  end if;

  insert into public.pool_requests (
    product_name, category, city, full_name, whatsapp_number, extra_message
  ) values (
    trim(p_product_name), v_category, trim(p_city), nullif(trim(p_full_name), ''),
    v_phone, coalesce(trim(p_extra_message), '')
  ) returning id into v_id;

  return v_id;
end;
$$;

-- Public role gets execute access only to these validated RPCs.
revoke all on function public.join_pool(uuid, text, text, text, text, boolean, numeric, text) from public;
revoke all on function public.submit_pool_request(text, text, text, text, text, text) from public;
grant execute on function public.join_pool(uuid, text, text, text, text, boolean, numeric, text) to anon, authenticated;
grant execute on function public.submit_pool_request(text, text, text, text, text, text) to anon, authenticated;

-- Service-role access is used exclusively from authenticated server Route Handlers.
grant all on public.pools to service_role;
grant all on public.pool_leads to service_role;
grant all on public.pool_requests to service_role;
grant select on public.public_pools to service_role;

-- Six illustrative demo pools. These are NOT live, validated dealer offers.
-- current_buyers starts at zero to keep it consistent with the real lead table.
insert into public.pools (
  slug, name, short_description, long_description, category, city, city_slug,
  product_brand, product_model, image_url, market_price, group_price,
  target_buyers, current_buyers, deadline, status, price_is_verified
) values
(
  'tvs-iqube-electric-scooter-bulk-deal', 'TVS iQube Electric Scooter',
  'Explore a possible city-level bulk-buy price for an electric scooter.',
  'Illustrative demo estimate only. Final on-road price, variant, insurance, registration, subsidy eligibility, dealer stock and any discount must be confirmed in writing by an authorized dealer.',
  'EV_SCOOTERS', 'Bhopal', 'bhopal', 'TVS', 'iQube', null,
  145000, 130000, 10, 0, now() + interval '10 days', 'ACTIVE', false
),
(
  'hyundai-exter-city-group-deal', 'Hyundai Exter — City Group Deal',
  'Register interest in a city-level group quotation for a compact SUV.',
  'Illustrative demo estimate only. Variant, fuel type, model year, registration, insurance, accessories and dealer terms determine the final quotation.',
  'CARS', 'Indore', 'indore', 'Hyundai', 'Exter', null,
  875000, 825000, 15, 0, now() + interval '12 days', 'ACTIVE', false
),
(
  '3kw-rooftop-solar-bulk-installation', '3 kW Rooftop Solar System',
  'Aggregate local interest for a residential rooftop solar installation quote.',
  'Illustrative demo estimate only. Actual system design, panels, inverter, structure, installation, net-metering, DISCOM rules and subsidy eligibility require survey and written quotation.',
  'ROOFTOP_SOLAR', 'Bhopal', 'bhopal', 'Multiple brands', '3 kW residential system', null,
  210000, 185000, 10, 0, now() + interval '14 days', 'ACTIVE', false
),
(
  'macbook-air-laptop-group-buy', 'MacBook Air — Laptop Group Buy',
  'Collect purchase intent for a bulk laptop quotation.',
  'Illustrative demo estimate only. Confirm exact model, chip, memory, storage, tax invoice, warranty and authorized reseller terms before relying on any price.',
  'LAPTOPS', 'Pune', 'pune', 'Apple', 'MacBook Air', null,
  104900, 96000, 15, 0, now() + interval '9 days', 'ACTIVE', false
),
(
  '55-inch-qled-smart-tv-group-deal', '55-inch QLED Smart TV',
  'Gather local demand for a 55-inch QLED television group quotation.',
  'Illustrative demo estimate only. Brand, model, refresh rate, panel specifications, installation and warranty vary; final dealer quotation is required.',
  'SMART_TVS', 'Delhi', 'delhi', 'Multiple brands', '55-inch QLED', null,
  72990, 64990, 10, 0, now() + interval '11 days', 'ACTIVE', false
),
(
  'mahindra-tractor-commercial-group-buy', 'Mahindra 575 DI XP Plus Tractor',
  'Explore bulk-buy demand for a farm tractor in the Banda region.',
  'Illustrative demo estimate only. Horsepower class, variant, implements, delivery, taxes, finance and dealer stock can change the final price. Do not advertise this estimate as an authorized quote.',
  'TRACTORS_COMMERCIAL', 'Banda', 'banda', 'Mahindra', '575 DI XP Plus', null,
  840000, 790000, 5, 0, now() + interval '15 days', 'ACTIVE', false
)
on conflict (slug) do nothing;
