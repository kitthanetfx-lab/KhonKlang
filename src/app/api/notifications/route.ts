import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const db = getAdminClient();

    const [list, unread] = await Promise.all([
      db.from('notifications').select('*').eq('user_id', me.id).order('created_at', { ascending: false }).limit(50),
      db.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', me.id).eq('read', false),
    ]);

    return NextResponse.json({ notifications: list.data || [], unread: unread.count || 0 });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const db = getAdminClient();
    const body = await req.json();

    if (body.all) {
      await db.from('notifications').update({ read: true }).eq('user_id', me.id).eq('read', false);
      return NextResponse.json({ ok: true });
    }

    if (body.id) {
      const { data: doc } = await db.from('notifications').select('user_id').eq('id', body.id).maybeSingle();
      if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (doc.user_id !== me.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      await db.from('notifications').update({ read: true }).eq('id', body.id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'ระบุ id หรือ all' }, { status: 400 });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
