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
