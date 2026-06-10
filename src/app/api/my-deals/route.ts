import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Databases, Query } from 'node-appwrite';

const DB_ID = 'khonklang_db';
const COL_DEALS = 'deals';
const COL_MSGS = 'messages';

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

/** ดีลทั้งหมดของฉัน (ทุกบทบาท) + ข้อความล่าสุดของแต่ละดีล — ใช้ทำหน้าประวัติ/กล่องข้อความ */
export async function GET(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const me = await getUserFromJwt(jwt);
    const db = getDb();

    const [asBuyer, asSeller, asMm] = await Promise.all([
      db.listDocuments(DB_ID, COL_DEALS, [Query.equal('buyerId', me.$id), Query.orderDesc('createdAt'), Query.limit(100)]).catch(() => ({ documents: [] })),
      db.listDocuments(DB_ID, COL_DEALS, [Query.equal('sellerId', me.$id), Query.orderDesc('createdAt'), Query.limit(100)]).catch(() => ({ documents: [] })),
      db.listDocuments(DB_ID, COL_DEALS, [Query.equal('middlemanId', me.$id), Query.orderDesc('createdAt'), Query.limit(100)]).catch(() => ({ documents: [] })),
    ]);

    const seen = new Set<string>();
    const all = [...asBuyer.documents, ...asSeller.documents, ...asMm.documents]
      .filter(d => { if (seen.has(d.$id)) return false; seen.add(d.$id); return true; })
      .slice(0, 80);

    const deals = await Promise.all(all.map(async d => {
      let lastMsg: { content: string; type: string; senderName: string; role: string; createdAt: string } | null = null;
      try {
        const m = await db.listDocuments(DB_ID, COL_MSGS, [
          Query.equal('dealId', d.$id),
          Query.orderDesc('createdAt'),
          Query.limit(1),
        ]);
        const doc = m.documents[0] as { content?: string; type?: string; senderName?: string; role?: string; createdAt?: string } | undefined;
        if (doc) lastMsg = { content: doc.content || '', type: doc.type || 'text', senderName: doc.senderName || '', role: doc.role || '', createdAt: doc.createdAt || '' };
      } catch { /* messages collection อาจยังไม่มี */ }
      const myRole = d.buyerId === me.$id ? 'buyer' : d.sellerId === me.$id ? 'seller' : 'middleman';
      return {
        id: d.$id, title: d.title, price: d.price, status: d.status,
        buyerName: d.buyerName, sellerName: d.sellerName, middlemanName: d.middlemanName,
        createdAt: d.createdAt, myRole, lastMsg,
      };
    }));

    deals.sort((a, b) => {
      const ta = a.lastMsg?.createdAt || a.createdAt || '';
      const tb = b.lastMsg?.createdAt || b.createdAt || '';
      return tb.localeCompare(ta);
    });

    return NextResponse.json({ deals });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
