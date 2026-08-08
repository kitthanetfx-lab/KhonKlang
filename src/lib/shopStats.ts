import type { SupabaseClient } from '@supabase/supabase-js';

export type ShopStats = {
  listingCount: number;
  soldCount: number;
  boughtCount: number;
  successfulDeals: number;
  reviewScore: number;
  reviewCount: number;
};

export type ShopProfile = {
  id: string;
  shopName: string;
  shopTagline: string;
  shopLocation: string;
  shopAddress: string;
  shopPublic: boolean;
  shopAvatarFileId: string;
  shopBannerFileId: string;
  displayName: string;
  sellerStatus: string | null;
  reviewScore: number;
  reviewCount: number;
};

export function mapShopProfile(row: Record<string, unknown> | null | undefined): ShopProfile | null {
  if (!row?.id) return null;
  return {
    id: String(row.id),
    shopName: String(row.shop_name || '').trim(),
    shopTagline: String(row.shop_tagline || '').trim(),
    shopLocation: String(row.shop_location || '').trim(),
    shopAddress: String(row.shop_address || '').trim(),
    shopPublic: Boolean(row.shop_public),
    shopAvatarFileId: String(row.shop_avatar_file_id || '').trim(),
    shopBannerFileId: String(row.shop_banner_file_id || '').trim(),
    displayName: String(row.display_name || '').trim(),
    sellerStatus: row.seller_status != null ? String(row.seller_status) : null,
    reviewScore: Number(row.review_score) || 0,
    reviewCount: Number(row.review_count) || 0,
  };
}

/** สถิติร้านจากกิจกรรมซื้อขายจริง */
export async function getShopStats(db: SupabaseClient, userId: string): Promise<ShopStats> {
  const [
    { count: listingCount },
    { count: soldCount },
    { count: boughtCount },
    { data: profile },
  ] = await Promise.all([
    db.from('deals').select('id', { count: 'exact', head: true })
      .eq('seller_id', userId).eq('source', 'listing').eq('status', 'posted'),
    db.from('deals').select('id', { count: 'exact', head: true })
      .eq('seller_id', userId).eq('status', 'completed'),
    db.from('deals').select('id', { count: 'exact', head: true })
      .eq('buyer_id', userId).eq('status', 'completed'),
    db.from('profiles').select('review_score, review_count').eq('id', userId).maybeSingle(),
  ]);

  const sold = soldCount || 0;
  const bought = boughtCount || 0;
  return {
    listingCount: listingCount || 0,
    soldCount: sold,
    boughtCount: bought,
    successfulDeals: sold + bought,
    reviewScore: Number(profile?.review_score) || 0,
    reviewCount: Number(profile?.review_count) || 0,
  };
}
