-- ดีลแบบง่าย: ผู้ขายต้องรีวิวแล้วกดขอรับเงิน ก่อนแจ้งส่วนกลางโอนค่าสินค้า
-- ดีลที่ completed อยู่แล้ว backfill เพื่อไม่ให้หลุดคิวโอนของแอดมิน

alter table deal_price_state
  add column if not exists payout_requested_at timestamptz;

update deal_price_state ps
set payout_requested_at = coalesce(ps.updated_at, now())
from deals d
where d.id = ps.deal_id
  and d.deal_type = 'simple'
  and d.status = 'completed'
  and ps.payout_requested_at is null;
