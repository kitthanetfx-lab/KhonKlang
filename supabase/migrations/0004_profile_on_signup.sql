-- ============================================================================
-- 0004_profile_on_signup.sql
-- ============================================================================
-- Auto-create a `profiles` row the moment a new auth.users row exists, so
-- every later piece of code can assume "if there's a session, there's a
-- profile row" instead of the old Appwrite pattern of empty prefs `{}` until
-- the user finishes the /register form. The /register form now just UPDATEs
-- this row instead of create-or-auto-link across two separate stores.
-- ============================================================================

create or replace function handle_new_auth_user() returns trigger as $$
begin
  insert into profiles (id, email, display_name, created_at)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'displayName', new.raw_user_meta_data->>'display_name'), now())
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_handle_new_auth_user on auth.users;
create trigger trg_handle_new_auth_user
  after insert on auth.users
  for each row execute function handle_new_auth_user();
