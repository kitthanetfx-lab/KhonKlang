-- ค่า GP ตลาดขาย (บวกจากราคาผู้ขาย) + ราคาฐานผู้ขาย
alter table fee_config
  add column if not exists marketplace_gp_percent numeric(5,2) not null default 20,
  add column if not exists marketplace_gp_commission_percent numeric(5,2) not null default 30;

alter table deals
  add column if not exists list_gross_price integer check (list_gross_price is null or list_gross_price >= 0);
