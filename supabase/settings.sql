-- Enterprise settings for Fourty
-- Run in Supabase SQL editor after schema.sql (+ enterprise.sql if used)

-- Per-user notification & UX preferences
create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  notify_sales boolean not null default true,
  notify_restock boolean not null default true,
  notify_low_stock boolean not null default true,
  notify_batches boolean not null default true,
  notify_reports boolean not null default true,
  notify_remittances boolean not null default true,
  notify_closeouts boolean not null default true,
  notify_users boolean not null default true,
  notify_system boolean not null default true,
  quiet_hours_enabled boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Singleton organization / company policy settings
create table if not exists public.organization_settings (
  id int primary key default 1 check (id = 1),
  company_name text not null default 'Fourty',
  company_phone text,
  company_address text,
  company_city text,
  currency_code text not null default 'ETB',
  timezone text not null default 'Africa/Addis_Ababa',
  default_min_stock int not null default 10 check (default_min_stock >= 0),
  require_sale_screenshot boolean not null default true,
  require_remittance_proof boolean not null default false,
  allow_negative_stock boolean not null default false,
  closeout_reminder_hour int not null default 18 check (closeout_reminder_hour between 0 and 23),
  fiscal_year_start_month int not null default 1 check (fiscal_year_start_month between 1 and 12),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.organization_settings (id)
values (1)
on conflict (id) do nothing;

drop trigger if exists trg_user_preferences_updated on public.user_preferences;
create trigger trg_user_preferences_updated before update on public.user_preferences
for each row execute function public.set_updated_at();

drop trigger if exists trg_organization_settings_updated on public.organization_settings;
create trigger trg_organization_settings_updated before update on public.organization_settings
for each row execute function public.set_updated_at();

-- Auto-create preferences when a profile is created
create or replace function public.handle_new_user_preferences()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created_preferences on public.profiles;
create trigger on_profile_created_preferences
  after insert on public.profiles
  for each row execute function public.handle_new_user_preferences();

-- Backfill preferences for existing users
insert into public.user_preferences (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

alter table public.user_preferences enable row level security;
alter table public.organization_settings enable row level security;

drop policy if exists "user_preferences_own" on public.user_preferences;
create policy "user_preferences_own" on public.user_preferences
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "org_settings_select" on public.organization_settings;
create policy "org_settings_select" on public.organization_settings
for select to authenticated
using (true);

drop policy if exists "org_settings_update_owner" on public.organization_settings;
create policy "org_settings_update_owner" on public.organization_settings
for update to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists "org_settings_insert_owner" on public.organization_settings;
create policy "org_settings_insert_owner" on public.organization_settings
for insert to authenticated
with check (public.is_owner());
