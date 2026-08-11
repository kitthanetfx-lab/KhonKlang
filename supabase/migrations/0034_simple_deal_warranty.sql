-- เงื่อนไขประกันสินค้า (ใช้กับดีล simple เป็นหลัก)
alter table deals
  add column if not exists warranty_years  integer not null default 0 check (warranty_years >= 0),
  add column if not exists warranty_months integer not null default 0 check (warranty_months >= 0 and warranty_months <= 11),
  add column if not exists warranty_days   integer not null default 0 check (warranty_days >= 0 and warranty_days <= 30);
