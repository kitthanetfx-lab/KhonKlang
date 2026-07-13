-- ============================================================================
-- 0013_signup_platform_display_name.sql
-- ============================================================================
-- ขยาย trigger สร้างแถว profiles ตอนสมัคร ให้อ่านชื่อจากทุกแพลตฟอร์ม:
--   LINE   → raw_user_meta_data->>'displayName'
--   Google → raw_user_meta_data->>'full_name' หรือ 'name'
-- เดิม (0004) อ่านเฉพาะ displayName/display_name ทำให้ผู้ใช้ Google
-- ไม่ได้ชื่อเริ่มต้นจากบัญชี Google
-- ============================================================================

create or replace function handle_new_auth_user() returns trigger as $$
begin
  insert into profiles (id, email, display_name, created_at)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'displayName',
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_handle_new_auth_user on auth.users;
create trigger trg_handle_new_auth_user
  after insert on auth.users
  for each row execute function handle_new_auth_user();
