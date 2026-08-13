-- =============================================================================
-- Fourty CLEAR SEED — remove all demo data before production deploy
-- Safe: only deletes rows with seed UUID prefixes / SEED-* codes / @fourty.demo
-- Does NOT delete real (non-seed) production rows.
-- Skips tables that do not exist yet (safe if enterprise.sql was never run).
-- =============================================================================

do $$
begin
  if to_regclass('public.remittances') is not null then
    delete from public.remittances
    where id::text like 'f0000001-%'
       or store_id::text like 'b0000001-%'
       or submitted_by::text like 'a0000001-%'
       or subagent_id::text like 'a0000001-%';
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
       or store_id::text like 'b0000001-%'
       or submitted_by::text like 'a0000001-%';
  end if;

  if to_regclass('public.sales') is not null then
    delete from public.sales
    where id::text like 'c1000001-%'
       or store_id::text like 'b0000001-%'
       or sold_by::text like 'a0000001-%'
       or subagent_id::text like 'a0000001-%'
       or batch_id::text like 'c0000001-%'
       or screenshot_url like '%SEED%';
  end if;

  if to_regclass('public.subagent_batches') is not null then
    delete from public.subagent_batches
    where id::text like 'c0000001-%'
       or store_id::text like 'b0000001-%'
       or subagent_id::text like 'a0000001-%'
       or issued_by::text like 'a0000001-%';
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
       or user_id::text like 'a0000001-%'
       or (metadata ? 'seed');
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
    where id::text like 'b0200001-%'
       or store_id::text like 'b0000001-%'
       or brand_id::text like 'b0100001-%';
  end if;

  if to_regclass('public.profiles') is not null then
    update public.profiles
    set store_id = null
    where id::text like 'a0000001-%'
       or email like '%@fourty.demo';

    delete from public.profiles
    where id::text like 'a0000001-%'
       or email like '%@fourty.demo';
  end if;

  if to_regclass('auth.identities') is not null then
    delete from auth.identities
    where user_id::text like 'a0000001-%'
       or user_id in (select id from auth.users where email like '%@fourty.demo');
  end if;

  if to_regclass('auth.users') is not null then
    delete from auth.users
    where id::text like 'a0000001-%'
       or email like '%@fourty.demo';
  end if;

  if to_regclass('public.brands') is not null then
    delete from public.brands
    where id::text like 'b0100001-%'
       or sku like 'SEED-%';
  end if;

  if to_regclass('public.stores') is not null then
    delete from public.stores
    where id::text like 'b0000001-%'
       or code like 'SEED-%';
  end if;
end $$;

select 'SEED_CLEARED' as status;
