import { NextRequest, NextResponse } from 'next/server';
import { verifyUser, getAdminClient, HttpError } from '@/lib/supabaseServer';
import { ensureUserWallet } from '../../_lib/userWallet';
import { notifyUsers } from '../../_lib/notify';

export async function POST(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const db = getAdminClient();
    const { data: profile } = await db.from('profiles').select('display_name').eq('id', me.id).maybeSingle();
    await ensureUserWallet(db, me.id, profile?.display_name || me.email || '');

    const { amount, slipFileId } = await req.json();
    const amt = Math.round(Number(amount) || 0);
    if (!amt || amt <= 0) return NextResponse.json({ error: 'กรุณากรอกจำนวนเงินที่โอน' }, { status: 400 });
    if (!slipFileId) return NextResponse.json({ error: 'กรุณาอัปโหลดสลิปการโอนเงิน' }, { status: 400 });

    const { data: created, error } = await db.from('wallet_topups').insert({
      user_id: me.id,
      amount: amt,
      slip_file_id: String(slipFileId).slice(0, 255),
      status: 'pending_review',
    }).select().single();
    if (error) throw new Error(error.message);

    const { data: admins } = await db.from('profiles').select('id').eq('role', 'admin').limit(50);
    await notifyUsers(db, (admins || []).map(a => a.id), {
      title: 'กระเป๋าเงิน — มีคำขอเติมเงิน',
      body: `${profile?.display_name || 'สมาชิก'} แจ้งเติม ฿${amt.toLocaleString()}`,
      link: '/admin/wallet',
    }).catch(() => {});

    return NextResponse.json({ success: true, topup: created });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status });
  }
}
