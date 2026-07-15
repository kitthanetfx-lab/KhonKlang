/**
 * Native Google Sign-In สำหรับแอปมือถือกลางฮับ (Capacitor — โปรเจกต์ glangApp)
 *
 * Google ห้าม OAuth ผ่าน WebView (Error 403: disallowed_useragent) —
 * ในแอปจึงใช้ตัวเลือกบัญชีแบบ native ของเครื่องผ่าน plugin
 * @capgo/capacitor-social-login แล้วเอา ID token มา login กับ Supabase
 * ด้วย signInWithIdToken() แทน — จบในแอป ไม่เด้งออกเบราว์เซอร์
 *
 * ฝั่งเว็บไม่ต้องติดตั้ง npm package ของ plugin — แอปฉีด bridge
 * (window.Capacitor.Plugins.SocialLogin) เข้ามาใน WebView ให้อยู่แล้ว
 *
 * Env ที่ต้องตั้งบน Vercel: NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID
 * (Web Client ID ตัวเดียวกับที่ตั้งไว้ใน Supabase → Auth → Google)
 */

type SocialLoginPlugin = {
  initialize(opts: { google: { webClientId: string } }): Promise<void>;
  login(opts: {
    provider: 'google';
    options?: Record<string, never>;
  }): Promise<{ provider: string; result: { idToken?: string | null } }>;
};

/** รันอยู่ในแอปมือถือกลางฮับหรือไม่ (ตั้ง appendUserAgent: 'GlanghubApp' ใน capacitor.config.ts) */
export function isGlanghubApp(): boolean {
  return typeof navigator !== 'undefined' && /GlanghubApp/i.test(navigator.userAgent || '');
}

function getSocialLoginPlugin(): SocialLoginPlugin | null {
  if (typeof window === 'undefined') return null;
  const cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, unknown> } }).Capacitor;
  return (cap?.Plugins?.SocialLogin as SocialLoginPlugin | undefined) ?? null;
}

let googleInitialized = false;

/**
 * เปิดตัวเลือกบัญชี Google แบบ native แล้วคืน ID token
 * throw Error ถ้า: ไม่ได้อยู่ในแอป / plugin ไม่พร้อม / ผู้ใช้ยกเลิก / ไม่ได้ token
 */
export async function nativeGoogleIdToken(): Promise<string> {
  const plugin = getSocialLoginPlugin();
  if (!plugin) throw new Error('native_plugin_missing');

  const webClientId = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
  if (!webClientId) throw new Error('missing_google_web_client_id');

  if (!googleInitialized) {
    await plugin.initialize({ google: { webClientId } });
    googleInitialized = true;
  }

  // หมายเหตุ: ห้ามส่ง scopes — plugin จะ throw "You CANNOT use scopes without modifying the main activity"
  // (ID token มี email/ชื่อ/รูปโปรไฟล์ครบอยู่แล้วโดยไม่ต้องขอ scopes เพิ่ม)
  const res = await plugin.login({ provider: 'google', options: {} });
  const idToken = res?.result?.idToken;
  if (!idToken) throw new Error('no_id_token');
  return idToken;
}

/** ผู้ใช้กดยกเลิกเอง (ไม่ต้องแสดง error) */
export function isUserCancelled(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /cancel|canceled|cancelled|13:|user closed/i.test(msg);
}
