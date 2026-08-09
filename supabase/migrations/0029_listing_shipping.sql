-- ค่าขนส่ง + ขนส่งที่ผู้ขายรองรับ + ขนส่งที่ผู้ซื้อเลือก
alter table deals
  add column if not exists shipping_cost integer not null default 0 check (shipping_cost >= 0),
  add column if not exists shipping_providers text[] not null default '{}',
  add column if not exists buyer_shipping_provider text;
