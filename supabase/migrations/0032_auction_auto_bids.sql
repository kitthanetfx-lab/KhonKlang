-- Auto-bid (proxy) — ตั้งราคาสูงสุดที่สู้ไว้ ระบบ bid ให้อัตโนมัติ
CREATE TABLE IF NOT EXISTS auction_auto_bids (
  deal_id       uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  bidder_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bidder_name   text NOT NULL DEFAULT '',
  max_amount    integer NOT NULL CHECK (max_amount > 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (deal_id, bidder_id)
);

CREATE INDEX IF NOT EXISTS idx_auction_auto_bids_deal ON auction_auto_bids(deal_id, max_amount DESC);

CREATE TRIGGER trg_auction_auto_bids_updated_at
  BEFORE UPDATE ON auction_auto_bids
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE auction_auto_bids ENABLE ROW LEVEL SECURITY;

-- อ่านได้เฉพาะของตัวเอง (max เป็นความลับ — API ใช้ service role สำหรับ resolve)
CREATE POLICY auction_auto_bids_read_own ON auction_auto_bids
  FOR SELECT USING (bidder_id = auth.uid());
