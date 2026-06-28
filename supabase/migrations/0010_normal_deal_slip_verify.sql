-- แยกสถานะตรวจสลิปของดีลปกติเป็นรายฝั่ง
-- payment_slip_verified_at        = เวลาที่ศูนย์กลางตรวจ "สลิปผู้ซื้อ" ว่าถูกต้อง
-- seller_fee_slip_verified_at    = เวลาที่ศูนย์กลางตรวจ "สลิปค่าบริการผู้ขาย" ว่าถูกต้อง

alter table public.deals
  add column if not exists payment_slip_verified_at timestamptz;

alter table public.deal_price_state
  add column if not exists seller_fee_slip_verified_at timestamptz;
