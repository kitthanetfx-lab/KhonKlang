-- 0010_meetup_proposal_price.sql
-- รวมการปรับราคาสินค้า + ผู้จ่ายค่าบริการ เข้ากับข้อเสนอจุดนัด (Pop-Up ตกลงจุดนัด)
--
--   pending_price      = ราคาสินค้าใหม่ที่เสนอมาพร้อมจุดนัด (null = ไม่เปลี่ยน)
--   pending_fee_payer  = ผู้จ่ายค่าบริการที่เสนอ ('buyer' | 'seller' | 'split'; null = ไม่เปลี่ยน)
--   เมื่ออีกฝ่ายกด "ยอมรับ" ระบบจะนำค่าไป update deals.price / deals.fee_payer แล้วล้างฟิลด์ pending
--
-- ปลอดภัยต่อการรันซ้ำ (idempotent)

alter table public.deal_meetup
  add column if not exists pending_price     integer,
  add column if not exists pending_fee_payer text;
