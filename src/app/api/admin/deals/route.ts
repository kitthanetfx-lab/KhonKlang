import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient, HttpError } from '@/lib/supabaseServer';

async function getBankInfo(db: ReturnType<typeof getAdminClient>, uid?: string | null) {
  if (!uid) return null;
  const { data: u } = await db.from('profiles')
    .select('bank_name, bank_acct, bank_owner, display_name')
    .eq('id', uid).maybeSingle();
  if (!u) return null;
  const bankName = u.bank_name || '';
  const bankAcct = u.bank_acct || '';
  const bankOwner = u.bank_owner || u.display_name || '';
  if (!bankName && !bankAcct) return null;
  return { bankName, bankAcct, bankOwner };
}

/** รายการดีลสำหรับแอดมิน: ?filter=disputed | active | completed | meetup_refund | all */
export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const filter = req.nextUrl.searchParams.get('filter') || 'disputed';
    let query = db.from('deals').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(200);
    if (filter === 'disputed') query = query.eq('status', 'disputed');
    else if (filter === 'completed') query = query.eq('status', 'completed');
    else if (filter === 'meetup_refund') query = query.eq('deal_type', 'meetup').eq('status', 'completed');
    else if (filter === 'confirm_pay') query = query.eq('status', 'payment_uploaded');
    else if (filter === 'active') query = query.neq('status', 'completed');
    const { data, count } = await query;
    const deals = data || [];

    // ดึง deal_meetup / deal_price_state ของทุกดีลที่เกี่ยวข้อง มาแนบ — แทน priceData/meetupData JSON blob เดิม
    const dealIds = deals.map(d => d.id);
    const [{ data: meetups }, { data: priceStates }] = dealIds.length
      ? await Promise.all([
        db.from('deal_meetup').select('*').in('deal_id', dealIds),
        db.from('deal_price_state').select('*').in('deal_id', dealIds),
      ])
      : [{ data: [] }, { data: [] }];
    const meetupMap = new Map((meetups || []).map(m => [m.deal_id, m]));
    const priceMap = new Map((priceStates || []).map(p => [p.deal_id, p]));

    // เลขบัญชีผู้ซื้อ/ผู้ขาย — แอดมินต้องเห็นตรงนี้เวลาโอนเงินจริงด้วยมือ (ไม่ต้องเปิดดีลแยก)
    const uids = Array.from(new Set(deals.flatMap(d => [d.buyer_id, d.seller_id]).filter(Boolean)));
    const bankPairs = await Promise.all(uids.map(async uid => [uid, await getBankInfo(db, uid)] as const));
    const bankMap = new Map(bankPairs);

    const documents = deals.map(d => ({
      ...d,
      meetup: meetupMap.get(d.id) || null,
      priceState: priceMap.get(d.id) || null,
      buyerBank: bankMap.get(d.buyer_id) || null,
      sellerBank: bankMap.get(d.seller_id) || null,
    }));

    return NextResponse.json({ documents, total: count || 0 });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}

/** แอดมินดำเนินการกับดีล: resolve_dispute (ตัดสินข้อพิพาท) / mark_refunded (คืนเงินประกัน meetup) */
export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const { id, action, note } = await req.json();
    if (!id || !action) return NextResponse.json({ error: 'missing params' }, { status: 400 });

    const { data: deal, error: dealErr } = await db.from('deals').select('*').eq('id', id).single();
    if (dealErr || !deal) return NextResponse.json({ error: 'ไม่พบดีล' }, { status: 404 });

    if (action === 'resolve_dispute') {
      if (deal.status !== 'disputed') return NextResponse.json({ error: 'ดีลนี้ไม่ได้อยู่ในข้อพิพาท' }, { status: 400 });
      const { data: updated } = await db.from('deals').update({
        status: 'completed', reject_reason: `[แอดมินตัดสิน] ${String(note || '').slice(0, 400)}`,
      }).eq('id', id).select().single();
      return NextResponse.json({ deal: updated });
    }

    if (action === 'cancel_refund') {
      const { data: updated } = await db.from('deals').update({
        status: 'cancelled', reject_reason: `[แอดมินยกเลิก+คืนเงิน] ${String(note || '').slice(0, 400)}`,
      }).eq('id', id).select().single();
      return NextResponse.json({ deal: updated });
    }

    if (action === 'mark_refunded') {
      // บันทึกว่าโอนเงินประกัน meetup คืนแล้ว
      await db.from('deal_meetup').upsert({
        deal_id: id, refunded_at: new Date().toISOString(), refund_note: String(note || '').slice(0, 200),
      }, { onConflict: 'deal_id' });
      const { data: updated } = await db.from('deals').select('*').eq('id', id).single();
      return NextResponse.json({ deal: updated });
    }

    // ศูนย์กลางยืนยันรับเงิน — ครอบคลุมทุกบริการ (ปกติ/แบบง่าย) ไม่ใช่แค่แบบง่าย
    if (action === 'confirm_payment' || action === 'confirm_simple_payment') {
      if (deal.status !== 'payment_uploaded')
        return NextResponse.json({ error: 'ดีลนี้ไม่อยู่ในสถานะรอยืนยันรับเงิน' }, { status: 400 });
      const { data: updated } = await db.from('deals').update({
        status: 'packing',
        middleman_confirmed_payment: true,
        reject_reason: note ? `[ศูนย์กลางยืนยันรับเงิน] ${String(note).slice(0, 200)}` : deal.reject_reason || '',
      }).eq('id', id).select().single();
      return NextResponse.json({ deal: updated });
    }

    if (action === 'delete_deal') {
      await db.from('deals').delete().eq('id', id);
      return NextResponse.json({ ok: true, deleted: true });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
