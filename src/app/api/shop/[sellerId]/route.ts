import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseServer';
import { getShopStats, mapShopProfile } from '@/lib/shopStats';

/** หน้าร้าน public — ไม่ต้อง login */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ sellerId: string }> }) {
  try {
    const { sellerId } = await ctx.params;
    if (!sellerId) return NextResponse.json({ error: 'ไม่พบร้าน' }, { status: 404 });

    const db = getAdminClient();
    const { data: profile, error } = await db.from('profiles')
      .select('id, display_name, seller_status, shop_name, shop_tagline, shop_location, shop_address, shop_public, shop_avatar_file_id, shop_banner_file_id, review_score, review_count')
      .eq('id', sellerId)
      .maybeSingle();
    if (error || !profile) return NextResponse.json({ error: 'ไม่พบร้าน' }, { status: 404 });

    const shop = mapShopProfile(profile);
    if (!shop || shop.sellerStatus !== 'approved') {
      return NextResponse.json({ error: 'ร้านนี้ยังไม่เปิดให้บริการ' }, { status: 404 });
    }
    if (!shop.shopPublic || !shop.shopName) {
      return NextResponse.json({ error: 'ร้านนี้ยังไม่เปิดเผยข้อมูล' }, { status: 404 });
    }

    const [stats, { data: listings }] = await Promise.all([
      getShopStats(db, sellerId),
      db.from('deals')
        .select('id, title, price, category, condition, location, images, status, created_at')
        .eq('seller_id', sellerId)
        .eq('source', 'listing')
        .eq('status', 'posted')
        .order('created_at', { ascending: false })
        .limit(48),
    ]);

    return NextResponse.json({ shop, stats, listings: listings || [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
