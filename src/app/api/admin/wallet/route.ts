import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient, HttpError } from '@/lib/supabaseServer';
import { applyUserWallet, creditApprovedWalletTopup } from '../../_lib/userWallet';
import { notifyUsers } from '../../_lib/notify';
import { runAutoWalletTopupVerification } from '../../_lib/walletTopupVerify';

export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const kind = req.nextUrl.searchParams.get('kind') === 'withdraw' ? 'withdraw' : 'topup';
    const status = req.nextUrl.searchParams.get('status');
    const table = kind === 'withdraw' ? 'wallet_withdrawals' : 'wallet_topups';

    let query = db.from(table).select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(200);
    if (status) query = query.eq('status', status);
    const { data, count } = await query;

    const userIds = Array.from(new Set((data || []).map(d => d.user_id).filter(Boolean)));
    let profilesById: Record<string, { display_name?: string; phone?: string }> = {};
    if (userIds.length) {
      const { data: profiles } = await db.from('profiles').select('id, display_name, phone').in('id', userIds);
      profilesById = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    }

    const documents = (data || []).map(d => ({ ...d, user: profilesById[d.user_id] || null }));
    return NextResponse.json({ documents, total: count || 0, kind });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const adminId = await verifyAdmin(req);
    const db = getAdminClient();
    const { kind, docId, action, reason } = await req.json();
    if (!docId || !action) return NextResponse.json({ error: 'missing params' }, { status: 400 });

    const isWithdraw = kind === 'withdraw';
    const table = isWithdraw ? 'wallet_withdrawals' : 'wallet_topups';
    const { data: doc, error: getErr } = await db.from(table).select('*').eq('id', docId).single();
    if (getErr || !doc) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 });

    if (action === 'recheck') {
      if (isWithdraw) return NextResponse.json({ error: 'คำขอถอนไม่มีสลิปให้ตรวจซ้ำ' }, { status: 400 });
      const { data: profile } = await db.from('profiles').select('display_name').eq('id', doc.user_id).maybeSingle();
      const result = await runAutoWalletTopupVerification(
        db,
        doc as { id: string; user_id: string; amount: number; slip_file_id?: string; created_at?: string; status?: string },
        profile?.display_name || 'สมาชิก',
        { rerun: true },
      );
      const { data: fresh } = await db.from('wallet_topups').select('*').eq('id', docId).maybeSingle();
      return NextResponse.json({ success: true, document: fresh || doc, autoApproved: result.autoApproved, skipped: result.skipped });
    }

    if (doc.status !== 'pending_review') {
      return NextResponse.json({ error: 'รายการนี้ดำเนินการแล้ว' }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const { data: updated, error } = await db.from(table).update({
      status: newStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
      ...(reason ? { reject_reason: String(reason).slice(0, 400) } : {}),
    }).eq('id', docId).select().single();
    if (error) throw new Error(error.message);

    const amount = Math.round(Number(doc.amount) || 0);
    if (isWithdraw) {
      if (action === 'reject') {
        await applyUserWallet(db, {
          userId: doc.user_id,
          amount,
          availableDelta: amount,
          heldDelta: 0,
          entryKey: `withdraw-reject:${doc.id}`,
          type: 'withdraw_reject',
          title: `คืนเงินจากคำขอถอนที่ถูกปฏิเสธ ฿${amount.toLocaleString()}`,
          referenceType: 'wallet_withdrawal',
          referenceId: doc.id,
        });
      } else {
        await applyUserWallet(db, {
          userId: doc.user_id,
          amount,
          availableDelta: 0,
          heldDelta: 0,
          entryKey: `withdraw-paid:${doc.id}`,
          type: 'withdraw_paid',
          title: `ถอนเงินสำเร็จ ฿${amount.toLocaleString()}`,
          referenceType: 'wallet_withdrawal',
          referenceId: doc.id,
        }).catch(() => {});
      }
    } else if (action === 'approve') {
      await creditApprovedWalletTopup(db, { id: doc.id, user_id: doc.user_id, amount });
    }

    const title = isWithdraw
      ? (action === 'approve' ? 'ถอนเงินสำเร็จ' : 'คำขอถอนเงินถูกปฏิเสธ')
      : (action === 'approve' ? 'เติมเงินเข้ากระเป๋าแล้ว' : 'คำขอเติมเงินถูกปฏิเสธ');
    const body = isWithdraw
      ? (action === 'approve'
        ? `โอนออก ฿${amount.toLocaleString()} แล้ว`
        : `คืน ฿${amount.toLocaleString()} เข้ากระเป๋าแล้ว${reason ? ` — ${reason}` : ''}`)
      : (action === 'approve'
        ? `ยอด ฿${amount.toLocaleString()} เข้ากระเป๋าแล้ว`
        : `คำขอเติม ฿${amount.toLocaleString()} ไม่ผ่าน${reason ? ` — ${reason}` : ''}`);

    await notifyUsers(db, [doc.user_id], {
      title,
      body,
      link: '/wallet',
    }).catch(() => {});

    return NextResponse.json({ success: true, document: updated });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status });
  }
}
