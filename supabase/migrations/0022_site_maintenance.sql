-- ปิดเปิดทั้งเว็บ + วันเวลาเปิดบริการอีกครั้ง
alter table service_controls
  add column if not exists reopen_at timestamptz;

insert into service_controls (key, enabled, note)
values ('siteMaintenance', false, 'เว็บไซต์ปิดปรับปรุงชั่วคราว — กรุณากลับมาทำรายการต่อหลังเปิดให้บริการ')
on conflict (key) do nothing;
