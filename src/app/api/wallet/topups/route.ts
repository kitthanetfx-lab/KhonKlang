import { NextRequest, NextResponse } from 'next/server';
import { verifyUser, getAdminClient, HttpError } from '@/lib/supabaseServer';
import { ensureUserWallet } from '../../_lib/userWallet';
import { notifyUsers } from '../../_lib/notify';
import { runAutoWalletTopupVerification } from '../../_lib/walletTopupVerify';

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

    const result = await runAutoWalletTopupVerification(
      db,
      created as { id: string; user_id: string; amount: number; slip_file_id?: string; created_at?: string },
      profile?.display_name || me.email || 'สมาชิก',
    ).catch(() => ({ autoApproved: false as const, skipped: true }));

    if (!result.autoApproved && !process.env.LINE_ADMIN_GROUP_ID) {
      const { data: admins } = await db.from('profiles').select('id').eq('role', 'admin').limit(50);
      await notifyUsers(db, (admins || []).map(a => a.id), {
        title: 'กระเป๋าเงิน — มีคำขอเติมเงิน',
        body: `${profile?.display_name || 'สมาชิก'} แจ้งเติม ฿${amt.toLocaleString()}`,
        link: '/admin/wallet',
      }).catch(() => {});
    }

    const { data: fresh } = await db.from('wallet_topups').select('*').eq('id', created.id).maybeSingle();
    return NextResponse.json({
      success: true,
      topup: fresh || created,
      autoApproved: Boolean(result.autoApproved),
    });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status });
  }
}
