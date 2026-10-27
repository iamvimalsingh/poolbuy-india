-- ==============================================================================
-- PoolBuy India — Phase C: Dynamic Categories, Standard Products & Pool Requests
-- Migration: 20261026000002_dynamic_categories_and_pool_requests.sql
-- ==============================================================================

-- 1. Create persistent categories table for runtime catalog management
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  label text not null check (char_length(trim(label)) between 2 and 80),
  description text not null default '' check (char_length(description) <= 500),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for public active categories lookup sorted by sort_order
create index if not exists categories_active_sort_idx
  on public.categories (sort_order) where is_active = true;

-- Enable RLS on categories
alter table public.categories enable row level security;

-- Public read policy for active categories
drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories
for select to anon, authenticated
using (is_active = true);

grant select on public.categories to anon, authenticated;
grant all on public.categories to service_role;

-- Seed the initial 6 catalog categories idempotently
insert into public.categories (slug, label, description, is_active, sort_order) values
  ('ev-scooters', 'Electric Scooters', 'Bulk buying for top 2W electric vehicles and high-speed commuters.', true, 1),
  ('cars', 'Cars & SUVs', 'City-level group quotations for personal and family passenger cars.', true, 2),
  ('rooftop-solar', 'Rooftop Solar', 'Residential rooftop solar installations with DISCOM subsidy guidance.', true, 3),
  ('laptops', 'Laptops & MacBooks', 'Direct corporate and student group deals on premium laptops.', true, 4),
  ('smart-tvs', 'Smart TVs', 'Large-screen 4K and QLED television group purchases.', true, 5),
  ('tractors-commercial', 'Tractors & Commercial', 'Agricultural equipment and commercial vehicle pooling.', true, 6)
on conflict (slug) do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order;

-- Maintain updated_at trigger on categories
drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at before update on public.categories
for each row execute function public.set_updated_at();

-- 2. Create standard_products table for reusable standardized product definitions
create table if not exists public.standard_products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 180),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category_slug text not null references public.categories(slug) on update cascade,
  brand text not null check (char_length(trim(brand)) between 1 and 80),
  model text not null check (char_length(trim(model)) between 1 and 80),
  short_description text not null default '',
  long_description text not null default '',
  default_market_price numeric check (default_market_price is null or default_market_price >= 0),
  default_group_price numeric check (default_group_price is null or default_group_price >= 0),
  default_target_buyers integer not null default 10 check (default_target_buyers > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS on standard_products
alter table public.standard_products enable row level security;

-- Public read policy for active standard products
drop policy if exists standard_products_public_read on public.standard_products;
create policy standard_products_public_read on public.standard_products
for select to anon, authenticated
using (is_active = true);

grant select on public.standard_products to anon, authenticated;
grant all on public.standard_products to service_role;

-- Maintain updated_at trigger on standard_products
drop trigger if exists standard_products_set_updated_at on public.standard_products;
create trigger standard_products_set_updated_at before update on public.standard_products
for each row execute function public.set_updated_at();

-- 3. Add dynamic category_slug reference to pools table
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pools' and column_name = 'category_slug'
  ) then
    alter table public.pools add column category_slug text references public.categories(slug) on update cascade;
  end if;
end $$;

-- Backfill category_slug from category enum
update public.pools set category_slug = 'ev-scooters' where category = 'EV_SCOOTERS' and category_slug is null;
update public.pools set category_slug = 'cars' where category = 'CARS' and category_slug is null;
update public.pools set category_slug = 'rooftop-solar' where category = 'ROOFTOP_SOLAR' and category_slug is null;
update public.pools set category_slug = 'laptops' where category = 'LAPTOPS' and category_slug is null;
update public.pools set category_slug = 'smart-tvs' where category = 'SMART_TVS' and category_slug is null;
update public.pools set category_slug = 'tractors-commercial' where category = 'TRACTORS_COMMERCIAL' and category_slug is null;

create index if not exists pools_category_slug_idx on public.pools (category_slug, status, deadline);

-- 4. Enhance pool_requests table with dynamic category, preferences, and conversion tracking
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_requests' and column_name = 'category_name'
  ) then
    alter table public.pool_requests add column category_name text check (
      category_name is null or char_length(trim(category_name)) between 2 and 100
    );
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_requests' and column_name = 'brand_preference'
  ) then
    alter table public.pool_requests add column brand_preference text check (
      brand_preference is null or char_length(trim(brand_preference)) <= 100
    );
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_requests' and column_name = 'model_preference'
  ) then
    alter table public.pool_requests add column model_preference text check (
      model_preference is null or char_length(trim(model_preference)) <= 100
    );
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_requests' and column_name = 'admin_notes'
  ) then
    alter table public.pool_requests add column admin_notes text not null default '' check (
      char_length(admin_notes) <= 2000
    );
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_requests' and column_name = 'resulting_pool_id'
  ) then
    alter table public.pool_requests add column resulting_pool_id uuid references public.pools(id) on delete set null;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_requests' and column_name = 'conversion_status'
  ) then
    alter table public.pool_requests add column conversion_status text not null default 'PENDING' check (
      conversion_status in ('PENDING', 'CONVERTED', 'DISMISSED')
    );
  end if;
end $$;

create index if not exists pool_requests_conversion_idx on public.pool_requests (conversion_status, created_at desc);
create index if not exists pool_requests_resulting_pool_idx on public.pool_requests (resulting_pool_id);

-- 5. Update submit_pool_request RPC: support unlisted/custom categories without invalid enum-cast failure
create or replace function public.submit_pool_request(
  p_product_name text,
  p_city text,
  p_category text default null,
  p_full_name text default null,
  p_whatsapp_number text default null,
  p_extra_message text default '',
  p_brand_preference text default null,
  p_model_preference text default null,
  p_category_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_category public.pool_category := null;
  v_category_name text := trim(p_category_name);
  v_phone text := nullif(trim(p_whatsapp_number), '');
  v_id uuid;
begin
  if p_product_name is null or char_length(trim(p_product_name)) < 2 or char_length(trim(p_product_name)) > 180 then
    raise exception 'INVALID_PRODUCT_NAME' using errcode = '22023';
  end if;
  if p_city is null or char_length(trim(p_city)) < 2 or char_length(trim(p_city)) > 80 then
    raise exception 'INVALID_CITY' using errcode = '22023';
  end if;
  if p_full_name is not null and trim(p_full_name) <> '' and (char_length(trim(p_full_name)) < 2 or char_length(trim(p_full_name)) > 100) then
    raise exception 'INVALID_NAME' using errcode = '22023';
  end if;
  if v_phone is not null and v_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'INVALID_INDIAN_MOBILE' using errcode = '22023';
  end if;
  if coalesce(char_length(p_extra_message), 0) > 1000 then
    raise exception 'MESSAGE_TOO_LONG' using errcode = '22023';
  end if;

  -- Safe category resolution: attempt enum cast, fallback to category_name if unlisted
  if p_category is not null and trim(p_category) <> '' then
    begin
      v_category := trim(p_category)::public.pool_category;
    exception when invalid_text_representation then
      v_category := null;
      if v_category_name is null or v_category_name = '' then
        v_category_name := trim(p_category);
      end if;
    end;
  end if;

  insert into public.pool_requests (
    product_name, category, category_name, city, full_name, whatsapp_number, extra_message,
    brand_preference, model_preference
  ) values (
    trim(p_product_name), v_category, nullif(v_category_name, ''), trim(p_city),
    nullif(trim(p_full_name), ''), v_phone, coalesce(trim(p_extra_message), ''),
    nullif(trim(p_brand_preference), ''), nullif(trim(p_model_preference), '')
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_pool_request(text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_pool_request(text, text, text, text, text, text, text, text, text) to anon, authenticated;
