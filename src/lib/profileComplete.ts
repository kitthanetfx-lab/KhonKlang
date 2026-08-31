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

/** path ภายในเว็บเท่านั้น — เก็บ query ไว้ด้วย (เช่น /deal/create?type=simple) */
export function safeReturnTo(path: string | null | undefined): string {
  const raw = String(path || '').split('#')[0];
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

export function currentAppPath(): string {
  if (typeof window === 'undefined') return '/';
  return safeReturnTo(`${window.location.pathname}${window.location.search}`);
}

/** หลังกรอกโปรไฟล์ครบ ถ้ามาจากหน้าแนะนำบริการ ให้เข้าขั้นสร้างดีลเลย */
export function resumePathAfterProfile(returnTo: string | null | undefined): string {
  const dest = safeReturnTo(returnTo);
  const path = dest.split('?')[0];
  if (path === '/service/simple') return '/deal/create?type=simple';
  if (path === '/service/trade/online') return '/deal/create';
  return dest;
}

export function profileIncompleteRedirectUrl(intendedPath?: string): string {
  const dest = safeReturnTo(intendedPath || currentAppPath());
  if (dest === '/profile' || dest.startsWith('/profile?')) return '/profile';
  return `/profile?returnTo=${encodeURIComponent(dest)}`;
}
