import type { SupabaseClient } from '@supabase/supabase-js';
import { SERVICE_CONTROL_DEFAULTS, ServiceControlMap, ServiceControlKey, sanitizeServiceControls } from '@/lib/serviceControls';

/** อ่านสถานะเปิด/ปิดบริการทั้งหมดจากตาราง service_controls (เดิมเป็น JSON blob ใน app_config) */
export async function readServiceControlsConfig(db: SupabaseClient): Promise<ServiceControlMap> {
  const { data } = await db.from('service_controls').select('key, enabled, note, reopen_at');
  const raw: Record<string, { enabled: boolean; note: string; reopenAt?: string }> = {};
  for (const row of data || []) {
    raw[row.key] = {
      enabled: row.enabled,
      note: row.note || '',
      reopenAt: row.reopen_at ? new Date(row.reopen_at).toISOString() : '',
    };
  }
  return sanitizeServiceControls(raw);
}

/** เขียนค่าทับทั้งรายการ (upsert ตาม key) */
export async function writeServiceControlsConfig(db: SupabaseClient, map: ServiceControlMap) {
  const rows = (Object.keys(map) as ServiceControlKey[]).map(key => ({
    key,
    enabled: map[key].enabled,
    note: map[key].note,
    reopen_at: key === 'siteMaintenance' && map[key].reopenAt ? map[key].reopenAt : null,
  }));
  const { error } = await db.from('service_controls').upsert(rows, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}
