-- ระบบประมูลตลาดขาย
ALTER TYPE deal_type ADD VALUE IF NOT EXISTS 'auction';

CREATE TABLE IF NOT EXISTS deal_auction (
  deal_id               uuid PRIMARY KEY REFERENCES deals(id) ON DELETE CASCADE,
  display_start_price   integer NOT NULL CHECK (display_start_price >= 0),
  bid_increment         integer NOT NULL CHECK (bid_increment > 0),
  ends_at               timestamptz NOT NULL,
  current_bid           integer CHECK (current_bid IS NULL OR current_bid >= 0),
  current_bidder_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  current_bidder_name   text NOT NULL DEFAULT '',
  bid_count             integer NOT NULL DEFAULT 0,
  unique_bidder_count   integer NOT NULL DEFAULT 0,
  ended_at              timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auction_bids (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id       uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  bidder_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bidder_name   text NOT NULL DEFAULT '',
  amount        integer NOT NULL CHECK (amount > 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auction_bids_deal ON auction_bids(deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_auction_ends ON deal_auction(ends_at) WHERE ended_at IS NULL;

CREATE TRIGGER trg_deal_auction_updated_at
  BEFORE UPDATE ON deal_auction
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE deal_auction ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY deal_auction_read_all ON deal_auction FOR SELECT USING (true);
CREATE POLICY auction_bids_read_all ON auction_bids FOR SELECT USING (true);
