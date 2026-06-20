import { NextRequest, NextResponse } from 'next/server';
import { Account, Client, Databases, ID } from 'node-appwrite';
import { DB_ID, COL_SIGNALS, ensureSupportCollections } from '../../_lib/support';

function getAdmin() {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Databases(c);
}

async function getMe(req: NextRequest) {
  const jwt = req.headers.get('x-session-jwt');
  if (!jwt) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setJWT(jwt);
  return new Account(c).get();
}

export async function POST(req: NextRequest) {
  try {
    const me = await getMe(req);
    const body = await req.json().catch(() => ({}));
    const db = getAdmin();
    await ensureSupportCollections(db);

    const payload = JSON.stringify({
      ...body,
      actorId: me.$id,
    }).slice(0, 8000);

    await db.createDocument(DB_ID, COL_SIGNALS, ID.unique(), {
      threadId: me.$id,
      callId: 'debug',
      fromRole: 'customer',
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
