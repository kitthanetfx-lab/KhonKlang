/** แปลงปี/เดือน/วัน เป็นข้อความอ่านง่าย — คืน null ถ้าไม่มีประกัน */
export function formatWarranty(years?: number | null, months?: number | null, days?: number | null): string | null {
  const y = Math.max(0, Math.round(Number(years) || 0));
  const m = Math.max(0, Math.min(11, Math.round(Number(months) || 0)));
  const d = Math.max(0, Math.min(30, Math.round(Number(days) || 0)));
  if (y === 0 && m === 0 && d === 0) return null;
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} ปี`);
  if (m > 0) parts.push(`${m} เดือน`);
  if (d > 0) parts.push(`${d} วัน`);
  return parts.join(' ');
}

export function clampWarrantyInput(kind: 'years' | 'months' | 'days', raw: string): number {
  const n = Math.max(0, Math.round(Number(raw) || 0));
  if (kind === 'months') return Math.min(11, n);
  if (kind === 'days') return Math.min(30, n);
  return Math.min(99, n);
}
