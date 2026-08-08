import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser } from '@/lib/supabaseServer';
import { getShopStats, mapShopProfile } from '@/lib/shopStats';

const SHOP_SELECT = 'id, seller_status, shop_name, shop_tagline, shop_location, shop_address, shop_public, shop_avatar_file_id, shop_banner_file_id, review_score, review_count';

async function requireApprovedSeller(db: ReturnType<typeof getAdminClient>, userId: string) {
  const { data: profile, error } = await db.from('profiles')
    .select(SHOP_SELECT)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (profile?.seller_status !== 'approved') {
    return { error: 'ต้องเป็นผู้ขายที่อนุมัติแล้ว', status: 403 as const, profile: null };
  }
  return { error: null, status: 200 as const, profile };
}

function shopPayload(profile: ReturnType<typeof mapShopProfile>) {
  if (!profile) return null;
  return {
    shopName: profile.shopName,
    shopTagline: profile.shopTagline,
    shopLocation: profile.shopLocation,
    shopAddress: profile.shopAddress,
    shopPublic: profile.shopPublic,
    shopAvatarFileId: profile.shopAvatarFileId,
    shopBannerFileId: profile.shopBannerFileId,
    reviewScore: profile.reviewScore,
    reviewCount: profile.reviewCount,
  };
}

export async function GET(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const db = getAdminClient();
    const check = await requireApprovedSeller(db, me.id);
    if (check.error) return NextResponse.json({ error: check.error }, { status: check.status });

    const stats = await getShopStats(db, me.id);
    return NextResponse.json({
      shop: shopPayload(mapShopProfile(check.profile)),
      stats,
    });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const db = getAdminClient();
    const check = await requireApprovedSeller(db, me.id);
    if (check.error) return NextResponse.json({ error: check.error }, { status: check.status });

    const body = await req.json().catch(() => ({}));
    const shopName = String(body.shopName ?? '').trim().slice(0, 120);
    const shopTagline = String(body.shopTagline ?? '').trim().slice(0, 200);
    const shopLocation = String(body.shopLocation ?? '').trim().slice(0, 80);
    const shopAddress = String(body.shopAddress ?? '').trim().slice(0, 500);
    const shopPublic = body.shopPublic === true;
    const shopAvatarFileId = body.shopAvatarFileId != null ? String(body.shopAvatarFileId).trim().slice(0, 120) : undefined;
    const shopBannerFileId = body.shopBannerFileId != null ? String(body.shopBannerFileId).trim().slice(0, 120) : undefined;

    const update: Record<string, unknown> = {
      shop_name: shopName,
      shop_tagline: shopTagline,
      shop_location: shopLocation,
      shop_address: shopAddress,
      shop_public: shopPublic,
    };
    if (shopAvatarFileId !== undefined) update.shop_avatar_file_id = shopAvatarFileId || null;
    if (shopBannerFileId !== undefined) update.shop_banner_file_id = shopBannerFileId || null;

    const { error } = await db.from('profiles').update(update).eq('id', me.id);
    if (error) throw new Error(error.message);

    const stats = await getShopStats(db, me.id);
    return NextResponse.json({
      ok: true,
      shop: {
        shopName, shopTagline, shopLocation, shopAddress, shopPublic,
        shopAvatarFileId: shopAvatarFileId ?? mapShopProfile(check.profile)?.shopAvatarFileId ?? '',
        shopBannerFileId: shopBannerFileId ?? mapShopProfile(check.profile)?.shopBannerFileId ?? '',
      },
      stats,
    });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
