import { NextRequest, NextResponse } from 'next/server';
import { verifyUser, getAdminClient, HttpError } from '@/lib/supabaseServer';
import { applyUserWallet, getUserWallet, WalletInsufficientError } from '../../_lib/userWallet';
import { notifyUsers } from '../../_lib/notify';

export async function POST(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const db = getAdminClient();
    const { data: profile } = await db
      .from('profiles')
      .select('display_name, bank_name, bank_acct, bank_owner')
      .eq('id', me.id)
      .maybeSingle();

    const { amount } = await req.json();
    const amt = Math.round(Number(amount) || 0);
    if (!amt || amt <= 0) return NextResponse.json({ error: 'กรุณากรอกจำนวนเงินที่ต้องการถอน' }, { status: 400 });
    if (!profile?.bank_acct || !profile?.bank_name) {
      return NextResponse.json({ error: 'กรุณาบันทึกบัญชีธนาคารในโปรไฟล์ก่อนถอนเงิน' }, { status: 400 });
    }

    const wallet = await getUserWallet(db, me.id, profile.display_name || '');
    if (wallet.availableBalance < amt) {
      return NextResponse.json({
        error: `ยอดพร้อมใช้ไม่พอ (คงเหลือ ฿${wallet.availableBalance.toLocaleString()})`,
        code: 'WALLET_INSUFFICIENT',
        need: amt,
        available: wallet.availableBalance,
      }, { status: 400 });
    }

    const { data: created, error } = await db.from('wallet_withdrawals').insert({
      user_id: me.id,
      amount: amt,
      bank_name: profile.bank_name,
      bank_acct: profile.bank_acct,
      bank_owner: profile.bank_owner || profile.display_name || '',
      status: 'pending_review',
    }).select().single();
    if (error) throw new Error(error.message);

    try {
      await applyUserWallet(db, {
        userId: me.id,
        amount: amt,
        availableDelta: -amt,
        heldDelta: 0,
        entryKey: `withdraw-hold:${created.id}`,
        type: 'withdraw_hold',
        title: `ขอถอนเงิน ฿${amt.toLocaleString()}`,
        referenceType: 'wallet_withdrawal',
        referenceId: created.id,
        need: amt,
      });
    } catch (holdErr) {
      await db.from('wallet_withdrawals').delete().eq('id', created.id);
      if (holdErr instanceof WalletInsufficientError) {
        return NextResponse.json({
          error: holdErr.message,
          code: 'WALLET_INSUFFICIENT',
          need: holdErr.need,
          available: holdErr.available,
        }, { status: 400 });
      }
      throw holdErr;
    }

    const { data: admins } = await db.from('profiles').select('id').eq('role', 'admin').limit(50);
    await notifyUsers(db, (admins || []).map(a => a.id), {
      title: 'กระเป๋าเงิน — มีคำขอถอนเงิน',
      body: `${profile.display_name || 'สมาชิก'} ขอถอน ฿${amt.toLocaleString()}`,
      link: '/admin/wallet',
    }).catch(() => {});

    return NextResponse.json({ success: true, withdrawal: created });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status });
  }
}
