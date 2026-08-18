/**
 * จัดการกรณี login ใน Chrome/Safari แล้ว Android App Links ดึง URL callback เข้าแอp
 * — session/cookie อยู่คนละที่กับ WebView ของแอp จึงเข้าไม่ได้และหน้ากระพริบ
 */
import { isGlanghubApp } from '@/lib/nativeAuth';

/** path ที่เป็นขั้นตอน auth — ห้าม deep-link navigate ซ้ำ / ห้าม App Links ดัก */
export const AUTH_CALLBACK_PREFIXES = ['/auth/', '/login', '/api/auth/'];

export function isAuthCallbackPath(path: string): boolean {
  return AUTH_CALLBACK_PREFIXES.some(p => path === p || path.startsWith(p));
}

/** หน้า login/register — ไม่แสดง header หลัก */
export function isAuthOnlyPage(path: string): boolean {
  const p = path.split('?')[0];
  return p === '/login' || p.startsWith('/register') || p.startsWith('/auth/');
}

/** เปิดในแอp กลางฮับ และ path เป็น callback จากเบราว์เซอร์ */
export function isAppBrowserHandoff(pathname: string): boolean {
  return isGlanghubApp() && isAuthCallbackPath(pathname);
}

export const APP_LOGIN_HINT =
  'กรุณาเข้าสู่ระบบในแอปนี้โดยตรง — การล็อกอินใน Chrome/Safari จะไม่ sync เข้าแอpp';

export const APP_HANDOFF_FAIL_MSG =
  'ล็อกอินในเบราว์เซอร์สำเร็จแล้ว แต่แอpp ยังไม่ได้รับ session — กรุณาเข้าสู่ระบบด้วย LINE หรือ Google ในแอpp อีกครั้ง';
