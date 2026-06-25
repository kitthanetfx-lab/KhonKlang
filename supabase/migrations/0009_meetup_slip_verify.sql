-- 0009_meetup_slip_verify.sql
-- ข้อ4/5: ศูนย์กลาง (แอดมิน) ตรวจสลิปเงินประกันรายฝ่ายก่อนเริ่มนัดพบ
--
--   buyer_slip_verified_at  = เวลาที่แอดมินตรวจสลิป "ผู้ซื้อ" ว่าถูกต้อง
--   seller_slip_verified_at = เวลาที่แอดมินตรวจสลิป "ผู้ขาย" ว่าถูกต้อง
--   (ถ้าแอดมินตีกลับว่าไม่ถูกต้อง ระบบจะล้างสลิป + ฟิลด์นี้ และถอยสถานะกลับไปวางเงินใหม่)
--
-- ปลอดภัยต่อการรันซ้ำ (idempotent)

alter table public.deal_meetup
  add column if not exists buyer_slip_verified_at  timestamptz,
  add column if not exists seller_slip_verified_at timestamptz;
