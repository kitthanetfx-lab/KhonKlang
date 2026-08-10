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
  /** ช่องทางที่ใช้เรียก SlipOK — debug */
  via?: 'upload' | 'signed_url' | 'public_url';
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

/** URL public สำหรับแสดงผล (sync — ใช้ pattern เดียวกับ getPublicUrl) */
export function dealSlipPublicUrl(fileId: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  if (!base || !fileId) return '';
  const path = fileId.split('/').map(encodeURIComponent).join('/');
  return `${base}/storage/v1/object/public/deal-files/${path}`;
}

function slipImageMime(fileId: string): string {
  const ext = fileId.split('.').pop()?.toLowerCase() || '';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function buildMultipartBody(
  fields: Record<string, string>,
  file?: { field: string; filename: string; mime: string; data: Buffer },
): { body: Uint8Array; contentType: string } {
  const boundary = `----SlipOK${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  const chunks: Buffer[] = [];

  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    ));
  }

  if (file) {
    chunks.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.filename}"\r\nContent-Type: ${file.mime}\r\n\r\n`,
    ));
    chunks.push(file.data);
    chunks.push(Buffer.from('\r\n'));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    body: Uint8Array.from(Buffer.concat(chunks)),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function buildSlipokFormData(opts: {
  url?: string;
  file?: { bytes: Buffer; filename: string; mime: string };
  expectedAmount?: number;
}): FormData {
  const form = new FormData();
  form.append('log', 'true');
  if (opts.url) form.append('url', opts.url);
  if (opts.file) {
    const blob = new Blob([Uint8Array.from(opts.file.bytes)], { type: opts.file.mime });
    form.append('files', blob, opts.file.filename);
  }
  if (opts.expectedAmount != null && opts.expectedAmount > 0) {
    form.append('amount', String(Math.round(opts.expectedAmount)));
  }
  return form;
}

function slipokTextFields(expectedAmount?: number): Record<string, string> {
  const fields: Record<string, string> = { log: 'true' };
  if (expectedAmount != null && expectedAmount > 0) {
    fields.amount = String(Math.round(expectedAmount));
  }
  return fields;
}

function parseSlipokApiResponse(res: Response, j: Record<string, unknown>, via?: SlipResult['via']): SlipResult {
  if (res.ok && j.success && j.data) {
    return {
      ok: true,
      code: 'ok',
      message: String((j.data as Record<string, unknown>).message || '✅'),
      slip: norm(j.data as RawSlip),
      via,
    };
  }
  const code = String(j.code ?? res.status);
  return {
    ok: false,
    code,
    message: String(j.message || res.statusText || 'ตรวจสลิปไม่สำเร็จ'),
    slip: j.data ? norm(j.data as RawSlip) : undefined,
    duplicate: code === '1012',
    wrongReceiver: code === '1014',
    via,
  };
}

function toFetchBody(body: BodyInit | Uint8Array): BodyInit {
  if (!(body instanceof Uint8Array)) return body;
  const copy = new Uint8Array(body.byteLength);
  copy.set(body);
  return new Blob([copy]);
}

async function postSlipok(
  body: BodyInit | Uint8Array,
  headers: Record<string, string>,
  via: SlipResult['via'],
): Promise<SlipResult> {
  const branchId = process.env.SLIPOK_BRANCH_ID?.trim();
  const apiKey = process.env.SLIPOK_API_KEY?.trim();
  if (!branchId || !apiKey) {
    return { ok: false, code: 'no_config', message: 'ยังไม่ได้ตั้งค่า SlipOK (SLIPOK_BRANCH_ID / SLIPOK_API_KEY)' };
  }
  try {
    const res = await fetch(`https://api.slipok.com/api/line/apikey/${encodeURIComponent(branchId)}`, {
      method: 'POST',
      headers: { ...headers, 'x-authorization': apiKey },
      body: toFetchBody(body),
    });
    const text = await res.text();
    let j: Record<string, unknown> = {};
    try {
      j = text ? JSON.parse(text) as Record<string, unknown> : {};
    } catch {
      console.error('[slipok] non-json response', via, res.status, text.slice(0, 200));
    }
    const result = parseSlipokApiResponse(res, j, via);
    if (!result.ok) {
      console.error('[slipok] verify failed', via, result.code, result.message, 'http', res.status, text.slice(0, 120));
    }
    return result;
  } catch (err) {
    console.error('[slipok] post failed', via, err);
    return { ok: false, code: 'network', message: 'เชื่อมต่อ SlipOK ไม่ได้' };
  }
}

async function getStorageAdmin() {
  const { getAdminClient } = await import('@/lib/supabaseServer');
  return getAdminClient();
}

async function getDealSlipPublicUrlFromStorage(fileId: string): Promise<string> {
  const db = await getStorageAdmin();
  return db.storage.from('deal-files').getPublicUrl(fileId).data.publicUrl;
}

async function downloadDealSlipFile(fileId: string): Promise<{ bytes: Buffer; filename: string } | null> {
  try {
    const db = await getStorageAdmin();
    const { data, error } = await db.storage.from('deal-files').download(fileId);
    if (error || !data) {
      console.error('[slipok] storage download failed', fileId, error?.message);
      return null;
    }
    const bytes = Buffer.from(await data.arrayBuffer());
    if (!bytes.length) return null;
    const filename = fileId.split('/').pop() || 'slip.jpg';
    return { bytes, filename };
  } catch (err) {
    console.error('[slipok] storage download error', fileId, err);
    return null;
  }
}

async function getDealSlipSignedUrl(fileId: string, expiresSec = 600): Promise<string | null> {
  try {
    const db = await getStorageAdmin();
    const { data, error } = await db.storage.from('deal-files').createSignedUrl(fileId, expiresSec);
    if (error || !data?.signedUrl) {
      console.error('[slipok] signed url failed', fileId, error?.message);
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.error('[slipok] signed url error', fileId, err);
    return null;
  }
}

function shouldRetryWithUrl(result: SlipResult): boolean {
  if (result.ok) return false;
  const c = result.code;
  return c === '404' || c === '1000' || c === '1005' || c === '1006' || c === 'network';
}

function mergeAttemptErrors(attempts: string[], last: SlipResult): SlipResult {
  if (attempts.length === 0) return last;
  return {
    ...last,
    message: `${last.message} [${attempts.join(' → ')}]`,
  };
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
  '1000': 'SlipOK ไม่ได้รับไฟล์/URL จากระบบ (สลิปไม่ได้ขาด) — ลองตรวจซ้ำ',
  '1001': 'ไม่พบข้อมูลสาขา — ตรวจสอบ SLIPOK_BRANCH_ID ใน Vercel',
  '1002': 'API Key SlipOK ไม่ถูกต้อง — ตรวจสอบ SLIPOK_API_KEY',
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
  storage_download: 'โหลดไฟล์สลิปจาก storage ไม่ได้ — ตรวจ SUPABASE_SERVICE_ROLE_KEY',
  no_config: 'ยังไม่ได้ตั้งค่า SlipOK (SLIPOK_BRANCH_ID / SLIPOK_API_KEY)',
  not_image: 'ไฟล์ไม่ใช่รูปสลิป (รองรับ JPG/PNG) — รอแอดมินตรวจด้วยตนเอง',
  network: 'เชื่อมต่อ SlipOK ไม่ได้',
};

const SLIPOK_MESSAGE_ALIASES: Array<{ pattern: RegExp; text: string }> = [
  { pattern: /^not found$/i, text: SLIPOK_CODE_TH['1001'] },
  { pattern: /slip.?not.?found/i, text: SLIPOK_CODE_TH['1011'] },
  { pattern: /qrcode.?not.?found/i, text: SLIPOK_CODE_TH['1007'] },
  { pattern: /duplicate/i, text: SLIPOK_CODE_TH['1012'] },
  { pattern: /wrong.?receiver/i, text: SLIPOK_CODE_TH['1014'] },
];

/** แปลรหัส/ข้อความจาก SlipOK เป็นภาษาไทยที่อ่านเข้าใจ */
export function formatSlipokError(code: string, message?: string): string {
  const c = String(code || '').trim();
  const raw = String(message || '').trim();
  const trailIdx = raw.indexOf(' [');
  const trail = trailIdx >= 0 ? raw.slice(trailIdx) : '';

  if (SLIPOK_CODE_TH[c]) return SLIPOK_CODE_TH[c] + trail;
  if (c === '404') return SLIPOK_CODE_TH['1001'] + trail;
  if (raw) {
    for (const { pattern, text } of SLIPOK_MESSAGE_ALIASES) {
      if (pattern.test(raw)) return text + trail;
    }
    if (/[\u0E00-\u0E7F]/.test(raw)) return raw;
  }
  return (raw || 'สลิปไม่ผ่านการตรวจสอบ') + trail;
}

/** ตรวจสลิปจาก URL — ลอง urlencoded แล้ว multipart (FormData บน Vercel มักส่ง body ว่าง) */
export async function verifySlipByUrl(imageUrl: string, expectedAmount?: number): Promise<SlipResult> {
  if (!isSlipokConfigured()) {
    return { ok: false, code: 'no_config', message: 'ยังไม่ได้ตั้งค่า SlipOK (SLIPOK_BRANCH_ID / SLIPOK_API_KEY)' };
  }
  const via: SlipResult['via'] = imageUrl.includes('token=') ? 'signed_url' : 'public_url';
  const fields = { url: imageUrl, ...slipokTextFields(expectedAmount) };

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) params.set(k, v);
  let last = await postSlipok(params, {}, via);
  if (last.ok || last.code !== '1000') return last;

  const { body, contentType } = buildMultipartBody(fields);
  last = await postSlipok(body, { 'Content-Type': contentType }, via);
  if (last.ok || last.code !== '1000') return last;

  return postSlipok(buildSlipokFormData({ url: imageUrl, expectedAmount }), {}, via);
}

/** ตรวจสลิปจาก bytes — multipart manual ก่อน (เสถียรบน Node/Vercel) */
export async function verifySlipByImageBytes(
  imageBytes: Buffer,
  filename: string,
  expectedAmount?: number,
): Promise<SlipResult> {
  if (!isSlipokConfigured()) {
    return { ok: false, code: 'no_config', message: 'ยังไม่ได้ตั้งค่า SlipOK (SLIPOK_BRANCH_ID / SLIPOK_API_KEY)' };
  }
  const mime = slipImageMime(filename);
  const { body, contentType } = buildMultipartBody(slipokTextFields(expectedAmount), {
    field: 'files',
    filename,
    mime,
    data: imageBytes,
  });
  let last = await postSlipok(body, { 'Content-Type': contentType }, 'upload');
  if (last.ok || last.code !== '1000') return last;

  return postSlipok(
    buildSlipokFormData({ file: { bytes: imageBytes, filename, mime }, expectedAmount }),
    {},
    'upload',
  );
}

export async function verifySlipByFileId(fileId: string, expectedAmount?: number): Promise<SlipResult> {
  if (!isSlipImageFile(fileId)) {
    return { ok: false, code: 'not_image', message: 'ไฟล์ไม่ใช่รูปสลิป (รองรับ JPG/PNG) — รอแอดมินตรวจด้วยตนเอง' };
  }

  const attempts: string[] = [];
  let last: SlipResult = { ok: false, code: 'unknown', message: 'ตรวจสลิปไม่สำเร็จ' };

  const local = await downloadDealSlipFile(fileId);
  if (!local) {
    attempts.push('storage:fail');
    last = { ok: false, code: 'storage_download', message: SLIPOK_CODE_TH.storage_download, via: 'upload' };
  } else {
    attempts.push(`storage:ok(${local.bytes.length}b)`);
    last = await verifySlipByImageBytes(local.bytes, local.filename, expectedAmount);
    if (last.ok) return last;
    attempts.push(`upload:${last.code}`);
    if (!shouldRetryWithUrl(last)) return mergeAttemptErrors(attempts, last);
  }

  const signed = await getDealSlipSignedUrl(fileId);
  if (signed) {
    last = await verifySlipByUrl(signed, expectedAmount);
    if (last.ok) return last;
    attempts.push(`signed:${last.code}`);
    if (!shouldRetryWithUrl(last)) return mergeAttemptErrors(attempts, last);
  } else {
    attempts.push('signed:fail');
  }

  const publicUrl = await getDealSlipPublicUrlFromStorage(fileId);
  last = await verifySlipByUrl(publicUrl || dealSlipPublicUrl(fileId), expectedAmount);
  attempts.push(`public:${last.code}`);
  return mergeAttemptErrors(attempts, last);
}
