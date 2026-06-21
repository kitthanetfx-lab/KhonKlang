import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser, HttpError } from '@/lib/supabaseServer';

const BUY_MODES = ['middleman', 'direct', 'both'] as const;
type BuyMode = typeof BUY_MODES[number];

export async function GET(req: NextRequest) {
  try {
    const db = getAdminClient();
    const mine = req.nextUrl.searchParams.get('mine') === '1';

    if (mine) {
      const me = await verifyUser(req);
      const { data } = await db.from('wanted_posts').select('*').eq('user_id', me.id).order('created_at', { ascending: false }).limit(100);
      return NextResponse.json({ posts: data || [] });
    }

    const { data } = await db.from('wanted_posts').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(100);
    return NextResponse.json({ posts: data || [] });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const db = getAdminClient();

    const body = await req.json();
    const title = String(body.title || '').trim().slice(0, 200);
    if (!title) return NextResponse.json({ error: 'กรุณากรอกชื่อสินค้าที่ต้องการหา' }, { status: 400 });
    const buyMode: BuyMode = BUY_MODES.includes(body.buyMode) ? body.buyMode : 'middleman';
    const budgetMin = Math.max(0, Math.round(Number(body.budgetMin) || 0));
    const budgetMax = Math.max(0, Math.round(Number(body.budgetMax) || 0));
    if (budgetMax && budgetMin > budgetMax) {
      return NextResponse.json({ error: 'งบต่ำสุดต้องไม่มากกว่างบสูงสุด' }, { status: 400 });
    }

    // จำกัดประกาศเปิดค้างไม่เกิน 10 รายการต่อคน กันสแปม
    const { count: openCount } = await db.from('wanted_posts').select('id', { count: 'exact', head: true })
      .eq('user_id', me.id).eq('status', 'open');
    if ((openCount || 0) >= 10) {
      return NextResponse.json({ error: 'คุณมีประกาศเปิดอยู่ครบ 10 รายการแล้ว กรุณาปิดประกาศเก่าก่อน' }, { status: 400 });
    }

    const { data: profile } = await db.from('profiles').select('display_name').eq('id', me.id).maybeSingle();

    const { data: doc, error } = await db.from('wanted_posts').insert({
      user_id: me.id,
      user_name: profile?.display_name || 'สมาชิก',
      title,
      detail: String(body.detail || '').slice(0, 1000),
      budget_min: budgetMin, budget_max: budgetMax,
      category: String(body.category || '').slice(0, 100),
      province: String(body.province || '').slice(0, 100),
      buy_mode: buyMode,
      contact: String(body.contact || '').slice(0, 200),
      status: 'open',
    }).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ post: doc });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const db = getAdminClient();

    const body = await req.json();
    const { id, action } = body;
    if (!id || !['close', 'reopen'].includes(action)) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    const { data: doc, error: getErr } = await db.from('wanted_posts').select('user_id').eq('id', id).single();
    if (getErr || !doc) return NextResponse.json({ error: 'ไม่พบประกาศ' }, { status: 404 });
    if (doc.user_id !== me.id) return NextResponse.json({ error: 'แก้ไขได้เฉพาะประกาศของตัวเอง' }, { status: 403 });

    const { data: updated, error } = await db.from('wanted_posts').update({
      status: action === 'close' ? 'closed' : 'open',
    }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ post: updated });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
