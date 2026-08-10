// ตรวจสลิปโอนเงินผ่าน SlipOK (https://slipok.com) — ใช้ฝั่ง server เท่านั้น (มี API key)
// ตั้งค่าใน .env.local: SLIPOK_BRANCH_ID, SLIPOK_API_KEY (และเพิ่มใน Vercel ด้วย)

export interface SlipInfo {
  amount: number;
  transRef: string;
  transTimestamp?: string;
  transDate?: string;
  transTime?: string;
  sendingBank?: string;
  receivingBank?: string;
  senderName?: string;
  senderAccount?: string;
  receiverName?: string;
  receiverAccount?: string;
}

export interface SlipResult {
  ok: boolean;
  code: string;
  message: string;
  slip?: SlipInfo;
  duplicate?: boolean;
  wrongReceiver?: boolean;
}

interface RawSlip {
  amount?: number; transRef?: string; transTimestamp?: string; transDate?: string; transTime?: string;
  sendingBank?: string; receivingBank?: string;
  sender?: { displayName?: string; name?: string; account?: { value?: string } };
  receiver?: { displayName?: string; name?: string; account?: { value?: string } };
}

function norm(d: RawSlip): SlipInfo {
  return {
    amount: Number(d.amount) || 0,
    transRef: String(d.transRef || ''),
    transTimestamp: d.transTimestamp,
    transDate: d.transDate,
    transTime: d.transTime,
    sendingBank: d.sendingBank,
    receivingBank: d.receivingBank,
    senderName: d.sender?.displayName || d.sender?.name || '',
    senderAccount: d.sender?.account?.value || '',
    receiverName: d.receiver?.displayName || d.receiver?.name || '',
    receiverAccount: d.receiver?.account?.value || '',
  };
}

export function dealSlipPublicUrl(fileId: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return `${base}/storage/v1/object/public/deal-files/${fileId}`;
}

export function isSlipImageFile(fileId: string): boolean {
  const ext = fileId.split('.').pop()?.toLowerCase() || '';
  return ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp';
}

export function isSlipokConfigured(): boolean {
  return Boolean(process.env.SLIPOK_BRANCH_ID?.trim() && process.env.SLIPOK_API_KEY?.trim());
}

/** ข้อความภาษาไทยสำหรับรหัส SlipOK 1000–1014 และข้อผิดพลาดภายใน */
const SLIPOK_CODE_TH: Record<string, string> = {
  '1000': 'กรุณาระบุ QR Code / ไฟล์รูป / URL สลิปให้ครบ',
  '1001': 'ไม่พบข้อมูลสาขา — ตรวจสอบ SLIPOK_BRANCH_ID',
  '1002': 'API Key SlipOK ไม่ถูกต้อง',
  '1003': 'แพ็กเกจ SlipOK หมดอายุแล้ว',
  '1004': 'แพ็กเกจ SlipOK ใช้เกินโควต้า — กรุณาต่ออายุแพ็กเกจ',
  '1005': 'ไฟล์ไม่ใช่รูปภาพ (รองรับ JPG, PNG, WEBP)',
  '1006': 'รูปภาพสลิปไม่ถูกต้อง',
  '1007': 'รูปภาพไม่มี QR Code',
  '1008': 'QR Code นี้ไม่ใช่ QR สำหรับตรวจสอบการชำระเงิน',
  '1009': 'ข้อมูลธนาคารขัดข้องชั่วคราว — ลองใหม่ใน 15 นาที (ไม่เสียโควต้า)',
  '1010': 'สลิปธนาคารนี้ต้องรอระบบธนาคารอัปเดต — ลองใหม่ภายหลัง',
  '1011': 'QR Code หมดอายุ หรือไม่มีรายการโอนนี้ในฐานข้อมูลธนาคาร',
  '1012': 'สลิปซ้ำ — เคยใช้ในระบบแล้ว',
  '1013': 'ยอดที่ส่งตรวจไม่ตรงกับยอดบนสลิป',
  '1014': 'บัญชีผู้รับไม่ตรงกับบัญชีหลักของร้าน',
  no_config: 'ยังไม่ได้ตั้งค่า SlipOK (SLIPOK_BRANCH_ID / SLIPOK_API_KEY)',
  not_image: 'ไฟล์ไม่ใช่รูปสลิป (รองรับ JPG/PNG) — รอแอดมินตรวจด้วยตนเอง',
  network: 'เชื่อมต่อ SlipOK ไม่ได้',
};

const SLIPOK_MESSAGE_ALIASES: Array<{ pattern: RegExp; text: string }> = [
  { pattern: /^not found$/i, text: SLIPOK_CODE_TH['1011'] },
  { pattern: /slip.?not.?found/i, text: SLIPOK_CODE_TH['1011'] },
  { pattern: /qrcode.?not.?found/i, text: SLIPOK_CODE_TH['1007'] },
  { pattern: /duplicate/i, text: SLIPOK_CODE_TH['1012'] },
  { pattern: /wrong.?receiver|receiver/i, text: SLIPOK_CODE_TH['1014'] },
];

/** แปลรหัส/ข้อความจาก SlipOK เป็นภาษาไทยที่อ่านเข้าใจ */
export function formatSlipokError(code: string, message?: string): string {
  const c = String(code || '').trim();
  if (SLIPOK_CODE_TH[c]) return SLIPOK_CODE_TH[c];
  if (c === '404') return 'SlipOK โหลดรูปสลิปจากลิงก์ไม่ได้ (ไฟล์ไม่พบหรือลิงก์ไม่เปิด public)';
  const raw = String(message || '').trim();
  if (raw) {
    for (const { pattern, text } of SLIPOK_MESSAGE_ALIASES) {
      if (pattern.test(raw)) return text;
    }
    // ข้อความไทยจาก SlipOK ใช้ได้เลย
    if (/[\u0E00-\u0E7F]/.test(raw)) return raw;
  }
  return raw || 'สลิปไม่ผ่านการตรวจสอบ';
}

/** ตรวจสลิปจาก URL รูป public (ตามเอกสาร SlipOK ใช้ field url) */
export async function verifySlipByUrl(imageUrl: string, expectedAmount?: number): Promise<SlipResult> {
  const branchId = process.env.SLIPOK_BRANCH_ID?.trim();
  const apiKey = process.env.SLIPOK_API_KEY?.trim();
  if (!branchId || !apiKey) {
    return { ok: false, code: 'no_config', message: 'ยังไม่ได้ตั้งค่า SlipOK (SLIPOK_BRANCH_ID / SLIPOK_API_KEY)' };
  }

  try {
    const body: Record<string, unknown> = { url: imageUrl, log: true };
    if (expectedAmount != null && expectedAmount > 0) body.amount = expectedAmount;

    const res = await fetch(`https://api.slipok.com/api/line/apikey/${branchId}`, {
      method: 'POST',
      headers: { 'x-authorization': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({} as Record<string, unknown>));

    if (res.ok && j.success && j.data) {
      return { ok: true, code: 'ok', message: String((j.data as Record<string, unknown>).message || '✅'), slip: norm(j.data as RawSlip) };
    }
    const code = String(j.code ?? res.status);
    return {
      ok: false,
      code,
      message: String(j.message || 'ตรวจสลิปไม่สำเร็จ'),
      slip: j.data ? norm(j.data as RawSlip) : undefined,
      duplicate: code === '1012',
      wrongReceiver: code === '1014',
    };
  } catch {
    return { ok: false, code: 'network', message: 'เชื่อมต่อ SlipOK ไม่ได้' };
  }
}

export async function verifySlipByFileId(fileId: string, expectedAmount?: number): Promise<SlipResult> {
  if (!isSlipImageFile(fileId)) {
    return { ok: false, code: 'not_image', message: 'ไฟล์ไม่ใช่รูปสลิป (รองรับ JPG/PNG) — รอแอดมินตรวจด้วยตนเอง' };
  }
  return verifySlipByUrl(dealSlipPublicUrl(fileId), expectedAmount);
}
