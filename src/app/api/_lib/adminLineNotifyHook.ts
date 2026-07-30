import type { SupabaseClient } from '@supabase/supabase-js';
import {
  detectEnteredAdminQueueSteps,
  loadAdminDealSnapshot,
  type AdminDealSnapshot,
  type AdminDealRow,
} from './adminDealQueue';
import { readFeesConfig } from './financeLedger';
import { notifyAdminLineSteps } from '@/lib/lineAdminNotify';

/** แจ้ง LINE OA เมื่อดีลเพิ่งเข้าคิวงานแอดมิน (best-effort) */
export async function maybeNotifyAdminLineQueues(
  db: SupabaseClient,
  before: AdminDealSnapshot,
  afterDeal: AdminDealRow,
): Promise<void> {
  try {
    const [after, fees] = await Promise.all([
      loadAdminDealSnapshot(db, afterDeal),
      readFeesConfig(db),
    ]);
    const steps = detectEnteredAdminQueueSteps(before, after, fees);
    if (steps.length) await notifyAdminLineSteps(db, after.deal, steps);
  } catch (err) {
    console.error('[adminLineNotifyHook]', err);
  }
}
