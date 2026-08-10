import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseServer';
import { getShopStats, mapShopProfile } from '@/lib/shopStats';
import { isPublicShopSold } from '@/lib/marketplaceOrder';

/** หน้าร้าน public — ไม่ต้อง login · โชว์เฉพาะสินค้าขาย + ขายแล้ว (ไม่โชว์งานดำเนินงาน) */
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

    const [stats, { data: rows }] = await Promise.all([
      getShopStats(db, sellerId),
      db.from('deals')
        .select('id, title, price, category, condition, location, images, status, created_at, deal_type, buyer_id')
        .eq('seller_id', sellerId)
        .eq('source', 'listing')
        .order('created_at', { ascending: false })
        .limit(80),
    ]);

    const all = rows || [];
    // สินค้าที่ยังขายได้ — ประมูลที่มีผู้ชนะแล้วไม่โชว์ในชั้นวาง (ไปโซนขายแล้ว)
    const listings = all.filter(d => {
      if (d.status !== 'posted') return false;
      if (d.deal_type === 'auction' && d.buyer_id) return false;
      return true;
    });
    const sold = all.filter(d => isPublicShopSold(d));

    return NextResponse.json({
      shop,
      stats: {
        listingCount: listings.length,
        soldCount: stats.soldCount,
        reviewScore: stats.reviewScore,
        reviewCount: stats.reviewCount,
      },
      listings,
      sold,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
