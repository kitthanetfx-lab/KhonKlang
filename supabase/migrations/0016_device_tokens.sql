-- ============================================================================
-- 0016 — device_tokens: เก็บ FCM/APNs token ของผู้ใช้สำหรับส่ง push notification
-- ============================================================================
-- ใช้สำหรับ:
--   • แจ้งเตือนดีล/แชท/สายเรียกเข้าไปยังแอปมือถือ (Capacitor — กลางฮับ)
--   • 1 user สามารถมีหลายเครื่อง (มือถือ + แท็บเล็ต) → เก็บหลาย token ได้
--
-- token มาจากฝั่งแอป: @capacitor/push-notifications ขอ token จาก FCM/APNs แล้ว
-- ยิง POST /api/push/register มาที่นี่
-- ============================================================================

create table if not exists device_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  token      text not null,
  platform   text check (platform in ('android','ios','web')) not null,
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);
create index if not exists idx_device_tokens_user on device_tokens(user_id);

-- auto-update updated_at เวลา upsert (เผื่อใช้ track token ที่ยัง active)
-- ใช้ trigger pattern เดียวกับ profiles/ทั่วไปในระบบ
drop trigger if exists trg_device_tokens_updated_at on device_tokens;
create or replace function set_device_tokens_updated_at() returns trigger as $$
begin new.updated_at := now(); return new; end;
$$ language plpgsql;
create trigger trg_device_tokens_updated_at before update on device_tokens
  for each row execute function set_device_tokens_updated_at();

-- RLS: owner เท่านั้นที่จัดการ token ตัวเองได้ผ่าน anon-key client (แอป)
-- (ฝั่ง server ใช้ service-role ผ่าน getAdminClient() ซึ่ง bypass RLS อยู่แล้ว)
alter table device_tokens enable row level security;
drop policy if exists device_tokens_owner_select on device_tokens;
drop policy if exists device_tokens_owner_insert on device_tokens;
drop policy if exists device_tokens_owner_update on device_tokens;
drop policy if exists device_tokens_owner_delete on device_tokens;
create policy device_tokens_owner_select on device_tokens for select using (user_id = auth.uid());
create policy device_tokens_owner_insert on device_tokens for insert with check (user_id = auth.uid());
create policy device_tokens_owner_update on device_tokens for update using (user_id = auth.uid());
create policy device_tokens_owner_delete on device_tokens for delete using (user_id = auth.uid());
