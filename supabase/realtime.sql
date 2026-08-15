-- Enable live postgres changes for Fourty tables.
-- Run once in the Supabase SQL editor (safe to re-run).

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
    'audit_logs',
    'daily_closeouts',
    'daily_reports',
    'stock_adjustments',
    'remittances',
    'user_preferences',
    'organization_settings',
    'push_subscriptions'
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
