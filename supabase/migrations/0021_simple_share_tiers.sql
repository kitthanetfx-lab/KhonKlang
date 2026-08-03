-- คอมมิชชั่นดีลแบบง่าย 3 ชั้น (เท่าของค่าคนกลางขั้นต่ำ × % แบ่งให้ผู้สร้างดีล)
alter table fee_config
  add column if not exists simple_share_tier1_multiplier numeric(8,2) not null default 1,
  add column if not exists simple_share_tier1_percent numeric(5,2) not null default 30,
  add column if not exists simple_share_tier2_multiplier numeric(8,2) not null default 2,
  add column if not exists simple_share_tier2_percent numeric(5,2) not null default 40,
  add column if not exists simple_share_tier3_multiplier numeric(8,2) not null default 4,
  add column if not exists simple_share_tier3_percent numeric(5,2) not null default 50;
