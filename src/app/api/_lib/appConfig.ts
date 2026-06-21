import type { SupabaseClient } from '@supabase/supabase-js';
import { SERVICE_CONTROL_DEFAULTS, ServiceControlMap, ServiceControlKey, sanitizeServiceControls } from '@/lib/serviceControls';

/** อ่านสถานะเปิด/ปิดบริการทั้งหมดจากตาราง service_controls (เดิมเป็น JSON blob ใน app_config) */
export async function readServiceControlsConfig(db: SupabaseClient): Promise<ServiceControlMap> {
  const { data } = await db.from('service_controls').select('key, enabled, note');
  const raw: Record<string, { enabled: boolean; note: string }> = {};
  for (const row of data || []) raw[row.key] = { enabled: row.enabled, note: row.note || '' };
  return sanitizeServiceControls(raw);
}

/** เขียนค่าทับทั้ง 8 รายการ (upsert ตาม key) */
export async function writeServiceControlsConfig(db: SupabaseClient, map: ServiceControlMap) {
  const rows = (Object.keys(map) as ServiceControlKey[]).map(key => ({
    key,
    enabled: map[key].enabled,
    note: map[key].note,
  }));
  const { error } = await db.from('service_controls').upsert(rows, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}
