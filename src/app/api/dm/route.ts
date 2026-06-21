import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser, HttpError } from '@/lib/supabaseServer';

const pairKeyOf = (a: string, b: string) => [a, b].sort().join('_');

interface DmRow {
  id: string; from_id: string; from_name: string; to_id: string; to_name: string;
  content: string; read: boolean; created_at: string;
}

export async function GET(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const db = getAdminClient();
    const sp = req.nextUrl.searchParams;

    // ── จำนวนยังไม่อ่าน (สำหรับ badge ไอคอนซองจดหมาย) ──
    if (sp.get('box') === 'unread') {
      const { count } = await db.from('dm_messages').select('id', { count: 'exact', head: true }).eq('to_id', me.id).eq('read', false);
      return NextResponse.json({ unread: count || 0 });
    }

    // ── บทสนทนากับคนใดคนหนึ่ง (เปิดอ่าน = mark read) ──
    const withId = sp.get('with') || '';
    if (withId) {
      const { data } = await db.from('dm_messages').select('*')
        .or(`and(from_id.eq.${me.id},to_id.eq.${withId}),and(from_id.eq.${withId},to_id.eq.${me.id})`)
        .order('created_at', { ascending: true }).limit(100);
      const msgs = (data || []) as DmRow[];
      const unreadIds = msgs.filter(m => m.to_id === me.id && !m.read).map(m => m.id);
      if (unreadIds.length) await db.from('dm_messages').update({ read: true }).in('id', unreadIds);
      return NextResponse.json({ messages: msgs });
    }

    // ── รายชื่อบทสนทนาทั้งหมด ──
    const { data } = await db.from('dm_messages').select('*')
      .or(`from_id.eq.${me.id},to_id.eq.${me.id}`)
      .order('created_at', { ascending: false }).limit(600);
    const rows = (data || []) as DmRow[];
    const byThread = new Map<string, { last: DmRow; unread: number }>();
    for (const doc of rows) {
      const key = pairKeyOf(doc.from_id, doc.to_id);
      const cur = byThread.get(key);
      if (!cur || doc.created_at > cur.last.created_at) byThread.set(key, { last: doc, unread: cur?.unread || 0 });
    }
    for (const doc of rows) {
      if (doc.to_id === me.id && !doc.read) {
        const key = pairKeyOf(doc.from_id, doc.to_id);
        const cur = byThread.get(key);
        if (cur) cur.unread += 1;
      }
    }
    const threads = [...byThread.entries()]
      .map(([threadId, { last, unread }]) => {
        const otherIsFrom = last.from_id !== me.id;
        const otherId = otherIsFrom ? last.from_id : last.to_id;
        const otherName = otherIsFrom ? last.from_name : last.to_name;
        return {
          threadId, otherId, otherName: otherName || 'สมาชิก',
          lastContent: last.content, lastAt: last.created_at,
          fromMe: last.from_id === me.id, unread,
        };
      })
      .sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''));
    return NextResponse.json({ threads });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const body = await req.json();

    const toId = String(body.toId || '').trim();
    const content = String(body.content || '').trim().slice(0, 2000);
    if (!toId || !content) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    if (toId === me.id) return NextResponse.json({ error: 'ส่งข้อความหาตัวเองไม่ได้' }, { status: 400 });

    const db = getAdminClient();
    const [{ data: myProfile }, { data: toProfile }] = await Promise.all([
      db.from('profiles').select('display_name').eq('id', me.id).maybeSingle(),
      db.from('profiles').select('display_name').eq('id', toId).maybeSingle(),
    ]);
    if (!toProfile) return NextResponse.json({ error: 'ไม่พบผู้ใช้ปลายทาง' }, { status: 404 });
    const toName = toProfile.display_name || String(body.toName || '').slice(0, 200) || 'สมาชิก';

    const { data: doc, error } = await db.from('dm_messages').insert({
      from_id: me.id,
      from_name: myProfile?.display_name || 'สมาชิก',
      to_id: toId, to_name: toName,
      content,
      read: false,
    }).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ message: doc });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
