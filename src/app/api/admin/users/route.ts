import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient, HttpError } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const { data, count } = await db.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(500);

    // ban_duration ถูกตั้งใน auth.users (Supabase Auth) ไม่ใช่ตาราง profiles — ต้องดึงมาผสมเพื่อรู้ว่าใครถูกระงับอยู่
    const bannedIds = new Set<string>();
    try {
      const { data: authData } = await db.auth.admin.listUsers({ perPage: 1000 });
      for (const u of authData?.users || []) {
        if (u.banned_until && new Date(u.banned_until) > new Date()) bannedIds.add(u.id);
      }
    } catch { /* best effort — ถ้าดึงไม่ได้ ก็ถือว่าไม่มีใครถูกระงับ */ }

    const users = (data || []).map((p) => ({ ...p, active: !bannedIds.has(p.id) }));
    return NextResponse.json({ users, total: count || 0 });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const { userId, action, role } = await req.json();
    if (!userId || !action) return NextResponse.json({ error: 'missing params' }, { status: 400 });

    if (action === 'set_role') {
      const { error } = await db.from('profiles').update({ role }).eq('id', userId);
      if (error) throw new Error(error.message);
    } else if (action === 'block') {
      const { error } = await db.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
      if (error) throw new Error(error.message);
    } else if (action === 'unblock') {
      const { error } = await db.auth.admin.updateUserById(userId, { ban_duration: 'none' });
      if (error) throw new Error(error.message);
    } else {
      return NextResponse.json({ error: 'unknown action' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
