import { NextRequest, NextResponse } from 'next/server';
import { Databases, ID, Query } from 'node-appwrite';
import { verifyAdmin, getAdminClient } from '../../_lib';
import { DB_ID, COL_SIGNALS, ensureSupportCollections } from '../../../_lib/support';

export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const customerId = String(req.nextUrl.searchParams.get('customerId') || '').trim();
    const last = Math.max(1, Math.min(200, Number(req.nextUrl.searchParams.get('last') || 100) || 100));

    const db = new Databases(getAdminClient());
    await ensureSupportCollections(db);
    const res = await db.listDocuments(DB_ID, COL_SIGNALS, [
      Query.orderDesc('createdAt'),
      Query.limit(last),
    ]).catch(() => ({ documents: [] as Array<Record<string, unknown>> }));

    const logs = res.documents
      .filter((doc) => doc.type === 'debug' && (!customerId || doc.threadId === customerId))
      .map((doc) => {
        const raw = String(doc.data || '');
        return {
          $id: doc.$id,
          threadId: doc.threadId,
          fromRole: doc.fromRole,
          createdAt: doc.createdAt,
          payload: JSON.parse(raw || '{}'),
        };
      });

    return NextResponse.json({ logs });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const body = await req.json().catch(() => ({}));
    const customerId = String(body.customerId || '').trim();
    if (!customerId) return NextResponse.json({ error: 'ไม่พบลูกค้า' }, { status: 400 });

    const db = new Databases(getAdminClient());
    await ensureSupportCollections(db);

    const payload = JSON.stringify(body).slice(0, 8000);
    await db.createDocument(DB_ID, COL_SIGNALS, ID.unique(), {
      threadId: customerId,
      callId: 'debug',
      fromRole: 'staff',
      type: 'debug',
      data: payload,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}
