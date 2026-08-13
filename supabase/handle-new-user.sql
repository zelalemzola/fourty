-- Optional: re-apply profile auto-create so role/store from user_metadata stick on signup.
-- Safe to run on existing databases. Owner create-account still works without this
-- because /api/users/create upserts the profile after auth.admin.createUser.

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
