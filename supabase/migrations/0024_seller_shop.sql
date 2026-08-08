-- ข้อมูลร้านของผู้ขาย (หน้าร้านของฉัน)
alter table profiles
  add column if not exists shop_name text,
  add column if not exists shop_location text,
  add column if not exists shop_address text,
  add column if not exists shop_public boolean not null default false;
