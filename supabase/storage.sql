-- Storage setup for sale transaction screenshots
insert into storage.buckets (id, name, public)
values ('sale-screenshots', 'sale-screenshots', true)
on conflict (id) do nothing;

drop policy if exists "sale_screenshots_read" on storage.objects;
create policy "sale_screenshots_read"
on storage.objects for select to authenticated
using (bucket_id = 'sale-screenshots');

drop policy if exists "sale_screenshots_public_read" on storage.objects;
create policy "sale_screenshots_public_read"
on storage.objects for select to public
using (bucket_id = 'sale-screenshots');

drop policy if exists "sale_screenshots_upload" on storage.objects;
create policy "sale_screenshots_upload"
on storage.objects for insert to authenticated
with check (bucket_id = 'sale-screenshots');

drop policy if exists "sale_screenshots_update" on storage.objects;
create policy "sale_screenshots_update"
on storage.objects for update to authenticated
using (bucket_id = 'sale-screenshots');
