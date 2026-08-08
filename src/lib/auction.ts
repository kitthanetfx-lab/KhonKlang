// ระบบประมูลตลาด — ใช้ได้ทั้ง client และ server

export type AuctionPhase = 'scheduled' | 'live' | 'ended';

export interface AuctionRow {
  deal_id: string;
  display_start_price: number;
  bid_increment: number;
  ends_at: string;
  current_bid: number | null;
  current_bidder_id: string | null;
  current_bidder_name: string;
  bid_count: number;
  unique_bidder_count: number;
  ended_at: string | null;
}

export interface AuctionPublic {
  dealId: string;
  displayStartPrice: number;
  bidIncrement: number;
  endsAt: string;
  currentBid: number | null;
  currentBidderId: string | null;
  currentBidderName: string;
  bidCount: number;
  uniqueBidderCount: number;
  phase: AuctionPhase;
  endedAt: string | null;
  minNextBid: number;
  leadingPrice: number;
}

export interface AuctionBidRow {
  id: string;
  deal_id: string;
  bidder_id: string;
  bidder_name: string;
  amount: number;
  created_at: string;
}

export function getAuctionPhase(endsAt: string, endedAt: string | null | undefined, now = Date.now()): AuctionPhase {
  if (endedAt) return 'ended';
  const end = new Date(endsAt).getTime();
  if (!isFinite(end)) return 'ended';
  return now >= end ? 'ended' : 'live';
}

export function minNextBidAmount(auction: Pick<AuctionPublic, 'displayStartPrice' | 'currentBid' | 'bidIncrement'>): number {
  if (auction.currentBid == null) return auction.displayStartPrice;
  return auction.currentBid + auction.bidIncrement;
}

export function leadingBidPrice(auction: Pick<AuctionPublic, 'displayStartPrice' | 'currentBid'>): number {
  return auction.currentBid != null ? auction.currentBid : auction.displayStartPrice;
}

export function rowToAuctionPublic(row: AuctionRow, now = Date.now()): AuctionPublic {
  const phase = getAuctionPhase(row.ends_at, row.ended_at, now);
  const pub: AuctionPublic = {
    dealId: row.deal_id,
    displayStartPrice: Number(row.display_start_price) || 0,
    bidIncrement: Number(row.bid_increment) || 1,
    endsAt: row.ends_at,
    currentBid: row.current_bid != null ? Number(row.current_bid) : null,
    currentBidderId: row.current_bidder_id || null,
    currentBidderName: row.current_bidder_name || '',
    bidCount: Number(row.bid_count) || 0,
    uniqueBidderCount: Number(row.unique_bidder_count) || 0,
    phase,
    endedAt: row.ended_at || null,
    minNextBid: 0,
    leadingPrice: 0,
  };
  pub.minNextBid = minNextBidAmount(pub);
  pub.leadingPrice = leadingBidPrice(pub);
  return pub;
}

/** แสดงเวลานับถอยหลัง HH:MM:SS หรือ DD วัน HH:MM:SS */
export function formatAuctionCountdown(endsAt: string, now = Date.now()): string {
  const end = new Date(endsAt).getTime();
  if (!isFinite(end)) return '—';
  const diff = Math.max(0, end - now);
  if (diff === 0) return 'ปิดแล้ว';
  const sec = Math.floor(diff / 1000);
  const days = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (days > 0) return `${days} วัน ${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export const AUCTION_DURATION_OPTIONS = [
  { hours: 24, label: '1 วัน' },
  { hours: 72, label: '3 วัน' },
  { hours: 168, label: '7 วัน' },
] as const;
