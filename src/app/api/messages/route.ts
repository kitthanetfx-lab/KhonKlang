import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient, verifyUser, HttpError } from '@/lib/supabaseServer';
import { notifyUsers } from '../_lib/notify';

function isAuthError(err: unknown) {
  return err instanceof HttpError && (err.status === 401 || err.status === 403);
}

/** อ่าน/โพสต์แชทได้เฉพาะผู้ร่วมดีล — กันคนสุ่ม dealId มาอ่าน/ยิงข้อความดีลคนอื่น */
async function assertDealParty(db: SupabaseClient, dealId: string, userId: string): Promise<NextResponse | null> {
  const { data: deal, error } = await db.from('deals').select('buyer_id, seller_id, middleman_id').eq('id', dealId).maybeSingle();
  if (error || !deal) return NextResponse.json({ error: 'ไม่พบดีล' }, { status: 404 });
  if (![deal.buyer_id, deal.seller_id, deal.middleman_id].includes(userId))
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงแชทของดีลนี้' }, { status: 403 });
  return null;
}

// GET /api/messages?dealId=xxx&after=isoDate
export async function GET(req: NextRequest) {
  try {
    const dealId = req.nextUrl.searchParams.get('dealId');
    const after  = req.nextUrl.searchParams.get('after');
    if (!dealId) return NextResponse.json({ error: 'Missing dealId' }, { status: 400 });

    const db = getAdminClient();
    let me;
    try {
      me = await verifyUser(req);
    } catch (err: unknown) {
      // หน้า deal มีการ poll route นี้เป็นระยะ แม้บางช่วง session จะยังไม่พร้อม
      // หรือผู้ใช้ยังไม่ได้เข้าร่วมดีลจริง ๆ จึงคืนรายการว่างแทน 401 เพื่อไม่ให้ console โดน spam
      if (isAuthError(err)) return NextResponse.json({ messages: [] });
      throw err;
    }
    const denied = await assertDealParty(db, dealId, me.id);
    if (denied) {
      if (denied.status === 403) return NextResponse.json({ messages: [] });
      return denied;
    }

    let query = db.from('messages').select('*').eq('deal_id', dealId).order('created_at', { ascending: true }).limit(200);
    if (after) query = query.gt('created_at', after);
    const { data } = await query;
    return NextResponse.json({ messages: data || [] });
  } catch (err: unknown) {
    if (isAuthError(err)) return NextResponse.json({ messages: [] });
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}

// POST /api/messages
export async function POST(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const body = await req.json();
    const { dealId, content, type, fileId, fileName, role } = body;
    if (!dealId || (!content && !fileId)) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });

    const db = getAdminClient();
    const denied = await assertDealParty(db, dealId, me.id);
    if (denied) return denied;

    const { data: profile } = await db.from('profiles').select('display_name').eq('id', me.id).maybeSingle();

    // คอลัมน์ role ในตาราง messages เป็น enum รับได้แค่ 'user' หรือ 'system' เท่านั้น
    // ฝั่ง client (deal/[id]/page.tsx) ส่ง myRole มาเป็น 'buyer'/'seller'/'middleman' ซึ่งไม่ตรงกับ enum
    // ทำให้ insert ล้มด้วย Postgres enum error (500) ทุกครั้งที่พิมพ์แชท — บีบให้เหลือแค่ค่าที่ enum รับได้จริง
    const safeRole = role === 'system' ? 'system' : 'user';

    const { data: msg, error } = await db.from('messages').insert({
      deal_id: dealId,
      sender_id: me.id,
      sender_name: profile?.display_name || '',
      role: safeRole,
      type: type || 'text',
      content: content || '',
      file_id: fileId || '',
      file_name: fileName || '',
    }).select().single();
    if (error) throw new Error(error.message);

    // แจ้งเตือน (in-app + push) สมาชิกดีลคนอื่น — ไม่รวมผู้ส่ง
    // ระบบเดิมไม่มี notifyUsers ตรงนี้ → เพิ่มเพื่อให้แชทใหม่ได้รับ push บนมือถือ
    if (safeRole !== 'system') {
      const { data: dealRow } = await db.from('deals')
        .select('buyer_id, seller_id, middleman_id, title')
        .eq('id', dealId).maybeSingle();
      const recipients = [dealRow?.buyer_id, dealRow?.seller_id, dealRow?.middleman_id]
        .filter((x): x is string => !!x && x !== me.id);
      if (recipients.length) {
        const senderName = profile?.display_name || 'สมาชิก';
        const body = type === 'image' ? '📷 ส่งรูป' : type === 'file' ? '📎 ส่งไฟล์' : (content || '').slice(0, 100);
        await notifyUsers(db, recipients, {
          title: `💬 ${senderName}: ${dealRow?.title || 'ดีล'}`,
          body,
          link: `/deal/${dealId}`,
        });
      }
    }

    return NextResponse.json({ message: msg });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
