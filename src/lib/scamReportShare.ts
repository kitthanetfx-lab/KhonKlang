export type ScamReportShareHit = {
  id: string;
  firstName: string;
  lastName: string;
  bankAccounts: { acct: string; bank: string }[];
  product: string;
  amount: number;
};

export function scamReportShareUrl(reportId: string, origin = '') {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/check-scam?report=${reportId}`;
}

export function scamReportShareText(hit: ScamReportShareHit, origin = '') {
  const name = `${hit.firstName} ${hit.lastName}`.trim();
  const accts = (hit.bankAccounts || [])
    .map((a) => `${a.acct}${a.bank ? ` · ${a.bank}` : ''}`)
    .join(', ');
  const url = scamReportShareUrl(hit.id, origin);
  const lines = [
    '⚠️ แจ้งเตือนก่อนโอน — ฐานข้อมูลคนโกง คนกลาง',
    `👤 ${name}`,
  ];
  if (accts) lines.push(`🏦 ${accts}`);
  if (hit.product) lines.push(`📦 สินค้า: ${hit.product}`);
  if (hit.amount > 0) lines.push(`💰 ยอดโอน: ฿${Number(hit.amount).toLocaleString()}`);
  lines.push('', '📋 ดูรายละเอียด + หลักฐาน:', url);
  return lines.join('\n');
}

export async function copyScamReportShare(hit: ScamReportShareHit): Promise<boolean> {
  const text = scamReportShareText(hit);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt('คัดลอกข้อความนี้ไปลงกลุ่ม/เพจ:', text);
    return false;
  }
}
