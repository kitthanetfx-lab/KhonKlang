import type { SupabaseClient } from '@supabase/supabase-js';
import {
  detectEnteredAdminQueueSteps,
  loadAdminDealSnapshot,
  type AdminDealSnapshot,
  type AdminDealRow,
  type AdminQueueStep,
} from './adminDealQueue';
import { readFeesConfig } from './financeLedger';
import { notifyAdminLineSteps } from '@/lib/lineAdminNotify';
import { notifyUsers } from './notify';
import { adminDealsPagePath, getDealCategory } from '@/lib/adminDealCategory';

const INAPP_DEAL_STEP_NOTIFY: Partial<Record<AdminQueueStep, { prefix: string; body: string }>> = {
  confirm_pay: {
    prefix: '⚡ ยืนยันรับเงิน',
    body: 'มีสลิปรอตรวจ — เข้าไปยืนยันรับเงินที่ดีล & ข้อพิพาท',
  },
  pay_seller: {
    prefix: '💰 โอนเงินค่าสินค้า',
    body: 'เข้าไปโอนเงินค่าสินค้าให้ผู้ขายที่ดีล & ข้อพิพาท',
  },
};

/** แจ้ง LINE OA เมื่อดีลเพิ่งเข้าคิวงานแอดมิน (best-effort) */
export async function maybeNotifyAdminLineQueues(
  db: SupabaseClient,
  before: AdminDealSnapshot,
  afterDeal: AdminDealRow,
  opts?: { skipSteps?: AdminQueueStep[] },
): Promise<void> {
  try {
    const [after, fees] = await Promise.all([
      loadAdminDealSnapshot(db, afterDeal),
      readFeesConfig(db),
    ]);
    const skip = new Set(opts?.skipSteps || []);
    const steps = detectEnteredAdminQueueSteps(before, after, fees).filter(s => !skip.has(s));
    if (steps.length) await notifyAdminLineSteps(db, after, steps, fees);
  } catch (err) {
    console.error('[adminLineNotifyHook]', err);
  }
}

/** แจ้งกระดิ่งในแอปแอดมิน — ดีล & ข้อพิพาท (ไม่ใช่หน้าการเงิน) */
export async function maybeNotifyAdminInAppQueues(
  db: SupabaseClient,
  before: AdminDealSnapshot,
  afterDeal: AdminDealRow,
  opts?: { onlySteps?: AdminQueueStep[] },
): Promise<void> {
  try {
    const { data: admins } = await db.from('profiles').select('id').eq('role', 'admin').limit(200);
    const adminIds = (admins || []).map(r => r.id as string);
    if (!adminIds.length) return;

    const [after, fees] = await Promise.all([
      loadAdminDealSnapshot(db, afterDeal),
      readFeesConfig(db),
    ]);
    const only = opts?.onlySteps ? new Set(opts.onlySteps) : null;
    const steps = detectEnteredAdminQueueSteps(before, after, fees).filter(s => !only || only.has(s));

    for (const step of steps) {
      const meta = INAPP_DEAL_STEP_NOTIFY[step];
      if (!meta) continue;
      const category = getDealCategory(after.deal);
      await notifyUsers(db, adminIds, {
        title: `${meta.prefix}: ${after.deal.title || 'ดีล'}`,
        body: meta.body,
        link: adminDealsPagePath(category, step),
      });
    }
  } catch (err) {
    console.error('[adminInAppNotifyHook]', err);
  }
}
