import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser, HttpError } from '@/lib/supabaseServer';
import { executeAuctionBuyNow } from '../../../_lib/auctionSync';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const me = await verifyUser(req);
    const body = await req.json().catch(() => ({}));
    const shippingProvider = body.shippingProvider != null ? String(body.shippingProvider) : undefined;

    const db = getAdminClient();
    const { data: profile } = await db.from('profiles').select('display_name').eq('id', me.id).maybeSingle();
    const name = profile?.display_name || me.email || 'สมาชิก';

    const result = await executeAuctionBuyNow(db, id, me.id, name, shippingProvider);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 400;
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status });
  }
}
