-- ส่วนแบ่งคนกลางสำหรับดีลแบบง่าย (simple) + บันทึกผู้สร้างดีล
alter table fee_config
  add column if not exists simple_middleman_share_percent numeric(5,2) not null default 18;

alter table deals
  add column if not exists creator_id uuid references profiles(id) on delete set null;

create index if not exists idx_deals_creator on deals(creator_id);

-- backfill creator_id สำหรับดีล simple เก่า (ประมาณการ — ดีลใหม่บันทึกตอนสร้างแล้ว)
update deals set creator_id = seller_id
where creator_id is null and deal_type = 'simple' and seller_id is not null and buyer_id is null;

update deals set creator_id = buyer_id
where creator_id is null and deal_type = 'simple' and buyer_id is not null and seller_id is null;

update deals set creator_id = seller_id
where creator_id is null and deal_type = 'simple' and seller_id is not null and buyer_id is not null;
