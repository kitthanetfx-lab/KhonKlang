-- ============================================================================
-- 0014 — รองรับ "ลบบัญชีผู้ใช้" จากหน้าแอดมิน
-- ============================================================================
-- เป้าหมาย: ลบบัญชีล็อกอินจริง (auth.users) เพื่อให้สมัครใหม่ด้วยอีเมล/LINE/Google
-- เดิมได้ในฐานะคนใหม่ — แต่ "ดีลต่างๆ" (deals + onsite_jobs) และ "การเงิน"
-- (finance_ledger + middleman_wallets) ต้องอยู่ครบเหมือนเดิมทุกฟิลด์ ห้ามหาย/ห้ามถูกลบ
--
-- ปัญหาทางเทคนิค: profiles.id → auth.users(id) ON DELETE CASCADE อยู่แล้ว
-- (ลบ auth user ลบ profiles ตามไปด้วยเสมอ) แต่ตารางอื่นที่อ้างถึง profiles(id)
-- (deals, finance_ledger, onsite_jobs, messages, deal_evidence, reviews,
-- scam_reports) เดิมไม่มี ON DELETE ระบุไว้ (ค่า default คือ NO ACTION) —
-- ถ้าลบ profiles row ทั้งที่ยังมีดีล/ธุรกรรมอ้างอิงอยู่ Postgres จะ "บล็อก"
-- การลบทันที (foreign key violation)
--
-- วิธีแก้: เปลี่ยนคอลัมน์ที่อ้างถึง profiles(id) ในตารางที่ "ต้องเก็บข้อมูลไว้"
-- ให้เป็น ON DELETE SET NULL แทน — พอบัญชีถูกลบจริง แถวดีล/การเงินยังอยู่ครบ
-- ทุกฟิลด์เป๊ะ มีแค่ "ลิงก์ไปยังผู้ใช้" ที่กลายเป็น NULL แต่ชื่อ ณ ขณะนั้น
-- (เช่น deals.seller_name, finance_ledger.owner_name) ยังคงแสดงอยู่เหมือนเดิม
-- เพราะเป็นคอลัมน์ text แยกต่างหาก ไม่ได้ join สดจาก profiles
--
-- middleman_wallets.middleman_id เป็น PRIMARY KEY เอง (set null ไม่ได้) —
-- ตัดความเป็น foreign key ออกเลย ให้แถวกระเป๋าเงิน/เครดิตคนกลางอยู่ถาวร
-- ไม่ผูกกับการมีอยู่ของ profiles row อีกต่อไป (ตัวเลขการเงินไม่หายแน่นอน)
-- ============================================================================

alter table deals
  drop constraint if exists deals_seller_id_fkey,
  add constraint deals_seller_id_fkey foreign key (seller_id) references profiles(id) on delete set null;
alter table deals
  drop constraint if exists deals_buyer_id_fkey,
  add constraint deals_buyer_id_fkey foreign key (buyer_id) references profiles(id) on delete set null;
alter table deals
  drop constraint if exists deals_middleman_id_fkey,
  add constraint deals_middleman_id_fkey foreign key (middleman_id) references profiles(id) on delete set null;

alter table finance_ledger
  drop constraint if exists finance_ledger_owner_id_fkey,
  add constraint finance_ledger_owner_id_fkey foreign key (owner_id) references profiles(id) on delete set null;

alter table onsite_jobs
  alter column buyer_id drop not null;
alter table onsite_jobs
  drop constraint if exists onsite_jobs_buyer_id_fkey,
  add constraint onsite_jobs_buyer_id_fkey foreign key (buyer_id) references profiles(id) on delete set null;
alter table onsite_jobs
  drop constraint if exists onsite_jobs_middleman_id_fkey,
  add constraint onsite_jobs_middleman_id_fkey foreign key (middleman_id) references profiles(id) on delete set null;

alter table messages
  drop constraint if exists messages_sender_id_fkey,
  add constraint messages_sender_id_fkey foreign key (sender_id) references profiles(id) on delete set null;

alter table deal_evidence
  drop constraint if exists deal_evidence_uploaded_by_fkey,
  add constraint deal_evidence_uploaded_by_fkey foreign key (uploaded_by) references profiles(id) on delete set null;

-- รีวิวที่ "คนถูกลบ" เป็นคนได้รับ (target) ยังอยู่ (เป็นส่วนหนึ่งของหลักฐานดีล) —
-- รีวิวที่ "คนถูกลบ" เป็นคนเขียน (reviewer) จะถูกลบทิ้งจริงตอนลบบัญชี (ทำในโค้ด/ฟังก์ชันด้านล่าง)
alter table reviews
  drop constraint if exists reviews_target_id_fkey,
  add constraint reviews_target_id_fkey foreign key (target_id) references profiles(id) on delete set null;

-- รายงานคนโกงเก็บไว้เพื่อความปลอดภัยของผู้ใช้อื่น แม้คนรายงานจะลบบัญชีไปแล้ว — แค่ตัดการเชื่อมโยงตัวตน
alter table scam_reports
  drop constraint if exists scam_reports_reporter_id_fkey,
  add constraint scam_reports_reporter_id_fkey foreign key (reporter_id) references profiles(id) on delete set null;

-- กระเป๋าเงิน/เครดิตคนกลาง — ถอด FK ออก ให้แถวอยู่ถาวรไม่ว่า profiles row จะยังอยู่หรือไม่
alter table middleman_wallets
  drop constraint if exists middleman_wallets_middleman_id_fkey;

-- ============================================================================
-- ฟังก์ชัน: ลบ "ประวัติที่ไม่ใช่การเงิน/ดีล" ของผู้ใช้คนหนึ่งแบบ transaction เดียว
-- (เรียกจาก API ก่อน auth.admin.deleteUser — ตัวฟังก์ชันนี้ไม่แตะ auth.users เอง
-- เพราะ Admin Auth API ต้องเรียกแยกจากฝั่ง JS ไม่ใช่ SQL statement)
-- ============================================================================
create or replace function delete_account_history(target_id uuid) returns void as $$
begin
  delete from support_threads where customer_id = target_id;     -- cascades: support_messages, call_signals
  delete from notifications   where user_id = target_id;
  delete from dm_messages     where from_id = target_id or to_id = target_id;
  delete from wanted_posts    where user_id = target_id;
  delete from seller_applications    where user_id = target_id;
  delete from middleman_applications where user_id = target_id;
  delete from reviews         where reviewer_id = target_id;      -- รีวิวที่เขาเป็นคนเขียนเอง (target ฝั่งถูกรีวิวเก็บไว้)
end;
$$ language plpgsql security definer;
