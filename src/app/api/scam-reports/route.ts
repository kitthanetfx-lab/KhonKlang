import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Databases, DatabasesIndexType, ID, OrderBy, Permission, Role, Query } from 'node-appwrite';
import { verifyAdmin as verifyAdminReq } from '../admin/_lib';

const DB_ID = 'khonklang_db';
const COL_ID = 'scam_reports';

function getDb() {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Databases(c);
}

function getUserFromJwt(jwt: string) {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setJWT(jwt);
  return new Account(c).get();
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function ensureCollection(db: Databases) {
  try { await db.getCollection(DB_ID, COL_ID); return; } catch { /* create below */ }
  try {
    await db.createCollection(DB_ID, COL_ID, 'Scam Reports', [Permission.read(Role.any())]);
    await Promise.all([
      db.createStringAttribute(DB_ID, COL_ID, 'reporterId',    255, false, ''),
      db.createStringAttribute(DB_ID, COL_ID, 'firstName',     120, true),
      db.createStringAttribute(DB_ID, COL_ID, 'lastName',      120, false, ''),
      db.createStringAttribute(DB_ID, COL_ID, 'idCard',         20, false, ''),
      db.createStringAttribute(DB_ID, COL_ID, 'bankAccounts', 1500, false, '[]'), // [{acct, bank}]
      db.createStringAttribute(DB_ID, COL_ID, 'searchBlob',   2500, false, ''),   // ชื่อ+บัญชี+เบอร์ normalize สำหรับค้นหา
      db.createStringAttribute(DB_ID, COL_ID, 'product',       200, false, ''),
      db.createIntegerAttribute(DB_ID, COL_ID, 'amount', false, 0, 999999999, 0),
      db.createStringAttribute(DB_ID, COL_ID, 'transferDate',   30, false, ''),
      db.createStringAttribute(DB_ID, COL_ID, 'sellerPage',    300, false, ''),
      db.createStringAttribute(DB_ID, COL_ID, 'province',      100, false, ''),
      db.createStringAttribute(DB_ID, COL_ID, 'detail',       5000, false, ''),
      db.createStringAttribute(DB_ID, COL_ID, 'chatImageIds', 2500, false, '[]'),
      db.createStringAttribute(DB_ID, COL_ID, 'policeDocIds', 1000, false, '[]'),
      db.createStringAttribute(DB_ID, COL_ID, 'slipImageIds', 1000, false, '[]'),
      db.createStringAttribute(DB_ID, COL_ID, 'contactEmail',  200, false, ''),
      db.createStringAttribute(DB_ID, COL_ID, 'contactPhone',   30, false, ''),
      db.createStringAttribute(DB_ID, COL_ID, 'contactLine',   100, false, ''),
      db.createStringAttribute(DB_ID, COL_ID, 'sourceName',    150, false, ''),  // กรณี import จากแหล่งอื่น
      db.createStringAttribute(DB_ID, COL_ID, 'status',         30, false, 'pending_review'),
      db.createStringAttribute(DB_ID, COL_ID, 'createdAt',      30, false, ''),
    ]);
    for (let i = 0; i < 24; i += 1) {
      try {
        const col = await db.listAttributes(DB_ID, COL_ID);
        if ((col.attributes as { status?: string }[]).every(a => a.status === 'available')) break;
      } catch { /* keep polling */ }
      await sleep(500);
    }
    await Promise.all([
      { key: 'idx_status',  attrs: ['status'],    orders: [OrderBy.Asc] },
      { key: 'idx_created', attrs: ['createdAt'], orders: [OrderBy.Desc] },
      { key: 'idx_reporter', attrs: ['reporterId'], orders: [OrderBy.Asc] },
    ].map(i => db.createIndex(DB_ID, COL_ID, i.key, DatabasesIndexType.Key, i.attrs, i.orders).catch(() => {})));
  } catch (err) {
    if (String(err).includes('missing scopes')) return;
    throw err;
  }
}

/** normalize เป็น blob ค้นหา: ตัวพิมพ์เล็ก + เลขล้วนของบัญชี/เบอร์ (ตัดขีด/เว้นวรรค) */
function buildSearchBlob(parts: string[]) {
  const text = parts.filter(Boolean).join(' ').toLowerCase();
  const digits = parts.filter(Boolean).map(p => p.replace(/\D/g, '')).filter(d => d.length >= 6).join(' ');
  return (text + ' ' + digits).slice(0, 2500);
}


export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const q = (req.nextUrl.searchParams.get('q') || '').trim().toLowerCase();
    if (!q || q.length < 3) return NextResponse.json({ error: 'กรุณาพิมพ์คำค้นอย่างน้อย 3 ตัวอักษร' }, { status: 400 });

    const qDigits = q.replace(/\D/g, '');
    const r = await db.listDocuments(DB_ID, COL_ID, [
      Query.notEqual('status', 'rejected'),
      Query.orderDesc('createdAt'),
      Query.limit(1000),
    ]).catch(() => ({ documents: [] as Record<string, unknown>[] }));

    const hits = (r.documents as { searchBlob?: string }[]).filter(d => {
      const blob = (d.searchBlob || '') as string;
      return blob.includes(q) || (qDigits.length >= 6 && blob.includes(qDigits));
    }).slice(0, 30);

    // ส่งเฉพาะ field ที่ควรเปิดเผย — ไม่ส่งข้อมูลติดต่อกลับของผู้รายงาน
    const results = (hits as Record<string, unknown>[]).map(d => ({
      id: d.$id, firstName: d.firstName, lastName: d.lastName,
      bankAccounts: d.bankAccounts, product: d.product, amount: d.amount,
      transferDate: d.transferDate, sellerPage: d.sellerPage, province: d.province,
      detail: String(d.detail || '').slice(0, 600),
      chatImageIds: d.chatImageIds, slipImageIds: d.slipImageIds,
      sourceName: d.sourceName, status: d.status, createdAt: d.createdAt,
    }));
    return NextResponse.json({ results, total: results.length });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนรายงาน' }, { status: 401 });
    const me = await getUserFromJwt(jwt);

    const body = await req.json();

    // ── โหมด import (แอดมินเท่านั้น): rows = [{firstName,lastName,acct,bank,phone,detail,sourceName}] ──
    if (Array.isArray(body.rows)) {
      await verifyAdminReq(req);
      const db = getDb();
      await ensureCollection(db);
      let ok = 0;
      for (const row of body.rows.slice(0, 200)) {
        const firstName = String(row.firstName || '').trim().slice(0, 120);
        if (!firstName) continue;
        const lastName = String(row.lastName || '').trim().slice(0, 120);
        const acct = String(row.acct || '').trim().slice(0, 30);
        const bank = String(row.bank || '').trim().slice(0, 80);
        const phone = String(row.phone || '').trim().slice(0, 30);
        await db.createDocument(DB_ID, COL_ID, ID.unique(), {
          reporterId: me.$id,
          firstName, lastName,
          bankAccounts: JSON.stringify(acct ? [{ acct, bank }] : []),
          searchBlob: buildSearchBlob([firstName, lastName, acct, phone, String(row.detail || '')]),
          detail: String(row.detail || '').slice(0, 5000),
          contactPhone: '',
          sourceName: String(row.sourceName || body.sourceName || 'นำเข้าจากแหล่งภายนอก').slice(0, 150),
          status: 'approved',
          createdAt: new Date().toISOString(),
          idCard: '', product: '', amount: 0, transferDate: '', sellerPage: '', province: '',
          chatImageIds: '[]', policeDocIds: '[]', slipImageIds: '[]',
          contactEmail: '', contactLine: '',
        }).catch(() => null);
        ok += 1;
      }
      return NextResponse.json({ ok: true, imported: ok });
    }

    // ── รายงานปกติจากฟอร์ม ──
    const firstName = String(body.firstName || '').trim().slice(0, 120);
    const lastName = String(body.lastName || '').trim().slice(0, 120);
    if (!firstName) return NextResponse.json({ error: 'กรุณากรอกชื่อคนขาย' }, { status: 400 });
    const accounts: { acct: string; bank: string }[] = (Array.isArray(body.bankAccounts) ? body.bankAccounts : [])
      .map((a: { acct?: string; bank?: string }) => ({ acct: String(a.acct || '').replace(/[^\d-]/g, '').slice(0, 30), bank: String(a.bank || '').slice(0, 80) }))
      .filter((a: { acct: string }) => a.acct.replace(/\D/g, '').length >= 6)
      .slice(0, 10);
    if (accounts.length === 0) return NextResponse.json({ error: 'กรุณากรอกบัญชีธนาคารอย่างน้อย 1 บัญชี (หากไม่รู้ให้กรอก 0000000)' }, { status: 400 });
    const detail = String(body.detail || '').trim().slice(0, 5000);
    if (detail.length < 30) return NextResponse.json({ error: 'กรุณาบรรยายรายละเอียดอย่างน้อย 30 ตัวอักษร' }, { status: 400 });
    const slipImageIds: string[] = (Array.isArray(body.slipImageIds) ? body.slipImageIds : []).slice(0, 5);
    if (slipImageIds.length === 0) return NextResponse.json({ error: 'กรุณาแนบสลิปโอนเงินอย่างน้อย 1 รูป' }, { status: 400 });
    const chatImageIds: string[] = (Array.isArray(body.chatImageIds) ? body.chatImageIds : []).slice(0, 20);

    const db = getDb();
    await ensureCollection(db);

    const doc = await db.createDocument(DB_ID, COL_ID, ID.unique(), {
      reporterId: me.$id,
      firstName, lastName,
      idCard: String(body.idCard || '').replace(/\D/g, '').slice(0, 13),
      bankAccounts: JSON.stringify(accounts),
      searchBlob: buildSearchBlob([
        firstName, lastName,
        ...accounts.map(a => a.acct),
        String(body.sellerPage || ''), String(body.contactPhoneOfSeller || ''), detail.slice(0, 500),
      ]),
      product: String(body.product || '').slice(0, 200),
      amount: Math.max(0, Math.round(Number(body.amount) || 0)),
      transferDate: String(body.transferDate || '').slice(0, 30),
      sellerPage: String(body.sellerPage || '').slice(0, 300),
      province: String(body.province || '').slice(0, 100),
      detail,
      chatImageIds: JSON.stringify(chatImageIds),
      policeDocIds: JSON.stringify((Array.isArray(body.policeDocIds) ? body.policeDocIds : []).slice(0, 5)),
      slipImageIds: JSON.stringify(slipImageIds),
      contactEmail: String(body.contactEmail || '').slice(0, 200),
      contactPhone: String(body.contactPhone || '').slice(0, 30),
      contactLine: String(body.contactLine || '').slice(0, 100),
      sourceName: '',
      status: 'pending_review',
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ report: { id: doc.$id } });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message || String(err) }, { status: e.status || 500 });
  }
}

/** แอดมินอนุมัติ/ปฏิเสธรายงาน */
export async function PATCH(req: NextRequest) {
  try {
    await verifyAdminReq(req);
    const { id, action } = await req.json();
    if (!id || !['approve', 'reject'].includes(action)) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    const db = getDb();
    const updated = await db.updateDocument(DB_ID, COL_ID, id, { status: action === 'approve' ? 'approved' : 'rejected' });
    return NextResponse.json({ report: updated });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message || String(err) }, { status: e.status || 500 });
  }
}
