// ฟิลด์ที่ "บังคับ" ต้องกรอกให้ครบก่อนใช้งานเว็บไซต์ได้ — เรียงตามความสำคัญ
// (บัญชีธนาคารสำคัญที่สุดเพราะใช้รับเงินจากระบบ escrow)
export const REQUIRED_PROFILE_FIELDS = [
  'bank_name',
  'bank_acct',
  'bank_owner',
  'first_name',
  'last_name',
  'phone',
] as const;

export type RequiredProfileField = (typeof REQUIRED_PROFILE_FIELDS)[number];

/** เช็คว่าโปรไฟล์มีข้อมูลครบตามฟิลด์บังคับหรือยัง */
export function isProfileComplete(p: Record<string, unknown> | null | undefined): boolean {
  if (!p) return false;
  return REQUIRED_PROFILE_FIELDS.every(f => typeof p[f] === 'string' && (p[f] as string).trim().length > 0);
}

/** path ภายในเว็บเท่านั้น — เก็บ query ไว้ด้วย และแปลง URL เต็มของโดเมนเดียวกันเป็น path */
export function safeReturnTo(path: string | null | undefined): string {
  const raw = String(path || '').split('#')[0].trim();
  if (!raw) return '/';
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const u = new URL(raw);
      if (typeof window !== 'undefined' && u.origin !== window.location.origin) return '/';
      return safeReturnTo(`${u.pathname}${u.search}`);
    } catch {
      return '/';
    }
  }
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

export function isDealRoomPath(path: string): boolean {
  const p = safeReturnTo(path).split('?')[0];
  return p.startsWith('/deal/') && p !== '/deal/create';
}

export function dealJoinReturnPath(dealId: string, role?: 'buyer' | 'seller'): string {
  const id = String(dealId || '').trim();
  if (!id) return '/';
  return role ? `/deal/${id}?join=${role}` : `/deal/${id}`;
}

export function currentAppPath(): string {
  if (typeof window === 'undefined') return '/';
  return safeReturnTo(`${window.location.pathname}${window.location.search}`);
}

/** หลังกรอกโปรไฟล์ครบ — แยกคนสร้างดีล กับคนเข้าจากลิงก์ดีล */
export function resumePathAfterProfile(returnTo: string | null | undefined): string {
  const dest = safeReturnTo(returnTo);
  const path = dest.split('?')[0];
  // ผู้เข้าร่วมจากลิงก์ดีล — กลับเข้าห้องดีลนั้นเท่านั้น ห้ามไปหน้าสร้าง
  if (isDealRoomPath(dest)) return dest;
  // คนสร้างดีล — จากหน้าสร้างหรือหน้าแนะนำบริการ
  if (path === '/deal/create') return dest;
  if (path === '/service/simple') return '/deal/create?type=simple';
  if (path === '/service/trade/online') return '/deal/create';
  return dest;
}

export function profileIncompleteRedirectUrl(intendedPath?: string): string {
  const dest = safeReturnTo(intendedPath || currentAppPath());
  if (dest === '/profile' || dest.startsWith('/profile?')) return '/profile';
  return `/profile?returnTo=${encodeURIComponent(dest)}`;
}
