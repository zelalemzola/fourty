-- =============================================================================
-- Fourty DEMO SEED (deep sample data for every page)
-- Prerequisites: schema.sql + storage.sql + enterprise.sql
--
-- Safe to re-run: clears previous seed first, then inserts.
-- Before production deploy, run: supabase/clear-seed.sql
--
-- Seed login accounts (password for ALL: SeedDemo123!)
--   owner@fourty.demo          → owner
--   keeper.central@fourty.demo → storekeeper (Central)
--   keeper.east@fourty.demo    → storekeeper (East)
--   keeper.north@fourty.demo   → storekeeper (North)
--   agent.abebe@fourty.demo    → subagent (Central)
--   agent.sara@fourty.demo     → subagent (East)
--   agent.dawit@fourty.demo    → subagent (North)
--
-- All seed rows use fixed UUIDs in the a000… / b000… / c000… ranges
-- so clear-seed.sql can remove them without touching real data.
-- =============================================================================

create extension if not exists "pgcrypto";

-- Require enterprise tables (closeouts / adjustments / remittances)
do $$
begin
  if to_regclass('public.remittances') is null
     or to_regclass('public.stock_adjustments') is null
     or to_regclass('public.daily_closeouts') is null then
    raise exception
      'Missing enterprise tables. Run supabase/enterprise.sql first, then re-run this seed.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 0) Clear previous seed (idempotent) — also available as clear-seed.sql
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.remittances') is not null then
    delete from public.remittances
    where id::text like 'f0000001-%'
       or store_id::text like 'b0000001-%'
       or submitted_by::text like 'a0000001-%';
  end if;

  if to_regclass('public.stock_adjustments') is not null then
    delete from public.stock_adjustments
    where id::text like 'e0000001-%'
       or store_id::text like 'b0000001-%'
       or performed_by::text like 'a0000001-%';
  end if;

  if to_regclass('public.daily_closeouts') is not null then
    delete from public.daily_closeouts
    where id::text like 'd0000001-%'
       or store_id::text like 'b0000001-%'
       or submitted_by::text like 'a0000001-%';
  end if;

  if to_regclass('public.daily_reports') is not null then
    delete from public.daily_reports
    where id::text like 'd1000001-%'
       or store_id::text like 'b0000001-%';
  end if;

  if to_regclass('public.sales') is not null then
    delete from public.sales
    where id::text like 'c1000001-%'
       or store_id::text like 'b0000001-%'
       or sold_by::text like 'a0000001-%';
  end if;

  if to_regclass('public.subagent_batches') is not null then
    delete from public.subagent_batches
    where id::text like 'c0000001-%'
       or store_id::text like 'b0000001-%'
       or subagent_id::text like 'a0000001-%';
  end if;

  if to_regclass('public.restocks') is not null then
    delete from public.restocks
    where id::text like 'b1000001-%'
       or store_id::text like 'b0000001-%'
       or performed_by::text like 'a0000001-%';
  end if;

  if to_regclass('public.notifications') is not null then
    delete from public.notifications
    where id::text like 'e1000001-%'
       or user_id::text like 'a0000001-%';
  end if;

  if to_regclass('public.audit_logs') is not null then
    delete from public.audit_logs
    where id::text like 'e2000001-%'
       or actor_id::text like 'a0000001-%'
       or store_id::text like 'b0000001-%'
       or (details ? 'seed');
  end if;

  if to_regclass('public.push_subscriptions') is not null then
    delete from public.push_subscriptions
    where user_id::text like 'a0000001-%';
  end if;

  if to_regclass('public.inventory') is not null then
    delete from public.inventory
    where store_id::text like 'b0000001-%'
       or brand_id::text like 'b0100001-%';
  end if;

  if to_regclass('public.profiles') is not null then
    update public.profiles set store_id = null
    where id::text like 'a0000001-%' or email like '%@fourty.demo';

    delete from public.profiles
    where id::text like 'a0000001-%' or email like '%@fourty.demo';
  end if;

  if to_regclass('auth.identities') is not null then
    delete from auth.identities
    where user_id::text like 'a0000001-%'
       or user_id in (select id from auth.users where email like '%@fourty.demo');
  end if;

  if to_regclass('auth.users') is not null then
    delete from auth.users
    where id::text like 'a0000001-%' or email like '%@fourty.demo';
  end if;

  if to_regclass('public.brands') is not null then
    delete from public.brands
    where id::text like 'b0100001-%' or sku like 'SEED-%';
  end if;

  if to_regclass('public.stores') is not null then
    delete from public.stores
    where id::text like 'b0000001-%' or code like 'SEED-%';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1) Auth users + profiles
-- ---------------------------------------------------------------------------
-- Password hash for "SeedDemo123!" (bcrypt via pgcrypto)
-- Supabase Auth expects crypt() bf hash.

do $$
declare
  v_pw text := crypt('SeedDemo123!', gen_salt('bf'));
  v_instance uuid := coalesce(
    (select id from auth.instances limit 1),
    '00000000-0000-0000-0000-000000000000'::uuid
  );
begin
  -- Owner
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    v_instance,
    'a0000001-0000-4000-8000-000000000001',
    'authenticated', 'authenticated',
    'owner@fourty.demo', v_pw, now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Fourty Owner","role":"owner"}'::jsonb,
    now(), now(), '', '', '', ''
  ) on conflict (id) do update set encrypted_password = excluded.encrypted_password,
    email_confirmed_at = now();

  -- Storekeepers
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
  (v_instance, 'a0000001-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'keeper.central@fourty.demo', v_pw, now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Helen Central","role":"storekeeper"}'::jsonb,
   now(), now(), '', '', '', ''),
  (v_instance, 'a0000001-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'keeper.east@fourty.demo', v_pw, now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Yonas East","role":"storekeeper"}'::jsonb,
   now(), now(), '', '', '', ''),
  (v_instance, 'a0000001-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'keeper.north@fourty.demo', v_pw, now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Marta North","role":"storekeeper"}'::jsonb,
   now(), now(), '', '', '', '')
  on conflict (id) do update set encrypted_password = excluded.encrypted_password,
    email_confirmed_at = now();

  -- Subagents
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
  (v_instance, 'a0000001-0000-4000-8000-000000000011', 'authenticated', 'authenticated',
   'agent.abebe@fourty.demo', v_pw, now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Abebe Subagent","role":"subagent"}'::jsonb,
   now(), now(), '', '', '', ''),
  (v_instance, 'a0000001-0000-4000-8000-000000000012', 'authenticated', 'authenticated',
   'agent.sara@fourty.demo', v_pw, now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Sara Subagent","role":"subagent"}'::jsonb,
   now(), now(), '', '', '', ''),
  (v_instance, 'a0000001-0000-4000-8000-000000000013', 'authenticated', 'authenticated',
   'agent.dawit@fourty.demo', v_pw, now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Dawit Subagent","role":"subagent"}'::jsonb,
   now(), now(), '', '', '', '')
  on conflict (id) do update set encrypted_password = excluded.encrypted_password,
    email_confirmed_at = now();

  -- Identities (required for email login in newer Supabase)
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  )
  select
    u.id,
    u.id,
    jsonb_build_object('sub', u.id::text, 'email', u.email),
    'email',
    u.id::text,
    now(), now(), now()
  from auth.users u
  where u.id::text like 'a0000001-%'
  on conflict do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Stores
-- ---------------------------------------------------------------------------
insert into public.stores (id, name, code, address, city, phone, is_active) values
  ('b0000001-0000-4000-8000-000000000001', 'Fourty Central Warehouse', 'SEED-CEN', 'Bole Atlas Rd 12', 'Addis Ababa', '+251911000001', true),
  ('b0000001-0000-4000-8000-000000000002', 'Fourty East Hub', 'SEED-EAST', 'CMC Michael Plaza', 'Addis Ababa', '+251911000002', true),
  ('b0000001-0000-4000-8000-000000000003', 'Fourty North Depot', 'SEED-NORTH', 'Piassa Merkato Lane', 'Addis Ababa', '+251911000003', true),
  ('b0000001-0000-4000-8000-000000000004', 'Fourty Hawassa Branch', 'SEED-HAW', 'Lake Side Ave 4', 'Hawassa', '+251911000004', true)
on conflict (id) do update set
  name = excluded.name,
  address = excluded.address,
  city = excluded.city,
  phone = excluded.phone,
  is_active = excluded.is_active;

-- ---------------------------------------------------------------------------
-- 3) Profiles (link to stores / roles)
-- Trigger may have created rows; upsert to be sure.
-- ---------------------------------------------------------------------------
insert into public.profiles (id, email, full_name, phone, role, store_id, is_active) values
  ('a0000001-0000-4000-8000-000000000001', 'owner@fourty.demo', 'Fourty Owner', '+251900000000', 'owner', null, true),
  ('a0000001-0000-4000-8000-000000000002', 'keeper.central@fourty.demo', 'Helen Central', '+251900000002', 'storekeeper', 'b0000001-0000-4000-8000-000000000001', true),
  ('a0000001-0000-4000-8000-000000000003', 'keeper.east@fourty.demo', 'Yonas East', '+251900000003', 'storekeeper', 'b0000001-0000-4000-8000-000000000002', true),
  ('a0000001-0000-4000-8000-000000000004', 'keeper.north@fourty.demo', 'Marta North', '+251900000004', 'storekeeper', 'b0000001-0000-4000-8000-000000000003', true),
  ('a0000001-0000-4000-8000-000000000011', 'agent.abebe@fourty.demo', 'Abebe Subagent', '+251900000011', 'subagent', 'b0000001-0000-4000-8000-000000000001', true),
  ('a0000001-0000-4000-8000-000000000012', 'agent.sara@fourty.demo', 'Sara Subagent', '+251900000012', 'subagent', 'b0000001-0000-4000-8000-000000000002', true),
  ('a0000001-0000-4000-8000-000000000013', 'agent.dawit@fourty.demo', 'Dawit Subagent', '+251900000013', 'subagent', 'b0000001-0000-4000-8000-000000000003', true)
on conflict (id) do update set
  full_name = excluded.full_name,
  role = excluded.role,
  store_id = excluded.store_id,
  phone = excluded.phone,
  is_active = true;

-- ---------------------------------------------------------------------------
-- 4) Brands
-- ---------------------------------------------------------------------------
insert into public.brands (id, name, sku, description, carton_size, unit_price, cost_price, is_active) values
  ('b0100001-0000-4000-8000-000000000001', 'Nyala Classic', 'SEED-NYA-CLS', 'Core volume brand', 10, 850, 620, true),
  ('b0100001-0000-4000-8000-000000000002', 'Nyala Menthol', 'SEED-NYA-MEN', 'Menthol variant', 10, 880, 640, true),
  ('b0100001-0000-4000-8000-000000000003', 'Ellington Gold', 'SEED-ELL-GLD', 'Premium gold pack', 10, 920, 690, true),
  ('b0100001-0000-4000-8000-000000000004', 'Rothman Blue', 'SEED-ROT-BLU', 'Value segment', 10, 780, 560, true),
  ('b0100001-0000-4000-8000-000000000005', 'Winston Red', 'SEED-WIN-RED', 'Full flavor', 10, 910, 680, true),
  ('b0100001-0000-4000-8000-000000000006', 'Yes Soft', 'SEED-YES-SFT', 'Soft pack economy', 10, 720, 510, true),
  ('b0100001-0000-4000-8000-000000000007', 'Bond Street', 'SEED-BND-STR', 'International line', 10, 860, 630, true),
  ('b0100001-0000-4000-8000-000000000008', 'L&M Blue', 'SEED-LM-BLU', 'Mild blend', 10, 800, 580, false)
on conflict (id) do update set
  unit_price = excluded.unit_price,
  cost_price = excluded.cost_price,
  description = excluded.description,
  is_active = excluded.is_active;

-- ---------------------------------------------------------------------------
-- 5) Inventory (per store × brand) — includes some low-stock rows
-- ---------------------------------------------------------------------------
insert into public.inventory (id, store_id, brand_id, quantity, min_stock) values
  -- Central
  ('b0200001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001', 'b0100001-0000-4000-8000-000000000001', 86, 15),
  ('b0200001-0000-4000-8000-000000000002', 'b0000001-0000-4000-8000-000000000001', 'b0100001-0000-4000-8000-000000000002', 54, 12),
  ('b0200001-0000-4000-8000-000000000003', 'b0000001-0000-4000-8000-000000000001', 'b0100001-0000-4000-8000-000000000003', 41, 10),
  ('b0200001-0000-4000-8000-000000000004', 'b0000001-0000-4000-8000-000000000001', 'b0100001-0000-4000-8000-000000000004', 8, 12),  -- low
  ('b0200001-0000-4000-8000-000000000005', 'b0000001-0000-4000-8000-000000000001', 'b0100001-0000-4000-8000-000000000005', 33, 10),
  ('b0200001-0000-4000-8000-000000000006', 'b0000001-0000-4000-8000-000000000001', 'b0100001-0000-4000-8000-000000000006', 22, 8),
  ('b0200001-0000-4000-8000-000000000007', 'b0000001-0000-4000-8000-000000000001', 'b0100001-0000-4000-8000-000000000007', 19, 8),
  -- East
  ('b0200001-0000-4000-8000-000000000011', 'b0000001-0000-4000-8000-000000000002', 'b0100001-0000-4000-8000-000000000001', 62, 15),
  ('b0200001-0000-4000-8000-000000000012', 'b0000001-0000-4000-8000-000000000002', 'b0100001-0000-4000-8000-000000000002', 5, 10),   -- low
  ('b0200001-0000-4000-8000-000000000013', 'b0000001-0000-4000-8000-000000000002', 'b0100001-0000-4000-8000-000000000003', 28, 10),
  ('b0200001-0000-4000-8000-000000000014', 'b0000001-0000-4000-8000-000000000002', 'b0100001-0000-4000-8000-000000000004', 44, 12),
  ('b0200001-0000-4000-8000-000000000015', 'b0000001-0000-4000-8000-000000000002', 'b0100001-0000-4000-8000-000000000005', 37, 10),
  ('b0200001-0000-4000-8000-000000000016', 'b0000001-0000-4000-8000-000000000002', 'b0100001-0000-4000-8000-000000000006', 15, 8),
  ('b0200001-0000-4000-8000-000000000017', 'b0000001-0000-4000-8000-000000000002', 'b0100001-0000-4000-8000-000000000007', 11, 8),
  -- North
  ('b0200001-0000-4000-8000-000000000021', 'b0000001-0000-4000-8000-000000000003', 'b0100001-0000-4000-8000-000000000001', 48, 15),
  ('b0200001-0000-4000-8000-000000000022', 'b0000001-0000-4000-8000-000000000003', 'b0100001-0000-4000-8000-000000000002', 31, 12),
  ('b0200001-0000-4000-8000-000000000023', 'b0000001-0000-4000-8000-000000000003', 'b0100001-0000-4000-8000-000000000003', 3, 10),   -- low
  ('b0200001-0000-4000-8000-000000000024', 'b0000001-0000-4000-8000-000000000003', 'b0100001-0000-4000-8000-000000000004', 26, 12),
  ('b0200001-0000-4000-8000-000000000025', 'b0000001-0000-4000-8000-000000000003', 'b0100001-0000-4000-8000-000000000005', 40, 10),
  ('b0200001-0000-4000-8000-000000000026', 'b0000001-0000-4000-8000-000000000003', 'b0100001-0000-4000-8000-000000000006', 9, 8),
  ('b0200001-0000-4000-8000-000000000027', 'b0000001-0000-4000-8000-000000000003', 'b0100001-0000-4000-8000-000000000007', 17, 8),
  -- Hawassa
  ('b0200001-0000-4000-8000-000000000031', 'b0000001-0000-4000-8000-000000000004', 'b0100001-0000-4000-8000-000000000001', 35, 12),
  ('b0200001-0000-4000-8000-000000000032', 'b0000001-0000-4000-8000-000000000004', 'b0100001-0000-4000-8000-000000000002', 20, 10),
  ('b0200001-0000-4000-8000-000000000033', 'b0000001-0000-4000-8000-000000000004', 'b0100001-0000-4000-8000-000000000003', 14, 8),
  ('b0200001-0000-4000-8000-000000000034', 'b0000001-0000-4000-8000-000000000004', 'b0100001-0000-4000-8000-000000000004', 18, 8),
  ('b0200001-0000-4000-8000-000000000035', 'b0000001-0000-4000-8000-000000000004', 'b0100001-0000-4000-8000-000000000005', 12, 8)
on conflict (id) do update set quantity = excluded.quantity, min_stock = excluded.min_stock;

-- ---------------------------------------------------------------------------
-- 6) Restocks (history)
-- ---------------------------------------------------------------------------
insert into public.restocks (id, store_id, brand_id, quantity, unit_cost, notes, performed_by, created_at) values
  ('b1000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001', 'b0100001-0000-4000-8000-000000000001', 50, 620, 'Weekly warehouse fill', 'a0000001-0000-4000-8000-000000000002', now() - interval '12 days'),
  ('b1000001-0000-4000-8000-000000000002', 'b0000001-0000-4000-8000-000000000001', 'b0100001-0000-4000-8000-000000000003', 30, 690, 'Premium restock', 'a0000001-0000-4000-8000-000000000001', now() - interval '9 days'),
  ('b1000001-0000-4000-8000-000000000003', 'b0000001-0000-4000-8000-000000000002', 'b0100001-0000-4000-8000-000000000002', 40, 640, 'East menthol fill', 'a0000001-0000-4000-8000-000000000003', now() - interval '7 days'),
  ('b1000001-0000-4000-8000-000000000004', 'b0000001-0000-4000-8000-000000000003', 'b0100001-0000-4000-8000-000000000005', 35, 680, 'North Winston', 'a0000001-0000-4000-8000-000000000004', now() - interval '5 days'),
  ('b1000001-0000-4000-8000-000000000005', 'b0000001-0000-4000-8000-000000000004', 'b0100001-0000-4000-8000-000000000001', 25, 620, 'Hawassa opening stock', 'a0000001-0000-4000-8000-000000000001', now() - interval '3 days'),
  ('b1000001-0000-4000-8000-000000000006', 'b0000001-0000-4000-8000-000000000001', 'b0100001-0000-4000-8000-000000000004', 20, 560, 'Emergency low-stock fill', 'a0000001-0000-4000-8000-000000000002', now() - interval '1 day')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 7) Subagent batches
-- ---------------------------------------------------------------------------
insert into public.subagent_batches (
  id, store_id, subagent_id, brand_id, quantity_taken, quantity_sold, quantity_returned,
  status, notes, issued_by, issued_at, settled_at
) values
  ('c0000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000011',
   'b0100001-0000-4000-8000-000000000001', 20, 12, 0, 'active', 'Abebe weekend route',
   'a0000001-0000-4000-8000-000000000002', now() - interval '4 days', null),
  ('c0000001-0000-4000-8000-000000000002', 'b0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000011',
   'b0100001-0000-4000-8000-000000000003', 10, 6, 2, 'partially_returned', 'Partial return after rain delay',
   'a0000001-0000-4000-8000-000000000002', now() - interval '10 days', null),
  ('c0000001-0000-4000-8000-000000000003', 'b0000001-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000012',
   'b0100001-0000-4000-8000-000000000002', 15, 15, 0, 'settled', 'Sara fully settled',
   'a0000001-0000-4000-8000-000000000003', now() - interval '14 days', now() - interval '2 days'),
  ('c0000001-0000-4000-8000-000000000004', 'b0000001-0000-4000-8000-000000000003', 'a0000001-0000-4000-8000-000000000013',
   'b0100001-0000-4000-8000-000000000005', 12, 4, 0, 'active', 'Dawit active batch',
   'a0000001-0000-4000-8000-000000000004', now() - interval '6 days', null),
  ('c0000001-0000-4000-8000-000000000005', 'b0000001-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000012',
   'b0100001-0000-4000-8000-000000000004', 8, 1, 0, 'overdue', 'Long outstanding — follow up',
   'a0000001-0000-4000-8000-000000000003', now() - interval '21 days', null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 8) Sales (store + subagent channels) across recent days
-- ---------------------------------------------------------------------------
insert into public.sales (
  id, store_id, brand_id, quantity, unit_price, total_amount, channel,
  sold_by, subagent_id, batch_id, screenshot_url, notes, sold_at
) values
  -- Central store sales
  ('c1000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001', 'b0100001-0000-4000-8000-000000000001',
   5, 850, 4250, 'store', 'a0000001-0000-4000-8000-000000000002', null, null,
   'https://placehold.co/600x800/png?text=SEED+Sale+1', 'Walk-in retailer', now() - interval '1 day'),
  ('c1000001-0000-4000-8000-000000000002', 'b0000001-0000-4000-8000-000000000001', 'b0100001-0000-4000-8000-000000000003',
   3, 920, 2760, 'store', 'a0000001-0000-4000-8000-000000000002', null, null,
   'https://placehold.co/600x800/png?text=SEED+Sale+2', null, now() - interval '1 day' + interval '2 hours'),
  ('c1000001-0000-4000-8000-000000000003', 'b0000001-0000-4000-8000-000000000001', 'b0100001-0000-4000-8000-000000000005',
   4, 910, 3640, 'store', 'a0000001-0000-4000-8000-000000000002', null, null,
   'https://placehold.co/600x800/png?text=SEED+Sale+3', null, now() - interval '2 days'),
  -- Abebe subagent sales (counts toward store)
  ('c1000001-0000-4000-8000-000000000004', 'b0000001-0000-4000-8000-000000000001', 'b0100001-0000-4000-8000-000000000001',
   4, 850, 3400, 'subagent', 'a0000001-0000-4000-8000-000000000011', 'a0000001-0000-4000-8000-000000000011',
   'c0000001-0000-4000-8000-000000000001',
   'https://placehold.co/600x800/png?text=SEED+Subagent+Sale', 'Bank transfer proof', now() - interval '2 days'),
  ('c1000001-0000-4000-8000-000000000005', 'b0000001-0000-4000-8000-000000000001', 'b0100001-0000-4000-8000-000000000001',
   3, 850, 2550, 'subagent', 'a0000001-0000-4000-8000-000000000011', 'a0000001-0000-4000-8000-000000000011',
   'c0000001-0000-4000-8000-000000000001',
   'https://placehold.co/600x800/png?text=SEED+Subagent+Sale+2', null, now() - interval '3 days'),
  -- East
  ('c1000001-0000-4000-8000-000000000006', 'b0000001-0000-4000-8000-000000000002', 'b0100001-0000-4000-8000-000000000004',
   6, 780, 4680, 'store', 'a0000001-0000-4000-8000-000000000003', null, null,
   'https://placehold.co/600x800/png?text=SEED+East+1', null, now() - interval '1 day'),
  ('c1000001-0000-4000-8000-000000000007', 'b0000001-0000-4000-8000-000000000002', 'b0100001-0000-4000-8000-000000000002',
   2, 880, 1760, 'subagent', 'a0000001-0000-4000-8000-000000000012', 'a0000001-0000-4000-8000-000000000012',
   'c0000001-0000-4000-8000-000000000003',
   'https://placehold.co/600x800/png?text=SEED+Sara', 'Settled batch sale', now() - interval '8 days'),
  ('c1000001-0000-4000-8000-000000000008', 'b0000001-0000-4000-8000-000000000002', 'b0100001-0000-4000-8000-000000000005',
   5, 910, 4550, 'store', 'a0000001-0000-4000-8000-000000000003', null, null,
   'https://placehold.co/600x800/png?text=SEED+East+2', null, now() - interval '4 days'),
  -- North
  ('c1000001-0000-4000-8000-000000000009', 'b0000001-0000-4000-8000-000000000003', 'b0100001-0000-4000-8000-000000000001',
   7, 850, 5950, 'store', 'a0000001-0000-4000-8000-000000000004', null, null,
   'https://placehold.co/600x800/png?text=SEED+North+1', null, now() - interval '1 day'),
  ('c1000001-0000-4000-8000-000000000010', 'b0000001-0000-4000-8000-000000000003', 'b0100001-0000-4000-8000-000000000005',
   2, 910, 1820, 'subagent', 'a0000001-0000-4000-8000-000000000013', 'a0000001-0000-4000-8000-000000000013',
   'c0000001-0000-4000-8000-000000000004',
   'https://placehold.co/600x800/png?text=SEED+Dawit', null, now() - interval '2 days'),
  -- Hawassa + older for charts
  ('c1000001-0000-4000-8000-000000000011', 'b0000001-0000-4000-8000-000000000004', 'b0100001-0000-4000-8000-000000000001',
   4, 850, 3400, 'store', 'a0000001-0000-4000-8000-000000000001', null, null,
   'https://placehold.co/600x800/png?text=SEED+Hawassa', 'Owner assisted sale', now() - interval '3 days'),
  ('c1000001-0000-4000-8000-000000000012', 'b0000001-0000-4000-8000-000000000001', 'b0100001-0000-4000-8000-000000000006',
   8, 720, 5760, 'store', 'a0000001-0000-4000-8000-000000000002', null, null,
   'https://placehold.co/600x800/png?text=SEED+Week', null, now() - interval '6 days'),
  ('c1000001-0000-4000-8000-000000000013', 'b0000001-0000-4000-8000-000000000002', 'b0100001-0000-4000-8000-000000000007',
   3, 860, 2580, 'store', 'a0000001-0000-4000-8000-000000000003', null, null,
   'https://placehold.co/600x800/png?text=SEED+Bond', null, now() - interval '11 days'),
  ('c1000001-0000-4000-8000-000000000014', 'b0000001-0000-4000-8000-000000000001', 'b0100001-0000-4000-8000-000000000002',
   6, 880, 5280, 'store', 'a0000001-0000-4000-8000-000000000002', null, null,
   'https://placehold.co/600x800/png?text=SEED+Today', null, now() - interval '3 hours'),
  ('c1000001-0000-4000-8000-000000000015', 'b0000001-0000-4000-8000-000000000003', 'b0100001-0000-4000-8000-000000000004',
   5, 780, 3900, 'store', 'a0000001-0000-4000-8000-000000000004', null, null,
   'https://placehold.co/600x800/png?text=SEED+Month', null, now() - interval '18 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 9) Daily reports + closeouts
-- ---------------------------------------------------------------------------
insert into public.daily_reports (
  id, store_id, report_date, total_sales_amount, total_cartons_sold, total_transactions, notes, submitted_by
) values
  ('d1000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001', current_date - 1, 7010, 8, 2, 'Solid day, Rothman low', 'a0000001-0000-4000-8000-000000000002'),
  ('d1000001-0000-4000-8000-000000000002', 'b0000001-0000-4000-8000-000000000002', current_date - 1, 4680, 6, 1, 'East quiet afternoon', 'a0000001-0000-4000-8000-000000000003'),
  ('d1000001-0000-4000-8000-000000000003', 'b0000001-0000-4000-8000-000000000003', current_date - 1, 5950, 7, 1, 'North strong opener', 'a0000001-0000-4000-8000-000000000004')
on conflict (id) do nothing;

insert into public.daily_closeouts (
  id, store_id, closeout_date, opening_notes, closing_notes,
  total_sales_amount, total_cartons_sold, total_transactions, cash_declared,
  stock_snapshot, status, submitted_by, reviewed_by, reviewed_at
) values
  ('d0000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001', current_date - 1,
   'Opened with full Nyala bay', 'Need Rothman Blue restock tomorrow',
   7010, 8, 2, 6900,
   '[{"brand_name":"Nyala Classic","quantity":86,"min_stock":15},{"brand_name":"Rothman Blue","quantity":8,"min_stock":12}]'::jsonb,
   'reviewed', 'a0000001-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000001', now() - interval '20 hours'),
  ('d0000001-0000-4000-8000-000000000002', 'b0000001-0000-4000-8000-000000000002', current_date - 1,
   'Menthol almost empty', 'Requested menthol refill',
   4680, 6, 1, 4680,
   '[{"brand_name":"Nyala Menthol","quantity":5,"min_stock":10}]'::jsonb,
   'submitted', 'a0000001-0000-4000-8000-000000000003', null, null),
  ('d0000001-0000-4000-8000-000000000003', 'b0000001-0000-4000-8000-000000000003', current_date - 2,
   null, 'Ellington critically low',
   4200, 5, 2, 4000,
   '[{"brand_name":"Ellington Gold","quantity":3,"min_stock":10}]'::jsonb,
   'submitted', 'a0000001-0000-4000-8000-000000000004', null, null),
  ('d0000001-0000-4000-8000-000000000004', 'b0000001-0000-4000-8000-000000000004', current_date - 3,
   'Hawassa soft opening week', 'Steady local demand',
   3400, 4, 1, 3400,
   '[{"brand_name":"Nyala Classic","quantity":35,"min_stock":12}]'::jsonb,
   'reviewed', 'a0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000001', now() - interval '2 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 10) Stock adjustments
-- ---------------------------------------------------------------------------
insert into public.stock_adjustments (
  id, store_id, brand_id, quantity_delta, reason, notes, performed_by, created_at
) values
  ('e0000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001', 'b0100001-0000-4000-8000-000000000004',
   -2, 'damage', 'Water damage on bottom cartons', 'a0000001-0000-4000-8000-000000000002', now() - interval '5 days'),
  ('e0000001-0000-4000-8000-000000000002', 'b0000001-0000-4000-8000-000000000002', 'b0100001-0000-4000-8000-000000000002',
   -1, 'shrinkage', 'Cycle count variance', 'a0000001-0000-4000-8000-000000000003', now() - interval '4 days'),
  ('e0000001-0000-4000-8000-000000000003', 'b0000001-0000-4000-8000-000000000003', 'b0100001-0000-4000-8000-000000000003',
   2, 'count_correction', 'Miscounted during morning open', 'a0000001-0000-4000-8000-000000000004', now() - interval '2 days'),
  ('e0000001-0000-4000-8000-000000000004', 'b0000001-0000-4000-8000-000000000001', 'b0100001-0000-4000-8000-000000000006',
   -3, 'return_to_supplier', 'Expired soft packs returned', 'a0000001-0000-4000-8000-000000000001', now() - interval '8 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 11) Remittances
-- ---------------------------------------------------------------------------
insert into public.remittances (
  id, store_id, submitted_by, subagent_id, amount, method, reference_code, proof_url, notes, status, confirmed_by, confirmed_at, created_at
) values
  ('f0000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001',
   'a0000001-0000-4000-8000-000000000011', 'a0000001-0000-4000-8000-000000000011',
   3400, 'bank_transfer', 'CBE-SEED-99101',
   'https://placehold.co/600x800/png?text=SEED+Remit+1', 'Abebe deposit for weekend sales',
   'confirmed', 'a0000001-0000-4000-8000-000000000001', now() - interval '1 day', now() - interval '2 days'),
  ('f0000001-0000-4000-8000-000000000002', 'b0000001-0000-4000-8000-000000000002',
   'a0000001-0000-4000-8000-000000000003', null,
   4680, 'mobile_money', 'TEL-SEED-44021',
   'https://placehold.co/600x800/png?text=SEED+Remit+2', 'East store daily cash-in',
   'pending', null, null, now() - interval '6 hours'),
  ('f0000001-0000-4000-8000-000000000003', 'b0000001-0000-4000-8000-000000000003',
   'a0000001-0000-4000-8000-000000000013', 'a0000001-0000-4000-8000-000000000013',
   1820, 'bank_transfer', 'AWASH-SEED-1188',
   null, 'Dawit partial remittance',
   'pending', null, null, now() - interval '1 day'),
  ('f0000001-0000-4000-8000-000000000004', 'b0000001-0000-4000-8000-000000000001',
   'a0000001-0000-4000-8000-000000000002', null,
   10000, 'cash_deposit', 'SEED-REJECT-01',
   'https://placehold.co/600x800/png?text=SEED+Rejected', 'Wrong account — rejected sample',
   'rejected', 'a0000001-0000-4000-8000-000000000001', now() - interval '3 days', now() - interval '4 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 12) Notifications (owner + keepers)
-- ---------------------------------------------------------------------------
insert into public.notifications (id, user_id, title, body, type, link, metadata, is_read, created_at) values
  ('e1000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000001',
   'Daily closeout submitted', 'Fourty East Hub closed yesterday', 'report', '/app/closeout',
   '{"seed":true}'::jsonb, false, now() - interval '5 hours'),
  ('e1000001-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000001',
   'Low stock alert', 'Rothman Blue below minimum at Central', 'low_stock', '/app/inventory',
   '{"seed":true}'::jsonb, false, now() - interval '1 day'),
  ('e1000001-0000-4000-8000-000000000003', 'a0000001-0000-4000-8000-000000000001',
   'Remittance pending', 'East Hub submitted 4,680 ETB', 'settlement', '/app/remittances',
   '{"seed":true}'::jsonb, true, now() - interval '6 hours'),
  ('e1000001-0000-4000-8000-000000000004', 'a0000001-0000-4000-8000-000000000002',
   'Batch issued', 'Abebe took 20 Nyala Classic cartons', 'batch', '/app/subagents',
   '{"seed":true}'::jsonb, true, now() - interval '4 days'),
  ('e1000001-0000-4000-8000-000000000005', 'a0000001-0000-4000-8000-000000000001',
   'New sale recorded', '7 cartons sold at North Depot', 'sale', '/app/reports',
   '{"seed":true}'::jsonb, false, now() - interval '1 day'),
  ('e1000001-0000-4000-8000-000000000006', 'a0000001-0000-4000-8000-000000000003',
   'Stock adjustment', '-1 Menthol shrinkage recorded', 'audit', '/app/adjustments',
   '{"seed":true}'::jsonb, false, now() - interval '4 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 13) Audit trail
-- ---------------------------------------------------------------------------
insert into public.audit_logs (
  id, actor_id, actor_name, actor_role, action, entity_type, entity_id, store_id, details, created_at
) values
  ('e2000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000002', 'Helen Central', 'storekeeper',
   'sale.create', 'sale', 'c1000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001',
   '{"seed":"true","qty":5}'::jsonb, now() - interval '1 day'),
  ('e2000001-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000002', 'Helen Central', 'storekeeper',
   'closeout.submit', 'closeout', 'd0000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001',
   '{"seed":"true"}'::jsonb, now() - interval '22 hours'),
  ('e2000001-0000-4000-8000-000000000003', 'a0000001-0000-4000-8000-000000000001', 'Fourty Owner', 'owner',
   'closeout.review', 'closeout', 'd0000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001',
   '{"seed":"true"}'::jsonb, now() - interval '20 hours'),
  ('e2000001-0000-4000-8000-000000000004', 'a0000001-0000-4000-8000-000000000002', 'Helen Central', 'storekeeper',
   'batch.issue', 'batch', 'c0000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001',
   '{"seed":"true","qty":20}'::jsonb, now() - interval '4 days'),
  ('e2000001-0000-4000-8000-000000000005', 'a0000001-0000-4000-8000-000000000003', 'Yonas East', 'storekeeper',
   'restock.create', 'restock', 'b1000001-0000-4000-8000-000000000003', 'b0000001-0000-4000-8000-000000000002',
   '{"seed":"true"}'::jsonb, now() - interval '7 days'),
  ('e2000001-0000-4000-8000-000000000006', 'a0000001-0000-4000-8000-000000000001', 'Fourty Owner', 'owner',
   'remittance.confirm', 'remittance', 'f0000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001',
   '{"seed":"true","amount":3400}'::jsonb, now() - interval '1 day'),
  ('e2000001-0000-4000-8000-000000000007', 'a0000001-0000-4000-8000-000000000004', 'Marta North', 'storekeeper',
   'adjustment.create', 'adjustment', 'e0000001-0000-4000-8000-000000000003', 'b0000001-0000-4000-8000-000000000003',
   '{"seed":"true"}'::jsonb, now() - interval '2 days'),
  ('e2000001-0000-4000-8000-000000000008', 'a0000001-0000-4000-8000-000000000001', 'Fourty Owner', 'owner',
   'brand.create', 'brand', 'b0100001-0000-4000-8000-000000000007', null,
   '{"seed":"true","name":"Bond Street"}'::jsonb, now() - interval '30 days')
on conflict (id) do nothing;

-- Done
select
  'SEED_OK' as status,
  (select count(*) from public.stores where code like 'SEED-%') as stores,
  (select count(*) from public.brands where sku like 'SEED-%') as brands,
  (select count(*) from public.sales where id::text like 'c1000001-%') as sales,
  (select count(*) from public.profiles where email like '%@fourty.demo') as users;
