-- ==============================================================================
-- GroupBuying / PoolBuy India — V3.1 MVP Amendment Schema Migration
-- Migration: 20261027000000_mvp_community_groupbuying.sql
-- ==============================================================================

-- 1. Create admin_audit_logs table for tracking administrative lifecycle, quotes & CRM actions
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null check (char_length(trim(action)) between 2 and 100),
  target_type text not null check (target_type in ('POOL', 'LEAD', 'REQUEST', 'QUOTE', 'CATEGORY', 'LOCATION', 'BLOG')),
  target_id text not null,
  actor text not null default 'admin',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_target_idx
  on public.admin_audit_logs (target_type, target_id, created_at desc);

create index if not exists admin_audit_logs_action_idx
  on public.admin_audit_logs (action, created_at desc);

alter table public.admin_audit_logs enable row level security;

-- Audit logs are strictly server-only. No public reads or writes.
drop policy if exists admin_audit_logs_service_role on public.admin_audit_logs;
create policy admin_audit_logs_service_role on public.admin_audit_logs
  for all to service_role
  using (true)
  with check (true);

grant all on public.admin_audit_logs to service_role;

-- 2. Additive columns to public.pools for lifecycle, publishing, quote classification & connection
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pools' and column_name = 'is_published'
  ) then
    alter table public.pools add column is_published boolean not null default true;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pools' and column_name = 'market_price_type'
  ) then
    alter table public.pools add column market_price_type text not null default 'INDICATIVE_ESTIMATE'
      check (market_price_type in ('UNKNOWN', 'INDICATIVE_ESTIMATE', 'SOURCED_REFERENCE', 'VERIFIED_COMPARABLE'));
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pools' and column_name = 'group_price_type'
  ) then
    alter table public.pools add column group_price_type text not null default 'INDICATIVE_ESTIMATE'
      check (group_price_type in ('UNKNOWN', 'INDICATIVE_ESTIMATE', 'VENDOR_QUOTED', 'VENDOR_VERIFIED', 'EXPIRED_WITHDRAWN'));
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pools' and column_name = 'target_reached_at'
  ) then
    alter table public.pools add column target_reached_at timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pools' and column_name = 'target_reached_acknowledged_at'
  ) then
    alter table public.pools add column target_reached_acknowledged_at timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pools' and column_name = 'connection_status'
  ) then
    alter table public.pools add column connection_status text not null default 'NOT_ELIGIBLE'
      check (connection_status in (
        'NOT_ELIGIBLE', 'ADMIN_REVIEW_PENDING', 'TERMS_PENDING',
        'PAYMENT_LINK_CONFIGURED', 'PAYMENT_PENDING', 'READY_TO_CONNECT', 'COMPLETED', 'CANCELLED'
      ));
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pools' and column_name = 'payment_config_state'
  ) then
    alter table public.pools add column payment_config_state text not null default 'DISABLED'
      check (payment_config_state in ('DISABLED', 'MANUAL_NO_CHARGE', 'EXTERNAL_LINK_CONFIGURED', 'RECONCILED'));
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pools' and column_name = 'connection_notes'
  ) then
    alter table public.pools add column connection_notes text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pools' and column_name = 'quote_source'
  ) then
    alter table public.pools add column quote_source text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pools' and column_name = 'quote_date'
  ) then
    alter table public.pools add column quote_date timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pools' and column_name = 'quote_valid_until'
  ) then
    alter table public.pools add column quote_valid_until timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pools' and column_name = 'quote_scope'
  ) then
    alter table public.pools add column quote_scope text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pools' and column_name = 'quote_private_notes'
  ) then
    alter table public.pools add column quote_private_notes text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pools' and column_name = 'savings_display_approved'
  ) then
    alter table public.pools add column savings_display_approved boolean not null default false;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pools' and column_name = 'source_request_id'
  ) then
    alter table public.pools add column source_request_id uuid references public.pool_requests(id) on delete set null;
  end if;
end $$;

-- 3. Additive columns to public.pool_leads for consent and contact preferences
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'connection_opt_in'
  ) then
    alter table public.pool_leads add column connection_opt_in boolean not null default false;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'vendor_share_consent'
  ) then
    alter table public.pool_leads add column vendor_share_consent boolean not null default false;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'locality'
  ) then
    alter table public.pool_leads add column locality text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'pin_code'
  ) then
    alter table public.pool_leads add column pin_code text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'admin_notes'
  ) then
    alter table public.pool_leads add column admin_notes text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'do_not_contact'
  ) then
    alter table public.pool_leads add column do_not_contact boolean not null default false;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'contact_preference'
  ) then
    alter table public.pool_leads add column contact_preference text not null default 'WHATSAPP';
  end if;
end $$;

-- 4. Additive columns to public.pool_requests for group proposals
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_requests' and column_name = 'state'
  ) then
    alter table public.pool_requests add column state text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_requests' and column_name = 'locality'
  ) then
    alter table public.pool_requests add column locality text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_requests' and column_name = 'pin_code'
  ) then
    alter table public.pool_requests add column pin_code text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_requests' and column_name = 'requirements_summary'
  ) then
    alter table public.pool_requests add column requirements_summary text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_requests' and column_name = 'target_buyers_requested'
  ) then
    alter table public.pool_requests add column target_buyers_requested integer;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_requests' and column_name = 'requested_deadline'
  ) then
    alter table public.pool_requests add column requested_deadline timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_requests' and column_name = 'contact_consent'
  ) then
    alter table public.pool_requests add column contact_consent boolean not null default true;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_requests' and column_name = 'consent_at'
  ) then
    alter table public.pool_requests add column consent_at timestamptz default now();
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_requests' and column_name = 'request_type'
  ) then
    alter table public.pool_requests add column request_type text not null default 'GROUP_PROPOSAL'
      check (request_type in ('GROUP_PROPOSAL', 'PRODUCT_SUGGESTION'));
  end if;
end $$;

-- 5. Refresh public_pools view to only publish eligible, non-archived, non-deleted, published active pools
create or replace view public.public_pools with (security_invoker = true) as
select
  id,
  slug,
  name,
  short_description,
  long_description,
  category,
  city,
  city_slug,
  product_brand,
  product_model,
  image_url,
  market_price,
  group_price,
  target_buyers,
  current_buyers,
  deadline,
  status,
  closure_reason,
  closed_at,
  offer_valid_until,
  is_archived,
  deleted_at,
  price_is_verified,
  price_verified_at,
  created_at,
  updated_at,
  is_published,
  market_price_type,
  group_price_type,
  target_reached_at,
  connection_status,
  savings_display_approved,
  source_request_id
from public.pools
where is_published = true
  and (deleted_at is null)
  and (is_archived = false)
  and (status <> 'CLOSED');

grant select on public.public_pools to anon, authenticated;

-- 6. Updated join_pool RPC with target-reach milestone recording and over-join protection
create or replace function public.join_pool(
  p_pool_id uuid,
  p_full_name text,
  p_whatsapp_number text,
  p_city text,
  p_buying_timeline text default 'THIS_MONTH',
  p_has_existing_quote boolean default false,
  p_existing_quote_amount numeric default null,
  p_extra_message text default '',
  p_selected_kit_offer_id uuid default null,
  p_connection_opt_in boolean default false,
  p_vendor_share_consent boolean default false,
  p_locality text default null,
  p_pin_code text default null
)
returns table (
  lead_id uuid,
  buyer_number integer,
  current_buyers integer,
  target_buyers integer,
  remaining_buyers integer,
  already_joined boolean,
  pool_status public.pool_status,
  target_reached boolean
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
  v_target_reached boolean := false;
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
  if p_buying_timeline is not null and p_buying_timeline not in (
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

  -- Lock the pool row for atomic concurrency
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

  -- Check existing membership idempotently
  select * into v_existing
    from public.pool_leads l
   where l.pool_id = p_pool_id
     and l.whatsapp_number = p_whatsapp_number;

  if found then
    return query
      select v_existing.id, v_existing.buyer_number, v_pool.current_buyers,
             v_pool.target_buyers,
             greatest(v_pool.target_buyers - v_pool.current_buyers, 0),
             true, v_pool.status,
             (v_pool.current_buyers >= v_pool.target_buyers);
    return;
  end if;

  if v_pool.status <> 'ACTIVE' or v_pool.deadline <= now() then
    raise exception 'POOL_NOT_OPEN' using errcode = 'P0001';
  end if;

  -- Check if target is already reached and block over-joining
  if v_pool.current_buyers >= v_pool.target_buyers then
    update public.pools
       set target_reached_at = coalesce(target_reached_at, now()),
           updated_at = now()
     where id = p_pool_id;
    raise exception 'TARGET_REACHED' using errcode = 'P0003';
  end if;

  -- If kit offer provided, lookup kit name
  if p_selected_kit_offer_id is not null then
    select name into v_kit_name from public.pool_kit_offers where id = p_selected_kit_offer_id and pool_id = p_pool_id;
  end if;

  insert into public.pool_leads (
    pool_id, buyer_number, full_name, whatsapp_number, city,
    buying_timeline, has_existing_quote, existing_quote_amount,
    extra_message, consent_at, selected_kit_offer_id, selected_kit_name,
    connection_opt_in, vendor_share_consent, locality, pin_code
  ) values (
    p_pool_id,
    v_pool.current_buyers + 1,
    trim(p_full_name),
    p_whatsapp_number,
    v_pool.city,
    coalesce(p_buying_timeline, 'THIS_MONTH')::public.buying_timeline,
    coalesce(p_has_existing_quote, false),
    p_existing_quote_amount,
    coalesce(trim(p_extra_message), ''),
    now(),
    p_selected_kit_offer_id,
    v_kit_name,
    coalesce(p_connection_opt_in, false),
    coalesce(p_vendor_share_consent, false),
    nullif(trim(p_locality), ''),
    nullif(trim(p_pin_code), '')
  ) returning id into v_new_lead_id;

  v_current_buyers := v_pool.current_buyers + 1;
  v_buyer_number := v_current_buyers;
  v_target_reached := (v_current_buyers >= v_pool.target_buyers);

  -- Record target reached on pool row when reached
  if v_target_reached and v_pool.target_reached_at is null then
    update public.pools
       set target_reached_at = now(),
           connection_status = 'ADMIN_REVIEW_PENDING',
           updated_at = now()
     where id = p_pool_id;
  end if;

  return query
    select v_new_lead_id, v_buyer_number, v_current_buyers,
           v_pool.target_buyers,
           greatest(v_pool.target_buyers - v_current_buyers, 0),
           false, v_pool.status, v_target_reached;
end;
$$;

revoke all on function public.join_pool(uuid, text, text, text, text, boolean, numeric, text, uuid, boolean, boolean, text, text) from public;
grant execute on function public.join_pool(uuid, text, text, text, text, boolean, numeric, text, uuid, boolean, boolean, text, text) to anon, authenticated;
