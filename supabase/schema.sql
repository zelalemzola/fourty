-- Fourty Inventory & Sales Management System
-- Run this in the Supabase SQL Editor

-- Extensions
create extension if not exists "pgcrypto";

-- Enums
do $$ begin
  create type public.user_role as enum ('owner', 'storekeeper', 'subagent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.sale_channel as enum ('store', 'subagent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.batch_status as enum ('active', 'partially_returned', 'settled', 'overdue');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_type as enum (
    'sale', 'restock', 'low_stock', 'report', 'batch', 'settlement', 'user', 'system', 'audit'
  );
exception when duplicate_object then null; end $$;

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  phone text,
  role public.user_role not null default 'storekeeper',
  store_id uuid,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Stores
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  address text,
  city text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  drop constraint if exists profiles_store_id_fkey;
alter table public.profiles
  add constraint profiles_store_id_fkey
  foreign key (store_id) references public.stores(id) on delete set null;

-- Brands / products
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sku text unique,
  description text,
  carton_size int not null default 10,
  unit_price numeric(12,2) not null default 0,
  cost_price numeric(12,2) not null default 0,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Inventory per store per brand
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  quantity int not null default 0 check (quantity >= 0),
  min_stock int not null default 5 check (min_stock >= 0),
  updated_at timestamptz not null default now(),
  unique (store_id, brand_id)
);

-- Restock events
create table if not exists public.restocks (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  quantity int not null check (quantity > 0),
  unit_cost numeric(12,2),
  notes text,
  performed_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Subagent batches (stock taken from store)
create table if not exists public.subagent_batches (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  subagent_id uuid not null references public.profiles(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  quantity_taken int not null check (quantity_taken > 0),
  quantity_sold int not null default 0 check (quantity_sold >= 0),
  quantity_returned int not null default 0 check (quantity_returned >= 0),
  quantity_in_hand int generated always as (quantity_taken - quantity_sold - quantity_returned) stored,
  status public.batch_status not null default 'active',
  notes text,
  issued_by uuid not null references public.profiles(id),
  issued_at timestamptz not null default now(),
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity_sold + quantity_returned <= quantity_taken)
);

-- Sales
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  quantity int not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  total_amount numeric(12,2) not null,
  channel public.sale_channel not null default 'store',
  sold_by uuid not null references public.profiles(id),
  subagent_id uuid references public.profiles(id),
  batch_id uuid references public.subagent_batches(id),
  screenshot_url text not null,
  notes text,
  sold_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Daily store reports (aggregated / submitted)
create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  report_date date not null,
  total_sales_amount numeric(14,2) not null default 0,
  total_cartons_sold int not null default 0,
  total_transactions int not null default 0,
  notes text,
  submitted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (store_id, report_date)
);

-- In-app notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  type public.notification_type not null default 'system',
  link text,
  metadata jsonb default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Web push subscriptions
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

-- Audit log
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  actor_role public.user_role,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  store_id uuid references public.stores(id) on delete set null,
  details jsonb default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_store on public.profiles(store_id);
create index if not exists idx_inventory_store on public.inventory(store_id);
create index if not exists idx_inventory_brand on public.inventory(brand_id);
create index if not exists idx_sales_store_date on public.sales(store_id, sold_at desc);
create index if not exists idx_sales_sold_by on public.sales(sold_by);
create index if not exists idx_sales_subagent on public.sales(subagent_id);
create index if not exists idx_batches_subagent on public.subagent_batches(subagent_id, status);
create index if not exists idx_notifications_user on public.notifications(user_id, is_read, created_at desc);
create index if not exists idx_audit_created on public.audit_logs(created_at desc);
create index if not exists idx_restocks_store on public.restocks(store_id, created_at desc);

-- Updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_stores_updated on public.stores;
create trigger trg_stores_updated before update on public.stores
  for each row execute function public.set_updated_at();

drop trigger if exists trg_brands_updated on public.brands;
create trigger trg_brands_updated before update on public.brands
  for each row execute function public.set_updated_at();

drop trigger if exists trg_inventory_updated on public.inventory;
create trigger trg_inventory_updated before update on public.inventory
  for each row execute function public.set_updated_at();

drop trigger if exists trg_batches_updated on public.subagent_batches;
create trigger trg_batches_updated before update on public.subagent_batches
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role, phone, store_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'storekeeper'),
    nullif(new.raw_user_meta_data->>'phone', ''),
    nullif(new.raw_user_meta_data->>'store_id', '')::uuid
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: current user role / store
create or replace function public.current_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_store_id()
returns uuid language sql stable security definer set search_path = public as $$
  select store_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner');
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.brands enable row level security;
alter table public.inventory enable row level security;
alter table public.restocks enable row level security;
alter table public.subagent_batches enable row level security;
alter table public.sales enable row level security;
alter table public.daily_reports enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles policies
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated
using (
  public.is_owner()
  or id = auth.uid()
  or (store_id is not null and store_id = public.current_store_id())
);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update to authenticated
using (id = auth.uid() or public.is_owner())
with check (id = auth.uid() or public.is_owner());

drop policy if exists "profiles_insert_owner" on public.profiles;
create policy "profiles_insert_owner" on public.profiles for insert to authenticated
with check (public.is_owner());

-- Stores
drop policy if exists "stores_select" on public.stores;
create policy "stores_select" on public.stores for select to authenticated
using (public.is_owner() or id = public.current_store_id());

drop policy if exists "stores_write_owner" on public.stores;
create policy "stores_write_owner" on public.stores for all to authenticated
using (public.is_owner()) with check (public.is_owner());

-- Brands (readable by all authenticated, writable by owner)
drop policy if exists "brands_select" on public.brands;
create policy "brands_select" on public.brands for select to authenticated using (true);

drop policy if exists "brands_write_owner" on public.brands;
create policy "brands_write_owner" on public.brands for all to authenticated
using (public.is_owner()) with check (public.is_owner());

-- Inventory
drop policy if exists "inventory_select" on public.inventory;
create policy "inventory_select" on public.inventory for select to authenticated
using (public.is_owner() or store_id = public.current_store_id());

drop policy if exists "inventory_write" on public.inventory;
create policy "inventory_write" on public.inventory for all to authenticated
using (
  public.is_owner()
  or (store_id = public.current_store_id() and public.current_role() = 'storekeeper')
)
with check (
  public.is_owner()
  or (store_id = public.current_store_id() and public.current_role() = 'storekeeper')
);

-- Restocks
drop policy if exists "restocks_select" on public.restocks;
create policy "restocks_select" on public.restocks for select to authenticated
using (public.is_owner() or store_id = public.current_store_id());

drop policy if exists "restocks_insert" on public.restocks;
create policy "restocks_insert" on public.restocks for insert to authenticated
with check (
  public.is_owner()
  or (store_id = public.current_store_id() and public.current_role() in ('storekeeper', 'owner'))
);

-- Batches
drop policy if exists "batches_select" on public.subagent_batches;
create policy "batches_select" on public.subagent_batches for select to authenticated
using (
  public.is_owner()
  or store_id = public.current_store_id()
  or subagent_id = auth.uid()
);

drop policy if exists "batches_write" on public.subagent_batches;
create policy "batches_write" on public.subagent_batches for all to authenticated
using (
  public.is_owner()
  or store_id = public.current_store_id()
  or subagent_id = auth.uid()
)
with check (
  public.is_owner()
  or store_id = public.current_store_id()
  or subagent_id = auth.uid()
);

-- Sales
drop policy if exists "sales_select" on public.sales;
create policy "sales_select" on public.sales for select to authenticated
using (
  public.is_owner()
  or store_id = public.current_store_id()
  or sold_by = auth.uid()
  or subagent_id = auth.uid()
);

drop policy if exists "sales_insert" on public.sales;
create policy "sales_insert" on public.sales for insert to authenticated
with check (
  public.is_owner()
  or store_id = public.current_store_id()
  or sold_by = auth.uid()
);

-- Daily reports
drop policy if exists "reports_select" on public.daily_reports;
create policy "reports_select" on public.daily_reports for select to authenticated
using (public.is_owner() or store_id = public.current_store_id());

drop policy if exists "reports_write" on public.daily_reports;
create policy "reports_write" on public.daily_reports for all to authenticated
using (public.is_owner() or store_id = public.current_store_id())
with check (public.is_owner() or store_id = public.current_store_id());

-- Notifications
drop policy if exists "notifications_own" on public.notifications;
create policy "notifications_own" on public.notifications for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "notifications_insert_system" on public.notifications;
create policy "notifications_insert_system" on public.notifications for insert to authenticated
with check (true);

-- Push subscriptions
drop policy if exists "push_own" on public.push_subscriptions;
create policy "push_own" on public.push_subscriptions for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Audit logs (owner read; authenticated insert)
drop policy if exists "audit_select_owner" on public.audit_logs;
create policy "audit_select_owner" on public.audit_logs for select to authenticated
using (public.is_owner());

drop policy if exists "audit_insert" on public.audit_logs;
create policy "audit_insert" on public.audit_logs for insert to authenticated
with check (true);

-- Storage buckets (run separately if needed)
-- insert into storage.buckets (id, name, public) values ('sale-screenshots', 'sale-screenshots', true)
-- on conflict (id) do nothing;

-- Seed helper note: create an owner via Auth, then:
-- update public.profiles set role = 'owner' where email = 'owner@fourty.com';

-- Live updates (also in realtime.sql — safe to re-run)
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles',
    'stores',
    'brands',
    'inventory',
    'restocks',
    'subagent_batches',
    'sales',
    'notifications',
    'audit_logs'
  ]
  loop
    begin
      execute format(
        'alter publication supabase_realtime add table public.%I',
        t
      );
    exception
      when duplicate_object then null;
      when undefined_table then null;
    end;
  end loop;
end $$;
