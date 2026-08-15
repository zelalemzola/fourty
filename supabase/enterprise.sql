-- Enterprise workflow extensions for Fourty
-- Run after schema.sql

do $$ begin
  create type public.closeout_status as enum ('draft', 'submitted', 'reviewed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.adjustment_reason as enum (
    'damage', 'shrinkage', 'count_correction', 'return_to_supplier', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.remittance_status as enum ('pending', 'confirmed', 'rejected');
exception when duplicate_object then null; end $$;

-- End-of-day closeout (replaces WhatsApp/handwritten daily reports)
create table if not exists public.daily_closeouts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  closeout_date date not null,
  opening_notes text,
  closing_notes text,
  total_sales_amount numeric(14,2) not null default 0,
  total_cartons_sold int not null default 0,
  total_transactions int not null default 0,
  cash_declared numeric(14,2) default 0,
  stock_snapshot jsonb not null default '[]'::jsonb,
  status public.closeout_status not null default 'submitted',
  submitted_by uuid not null references public.profiles(id),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (store_id, closeout_date)
);

-- Inventory adjustments with reason codes
create table if not exists public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  quantity_delta int not null,
  reason public.adjustment_reason not null default 'count_correction',
  notes text,
  performed_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (quantity_delta <> 0)
);

-- Money sent to company account (storekeeper / subagent remittances)
create table if not exists public.remittances (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id),
  subagent_id uuid references public.profiles(id),
  amount numeric(14,2) not null check (amount > 0),
  method text not null default 'bank_transfer',
  reference_code text,
  proof_url text,
  notes text,
  status public.remittance_status not null default 'pending',
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_closeouts_store_date on public.daily_closeouts(store_id, closeout_date desc);
create index if not exists idx_adjustments_store on public.stock_adjustments(store_id, created_at desc);
create index if not exists idx_remittances_store on public.remittances(store_id, created_at desc);

alter table public.daily_closeouts enable row level security;
alter table public.stock_adjustments enable row level security;
alter table public.remittances enable row level security;

drop policy if exists "closeouts_select" on public.daily_closeouts;
create policy "closeouts_select" on public.daily_closeouts for select to authenticated
using (public.is_owner() or store_id = public.current_store_id());

drop policy if exists "closeouts_write" on public.daily_closeouts;
create policy "closeouts_write" on public.daily_closeouts for all to authenticated
using (public.is_owner() or store_id = public.current_store_id())
with check (public.is_owner() or store_id = public.current_store_id());

drop policy if exists "adjustments_select" on public.stock_adjustments;
create policy "adjustments_select" on public.stock_adjustments for select to authenticated
using (public.is_owner() or store_id = public.current_store_id());

drop policy if exists "adjustments_insert" on public.stock_adjustments;
create policy "adjustments_insert" on public.stock_adjustments for insert to authenticated
with check (public.is_owner() or store_id = public.current_store_id());

drop policy if exists "remittances_select" on public.remittances;
create policy "remittances_select" on public.remittances for select to authenticated
using (
  public.is_owner()
  or store_id = public.current_store_id()
  or submitted_by = auth.uid()
  or subagent_id = auth.uid()
);

drop policy if exists "remittances_insert" on public.remittances;
create policy "remittances_insert" on public.remittances for insert to authenticated
with check (
  public.is_owner()
  or store_id = public.current_store_id()
  or submitted_by = auth.uid()
);

drop policy if exists "remittances_update" on public.remittances;
create policy "remittances_update" on public.remittances for update to authenticated
using (public.is_owner() or store_id = public.current_store_id());

