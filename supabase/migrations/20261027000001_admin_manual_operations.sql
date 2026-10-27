-- ==============================================================================
-- GroupBuying / PoolBuy India — Stage 3 Admin Manual Operations Migration
-- Migration: 20261027000001_admin_manual_operations.sql
-- ==============================================================================

-- 1. Create pool_waitlist table for FIFO waitlist capacity management
create table if not exists public.pool_waitlist (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete restrict,
  sequence_number integer not null,
  full_name text not null check (char_length(trim(full_name)) between 2 and 100),
  whatsapp_number text not null check (whatsapp_number ~ '^[6-9][0-9]{9}$'),
  city text not null check (char_length(trim(city)) between 2 and 80),
  buying_timeline text,
  locality text,
  pin_code text,
  status text not null default 'WAITING' check (status in (
    'WAITING', 'INVITED', 'ACCEPTED_PROMOTION', 'DECLINED', 'EXPIRED', 'PROMOTED', 'REMOVED'
  )),
  invited_at timestamptz,
  invitation_expires_at timestamptz,
  response_at timestamptz,
  promoted_at timestamptz,
  promoted_lead_id uuid references public.pool_leads(id),
  removal_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pool_waitlist_unique_buyer unique (pool_id, whatsapp_number)
);

create index if not exists pool_waitlist_pool_seq_idx
  on public.pool_waitlist (pool_id, sequence_number);

create index if not exists pool_waitlist_status_idx
  on public.pool_waitlist (status, created_at asc);

alter table public.pool_waitlist enable row level security;

-- Strictly server-only. No public queries to waitlist.
drop policy if exists pool_waitlist_service_role on public.pool_waitlist;
create policy pool_waitlist_service_role on public.pool_waitlist
  for all to service_role
  using (true)
  with check (true);

grant all on public.pool_waitlist to service_role;


-- 2. Create pool_quotations table for quotation lifecycle and pricing history
create table if not exists public.pool_quotations (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete restrict,
  price_type text not null default 'VENDOR_QUOTED' check (price_type in ('ESTIMATED', 'VENDOR_QUOTED')),
  vendor_name text not null check (char_length(trim(vendor_name)) between 2 and 180),
  vendor_contact_ref text,
  quoted_amount numeric not null check (quoted_amount > 0),
  currency text not null default 'INR',
  quote_date date not null default current_date,
  valid_until timestamptz not null,
  scope text not null check (char_length(trim(scope)) >= 5),
  inclusions jsonb not null default '[]'::jsonb,
  exclusions jsonb not null default '[]'::jsonb,
  delivery_terms text,
  quantity_condition text,
  status text not null default 'RECEIVED' check (status in (
    'NOT_REQUESTED', 'REQUESTED', 'RECEIVED', 'PUBLISHED', 'EXPIRED', 'WITHDRAWN'
  )),
  is_current_published boolean not null default false,
  verified_by_admin text,
  verified_at timestamptz,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pool_quotations_pool_idx
  on public.pool_quotations (pool_id, created_at desc);

create index if not exists pool_quotations_status_idx
  on public.pool_quotations (status, is_current_published);

alter table public.pool_quotations enable row level security;

-- Strictly server-only. No public queries to private quotation details or vendor contacts.
drop policy if exists pool_quotations_service_role on public.pool_quotations;
create policy pool_quotations_service_role on public.pool_quotations
  for all to service_role
  using (true)
  with check (true);

grant all on public.pool_quotations to service_role;


-- 3. Additive columns to public.pool_leads for member decision, fee and connection operations
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'quote_response'
  ) then
    alter table public.pool_leads add column quote_response text
      check (quote_response in ('NOT_SENT', 'AWAITING_RESPONSE', 'INTERESTED', 'DECLINED', 'NEEDS_INFORMATION', 'NO_RESPONSE'));
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'quote_response_notes'
  ) then
    alter table public.pool_leads add column quote_response_notes text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'quote_response_recorded_at'
  ) then
    alter table public.pool_leads add column quote_response_recorded_at timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'fee_status'
  ) then
    alter table public.pool_leads add column fee_status text not null default 'NOT_REQUESTED'
      check (fee_status in (
        'NOT_APPLICABLE', 'NOT_REQUESTED', 'DISCLOSED_PENDING', 'PAYMENT_REPORTED', 'PAID_VERIFIED', 'WAIVED', 'REFUNDED', 'CANCELLED'
      ));
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'fee_rule_version'
  ) then
    alter table public.pool_leads add column fee_rule_version text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'fee_approved_basis'
  ) then
    alter table public.pool_leads add column fee_approved_basis numeric;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'fee_calculated_amount'
  ) then
    alter table public.pool_leads add column fee_calculated_amount numeric;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'fee_disclosed_amount'
  ) then
    alter table public.pool_leads add column fee_disclosed_amount numeric;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'fee_disclosed_at'
  ) then
    alter table public.pool_leads add column fee_disclosed_at timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'payment_reference'
  ) then
    alter table public.pool_leads add column payment_reference text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'payment_reported_at'
  ) then
    alter table public.pool_leads add column payment_reported_at timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'payment_verified_by'
  ) then
    alter table public.pool_leads add column payment_verified_by text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'payment_verified_at'
  ) then
    alter table public.pool_leads add column payment_verified_at timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'payment_waiver_reason'
  ) then
    alter table public.pool_leads add column payment_waiver_reason text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'member_connection_status'
  ) then
    alter table public.pool_leads add column member_connection_status text not null default 'NOT_READY'
      check (member_connection_status in (
        'NOT_READY', 'OPTED_IN', 'WAITING_FOR_FEE', 'ELIGIBLE_TO_CONNECT', 'CONNECTED', 'OPTED_OUT', 'EXCLUDED'
      ));
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'connection_date'
  ) then
    alter table public.pool_leads add column connection_date timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'connection_method'
  ) then
    alter table public.pool_leads add column connection_method text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'exclusion_reason'
  ) then
    alter table public.pool_leads add column exclusion_reason text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'excluded_at'
  ) then
    alter table public.pool_leads add column excluded_at timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'last_contact_at'
  ) then
    alter table public.pool_leads add column last_contact_at timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'last_contact_status'
  ) then
    alter table public.pool_leads add column last_contact_status text
      check (last_contact_status in ('LINK_GENERATED', 'SENT'));
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_leads' and column_name = 'last_contact_note'
  ) then
    alter table public.pool_leads add column last_contact_note text;
  end if;
end $$;
