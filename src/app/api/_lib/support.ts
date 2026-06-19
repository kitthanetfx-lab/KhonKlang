// Shared helpers — ระบบแชทศูนย์ช่วยเหลือ (customer care) + คำขอโทร
// รูปแบบเดียวกับ dm/route.ts และ _lib/notify.ts: สร้างคอลเลกชันแบบ lazy ครั้งแรกที่ใช้งาน
import { Databases, DatabasesIndexType, ID, OrderBy, Permission, Role, Query } from 'node-appwrite';

export const DB_ID = 'khonklang_db';
export const COL_THREADS  = 'support_threads';
export const COL_MESSAGES = 'support_messages';
export const COL_SIGNALS  = 'call_signals';

export type CallStatus = 'idle' | 'customer_requesting' | 'staff_ringing' | 'connecting' | 'active' | 'ended';

export interface SupportThreadDoc {
  $id: string; // = customerId
  customerName: string;
  status: 'open' | 'closed';
  lastMessage: string;
  lastAt: string;
  lastSender: 'customer' | 'staff' | '';
  unreadCustomer: boolean;
  unreadStaff: boolean;
  assignedStaffId: string;
  assignedStaffName: string;
  callStatus: CallStatus;
  callId: string;
  callInitiator: 'customer' | 'staff' | '';
  callStaffId: string;
  callStaffName: string;
  callUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupportMessageDoc {
  $id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderRole: 'customer' | 'staff' | 'system';
  content: string;
  imageUrl?: string;
  mimeType?: string;
  createdAt: string;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function waitAvailable(db: Databases, colId: string) {
  for (let i = 0; i < 20; i += 1) {
    try {
      const col = await db.listAttributes(DB_ID, colId);
      if ((col.attributes as { status?: string }[]).every(a => a.status === 'available')) return;
    } catch { /* keep polling */ }
    await sleep(450);
  }
}

/**
 * สร้าง attribute แบบ idempotent + ทีละตัว (ไม่ใช้ Promise.all) — Appwrite Cloud เคยพบเคสที่สร้าง
 * attribute จำนวนมากพร้อมกันแล้ว metadata รายงานว่า "available" ทั้งที่ schema validation จริง
 * ยังไม่รู้จัก attribute นั้น (เกิด race ฝั่งเซิร์ฟเวอร์) ทำให้สร้าง/อัปเดต document ถูกปฏิเสธด้วย
 * "Unknown attribute" แม้ listAttributes() จะบอกว่าพร้อมแล้วก็ตาม — สร้างทีละตัวพร้อม wait ให้
 * available ก่อนสร้างตัวถัดไปเสมอ เพื่อกันปัญหานี้ไม่ให้เกิดซ้ำ ทั้งตอนสร้าง collection ใหม่
 * และตอน migrate attribute ใหม่เข้า collection ที่มีอยู่แล้วใน production
 */
async function ensureStringAttribute(db: Databases, colId: string, key: string, size: number, required: boolean, def?: string) {
  try {
    const attr = await db.getAttribute(DB_ID, colId, key) as { status?: string };
    if (attr?.status === 'available') return;
  } catch { /* ยังไม่มี attribute นี้ — สร้างด้านล่าง */ }
  try {
    await db.createStringAttribute(DB_ID, colId, key, size, required, required ? undefined : def);
  } catch (e) {
    if (!String(e).includes('already exists')) throw e;
  }
  await waitAvailable(db, colId);
}

async function ensureBooleanAttribute(db: Databases, colId: string, key: string, required: boolean, def?: boolean) {
  try {
    const attr = await db.getAttribute(DB_ID, colId, key) as { status?: string };
    if (attr?.status === 'available') return;
  } catch { /* ยังไม่มี attribute นี้ — สร้างด้านล่าง */ }
  try {
    await db.createBooleanAttribute(DB_ID, colId, key, required, def);
  } catch (e) {
    if (!String(e).includes('already exists')) throw e;
  }
  await waitAvailable(db, colId);
}

// กันยิง migration ของ attribute รูปภาพซ้ำในอินสแตนซ์ serverless เดียวกันที่ยัง warm อยู่
let messageImageAttrsEnsured = false;

export async function ensureSupportCollections(db: Databases) {
  // ── support_threads ──
  try { await db.getCollection(DB_ID, COL_THREADS); } catch {
    try {
      await db.createCollection(DB_ID, COL_THREADS, 'Support Threads', [Permission.read(Role.users())]);
      await ensureStringAttribute(db, COL_THREADS, 'customerName', 200, false, '');
      await ensureStringAttribute(db, COL_THREADS, 'status', 20, false, 'open');
      await ensureStringAttribute(db, COL_THREADS, 'lastMessage', 2000, false, '');
      await ensureStringAttribute(db, COL_THREADS, 'lastAt', 30, false, '');
      await ensureStringAttribute(db, COL_THREADS, 'lastSender', 10, false, '');
      await ensureBooleanAttribute(db, COL_THREADS, 'unreadCustomer', false, false);
      await ensureBooleanAttribute(db, COL_THREADS, 'unreadStaff', false, false);
      await ensureStringAttribute(db, COL_THREADS, 'assignedStaffId', 255, false, '');
      await ensureStringAttribute(db, COL_THREADS, 'assignedStaffName', 200, false, '');
      await ensureStringAttribute(db, COL_THREADS, 'callStatus', 24, false, 'idle');
      await ensureStringAttribute(db, COL_THREADS, 'callId', 64, false, '');
      await ensureStringAttribute(db, COL_THREADS, 'callInitiator', 10, false, '');
      await ensureStringAttribute(db, COL_THREADS, 'callStaffId', 255, false, '');
      await ensureStringAttribute(db, COL_THREADS, 'callStaffName', 200, false, '');
      await ensureStringAttribute(db, COL_THREADS, 'callUpdatedAt', 30, false, '');
      await ensureStringAttribute(db, COL_THREADS, 'createdAt', 30, false, '');
      await ensureStringAttribute(db, COL_THREADS, 'updatedAt', 30, false, '');
      await Promise.all([
        { key: 'idx_status',  attrs: ['status'],  orders: [OrderBy.Asc] },
        { key: 'idx_updated', attrs: ['updatedAt'], orders: [OrderBy.Desc] },
      ].map(i => db.createIndex(DB_ID, COL_THREADS, i.key, DatabasesIndexType.Key, i.attrs, i.orders).catch(() => {})));
    } catch (err) {
      if (!String(err).includes('missing scopes') && !String(err).includes('already exists')) throw err;
    }
  }

  // ── support_messages ──
  try {
    await db.getCollection(DB_ID, COL_MESSAGES);
    // collection มีอยู่แล้ว — migrate attribute รูปภาพเข้าไปถ้ายังไม่มี (เคสอัปเกรดของ production เดิม)
    if (!messageImageAttrsEnsured) {
      await ensureStringAttribute(db, COL_MESSAGES, 'imageUrl', 500, false, '');
      await ensureStringAttribute(db, COL_MESSAGES, 'mimeType', 60, false, '');
      messageImageAttrsEnsured = true;
    }
  } catch {
    try {
      await db.createCollection(DB_ID, COL_MESSAGES, 'Support Messages', [Permission.read(Role.users())]);
      await ensureStringAttribute(db, COL_MESSAGES, 'threadId', 255, true);
      await ensureStringAttribute(db, COL_MESSAGES, 'senderId', 255, true);
      await ensureStringAttribute(db, COL_MESSAGES, 'senderName', 200, false, '');
      await ensureStringAttribute(db, COL_MESSAGES, 'senderRole', 10, false, 'customer');
      await ensureStringAttribute(db, COL_MESSAGES, 'content', 2000, false, '');
      await ensureStringAttribute(db, COL_MESSAGES, 'imageUrl', 500, false, '');
      await ensureStringAttribute(db, COL_MESSAGES, 'mimeType', 60, false, '');
      await ensureStringAttribute(db, COL_MESSAGES, 'createdAt', 30, false, '');
      messageImageAttrsEnsured = true;
      await Promise.all([
        { key: 'idx_thread',  attrs: ['threadId'],  orders: [OrderBy.Asc] },
        { key: 'idx_created', attrs: ['createdAt'], orders: [OrderBy.Asc] },
      ].map(i => db.createIndex(DB_ID, COL_MESSAGES, i.key, DatabasesIndexType.Key, i.attrs, i.orders).catch(() => {})));
    } catch (err) {
      if (!String(err).includes('missing scopes') && !String(err).includes('already exists')) throw err;
    }
  }

  // ── call_signals (สัญญาณ WebRTC: offer/answer/candidate/hangup ฯลฯ) ──
  try { await db.getCollection(DB_ID, COL_SIGNALS); } catch {
    try {
      await db.createCollection(DB_ID, COL_SIGNALS, 'Call Signals', [Permission.read(Role.users())]);
      await ensureStringAttribute(db, COL_SIGNALS, 'threadId', 255, true);
      await ensureStringAttribute(db, COL_SIGNALS, 'callId', 64, true);
      await ensureStringAttribute(db, COL_SIGNALS, 'fromRole', 10, true);
      await ensureStringAttribute(db, COL_SIGNALS, 'type', 20, true);
      await ensureStringAttribute(db, COL_SIGNALS, 'data', 8000, false, '');
      await ensureStringAttribute(db, COL_SIGNALS, 'createdAt', 30, false, '');
      await Promise.all([
        { key: 'idx_call',    attrs: ['callId'],    orders: [OrderBy.Asc] },
        { key: 'idx_created', attrs: ['createdAt'], orders: [OrderBy.Asc] },
      ].map(i => db.createIndex(DB_ID, COL_SIGNALS, i.key, DatabasesIndexType.Key, i.attrs, i.orders).catch(() => {})));
    } catch (err) {
      if (!String(err).includes('missing scopes') && !String(err).includes('already exists')) throw err;
    }
  }
}

/** ดึงห้องแชทของลูกค้า (สร้างใหม่ถ้ายังไม่มี — ใช้ customerId เป็น document id โดยตรง) */
export async function getOrCreateThread(db: Databases, customerId: string, customerName: string): Promise<SupportThreadDoc> {
  try {
    const doc = await db.getDocument(DB_ID, COL_THREADS, customerId);
    return doc as unknown as SupportThreadDoc;
  } catch {
    const now = new Date().toISOString();
    const doc = await db.createDocument(DB_ID, COL_THREADS, customerId, {
      customerName: customerName.slice(0, 200) || 'ลูกค้า',
      status: 'open',
      lastMessage: '',
      lastAt: now,
      lastSender: '',
      unreadCustomer: false,
      unreadStaff: false,
      assignedStaffId: '',
      assignedStaffName: '',
      callStatus: 'idle',
      callId: '',
      callInitiator: '',
      callStaffId: '',
      callStaffName: '',
      callUpdatedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return doc as unknown as SupportThreadDoc;
  }
}

export function newCallId() {
  return `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function listSignalsSince(db: Databases, callId: string, sinceIso: string) {
  const queries = [Query.equal('callId', callId), Query.orderAsc('createdAt'), Query.limit(200)];
  if (sinceIso) queries.push(Query.greaterThan('createdAt', sinceIso));
  const r = await db.listDocuments(DB_ID, COL_SIGNALS, queries).catch(() => ({ documents: [] as unknown[] }));
  return r.documents as unknown as (SupportThreadDoc & { fromRole: string; type: string; data: string; createdAt: string; $id: string })[];
}
