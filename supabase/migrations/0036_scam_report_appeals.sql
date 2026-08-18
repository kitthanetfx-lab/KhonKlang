-- อุธรณ์/คำชี้แจงต่อรายงานคนโกง
create table if not exists scam_report_appeals (
  id                  uuid primary key default gen_random_uuid(),
  report_id           uuid not null references scam_reports(id) on delete cascade,
  appellant_id        uuid references profiles(id) on delete set null,
  appellant_name      text not null,
  contact_phone       text,
  contact_line        text,
  contact_email       text,
  statement           text not null check (char_length(statement) >= 30),
  evidence_image_ids  text[] not null default '{}',
  status              approval_status not null default 'pending_review',
  created_at          timestamptz not null default now()
);

create index if not exists idx_scam_appeals_report on scam_report_appeals(report_id);
create index if not exists idx_scam_appeals_status on scam_report_appeals(status);

alter table scam_report_appeals enable row level security;

create policy scam_appeals_insert on scam_report_appeals
  for insert with check (true);

create policy scam_appeals_admin on scam_report_appeals
  for all using (is_admin());
