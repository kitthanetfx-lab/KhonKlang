import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Databases, Query } from 'node-appwrite';
import { DB_ID, COL_NOTIFICATIONS, ensureNotificationsCollection } from '../_lib/notify';

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

export async function GET(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const me = await getUserFromJwt(jwt);
    const db = getDb();

    const [list, unread] = await Promise.all([
      db.listDocuments(DB_ID, COL_NOTIFICATIONS, [
        Query.equal('userId', me.$id),
        Query.orderDesc('createdAt'),
        Query.limit(50),
      ]).catch(() => ({ documents: [] as unknown[] })),
      db.listDocuments(DB_ID, COL_NOTIFICATIONS, [
        Query.equal('userId', me.$id),
        Query.equal('read', false),
        Query.limit(1),
      ]).catch(() => ({ total: 0 })),
    ]);

    return NextResponse.json({ notifications: list.documents, unread: unread.total || 0 });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const me = await getUserFromJwt(jwt);
    const db = getDb();
    await ensureNotificationsCollection(db);
    const body = await req.json();

    if (body.all) {
      const unreadDocs = await db.listDocuments(DB_ID, COL_NOTIFICATIONS, [
        Query.equal('userId', me.$id),
        Query.equal('read', false),
        Query.limit(100),
      ]).catch(() => ({ documents: [] as { $id: string }[] }));
      await Promise.all((unreadDocs.documents as { $id: string }[]).map(d =>
        db.updateDocument(DB_ID, COL_NOTIFICATIONS, d.$id, { read: true }).catch(() => null)));
      return NextResponse.json({ ok: true });
    }

    if (body.id) {
      const doc = await db.getDocument(DB_ID, COL_NOTIFICATIONS, body.id);
      if (doc.userId !== me.$id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      await db.updateDocument(DB_ID, COL_NOTIFICATIONS, body.id, { read: true });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'ระบุ id หรือ all' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
