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
  ok: boolean;          // สลิปถูกต้องและผ่านทุกเงื่อนไข
  code: string;         // 'ok' | 'no_config' | 'image_fetch' | 'network' | รหัส error ของ SlipOK (เช่น 1012, 1014)
  message: string;
  slip?: SlipInfo;      // ข้อมูลบนสลิป (มีแม้บางกรณี error เช่น 1012/1013/1014)
  duplicate?: boolean;  // 1012 สลิปซ้ำ
  wrongReceiver?: boolean; // 1014 บัญชีผู้รับไม่ตรงบัญชีร้าน
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

/** ตรวจสลิปจาก URL รูป (ดึงรูปมาเป็น base64 แล้วส่งให้ SlipOK) */
export async function verifySlipByUrl(imageUrl: string): Promise<SlipResult> {
  const branchId = process.env.SLIPOK_BRANCH_ID;
  const apiKey = process.env.SLIPOK_API_KEY;
  if (!branchId || !apiKey) {
    return { ok: false, code: 'no_config', message: 'ยังไม่ได้ตั้งค่า SlipOK (SLIPOK_BRANCH_ID / SLIPOK_API_KEY)' };
  }

  let base64 = '';
  try {
    const img = await fetch(imageUrl);
    if (!img.ok) return { ok: false, code: 'image_fetch', message: 'ดึงรูปสลิปไม่สำเร็จ' };
    base64 = Buffer.from(await img.arrayBuffer()).toString('base64');
  } catch {
    return { ok: false, code: 'image_fetch', message: 'ดึงรูปสลิปไม่สำเร็จ' };
  }

  try {
    const res = await fetch(`https://api.slipok.com/api/line/apikey/${branchId}`, {
      method: 'POST',
      headers: { 'x-authorization': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: base64, log: true }),
    });
    const j = await res.json().catch(() => ({} as Record<string, unknown>));

    if (res.ok && j.success && j.data) {
      return { ok: true, code: 'ok', message: String(j.data.message || '✅'), slip: norm(j.data as RawSlip) };
    }
    // error: { code, message, data? }
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
