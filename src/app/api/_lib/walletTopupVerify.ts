import type { SupabaseClient } from '@supabase/supabase-js';
import { verifySlipByFileId, isSlipokConfigured, isSlipImageFile, shouldAutoRetrySlipok } from '@/lib/slipok';
import { evaluateSlipCheck, type SlipCheckEvaluation } from '@/app/api/_lib/slipAutoVerify';
import { readFeesConfig } from '@/app/api/_lib/financeLedger';
import { readServiceControlsConfig } from '@/app/api/_lib/appConfig';
import { shouldAutoVerifySlip } from '@/lib/serviceControls';
import { creditApprovedWalletTopup } from '@/app/api/_lib/userWallet';
import { notifyUsers } from '@/app/api/_lib/notify';
import { notifyAdminLineWalletTopup } from '@/lib/lineAdminNotify';
import { getAdminClient } from '@/lib/supabaseServer';
import { scheduleSlipRetry } from '@/app/api/_lib/slipRetrySchedule';

export async function runAutoWalletTopupVerification(
  db: SupabaseClient,
  topup: { id: string; user_id: string; amount: number; slip_file_id?: string | null; created_at?: string; status?: string },
  userName: string,
  opts?: { rerun?: boolean; fromAutoRetry?: boolean },
): Promise<{ autoApproved: boolean; evaluation?: SlipCheckEvaluation; skipped?: boolean; retryScheduled?: boolean }> {
  const amount = Math.round(Number(topup.amount) || 0);
  const fileId = String(topup.slip_file_id || '');
  const displayName = userName || 'สมาชิก';

  const notifyAdmin = async (params: {
    autoApproved: boolean;
    skipped?: boolean;
    skipReason?: string;
    retryScheduled?: boolean;
    evaluation?: SlipCheckEvaluation;
  }) => {
    await notifyAdminLineWalletTopup({
      userName: displayName,
      amount,
      autoApproved: params.autoApproved,
      skipped: params.skipped,
      skipReason: params.skipReason,
      retryScheduled: params.retryScheduled,
      evaluation: params.evaluation,
      slipFileId: fileId,
    }).catch((err) => {
      console.error('[walletTopup] admin LINE failed', err);
    });
  };

  if (!fileId || amount <= 0) {
    await notifyAdmin({ autoApproved: false, skipped: true, skipReason: 'ไม่มีสลิป' });
    return { autoApproved: false, skipped: true };
  }

  const controls = await readServiceControlsConfig(db);
  const canAuto = shouldAutoVerifySlip(controls, amount) && isSlipokConfigured() && isSlipImageFile(fileId);
  if (!canAuto) {
    const skipReason = !isSlipokConfigured()
      ? 'ยังไม่ตั้ง SlipOK'
      : !isSlipImageFile(fileId)
        ? 'ไฟล์ไม่ใช่รูปสลิป'
        : 'โหมดตรวจมือ / ยอดเกินเกณฑ์';
    await notifyAdmin({ autoApproved: false, skipped: true, skipReason });
    return { autoApproved: false, skipped: true };
  }

  const fees = await readFeesConfig(db);
  const result = await verifySlipByFileId(fileId);
  const evaluation = evaluateSlipCheck(result, {
    expectedAmount: amount,
    companyBankAcct: fees.companyBankAcct || '',
    companyPromptPay: fees.companyPromptPay || '',
    uploadedAt: topup.created_at ? new Date(topup.created_at) : new Date(),
  });

  if (evaluation.pass) {
    const { data: newlyApproved } = await db.from('wallet_topups').update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reject_reason: null,
    }).eq('id', topup.id).eq('status', 'pending_review').select('id').maybeSingle();

    if (!newlyApproved && opts?.rerun) {
      await db.from('wallet_topups').update({ reject_reason: null }).eq('id', topup.id).eq('status', 'approved');
    }

    if (newlyApproved || opts?.rerun) {
      try {
        if (newlyApproved) await creditApprovedWalletTopup(db, topup);
      } catch (err) {
        console.error('[walletTopup] credit after approve failed', err);
      }
      await notifyUsers(db, [topup.user_id], {
        title: 'เติมเงินเข้ากระเป๋าแล้ว',
        body: `ตรวจสลิปผ่าน — ยอด ฿${amount.toLocaleString()} เข้ากระเป๋าแล้ว`,
        link: '/wallet',
      }).catch((err) => {
        console.error('[walletTopup] user notify failed', err);
      });
    }

    await notifyAdmin({ autoApproved: true, evaluation });
    return { autoApproved: true, evaluation };
  }

  const reasonText = evaluation.reasons.join(' · ') || 'ตรวจไม่ผ่าน';
  const willAutoRetry = !opts?.fromAutoRetry && shouldAutoRetrySlipok(result.code);

  if (willAutoRetry) {
    await db.from('wallet_topups').update({
      reject_reason: `[รอตรวจซ้ำอัตโนมัติ ~1 นาที] ${reasonText}`.slice(0, 400),
    }).eq('id', topup.id).eq('status', 'pending_review');

    await notifyUsers(db, [topup.user_id], {
      title: 'กำลังตรวจสลิปเติมเงิน',
      body: 'ธนาคารยังไม่อัปเดตรายการ — ระบบจะตรวจซ้ำอัตโนมัติใน 1 นาที',
      link: '/wallet',
    }).catch((err) => {
      console.error('[walletTopup] user notify failed', err);
    });

    await notifyAdmin({ autoApproved: false, evaluation, retryScheduled: true });

    const topupId = topup.id;
    scheduleSlipRetry(async () => {
      const db2 = getAdminClient();
      const { data: fresh } = await db2.from('wallet_topups').select('*').eq('id', topupId).maybeSingle();
      if (!fresh || fresh.status !== 'pending_review') return;
      const { data: profile } = await db2.from('profiles').select('display_name').eq('id', fresh.user_id).maybeSingle();
      await runAutoWalletTopupVerification(
        db2,
        fresh as { id: string; user_id: string; amount: number; slip_file_id?: string; created_at?: string; status?: string },
        profile?.display_name || 'สมาชิก',
        { rerun: true, fromAutoRetry: true },
      );
    });

    return { autoApproved: false, evaluation, retryScheduled: true };
  }

  if (topup.status !== 'approved') {
    await db.from('wallet_topups').update({
      reject_reason: `[ระบบตรวจสลิป] ${reasonText}`.slice(0, 400),
    }).eq('id', topup.id).eq('status', 'pending_review');

    await notifyUsers(db, [topup.user_id], {
      title: 'สลิปเติมเงินยังไม่ผ่าน',
      body: `${reasonText} — ทีมงานจะตรวจให้อีกครั้ง`,
      link: '/wallet',
    }).catch((err) => {
      console.error('[walletTopup] user notify failed', err);
    });
  }

  await notifyAdmin({ autoApproved: false, evaluation });
  return { autoApproved: false, evaluation };
}
