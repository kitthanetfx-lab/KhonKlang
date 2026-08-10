-- Auto-bid: จำนวนเงินต่อบิด (สูงกว่าขั้นต่ำรายการได้) + ผูก LINE user สำหรับแจ้ง OA
ALTER TABLE auction_auto_bids
  ADD COLUMN IF NOT EXISTS step_amount integer NOT NULL DEFAULT 0
  CHECK (step_amount >= 0);

COMMENT ON COLUMN auction_auto_bids.step_amount IS
  'จำนวนเงินที่ Auto-bid สู้เพิ่มต่อครั้ง; 0 = ใช้ขั้นต่ำของรายการประมูล';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS line_user_id text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_line_user_id_uidx
  ON profiles (line_user_id)
  WHERE line_user_id IS NOT NULL AND length(trim(line_user_id)) > 0;

COMMENT ON COLUMN profiles.line_user_id IS
  'LINE userId สำหรับ push แจ้งเตือนผ่าน Messaging API (เช่น overbid)';
