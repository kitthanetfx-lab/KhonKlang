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

/** ตรวจสลิปจาก URL รูป public (ตามเอกสาร SlipOK ใช้ field url) */
export async function verifySlipByUrl(imageUrl: string, expectedAmount?: number): Promise<SlipResult> {
  const branchId = process.env.SLIPOK_BRANCH_ID;
  const apiKey = process.env.SLIPOK_API_KEY;
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
