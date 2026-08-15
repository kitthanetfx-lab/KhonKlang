import { getAdminClient } from '@/lib/supabaseServer';
import { DEAL_BUCKET, fileViewUrl } from '@/lib/supabase';
import { rowToAuctionPublic } from '@/lib/auction';
import type { AuctionRow } from '@/lib/auction';

export type MarketplaceShareAuction = {
  endsAt: string;
  endedAt: string | null;
  bidCount: number;
  uniqueBidderCount: number;
  displayStartPrice: number;
  currentBid: number | null;
  leadingPrice: number;
  timeRemainingLabel: string;
};

export type MarketplaceShareMeta = {
  id: string;
  title: string;
  description: string;
  shortDescription: string;
  displayPrice: number;
  isAuction: boolean;
  condition?: string | null;
  category?: string | null;
  imageUrls: string[];
  auction?: MarketplaceShareAuction;
};

function cleanText(input: string, max = 160) {
  return String(input || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function formatShareTimeRemaining(endsAt: string, endedAt: string | null, now = Date.now()): string {
  if (endedAt) return 'ปิดประมูลแล้ว';
  const endMs = new Date(endsAt).getTime();
  if (!Number.isFinite(endMs) || now >= endMs) return 'ปิดประมูลแล้ว';
  const sec = Math.floor((endMs - now) / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `เหลือ ${d} วัน ${h} ชม. ${m} นาที`;
  if (h > 0) return `เหลือ ${h} ชม. ${m} นาที`;
  return `เหลือ ${Math.max(1, m)} นาที`;
}

function buildDescription(meta: Omit<MarketplaceShareMeta, 'description'>) {
  const parts = [
    meta.isAuction ? '🔨 สินค้าประมูล' : '🛒 ขายสินค้า',
    meta.condition,
    meta.category,
    meta.shortDescription,
  ].filter(Boolean);

  if (meta.isAuction && meta.auction) {
    parts.unshift(
      `ราคาปัจจุบัน ฿${meta.displayPrice.toLocaleString('th-TH')}`,
      meta.auction.timeRemainingLabel,
      `${meta.auction.uniqueBidderCount} คนบิด · ${meta.auction.bidCount} bid`,
    );
  } else {
    parts.unshift(`ราคา ฿${meta.displayPrice.toLocaleString('th-TH')}`);
  }

  return parts.join(' · ');
}

/** ข้อมูลสำหรับ OG / แชร์ลิงก์ — อ่านได้โดยไม่ต้อง login */
export async function getMarketplaceListingShareMeta(id: string): Promise<MarketplaceShareMeta | null> {
  const db = getAdminClient();
  const { data: deal } = await db
    .from('deals')
    .select('id, title, description, price, condition, category, deal_type, status, source')
    .eq('id', id)
    .maybeSingle();

  if (!deal || deal.source !== 'listing' || deal.deal_type === 'meetup') {
    return null;
  }

  const { data: images } = await db
    .from('deal_images')
    .select('file_id')
    .eq('deal_id', id)
    .order('position', { ascending: true })
    .limit(3);

  const imageUrls = (images || [])
    .map(row => (row.file_id ? fileViewUrl(DEAL_BUCKET, String(row.file_id)) : ''))
    .filter(Boolean);

  const isAuction = deal.deal_type === 'auction';
  let displayPrice = Number(deal.price) || 0;
  let auction: MarketplaceShareAuction | undefined;

  if (isAuction) {
    const { data: aucRow } = await db
      .from('deal_auction')
      .select('*')
      .eq('deal_id', id)
      .maybeSingle();

    if (aucRow) {
      const pub = rowToAuctionPublic(aucRow as AuctionRow);
      displayPrice = pub.leadingPrice || pub.displayStartPrice;
      auction = {
        endsAt: pub.endsAt,
        endedAt: pub.endedAt,
        bidCount: pub.bidCount,
        uniqueBidderCount: pub.uniqueBidderCount,
        displayStartPrice: pub.displayStartPrice,
        currentBid: pub.currentBid,
        leadingPrice: displayPrice,
        timeRemainingLabel: formatShareTimeRemaining(pub.endsAt, pub.endedAt),
      };
    }
  }

  const shortDescription = cleanText(deal.description || '', 120);
  const base = {
    id: deal.id,
    title: deal.title,
    shortDescription,
    displayPrice,
    isAuction,
    condition: deal.condition,
    category: deal.category,
    imageUrls,
    auction,
  };

  return {
    ...base,
    description: buildDescription(base),
  };
}
