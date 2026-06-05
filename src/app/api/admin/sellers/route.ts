import { NextRequest, NextResponse } from 'next/server';
import { Databases, Users, Query } from 'node-appwrite';
import { verifyAdmin, getAdminClient, DB_ID } from '../../admin/_lib';

const COL = 'seller_applications';

export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const client    = getAdminClient();
    const databases = new Databases(client);

    const status = req.nextUrl.searchParams.get('status');
    const queries = [Query.limit(200), Query.orderDesc('$createdAt')];
    if (status) queries.push(Query.equal('status', status));

    const res = await databases.listDocuments(DB_ID, COL, queries);
    return NextResponse.json(res);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const client    = getAdminClient();
    const databases = new Databases(client);
    const users     = new Users(client);

    const { docId, action, reason } = await req.json();
    if (!docId || !action) return NextResponse.json({ error: 'missing params' }, { status: 400 });

    const doc = await databases.getDocument(DB_ID, COL, docId);
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await databases.updateDocument(DB_ID, COL, docId, {
      status: newStatus,
      ...(reason ? { rejectReason: reason } : {}),
    });

    // Update user prefs
    try {
      const user    = await users.get(doc.userId);
      const prefs   = (user.prefs || {}) as Record<string, string>;
      prefs.sellerStatus = newStatus;
      if (action === 'approve') prefs.role = 'seller';
      await users.updatePrefs(doc.userId, prefs);
    } catch { /* user may not exist */ }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
