import { getAdminClient } from '@/lib/supabaseServer';
import { DEAL_BUCKET, fileViewUrl } from '@/lib/supabase';

export type MarketplaceShareMeta = {
  id: string;
  title: string;
  description: string;
  displayPrice: number;
  isAuction: boolean;
  condition?: string | null;
  category?: string | null;
  imageUrl?: string;
};

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
    .limit(1);

  const isAuction = deal.deal_type === 'auction';
  let displayPrice = Number(deal.price) || 0;

  if (isAuction) {
    const { data: auc } = await db
      .from('deal_auction')
      .select('current_bid, display_start_price')
      .eq('deal_id', id)
      .maybeSingle();
    const leading = Number(auc?.current_bid ?? auc?.display_start_price ?? 0);
    if (leading > 0) displayPrice = leading;
  }

  const imageFileId = images?.[0]?.file_id;
  const imageUrl = imageFileId ? fileViewUrl(DEAL_BUCKET, String(imageFileId)) : undefined;

  const shortDesc = String(deal.description || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  const priceLabel = isAuction ? `ราคาเริ่ม/ปัจจุบัน ฿${displayPrice.toLocaleString('th-TH')}` : `฿${displayPrice.toLocaleString('th-TH')}`;
  const description = [
    isAuction ? 'สินค้าประมูลบนกลางฮับ' : 'สินค้าขายบนกลางฮับ',
    priceLabel,
    deal.condition,
    deal.category,
    shortDesc,
  ].filter(Boolean).join(' · ');

  return {
    id: deal.id,
    title: deal.title,
    description,
    displayPrice,
    isAuction,
    condition: deal.condition,
    category: deal.category,
    imageUrl,
  };
}
