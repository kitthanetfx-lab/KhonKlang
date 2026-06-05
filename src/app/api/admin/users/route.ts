import { NextRequest, NextResponse } from 'next/server';
import { Users, Query } from 'node-appwrite';
import { verifyAdmin, getAdminClient } from '../../admin/_lib';

export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const client = getAdminClient();
    const users  = new Users(client);

    // Fetch up to 500 users (Appwrite max per request is 100, so paginate)
    let allUsers: ReturnType<typeof users.list> extends Promise<infer T> ? (T extends { users: infer U } ? U : never) : never = [];
    let offset = 0;
    let total  = 0;

    while (true) {
      const res = await users.list([Query.limit(100), Query.offset(offset), Query.orderDesc('$createdAt')]);
      total = res.total;
      allUsers = [...allUsers, ...res.users] as typeof allUsers;
      offset += res.users.length;
      if (offset >= Math.min(total, 500) || res.users.length === 0) break;
    }

    return NextResponse.json({ users: allUsers, total });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const client = getAdminClient();
    const users  = new Users(client);

    const { userId, action, role } = await req.json();
    if (!userId || !action) return NextResponse.json({ error: 'missing params' }, { status: 400 });

    if (action === 'set_role') {
      const user  = await users.get(userId);
      const prefs = (user.prefs || {}) as Record<string, string>;
      prefs.role  = role;
      await users.updatePrefs(userId, prefs);
    } else if (action === 'block') {
      await users.updateStatus(userId, false);
    } else if (action === 'unblock') {
      await users.updateStatus(userId, true);
    } else {
      return NextResponse.json({ error: 'unknown action' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
