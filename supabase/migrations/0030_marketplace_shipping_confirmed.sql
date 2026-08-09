-- ตลาดซื้อขาย — บันทึกว่าผู้ซื้อยืนยันที่อยู่จัดส่งแล้ว (checkout แบบ Shopee)
alter table deal_price_state
  add column if not exists buyer_shipping_confirmed_at timestamptz;
