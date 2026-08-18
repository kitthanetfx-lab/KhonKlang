/**
 * นำทางเมื่อแอpp ถูกเรียกจากภายนอก (App Links / deep link)
 * — ยังไม่ login → ไปหน้า login ในแอpp + เก็บ returnTo
 * — ไม่รับ session จากเบราว์เซอร์ (auth callback → login ในแอpp)
 */
import { isGlanghubApp } from '@/lib/nativeAuth';
import { isAuthCallbackPath } from '@/lib/appAuthHandoff';

const APP_LOGIN_PATHS = ['/login', '/privacy', '/terms'];

function pathOnly(path: string): string {
  return path.split('?')[0].split('#')[0];
}

/** อ่าน session จาก localStorage แบบ sync — ใช้ก่อน paint ในแอpp */
export function hasSupabaseSessionSync(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.includes('-auth-token')) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const data = JSON.parse(raw) as { access_token?: string; expires_at?: number };
      if (!data?.access_token) continue;
      if (data.expires_at && data.expires_at * 1000 < Date.now() + 5000) continue;
      return true;
    }
  } catch { /* ignore */ }
  return false;
}

/** redirect ทันที (sync) ถ้ายังไม่ login — คืน true ถ้า redirect แล้ว */
export function redirectAppEntrySync(path: string): boolean {
  if (!isGlanghubApp()) return false;

  const target = path.startsWith('/') ? path : `/${path}`;
  const current = `${window.location.pathname}${window.location.search}`;

  if (isAuthCallbackPath(target)) {
    if (document.cookie.includes('line_session_pending=')) return false;
    if (window.location.hash.includes('access_token')) return false;
    const login = appLoginUrl(returnToFromAuthCallback(target));
    if (current !== login) window.location.replace(login);
    return true;
  }

  if (isAppLoginPage(target)) return false;

  if (!hasSupabaseSessionSync()) {
    const login = appLoginUrl(target);
    if (current !== login) window.location.replace(login);
    return true;
  }

  return false;
}

function isAppLoginPage(path: string): boolean {
  const p = pathOnly(path);
  return APP_LOGIN_PATHS.some(x => p === x || p.startsWith(x + '/'));
}

/** returnTo ที่ปลอดภัย — ต้องเป็น path ภายในเว็บ */
export function safeReturnPath(path: string): string {
  const raw = path.split('#')[0];
  const p = pathOnly(raw);
  if (!p.startsWith('/') || p.startsWith('//')) return '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

export function appLoginUrl(returnTo: string): string {
  return `/login?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`;
}

function returnToFromAuthCallback(path: string): string {
  try {
    const u = new URL(path, window.location.origin);
    return u.searchParams.get('returnTo') || '/';
  } catch {
    return '/';
  }
}

/**
 * จัดการลิงก์ที่เปิดแอpp จากภายนอก
 * เรียกจาก NativeDeepLinkBridge และ AppColdStartBridge
 */
export async function handleAppExternalLink(path: string): Promise<void> {
  if (!isGlanghubApp()) {
    window.location.replace(path);
    return;
  }

  if (redirectAppEntrySync(path)) return;

  const target = path.startsWith('/') ? path : `/${path}`;
  const current = `${window.location.pathname}${window.location.search}`;

  if (current === target) return;
  window.location.replace(target);
}

/** ตรวจ URL ปัจจุบันตอนแอppโหลด (cold start / App Link เปิดตรง path) */
export async function handleAppCurrentUrl(): Promise<void> {
  if (!isGlanghubApp()) return;
  const path = `${window.location.pathname}${window.location.search}`;
  await handleAppExternalLink(path);
}
