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
    else if (filter === 'pay_seller') query = query.eq('status', 'completed').neq('deal_type', 'meetup');
    else if (filter === 'refund_pending') query = query.eq('status', 'cancelled').neq('deal_type', 'meetup');
    else if (filter === 'middleman_fee') query = query.eq('status', 'completed').not('middleman_id', 'is', null);
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

    // เลขบัญชีผู้ซื้อ/ผู้ขาย/คนกลาง — แอดมินต้องเห็นตรงนี้เวลาโอนเงินจริงด้วยมือ (ไม่ต้องเปิดดีลแยก)
    const uids = Array.from(new Set(deals.flatMap(d => [d.buyer_id, d.seller_id, d.middleman_id]).filter(Boolean)));
    const bankPairs = await Promise.all(uids.map(async uid => [uid, await getBankInfo(db, uid)] as const));
    const bankMap = new Map(bankPairs);

    let documents = deals.map(d => ({
      ...d,
      meetup: meetupMap.get(d.id) || null,
      priceState: priceMap.get(d.id) || null,
      buyerBank: bankMap.get(d.buyer_id) || null,
      sellerBank: bankMap.get(d.seller_id) || null,
      middlemanBank: bankMap.get(d.middleman_id) || null,
    }));

    // กรองเพิ่มฝั่ง JS เพราะต้องเช็คฟิลด์ที่อยู่ใน deal_price_state/deal_meetup (join แล้วถึงรู้)
    const jsFiltered = filter === 'pay_seller' || filter === 'refund_pending' || filter === 'middleman_fee' || filter === 'meetup_refund';
    if (filter === 'pay_seller') documents = documents.filter(d => !d.priceState?.payout_slip_file_id);
    else if (filter === 'refund_pending') documents = documents.filter(d => !!d.payment_slip_file_id && !d.priceState?.refund_slip_file_id);
    else if (filter === 'middleman_fee') documents = documents.filter(d => !d.priceState?.middleman_fee_sent_at);
    else if (filter === 'meetup_refund') documents = documents.filter(d => !d.meetup?.refund_outcome);

    return NextResponse.json({ documents, total: jsFiltered ? documents.length : (count || 0) });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}

/** แอดมินดำเนินการกับดีล */