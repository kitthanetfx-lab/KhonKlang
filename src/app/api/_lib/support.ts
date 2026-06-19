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

export async function ensureSupportCollections(db: Databases) {
  // ── support_threads ──
  try { await db.getCollection(DB_ID, COL_THREADS); } catch {
    try {
      await db.createCollection(DB_ID, COL_THREADS, 'Support Threads', [Permission.read(Role.users())]);
      await Promise.all([
        db.createStringAttribute(DB_ID, COL_THREADS, 'customerName', 200, false, ''),
        db.createStringAttribute(DB_ID, COL_THREADS, 'status', 20, false, 'open'),
        db.createStringAttribute(DB_ID, COL_THREADS, 'lastMessage', 2000, false, ''),
        db.createStringAttribute(DB_ID, COL_THREADS, 'lastAt', 30, false, ''),
        db.createStringAttribute(DB_ID, COL_THREADS, 'lastSender', 10, false, ''),
        db.createBooleanAttribute(DB_ID, COL_THREADS, 'unreadCustomer', false, false),
        db.createBooleanAttribute(DB_ID, COL_THREADS, 'unreadStaff', false, false),
        db.createStringAttribute(DB_ID, COL_THREADS, 'assignedStaffId', 255, false, ''),
        db.createStringAttribute(DB_ID, COL_THREADS, 'assignedStaffName', 200, false, ''),
        db.createStringAttribute(DB_ID, COL_THREADS, 'callStatus', 24, false, 'idle'),
        db.createStringAttribute(DB_ID, COL_THREADS, 'callId', 64, false, ''),
        db.createStringAttribute(DB_ID, COL_THREADS, 'callInitiator', 10, false, ''),
        db.createStringAttribute(DB_ID, COL_THREADS, 'callStaffId', 255, false, ''),
        db.createStringAttribute(DB_ID, COL_THREADS, 'callStaffName', 200, false, ''),
        db.createStringAttribute(DB_ID, COL_THREADS, 'callUpdatedAt', 30, false, ''),
        db.createStringAttribute(DB_ID, COL_THREADS, 'createdAt', 30, false, ''),
        db.createStringAttribute(DB_ID, COL_THREADS, 'updatedAt', 30, false, ''),
      ]);
      await waitAvailable(db, COL_THREADS);
      await Promise.all([
        { key: 'idx_status',  attrs: ['status'],  orders: [OrderBy.Asc] },
        { key: 'idx_updated', attrs: ['updatedAt'], orders: [OrderBy.Desc] },
      ].map(i => db.createIndex(DB_ID, COL_THREADS, i.key, DatabasesIndexType.Key, i.attrs, i.orders).catch(() => {})));
    } catch (err) {
      if (!String(err).includes('missing scopes') && !String(err).includes('already exists')) throw err;
    }
  }

  // ── support_messages ──
  try { await db.getCollection(DB_ID, COL_MESSAGES); } catch {
    try {
      await db.createCollection(DB_ID, COL_MESSAGES, 'Support Messages', [Permission.read(Role.users())]);
      await Promise.all([
        db.createStringAttribute(DB_ID, COL_MESSAGES, 'threadId', 255, true),
        db.createStringAttribute(DB_ID, COL_MESSAGES, 'senderId', 255, true),
        db.createStringAttribute(DB_ID, COL_MESSAGES, 'senderName', 200, false, ''),
        db.createStringAttribute(DB_ID, COL_MESSAGES, 'senderRole', 10, false, 'customer'),
        db.createStringAttribute(DB_ID, COL_MESSAGES, 'content', 2000, false, ''),
        db.createStringAttribute(DB_ID, COL_MESSAGES, 'createdAt', 30, false, ''),
      ]);
      await waitAvailable(db, COL_MESSAGES);
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
      await Promise.all([
        db.createStringAttribute(DB_ID, COL_SIGNALS, 'threadId', 255, true),
        db.createStringAttribute(DB_ID, COL_SIGNALS, 'callId', 64, true),
        db.createStringAttribute(DB_ID, COL_SIGNALS, 'fromRole', 10, true),
        db.createStringAttribute(DB_ID, COL_SIGNALS, 'type', 20, true),
        db.createStringAttribute(DB_ID, COL_SIGNALS, 'data', 8000, false, ''),
        db.createStringAttribute(DB_ID, COL_SIGNALS, 'createdAt', 30, false, ''),
      ]);
      await waitAvailable(db, COL_SIGNALS);
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
