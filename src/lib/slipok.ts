// ตรวจสลิปโอนเงินผ่าน SlipOK (https://slipok.com) — ใช้ฝั่ง server เท่านั้น (มี API key)
// ตั้งค่าใน .env.local: SLIPOK_BRANCH_ID=69043, SLIPOK_API_KEY=... (และเพิ่มใน Vercel ด้วย)

import { File as NodeFile } from 'node:buffer';

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
  /** เลขบัญชีธนาคารผู้รับ (account.value) */
  receiverAccount?: string;
  /** PromptPay / proxy ผู้รับ (proxy.value) — สลิปพร้อมเพย์มักมีค่านี้แทนเลขบัญชี */
  receiverProxy?: string;
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

type SlipAccountBlob = unknown;

interface RawParty {
  displayName?: string;
  name?: string;
  account?: SlipAccountBlob;
  proxy?: SlipAccountBlob;
  [key: string]: unknown;
}

interface RawSlip {
  amount?: number; transRef?: string; transTimestamp?: string; transDate?: string; transTime?: string;
  sendingBank?: string; receivingBank?: string;
  sender?: RawParty;
  receiver?: RawParty;
  data?: RawSlip;
}

/** เลขบัญชีจากสลิป — รับทั้งเลขเต็มและ mask (x / X / * / ●) */
function looksLikeAccount(value: string): boolean {
  const compact = value.replace(/[\s-]/g, '');
  const digits = compact.replace(/\D/g, '');
  if (digits.length >= 4) return true;
  return /[0-9xX*×●•]{6,}/.test(compact);
}

function extractAccountNumber(input: unknown, depth = 0): string {
  if (depth > 5 || input == null) return '';
  if (typeof input === 'number' && Number.isFinite(input)) {
    const s = String(Math.trunc(input));
    return looksLikeAccount(s) ? s : '';
  }
  if (typeof input === 'string') {
    const s = input.trim();
    return looksLikeAccount(s) ? s : '';
  }
  if (Array.isArray(input)) {
    for (const item of input) {
      const got = extractAccountNumber(item, depth + 1);
      if (got) return got;
    }
    return '';
  }
  if (typeof input !== 'object') return '';
  const o = input as Record<string, unknown>;
  for (const key of ['value', 'account', 'acc', 'number', 'acct', 'bankAccount', 'bank_account']) {
    if (key in o) {
      const got = extractAccountNumber(o[key], depth + 1);
      if (got) return got;
    }
  }
  if (o.bank) {
    const got = extractAccountNumber(o.bank, depth + 1);
    if (got) return got;
  }
  for (const [key, val] of Object.entries(o)) {
    if (key === 'type' || key === 'typeName' || key === 'displayName' || key === 'name') continue;
    const got = extractAccountNumber(val, depth + 1);
    if (got) return got;
  }
  return '';
}

function partyFields(party?: RawParty | null) {
  return {
    name: String(party?.displayName || party?.name || '').trim(),
    account: extractAccountNumber(party?.account),
    proxy: extractAccountNumber(party?.proxy),
  };
}

function unwrapSlipData(raw: unknown): RawSlip {
  if (!raw || typeof raw !== 'object') return {};
  const d = raw as RawSlip & Record<string, unknown>;
  if (d.receiver || d.sender || d.amount != null || d.transRef) return d;
  if (d.data && typeof d.data === 'object') return unwrapSlipData(d.data);
  return d;
}

function norm(d: RawSlip): SlipInfo {
  const payload = unwrapSlipData(d);
  const sender = partyFields(payload.sender);
  const receiver = partyFields(payload.receiver);
  if (payload.receiver && !receiver.account) {
    console.warn('[slipok] receiver.account empty after parse', JSON.stringify(payload.receiver));
  }
  return {
    amount: Number(payload.amount) || 0,
    transRef: String(payload.transRef || ''),
    transTimestamp: payload.transTimestamp,
    transDate: payload.transDate,
    transTime: payload.transTime,
    sendingBank: payload.sendingBank,
    receivingBank: payload.receivingBank,
    senderName: sender.name,
    senderAccount: sender.account || sender.proxy,
    receiverName: receiver.name,
    receiverAccount: receiver.account,
    receiverProxy: receiver.proxy,
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
): { body: Buffer; contentType: string } {
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
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
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
      slip: norm(unwrapSlipData(j.data)),
      via,
    };
  }
  const code = String(j.code ?? res.status);
  return {
    ok: false,
    code,
    message: String(j.message || res.statusText || 'ตรวจสลิปไม่สำเร็จ'),
    slip: j.data ? norm(unwrapSlipData(j.data)) : undefined,
    duplicate: code === '1012',
    wrongReceiver: code === '1014',
    via,
  };
}

function toFetchBody(body: BodyInit | Buffer): BodyInit {
  if (Buffer.isBuffer(body)) return body as unknown as BodyInit;
  return body;
}

/** ดึง branch ID — env ใส่แค่ `69043` ไม่ใช่ URL ทั้งเส้น (ถ้าวาง URL มาจะดึงเลขท้ายให้) */
function resolveSlipokBranchId(raw?: string): string {
  const v = String(raw || '').trim();
  if (!v) return '';
  const fromUrl = v.match(/apikey\/(\d+)\/?$/i);
  if (fromUrl) return fromUrl[1];
  const digits = v.match(/^(\d+)$/);
  if (digits) return digits[1];
  return v.replace(/\/$/, '').split('/').pop()?.match(/^(\d+)$/)?.[1] || v;
}

function slipokCredentials(): { branchId: string; apiKey: string } {
  return {
    branchId: resolveSlipokBranchId(process.env.SLIPOK_BRANCH_ID),
    apiKey: process.env.SLIPOK_API_KEY?.trim() || '',
  };
}
/** ตรวจ quota / credentials ก่อนส่งสลิป — คืน 1003 ถ้าแพ็กเกจหมดอายุ */
export async function checkSlipokQuota(): Promise<SlipResult> {
  const { branchId, apiKey } = slipokCredentials();
  if (!branchId || !apiKey) {
    return { ok: false, code: 'no_config', message: 'ยังไม่ได้ตั้งค่า SlipOK — SLIPOK_BRANCH_ID ใส่แค่เลข เช่น 69043' };
  }
  try {
    const res = await fetch(`https://api.slipok.com/api/line/apikey/${encodeURIComponent(branchId)}/quota`, {
      headers: { 'x-authorization': apiKey },
    });
    const text = await res.text();
    let j: Record<string, unknown> = {};
    try {
      j = text ? JSON.parse(text) as Record<string, unknown> : {};
    } catch {
      return { ok: false, code: String(res.status), message: `SlipOK quota ตอบไม่ใช่ JSON (${res.status})` };
    }
    if (res.ok && j.success && j.data) {
      const quota = (j.data as Record<string, unknown>).quota;
      return { ok: true, code: 'ok', message: `โควต้า SlipOK คงเหลือ ${String(quota ?? '?')}` };
    }
    return {
      ok: false,
      code: String(j.code ?? res.status),
      message: String(j.message || 'ตรวจ quota SlipOK ไม่สำเร็จ'),
    };
  } catch {
    return { ok: false, code: 'network', message: 'เชื่อมต่อ SlipOK ไม่ได้' };
  }
}

export function slipokBranchHint(): string {
  const id = resolveSlipokBranchId(process.env.SLIPOK_BRANCH_ID);
  return id.length >= 3 ? id.slice(-3) : (id || '?');
}

/** สถานะ env + quota บน server ปัจจุบัน (ใช้ debug Vercel) */
export async function getSlipokHealth(): Promise<{
  configured: boolean;
  branchHint: string;
  quota: SlipResult | null;
}> {
  const configured = isSlipokConfigured();
  if (!configured) {
    return { configured: false, branchHint: '?', quota: null };
  }
  const quota = await checkSlipokQuota();
  return { configured: true, branchHint: slipokBranchHint(), quota };
}

async function postSlipok(
  body: BodyInit | Buffer,
  headers: Record<string, string>,
  via: SlipResult['via'],
): Promise<SlipResult> {
  const { branchId, apiKey } = slipokCredentials();
  if (!branchId || !apiKey) {
    return { ok: false, code: 'no_config', message: 'ยังไม่ได้ตั้งค่า SlipOK — SLIPOK_BRANCH_ID ใส่แค่เลข เช่น 69043' };
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
  const { branchId, apiKey } = slipokCredentials();
  return Boolean(branchId && apiKey);
}

/** 1010 = ธนาคารยังไม่อัปเดต — ตรวจซ้ำอัตโนมัติ (ครั้งถัดไปอาจได้ 1012 พร้อมข้อมูลสลิป) */
export const SLIPOK_AUTO_RETRY_CODES = ['1010'] as const;
export const SLIPOK_AUTO_RETRY_DELAY_MS = 60_000;

export function shouldAutoRetrySlipok(code: string): boolean {
  return (SLIPOK_AUTO_RETRY_CODES as readonly string[]).includes(String(code || '').trim());
}

/** ข้อความภาษาไทยสำหรับรหัส SlipOK 1000–1014 และข้อผิดพลาดภายใน */
const SLIPOK_CODE_TH: Record<string, string> = {
  '1000': 'SlipOK ไม่ได้รับไฟล์/URL — Vercel env ผิดหรือยังไม่ Redeploy (quota ok แต่ upload 1000 = credentials ไม่ตรง 69043)',
  '1001': 'ไม่พบข้อมูลสาขา — ตรวจสอบ SLIPOK_BRANCH_ID ใน Vercel',
  '1002': 'API Key SlipOK ไม่ถูกต้อง — ตรวจสอบ SLIPOK_API_KEY',
  '1003': 'แพ็กเกจ SlipOK หมดอายุแล้ว',
  '1004': 'แพ็กเกจ SlipOK ใช้เกินโควต้า — กรุณาต่ออายุแพ็กเกจ',
  '1005': 'ไฟล์ไม่ใช่รูปภาพ (รองรับ JPG, PNG, WEBP)',
  '1006': 'รูปภาพสลิปไม่ถูกต้อง',
  '1007': 'รูปภาพไม่มี QR Code',
  '1008': 'QR Code นี้ไม่ใช่ QR สำหรับตรวจสอบการชำระเงิน',
  '1009': 'ข้อมูลธนาคารขัดข้องชั่วคราว — ลองใหม่ใน 15 นาที (ไม่เสียโควต้า)',
  '1010': 'ธนาคารยังไม่อัปเดตรายการโอน — ระบบจะตรวจซ้ำอัตโนมัติใน 1 นาที',
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

/** ตรวจสลิปจาก URL — JSON ตาม SlipOK API Guide v1.13 */
export async function verifySlipByUrl(imageUrl: string, expectedAmount?: number): Promise<SlipResult> {
  if (!isSlipokConfigured()) {
    return { ok: false, code: 'no_config', message: 'ยังไม่ได้ตั้งค่า SlipOK (SLIPOK_BRANCH_ID / SLIPOK_API_KEY)' };
  }
  const via: SlipResult['via'] = imageUrl.includes('token=') ? 'signed_url' : 'public_url';
  const payload: Record<string, unknown> = { url: imageUrl, log: true };
  if (expectedAmount != null && expectedAmount > 0) payload.amount = Math.round(expectedAmount);
  return postSlipok(JSON.stringify(payload), { 'Content-Type': 'application/json' }, via);
}

/** ตรวจสลิปจาก bytes — FormData+File (Node 20+) แล้ว fallback multipart manual */
export async function verifySlipByImageBytes(
  imageBytes: Buffer,
  filename: string,
  expectedAmount?: number,
): Promise<SlipResult> {
  if (!isSlipokConfigured()) {
    return { ok: false, code: 'no_config', message: 'ยังไม่ได้ตั้งค่า SlipOK (SLIPOK_BRANCH_ID / SLIPOK_API_KEY)' };
  }
  const mime = slipImageMime(filename);
  const form = new FormData();
  form.append('files', new NodeFile([Uint8Array.from(imageBytes)], filename, { type: mime }) as unknown as Blob);
  form.append('log', 'true');
  if (expectedAmount != null && expectedAmount > 0) {
    form.append('amount', String(Math.round(expectedAmount)));
  }
  let last = await postSlipok(form, {}, 'upload');
  if (last.ok || last.code !== '1000') return last;

  const { body, contentType } = buildMultipartBody(slipokTextFields(expectedAmount), {
    field: 'files',
    filename,
    mime,
    data: imageBytes,
  });
  return postSlipok(body, { 'Content-Type': contentType }, 'upload');
}

export async function verifySlipByFileId(fileId: string, expectedAmount?: number): Promise<SlipResult> {
  if (!isSlipImageFile(fileId)) {
    return { ok: false, code: 'not_image', message: 'ไฟล์ไม่ใช่รูปสลิป (รองรับ JPG/PNG) — รอแอดมินตรวจด้วยตนเอง' };
  }

  const branchHint = slipokBranchHint();
  const attempts: string[] = [`branch:…${branchHint}`];

  const quota = await checkSlipokQuota();
  if (quota.ok) {
    attempts.push('quota:ok');
  } else {
    attempts.push(`quota:${quota.code}`);
    if (['1001', '1002', '1003', '1004', 'no_config', 'network'].includes(quota.code)) {
      return mergeAttemptErrors(attempts, {
        ...quota,
        message: `${quota.message} — ตรวจ SLIPOK_* บน Vercel (ต้องเป็น branch 69043)`,
      });
    }
  }

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
