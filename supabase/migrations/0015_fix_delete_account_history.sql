-- ============================================================================
-- 0015 — แก้บั๊ก delete_account_history() จาก migration 0014
-- ============================================================================
-- Error ตอนกดลบบัญชีจริง: "column reference \"target_id\" is ambiguous"
-- สาเหตุ: พารามิเตอร์ของฟังก์ชันตั้งชื่อ target_id ซึ่งชนกับคอลัมน์ reviews.target_id
-- (ตาราง reviews มีทั้ง reviewer_id และ target_id) — Postgres แยกไม่ออกว่า
-- "target_id" ในเงื่อนไข WHERE หมายถึงคอลัมน์ของตาราง หรือพารามิเตอร์ของฟังก์ชัน
--
-- แก้โดยเปลี่ยนชื่อพารามิเตอร์เป็น p_user_id (ไม่ชนกับคอลัมน์ใดในตารางที่แตะ)
-- ตรรกะข้างในเหมือนเดิมทุกประการ — แค่ create or replace ทับของเดิม
-- ============================================================================

-- create or replace เปลี่ยนชื่อพารามิเตอร์ตรงๆ ไม่ได้ (Postgres error 42P13) ต้อง drop ก่อนเสมอ
drop function if exists delete_account_history(uuid);

create or replace function delete_account_history(p_user_id uuid) returns void as $$
begin
  delete from support_threads where customer_id = p_user_id;     -- cascades: support_messages, call_signals
  delete from notifications   where user_id = p_user_id;
  delete from dm_messages     where from_id = p_user_id or to_id = p_user_id;
  delete from wanted_posts    where user_id = p_user_id;
  delete from seller_applications    where user_id = p_user_id;
  delete from middleman_applications where user_id = p_user_id;
  delete from reviews         where reviewer_id = p_user_id;      -- รีวิวที่เขาเป็นคนเขียนเอง (target ฝั่งถูกรีวิวเก็บไว้)
end;
$$ language plpgsql security definer;
