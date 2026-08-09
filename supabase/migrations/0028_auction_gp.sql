-- GP ตลาดซื้อขาย (0026) + GP ตลาดประมูลแยก (หักจากราคาปิดประมูล)
alter table fee_config
  add column if not exists marketplace_gp_percent numeric(5,2) not null default 20,
  add column if not exists marketplace_gp_commission_percent numeric(5,2) not null default 30,
  add column if not exists auction_gp_percent numeric(5,2) not null default 20,
  add column if not exists auction_gp_commission_percent numeric(5,2) not null default 30;
