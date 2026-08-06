-- สลับตรวจสลิปอัตโนมัติ/แมนนวล + เกณฑ์มูลค่าดีล (deal.price)
alter table service_controls
  add column if not exists amount_threshold numeric;

insert into service_controls (key, enabled, note)
values ('slipAutoVerify', true, '')
on conflict (key) do nothing;
