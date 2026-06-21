import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient, HttpError } from '@/lib/supabaseServer';

/** รวม moderation ของประกาศหา (wanted_posts) และรีวิว (reviews) ในที่เดียว */
export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const type = req.nextUrl.searchParams.get('type') || 'wanted';
    if (type === 'listings') {
      // ประกาศขายในตลาด = ดีลที่ source='listing'
      const { data, count } = await db.from('deals').select('*', { count: 'exact' }).eq('source', 'listing').order('created_at', { ascending: false }).limit(200);
      return NextResponse.json({ documents: data || [], total: count || 0 });
    }
    const table = type === 'reviews' ? 'reviews' : 'wanted_posts';
    const { data, count } = await db.from(table).select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(200);
    return NextResponse.json({ documents: data || [], total: count || 0 });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}

/** ลบ/ปิดประกาศหรือรีวิวที่ไม่เหมาะสม */
export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const { type, id, action } = await req.json();
    if (!type || !id || !action) return NextResponse.json({ error: 'missing params' }, { status: 400 });

    if (type === 'wanted' && action === 'remove') {
      await db.from('wanted_posts').update({ status: 'closed' }).eq('id', id);
      return NextResponse.json({ ok: true });
    }
    if (type === 'reviews' && action === 'delete') {
      await db.from('reviews').delete().eq('id', id);
      return NextResponse.json({ ok: true });
    }
    if (type === 'listings') {
      // ถอดประกาศ = ตั้งสถานะดีลเป็น cancelled (ตลาดแสดงเฉพาะ status='posted') / คืนประกาศ = posted
      if (action === 'remove') {
        await db.from('deals').update({ status: 'cancelled', reject_reason: '[แอดมินถอดประกาศจากตลาด]' }).eq('id', id);
        return NextResponse.json({ ok: true });
      }
      if (action === 'restore') {
        await db.from('deals').update({ status: 'posted', reject_reason: '' }).eq('id', id);
        return NextResponse.json({ ok: true });
      }
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
