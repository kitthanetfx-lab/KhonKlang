/**
 * Deep Links / App Links สำหรับแอpมือถือกลางฮับ (Capacitor — โปรเจกต์ glangApp)
 *
 * เมื่อผู้ใช้กดลิงก์ https://www.glanghub.com/deal/... จาก Chrome/LINE/SMS
 * Android เปิดแอp → plugin App ส่ง appUrlOpen → นำทาง WebView ไป path นั้น
 *
 * ฝั่งเว็บไม่ติด npm ของ plugin — แอpฉีด bridge (window.Capacitor.Plugins.App)
 */
import { isGlanghubApp } from '@/lib/nativeAuth';

const ALLOWED_HOSTS = new Set(['www.glanghub.com', 'glanghub.com']);

type PluginListenerHandle = { remove: () => Promise<void> };

type AppPlugin = {
  getLaunchUrl(): Promise<{ url: string } | undefined>;
  addListener(
    event: 'appUrlOpen',
    cb: (event: { url: string }) => void,
  ): Promise<PluginListenerHandle>;
};

function getAppPlugin(): AppPlugin | null {
  if (typeof window === 'undefined') return null;
  const cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, unknown> } }).Capacitor;
  return (cap?.Plugins?.App as AppPlugin | undefined) ?? null;
}

/** แปลง URL ที่เปิดแอp เป็น path ภายในเว็บ (เช่น /deal/abc?call=1) */
export function extractDeepLinkPath(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol === 'glanghub:') {
      const raw = u.pathname.replace(/^\/+/, '') || u.host.replace(/^open$/i, '');
      if (!raw || raw === 'open') return '/';
      return raw.startsWith('/') ? `${raw}${u.search}${u.hash}` : `/${raw}${u.search}${u.hash}`;
    }
    if (!ALLOWED_HOSTS.has(u.hostname)) return null;
    const path = u.pathname + u.search + u.hash;
    return path.startsWith('/') ? path : `/${path}`;
  } catch {
    return null;
  }
}

let onNavigate: ((path: string) => void) | null = null;
let listenersBound = false;

export function setDeepLinkNavigateHandler(fn: (path: string) => void): void {
  onNavigate = fn;
}

function handleIncomingUrl(url: string): void {
  const path = extractDeepLinkPath(url);
  if (path) onNavigate?.(path);
}

/** ฟัง deep link ตอนแอpเปิด / กดลิงก์ขณะแอpอยู่เบื้องหลัง */
export async function initNativeDeepLinks(): Promise<void> {
  if (!isGlanghubApp()) return;
  const plugin = getAppPlugin();
  if (!plugin) return;

  if (!listenersBound) {
    listenersBound = true;
    await plugin.addListener('appUrlOpen', ({ url }) => {
      if (url) handleIncomingUrl(url);
    });
  }

  const launch = await plugin.getLaunchUrl().catch(() => undefined);
  if (launch?.url) handleIncomingUrl(launch.url);
}
