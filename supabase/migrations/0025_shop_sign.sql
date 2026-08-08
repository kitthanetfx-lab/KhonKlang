-- ป้ายร้าน: โลโก้ + แบนเนอร์ + คำโปรย
alter table profiles
  add column if not exists shop_avatar_file_id text,
  add column if not exists shop_banner_file_id text,
  add column if not exists shop_tagline text;
