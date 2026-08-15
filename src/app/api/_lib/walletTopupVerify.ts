import type { SupabaseClient } from '@supabase/supabase-js';
import { verifySlipByFileId, isSlipokConfigured, isSlipImageFile } from '@/lib/slipok';
import { evaluateSlipCheck, type SlipCheckEvaluation } from '@/app/api/_lib/slipAutoVerify';
import { readFeesConfig } from '@/app/api/_lib/financeLedger';
import { readServiceControlsConfig } from '@/app/api/_lib/appConfig';
import { shouldAutoVerifySlip } from '@/lib/serviceControls';
import { creditApprovedWalletTopup } from '@/app/api/_lib/userWallet';
import { notifyUsers } from '@/app/api/_lib/notify';
import { notifyAdminLineWalletTopup } from '@/lib/lineAdminNotify';

export async function runAutoWalletTopupVerification(
  db: SupabaseClient,
  topup: { id: string; user_id: string; amount: number; slip_file_id?: string | null; created_at?: string },
  userName: string,
): Promise<{ autoApproved: boolean; evaluation?: SlipCheckEvaluation; skipped?: boolean }> {
  const amount = Math.round(Number(topup.amount) || 0);
  const fileId = String(topup.slip_file_id || '');
  const displayName = userName || 'สมาชิก';

  const notifyAdmin = async (opts: {
    autoApproved: boolean;
    skipped?: boolean;
    skipReason?: string;
    evaluation?: SlipCheckEvaluation;
  }) => {
    await notifyAdminLineWalletTopup({
      userName: displayName,
      amount,
      autoApproved: opts.autoApproved,
      skipped: opts.skipped,
      skipReason: opts.skipReason,
      evaluation: opts.evaluation,
      slipFileId: fileId,
    }).catch(() => {});
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
    uploadedAt: topup.created_at ? new Date(topup.created_at) : new Date(),
  });

  if (evaluation.pass) {
    const { data: updated } = await db.from('wallet_topups').update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reject_reason: evaluation.warnings.length ? evaluation.warnings.join(' · ').slice(0, 400) : null,
    }).eq('id', topup.id).eq('status', 'pending_review').select('id').maybeSingle();

    if (updated) {
      await creditApprovedWalletTopup(db, topup);
      await notifyUsers(db, [topup.user_id], {
        title: 'เติมเงินเข้ากระเป๋าแล้ว',
        body: `ตรวจสลิปผ่าน — ยอด ฿${amount.toLocaleString()} เข้ากระเป๋าแล้ว`,
        link: '/wallet',
      }).catch(() => {});
    }

    await notifyAdmin({ autoApproved: true, evaluation });
    return { autoApproved: true, evaluation };
  }

  const reasonText = evaluation.reasons.join(' · ') || 'ตรวจไม่ผ่าน';
  await db.from('wallet_topups').update({
    reject_reason: `[ระบบตรวจสลิป] ${reasonText}`.slice(0, 400),
  }).eq('id', topup.id).eq('status', 'pending_review');

  await notifyUsers(db, [topup.user_id], {
    title: 'สลิปเติมเงินยังไม่ผ่าน',
    body: `${reasonText} — ทีมงานจะตรวจให้อีกครั้ง`,
    link: '/wallet',
  }).catch(() => {});

  await notifyAdmin({ autoApproved: false, evaluation });
  return { autoApproved: false, evaluation };
}
