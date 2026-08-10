-- 0031_slip_verify_scaffold.sql
-- วางโครงฟิลด์สลิปสำหรับออนไซต์ (รอ flow อัปสลิปจริง)
-- ฝากขาย: ยังไม่มีตาราง — ใช้ slipVerifyScaffold.ts เป็น stub

alter table public.onsite_jobs
  add column if not exists payment_slip_file_id text,
  add column if not exists payment_slip_verified_at timestamptz,
  add column if not exists slip_reject_reason text;

comment on column public.onsite_jobs.payment_slip_file_id is 'Scaffold: สลิปโอนเงินจากผู้ว่าจ้าง — รอ flow upload';
comment on column public.onsite_jobs.payment_slip_verified_at is 'Scaffold: เวลาที่ SlipOK/แอดมินตรวจผ่าน';
comment on column public.onsite_jobs.slip_reject_reason is 'Scaffold: เหตุผลที่สลิปไม่ผ่าน';
