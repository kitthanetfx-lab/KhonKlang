-- ขั้นต่ำค่าธรรมเนียมดีลแบบง่าย เมื่อราคาสินค้าต่ำกว่า ฿1,000
alter table fee_config
  add column if not exists simple_fee_min_under_1000 integer not null default 20;
