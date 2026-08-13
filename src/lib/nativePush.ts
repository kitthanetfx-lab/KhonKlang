/**
 * Push notifications สำหรับแอปมือถือกลางฮับ (Capacitor — โปรเจกต์ glangApp)
 *
 * ฝั่งเว็บไม่ติด npm ของ plugin — แอปฉีด bridge
 * (window.Capacitor.Plugins.PushNotifications) เข้ามาใน WebView ให้อยู่แล้ว
 * รูปแบบเดียวกับ nativeAuth.ts / SocialLogin
 */
import { isGlanghubApp } from '@/lib/nativeAuth';
import { authHeaders } from '@/lib/supabase';

/** ต้องตรงกับ src/lib/push.ts และ AndroidManifest meta-data ใน glangApp */
export const PUSH_CHANNEL_ALERTS = 'glanghub_alerts';
export const PUSH_CHANNEL_CALL = 'glanghub_incoming_call';

type PermissionStatus = {
  receive: 'prompt' | 'granted' | 'denied' | 'prompt-with-rationale';
};

type PluginListenerHandle = { remove: () => Promise<void> };

type PushNotificationsPlugin = {
  checkPermissions(): Promise<PermissionStatus>;
  requestPermissions(): Promise<PermissionStatus>;
  register(): Promise<void>;
  createChannel(channel: {
    id: string;
    name: string;
    description?: string;
    importance?: number;
    sound?: string;
    vibration?: boolean;
    visibility?: number;
  }): Promise<void>;
  addListener(
    event: 'registration',
    cb: (token: { value: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: 'registrationError',
    cb: (err: { error: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: 'pushNotificationActionPerformed',
    cb: (action: { notification: { data?: Record<string, string>; link?: string } }) => void,
  ): Promise<PluginListenerHandle>;
};

type CapacitorGlobal = {
  getPlatform?: () => string;
  Plugins?: Record<string, unknown>;
};

function getCapacitor(): CapacitorGlobal | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor ?? null;
}

function getPushPlugin(): PushNotificationsPlugin | null {
  const cap = getCapacitor();
  return (cap?.Plugins?.PushNotifications as PushNotificationsPlugin | undefined) ?? null;
}

function getNativePlatform(): 'android' | 'ios' | null {
  const platform = getCapacitor()?.getPlatform?.() ?? '';
  if (platform === 'android' || platform === 'ios') return platform;
  return null;
}

let lastToken: string | null = null;
let listenersBound = false;
let onNavigate: ((path: string) => void) | null = null;

export function setPushNavigateHandler(fn: (path: string) => void): void {
  onNavigate = fn;
}

export function extractPushLink(notification: {
  data?: Record<string, string>;
  link?: string;
}): string {
  const data = notification.data || {};
  const raw = data.link || notification.link || data.url || '/';
  if (raw.startsWith('http')) {
    try {
      const u = new URL(raw);
      return u.pathname + u.search;
    } catch {
      return '/';
    }
  }
  return raw.startsWith('/') ? raw : `/${raw}`;
}

async function registerTokenWithServer(token: string, platform: 'android' | 'ios'): Promise<void> {
  const headers = await authHeaders();
  if (!headers.Authorization) return;
  await fetch('/api/push/register', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, platform }),
  }).catch(() => {});
}

export async function unregisterPushToken(): Promise<void> {
  if (!lastToken) return;
  const token = lastToken;
  lastToken = null;
  const headers = await authHeaders();
  if (!headers.Authorization) return;
  await fetch('/api/push/register', {
    method: 'DELETE',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  }).catch(() => {});
}

async function ensureAndroidChannels(plugin: PushNotificationsPlugin): Promise<void> {
  if (getNativePlatform() !== 'android') return;
  // importance 4 = HIGH → มีเสียง + heads-up; ใช้ channel id ใหม่เพื่อไม่ติด channel เก่าที่เงียบ
  await plugin.createChannel({
    id: PUSH_CHANNEL_ALERTS,
    name: 'แจ้งเตือนกลางฮับ',
    description: 'ดีล แชท ตลาด และกิจกรรม',
    importance: 4,
    sound: 'default',
    vibration: true,
  }).catch(() => {});
  await plugin.createChannel({
    id: PUSH_CHANNEL_CALL,
    name: 'สายเรียกเข้า',
    description: 'เมื่อมีคนโทรในดีลหรือทีมงานโทรหา',
    importance: 5,
    sound: 'default',
    vibration: true,
    visibility: 1,
  }).catch(() => {});
}

async function ensureListeners(
  plugin: PushNotificationsPlugin,
  platform: 'android' | 'ios',
): Promise<void> {
  if (listenersBound) return;
  listenersBound = true;

  await plugin.addListener('registration', async ({ value }) => {
    if (!value) return;
    lastToken = value;
    await registerTokenWithServer(value, platform);
  });

  await plugin.addListener('registrationError', () => {});

  await plugin.addListener('pushNotificationActionPerformed', ({ notification }) => {
    onNavigate?.(extractPushLink(notification));
  });
}

/** ขอ permission + ลงทะเบียน FCM/APNs token กับเซิร์ฟเวอร์ (ต้อง login แล้ว) */
export async function initNativePushRegistration(): Promise<void> {
  if (!isGlanghubApp()) return;

  const plugin = getPushPlugin();
  const platform = getNativePlatform();
  if (!plugin || !platform) return;

  await ensureListeners(plugin, platform);
  await ensureAndroidChannels(plugin);

  const perm = await plugin.checkPermissions();
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    const req = await plugin.requestPermissions();
    if (req.receive !== 'granted') return;
  } else if (perm.receive === 'denied') {
    return;
  }

  await plugin.register().catch(() => {});

  // token อาจได้ก่อน login — ส่งซ้ำทุกครั้งที่ init หลัง login
  if (lastToken) {
    await registerTokenWithServer(lastToken, platform);
  }
}
