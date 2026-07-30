-- บันทึกว่าแจ้ง LINE OA แอดมินแล้ว — ครั้งเดียวต่อดีลต่อขั้นตอน
create table if not exists admin_line_notifications (
  deal_id uuid not null references deals(id) on delete cascade,
  step text not null check (step in ('confirm_pay', 'pay_seller', 'refund_pending', 'middleman_fee', 'meetup_refund')),
  sent_at timestamptz not null default now(),
  primary key (deal_id, step)
);

create index if not exists admin_line_notifications_sent_at_idx on admin_line_notifications (sent_at desc);
