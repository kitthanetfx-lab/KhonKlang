import { Databases, Permission, Role } from 'node-appwrite';
import { SERVICE_CONTROL_DEFAULTS, ServiceControlMap, sanitizeServiceControls } from '@/lib/serviceControls';

export const APP_CONFIG_COL = 'app_config';

export async function ensureAppConfigCollection(db: Databases) {
  try {
    await db.getCollection('khonklang_db', APP_CONFIG_COL);
  } catch {
    await db.createCollection('khonklang_db', APP_CONFIG_COL, 'App Config', [Permission.read(Role.any())]).catch(() => {});
    await db.createStringAttribute('khonklang_db', APP_CONFIG_COL, 'data', 4000, false, '').catch(() => {});
  }
}

export async function readJsonConfig<T>(db: Databases, docId: string, defaults: T): Promise<T> {
  try {
    const doc = await db.getDocument('khonklang_db', APP_CONFIG_COL, docId) as unknown as { data?: string };
    const saved = JSON.parse(doc.data || '{}');
    return { ...defaults, ...saved };
  } catch {
    return defaults;
  }
}

export async function writeJsonConfig(db: Databases, docId: string, payload: unknown) {
  const data = JSON.stringify(payload).slice(0, 3900);
  await ensureAppConfigCollection(db);
  let lastErr: unknown = null;
  for (let i = 0; i < 6; i += 1) {
    try {
      try {
        await db.updateDocument('khonklang_db', APP_CONFIG_COL, docId, { data });
      } catch {
        await db.createDocument('khonklang_db', APP_CONFIG_COL, docId, { data });
      }
      return;
    } catch (err) {
      lastErr = err;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw lastErr;
}

export async function readServiceControlsConfig(db: Databases): Promise<ServiceControlMap> {
  return sanitizeServiceControls(await readJsonConfig(db, 'service_controls', SERVICE_CONTROL_DEFAULTS));
}
