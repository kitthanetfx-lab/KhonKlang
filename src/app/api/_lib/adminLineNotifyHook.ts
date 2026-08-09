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
    if (steps.length) await notifyAdminLineSteps(db, after, steps);
  } catch (err) {
    console.error('[adminLineNotifyHook]', err);
  }
}
