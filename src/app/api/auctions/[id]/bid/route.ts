import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser, HttpError } from '@/lib/supabaseServer';
import { placeAuctionBid } from '../../../_lib/auctionSync';
import { WalletInsufficientError } from '../../../_lib/userWallet';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const me = await verifyUser(req);
    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount);
    const maxBid = body.maxBid != null && body.maxBid !== '' ? Number(body.maxBid) : null;
    const stepAmount = body.stepAmount != null && body.stepAmount !== '' ? Number(body.stepAmount) : null;
    const clearAutoBid = Boolean(body.clearAutoBid);
    if (!isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'กรุณาระบุราคา bid' }, { status: 400 });
    }

    const db = getAdminClient();
    const { data: profile } = await db.from('profiles').select('display_name').eq('id', me.id).maybeSingle();
    const name = profile?.display_name || me.email || 'สมาชิก';

    const auction = await placeAuctionBid(db, id, me.id, name, amount, { maxBid, stepAmount, clearAutoBid });
    return NextResponse.json({ ok: true, auction });
  } catch (err: unknown) {
    if (err instanceof WalletInsufficientError) {
      return NextResponse.json({
        error: err.message,
        code: 'WALLET_INSUFFICIENT',
        need: err.need,
        available: err.available,
      }, { status: 400 });
    }
    const status = err instanceof HttpError ? err.status : 400;
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status });
  }
}
