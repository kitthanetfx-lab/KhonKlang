-- ============================================================================
-- 0007_middleman_deposits.sql
-- ============================================================================
-- บั๊กเดิม: ตอน admin อนุมัติใบสมัครคนกลาง ระบบจะปล่อย credit_limit ให้ทันทีตาม
-- tier ที่เลือก (Bronze=1,000 / Silver=5,000 / ...) โดยที่คนกลางยังไม่ได้โอนเงิน
-- ค้ำประกันจริงเข้ามาในระบบเลย — แก้โดยเพิ่มตาราง middleman_deposits เก็บ
-- ประวัติการโอนเงินค้ำประกันจริงแต่ละครั้ง (พร้อมสลิป + อนุมัติโดย admin)
-- แล้วเปลี่ยนให้ credit_limit ของคนกลางคำนวณจากยอดเงินค้ำประกันที่ "ยืนยันแล้ว"
-- (status = approved) เท่านั้น ไม่ใช่ auto-grant ตาม tier อีกต่อไป
-- ============================================================================

alter type ledger_reference_type add value if not exists 'middleman_deposit';
alter type ledger_entry_type add value if not exists 'middleman_deposit';

create table if not exists middleman_deposits (
  id            uuid primary key default gen_random_uuid(),
  middleman_id  uuid not null references profiles(id) on delete cascade,
  amount        integer not null check (amount > 0),
  slip_file_id  text,
  status        approval_status not null default 'pending_review',
  reject_reason text,
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid references profiles(id)
);

create index if not exists idx_middleman_deposits_middleman on middleman_deposits(middleman_id);
create index if not exists idx_middleman_deposits_status on middleman_deposits(status);

comment on table middleman_deposits is
  'เงินค้ำประกันที่คนกลางโอนเข้าระบบจริง (แนบสลิป รอ admin ตรวจสอบ/อนุมัติ) — credit_limit ของ middleman_wallets คำนวณจากยอดที่ status=approved ของตารางนี้เท่านั้น';
