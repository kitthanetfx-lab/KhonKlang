/**
 * นำทางเมื่อแอpp ถูกเรียกจากภายนอก (App Links / deep link)
 * — ยังไม่ login → ไปหน้า login ในแอpp + เก็บ returnTo
 * — ไม่รับ session จากเบราว์เซอร์ (auth callback → login ในแอpp)
 */
import { supabase } from '@/lib/supabase';
import { isGlanghubApp } from '@/lib/nativeAuth';
import { isAuthCallbackPath } from '@/lib/appAuthHandoff';

const APP_LOGIN_PATHS = ['/login', '/privacy', '/terms'];

function pathOnly(path: string): string {
  return path.split('?')[0].split('#')[0];
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

  const target = path.startsWith('/') ? path : `/${path}`;

  // callback จาก login ในเบราว์เซอร์ — ไม่รับ ให้ login ในแอpp
  if (isAuthCallbackPath(target)) {
    window.location.replace(appLoginUrl(returnToFromAuthCallback(target)));
    return;
  }

  if (isAppLoginPage(target)) {
    window.location.replace(target);
    return;
  }

  const { data } = await supabase.auth.getSession();
  const current = `${window.location.pathname}${window.location.search}`;

  if (!data.session) {
    const login = appLoginUrl(target);
    if (current === login) return;
    window.location.replace(login);
    return;
  }

  if (current === target) return;
  window.location.replace(target);
}

/** ตรวจ URL ปัจจุบันตอนแอppโหลด (cold start / App Link เปิดตรง path) */
export async function handleAppCurrentUrl(): Promise<void> {
  if (!isGlanghubApp()) return;
  const path = `${window.location.pathname}${window.location.search}`;
  await handleAppExternalLink(path);
}
