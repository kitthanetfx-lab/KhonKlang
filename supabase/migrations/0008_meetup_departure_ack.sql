-- 0008_meetup_departure_ack.sql
-- ข้อ5: ปุ่ม "รับทราบ" การออกเดินทางของอีกฝ่าย (โหมดรับประกันการเดินทาง / meetup)
--
-- ความหมายของคอลัมน์ (mutual acknowledge):
--   buyer_departed_ack_at  = เวลาที่ "ผู้ขาย" กดรับทราบว่า "ผู้ซื้อ" ออกเดินทางแล้ว
--   seller_departed_ack_at = เวลาที่ "ผู้ซื้อ" กดรับทราบว่า "ผู้ขาย" ออกเดินทางแล้ว
--
-- ปลอดภัยต่อการรันซ้ำ (idempotent) ด้วย IF NOT EXISTS

alter table public.deal_meetup
  add column if not exists buyer_departed_ack_at  timestamptz,
  add column if not exists seller_departed_ack_at timestamptz;
