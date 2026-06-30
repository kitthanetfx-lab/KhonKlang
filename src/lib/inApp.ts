/**
 * ตรวจจับว่ากำลังเปิดผ่านเบราว์เซอร์ภายในแอป (in-app WebView) ของแพลตฟอร์มไหน
 * — WebView พวกนี้เป็นคนละ session กับ Chrome/Safari จึงไม่เห็นการล็อกอินเดิม
 */
export type InAppKind = '' | 'line' | 'messenger' | 'facebook' | 'instagram' | 'tiktok' | 'telegram' | 'webview';

export function detectInApp(): InAppKind {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent || '';
  if (/Line\//i.test(ua)) return 'line';
  if (/FB_IAB|FBAN|FBAV/i.test(ua)) return /Messenger/i.test(ua) ? 'messenger' : 'facebook';
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/TikTok|musical_ly|Bytedance/i.test(ua)) return 'tiktok';
  if (/Telegram/i.test(ua)) return 'telegram';
  // Android WebView ทั่วไป (เช่น Telegram/แอปอื่นที่ใช้ WebView ระบบ) มี token "; wv)" ใน UA
  if (/Android/i.test(ua) && /; wv\)/i.test(ua)) return 'webview';
  return '';
}

export const IN_APP_LABEL: Record<Exclude<InAppKind, ''>, string> = {
  line: 'LINE', messenger: 'Messenger', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok',
  telegram: 'Telegram', webview: 'แอปนี้',
};

/**
 * พยายามเด้งออกไปเบราว์เซอร์หลักของเครื่อง "อัตโนมัติ" ทันทีที่ตรวจเจอ in-app browser
 * - LINE: redirect ตัวเองพร้อม openExternalBrowser=1 → LINE เปิดเบราว์เซอร์หลักให้เอง (ทางการ)
 * - Android (Messenger/Telegram/WebView อื่น): ใช้ intent:// เปิด Chrome/เบราว์เซอร์หลัก
 * - iOS (ที่ไม่ใช่ LINE): ระบบไม่อนุญาตให้บังคับ — คืน false ให้แสดงแบนเนอร์แนะนำแทน
 */
export function tryAutoEscape(kind: InAppKind): boolean {
  if (typeof window === 'undefined' || !kind) return false;
  const href = window.location.href;
  if (kind === 'line') {
    window.location.replace(withExternalBrowserParam(href));
    return true;
  }
  if (/Android/i.test(navigator.userAgent)) {
    try {
      const u = new URL(href);
      const intentUrl = `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;S.browser_fallback_url=${encodeURIComponent(href)};end`;
      window.location.href = intentUrl;
      return true;
    } catch { return false; }
  }
  return false;
}

/** เติมพารามิเตอร์ openExternalBrowser=1 — LINE จะเด้งไปเปิดเบราว์เซอร์หลักของเครื่องให้เอง */
export function withExternalBrowserParam(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('openExternalBrowser', '1');
    return u.toString();
  } catch {
    return url + (url.includes('?') ? '&' : '?') + 'openExternalBrowser=1';
  }
}
