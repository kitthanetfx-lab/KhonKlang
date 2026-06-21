import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient, verifyUser, HttpError } from '@/lib/supabaseServer';

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
    const me = await verifyUser(req);
    const dealId = req.nextUrl.searchParams.get('dealId');
    const after  = req.nextUrl.searchParams.get('after');
    if (!dealId) return NextResponse.json({ error: 'Missing dealId' }, { status: 400 });

    const db = getAdminClient();
    const denied = await assertDealParty(db, dealId, me.id);
    if (denied) return denied;

    let query = db.from('messages').select('*').eq('deal_id', dealId).order('created_at', { ascending: true }).limit(200);
    if (after) query = query.gt('created_at', after);
    const { data } = await query;
    return NextResponse.json({ messages: data || [] });
  } catch (err: unknown) {
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

    const { data: msg, error } = await db.from('messages').insert({
      deal_id: dealId,
      sender_id: me.id,
      sender_name: profile?.display_name || '',
      role: role || 'user',
      type: type || 'text',
      content: content || '',
      file_id: fileId || '',
      file_name: fileName || '',
    }).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ message: msg });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
