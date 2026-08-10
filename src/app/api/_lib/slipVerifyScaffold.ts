import type { SupabaseClient } from '@supabase/supabase-js';

export type SlipVerifyScaffoldResult = {
  skipped: true;
  reason: 'consign_not_active' | 'onsite_not_active';
  referenceId: string;
};

/**
 * ฝากขาย — ยังไม่มี flow ดีล/สลิปจริง
 * เมื่อเปิดใช้งาน: สร้าง deal_type หรือตาราง consign แล้วเรียก SlipOK ตาม pattern ใน slipAutoVerify.ts
 */
export async function runAutoConsignSlipVerification(
  _db: SupabaseClient,
  referenceId: string,
): Promise<SlipVerifyScaffoldResult> {
  return { skipped: true, reason: 'consign_not_active', referenceId };
}

/**
 * ออนไซต์ — ฟิลด์สลิปใน onsite_jobs พร้อมแล้ว (migration 0031)
 * รอ flow อัปสลิปจากผู้ว่าจ้าง + action upload_payment ใน onsite-jobs API
 */
export async function runAutoOnsiteSlipVerification(
  _db: SupabaseClient,
  jobId: string,
): Promise<SlipVerifyScaffoldResult> {
  return { skipped: true, reason: 'onsite_not_active', referenceId: jobId };
}

/** รายการหมวดที่รองรับ SlipOK auto-verify แล้ว */
export const SLIP_AUTO_VERIFY_ACTIVE = ['trade', 'market', 'meetup'] as const;

/** หมวดที่วางโครงไว้แล้ว รอเปิดใช้งาน */
export const SLIP_AUTO_VERIFY_SCAFFOLD = ['consign', 'onsite'] as const;
