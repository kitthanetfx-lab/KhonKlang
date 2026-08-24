-- ราคาซื้อทันที + ระยะเวลาประมูล (ใช้เปิดรอบใหม่อัตโนมัติ)
ALTER TABLE deal_auction
  ADD COLUMN IF NOT EXISTS buy_now_price integer CHECK (buy_now_price IS NULL OR buy_now_price > 0),
  ADD COLUMN IF NOT EXISTS duration_minutes integer CHECK (duration_minutes IS NULL OR duration_minutes >= 1);

UPDATE deal_auction da
SET duration_minutes = GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (da.ends_at - d.created_at)) / 60)::int)
FROM deals d
WHERE d.id = da.deal_id AND da.duration_minutes IS NULL;
