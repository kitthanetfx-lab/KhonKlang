import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser } from '@/lib/supabaseServer';

async function requireApprovedSeller(db: ReturnType<typeof getAdminClient>, userId: string) {
  const { data: profile, error } = await db.from('profiles')
    .select('seller_status, shop_name, shop_location, shop_address, shop_public')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (profile?.seller_status !== 'approved') {
    return { error: 'ต้องเป็นผู้ขายที่อนุมัติแล้ว', status: 403 as const, profile: null };
  }
  return { error: null, status: 200 as const, profile };
}

export async function GET(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const db = getAdminClient();
    const check = await requireApprovedSeller(db, me.id);
    if (check.error) return NextResponse.json({ error: check.error }, { status: check.status });

    return NextResponse.json({
      shop: {
        shopName: check.profile?.shop_name || '',
        shopLocation: check.profile?.shop_location || '',
        shopAddress: check.profile?.shop_address || '',
        shopPublic: Boolean(check.profile?.shop_public),
      },
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
    const shopLocation = String(body.shopLocation ?? '').trim().slice(0, 80);
    const shopAddress = String(body.shopAddress ?? '').trim().slice(0, 500);
    const shopPublic = body.shopPublic === true;

    const { error } = await db.from('profiles').update({
      shop_name: shopName,
      shop_location: shopLocation,
      shop_address: shopAddress,
      shop_public: shopPublic,
    }).eq('id', me.id);
    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      shop: { shopName, shopLocation, shopAddress, shopPublic },
    });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
