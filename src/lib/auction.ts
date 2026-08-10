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

export type AuctionCountdownParts = {
  days: number;
  h: number;
  m: number;
  s: number;
  totalMs: number;
  ended: boolean;
};

/** แยกส่วนตัวเลขนับถอยหลัง — ใช้แสดง UI แบบใหญ่บนการ์ด */
export function parseAuctionCountdownParts(endsAt: string, now = Date.now()): AuctionCountdownParts {
  const end = new Date(endsAt).getTime();
  if (!isFinite(end)) return { days: 0, h: 0, m: 0, s: 0, totalMs: 0, ended: true };
  const diff = Math.max(0, end - now);
  const sec = Math.floor(diff / 1000);
  return {
    days: Math.floor(sec / 86400),
    h: Math.floor((sec % 86400) / 3600),
    m: Math.floor((sec % 3600) / 60),
    s: sec % 60,
    totalMs: diff,
    ended: diff === 0,
  };
}

/** แสดงเวลานับถอยหลัง HH:MM:SS หรือ DD วัน HH:MM:SS */
export function formatAuctionCountdown(endsAt: string, now = Date.now()): string {
  const p = parseAuctionCountdownParts(endsAt, now);
  if (!isFinite(new Date(endsAt).getTime())) return '—';
  if (p.ended) return 'ปิดแล้ว';
  const pad = (n: number) => String(n).padStart(2, '0');
  if (p.days > 0) return `${p.days} วัน ${pad(p.h)}:${pad(p.m)}:${pad(p.s)}`;
  return `${pad(p.h)}:${pad(p.m)}:${pad(p.s)}`;
}

export const AUCTION_MAX_DURATION_MINUTES = 30 * 24 * 60; // 30 วัน

export type AuctionDurationInput = {
  durationMinutes?: number;
  /** @deprecated ใช้ durationDays + durationHours + durationMinutes แทน */
  durationHours?: number;
  durationDays?: number;
  durationHoursPart?: number;
  durationMinutesPart?: number;
};

/** คำนวณระยะเวลาประมูลเป็น ms — อย่างน้อย 1 นาที */
export function resolveAuctionDurationMs(input: AuctionDurationInput): number {
  if (input.durationMinutes != null && Number.isFinite(Number(input.durationMinutes))) {
    const m = Math.round(Number(input.durationMinutes));
    const clamped = Math.max(1, Math.min(AUCTION_MAX_DURATION_MINUTES, m));
    return clamped * 60 * 1000;
  }
  // legacy: ส่ง durationHours อย่างเดียว
  if (
    input.durationDays == null
    && input.durationHoursPart == null
    && input.durationMinutesPart == null
    && input.durationHours != null
  ) {
    const h = Math.max(1, Math.min(720, Math.round(Number(input.durationHours) || 72)));
    return h * 3600 * 1000;
  }
  const days = Math.max(0, Math.min(30, Math.round(Number(input.durationDays) || 0)));
  const hours = Math.max(0, Math.min(23, Math.round(Number(input.durationHoursPart ?? input.durationHours) || 0)));
  const minutes = Math.max(0, Math.min(59, Math.round(Number(input.durationMinutesPart) || 0)));
  const totalMinutes = days * 24 * 60 + hours * 60 + minutes;
  const clamped = Math.max(1, Math.min(AUCTION_MAX_DURATION_MINUTES, totalMinutes));
  return clamped * 60 * 1000;
}

export function computeAuctionEndsAt(input: AuctionDurationInput, from = Date.now()): string {
  return new Date(from + resolveAuctionDurationMs(input)).toISOString();
}

export function formatDurationPartsLabel(days: number, hours: number, minutes: number): string {
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} วัน`);
  if (hours > 0) parts.push(`${hours} ชม.`);
  if (minutes > 0) parts.push(`${minutes} นาที`);
  if (!parts.length) return '1 นาที';
  return parts.join(' ');
}

export const AUCTION_DURATION_OPTIONS = [
  { hours: 24, label: '1 วัน' },
  { hours: 72, label: '3 วัน' },
  { hours: 168, label: '7 วัน' },
] as const;
