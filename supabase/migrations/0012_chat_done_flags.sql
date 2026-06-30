-- เพิ่ม flag ยืนยันขั้น "คุยกันจบแล้ว" ให้แต่ละฝ่าย
-- แทนการอ่าน system message (hasProgressPing) ที่ persist ค้างใน DB ทำให้ step ขึ้นเองโดยไม่ได้กด

alter table deal_price_state
  add column if not exists chat_done_seller    boolean not null default false,
  add column if not exists chat_done_buyer     boolean not null default false,
  add column if not exists chat_done_middleman boolean not null default false;
