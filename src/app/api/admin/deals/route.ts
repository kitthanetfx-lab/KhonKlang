import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient, HttpError } from '@/lib/supabaseServer';
import { deleteDealById } from '../../_lib/deleteDeal';

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

/** นับจำนวนดีลทุก tab พร้อมกัน: ?filter=counts */
async function getCounts(db: ReturnType<typeof getAdminClient>) {
  const [active, confirmPay, paySeller, refundPending, meetupRefund, disputed, middlemanFee] = await Promise.all([
    db.from('deals').select('id', { count: 'exact', head: true }).neq('status', 'completed').neq('status', 'cancelled'),
    db.from('deals').select('id', { count: 'exact', head: true }).eq('status', 'payment_uploaded'),
    db.from('deals').select('id', { count: 'exact', head: true }).eq('status', 'completed').neq('deal_type', 'meetup'),
    db.from('deals').select('id', { count: 'exact', head: true }).eq('status', 'cancelled').neq('deal_type', 'meetup'),
    db.from('deal_meetup').select('id', { count: 'exact', head: true }).is('refund_outcome', null),
    db.from('deals').select('id', { count: 'exact', head: true }).eq('status', 'disputed'),
    db.from('deals').select('id', { count: 'exact', head: true }).eq('status', 'completed').not('middleman_id', 'is', null),
  ]);
  return {
    active: active.count || 0,
    confirm_pay: confirmPay.count || 0,
    pay_seller: paySeller.count || 0,
    refund_pending: refundPending.count || 0,
    meetup_refund: meetupRefund.count || 0,
    disputed: disputed.count || 0,
    middleman_fee: middlemanFee.count || 0,
  };
}

/** รายการดีลสำหรับแอดมิน: ?filter=disputed | active | completed | meetup_refund | counts */
export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const filter = req.nextUrl.searchParams.get('filter') || 'disputed';

    if (filter === 'counts') {
      const counts = await getCounts(db);
      return NextResponse.json({ counts });
    }
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
    const [{ data: meetups }, { data: priceStates }, { data: evidences }, { data: reviews }] = dealIds.length
      ? await Promise.all([
        db.from('deal_meetup').select('*').in('deal_id', dealIds),
        db.from('deal_price_state').select('*').in('deal_id', dealIds),
        db.from('deal_evidence').select('*').in('deal_id', dealIds).order('created_at', { ascending: true }),
        db.from('reviews').select('id, deal_id, reviewer_name, reviewer_role, target_role, rating, tags, comment, created_at').in('deal_id', dealIds).order('created_at', { ascending: false }),
      ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
    const meetupMap = new Map((meetups || []).map(m => [m.deal_id, m]));
    const priceMap = new Map((priceStates || []).map(p => [p.deal_id, p]));
    const evidenceMap = new Map<string, typeof evidences>();
    for (const item of evidences || []) {
      const prev = evidenceMap.get(item.deal_id) || [];
      prev.push(item);
      evidenceMap.set(item.deal_id, prev);
    }
    const reviewMap = new Map<string, typeof reviews>();
    for (const item of reviews || []) {
      const prev = reviewMap.get(item.deal_id) || [];
      prev.push(item);
      reviewMap.set(item.deal_id, prev);
    }

    // เลขบัญชีผู้ซื้อ/ผู้ขาย/คนกลาง — แอดมินต้องเห็นตรงนี้เวลาโอนเงินจริงด้วยมือ (ไม่ต้องเปิดดีลแยก)
    const uids = Array.from(new Set(deals.flatMap(d => [d.buyer_id, d.seller_id, d.middleman_id]).filter(Boolean)));
    const bankPairs = await Promise.all(uids.map(async uid => [uid, await getBankInfo(db, uid)] as const));
    const bankMap = new Map(bankPairs);

    const creatorIds = Array.from(new Set(
      deals.filter(d => d.deal_type === 'simple' && d.creator_id).map(d => d.creator_id as string),
    ));
    const { data: creatorProfiles } = creatorIds.length
      ? await db.from('profiles').select('id, display_name, seller_status, middleman_status').in('id', creatorIds)
      : { data: [] as { id: string; display_name: string | null; seller_status: string | null; middleman_status: string | null }[] };
    const creatorMap = new Map((creatorProfiles || []).map(p => [p.id, p]));

    let documents = deals.map(d => ({
      ...d,
      meetup: meetupMap.get(d.id) || null,
      priceState: priceMap.get(d.id) || null,
      evidence: evidenceMap.get(d.id) || [],
      reviews: reviewMap.get(d.id) || [],
      buyerBank: bankMap.get(d.buyer_id) || null,
      sellerBank: bankMap.get(d.seller_id) || null,
      middlemanBank: bankMap.get(d.middleman_id) || null,
      creatorProfile: d.creator_id ? creatorMap.get(d.creator_id) || null : null,
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
export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const body = await req.json();
    const { id, action, note, outcome, fileId, whichSlip, ok } = body as {
      id: string; action: string; note?: string;
      outcome?: 'buyer_all' | 'seller_all' | 'both' | 'frozen';
      fileId?: string; whichSlip?: 'buyer' | 'seller'; ok?: boolean;
    };

    if (!id || !action) return NextResponse.json({ error: 'Missing id or action' }, { status: 400 });

    // ดึงดีลปัจจุบัน
    const { data: deal, error: dealErr } = await db.from('deals').select('*').eq('id', id).maybeSingle();
    if (dealErr || !deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    const { data: priceState } = await db.from('deal_price_state').select('*').eq('deal_id', id).maybeSingle();
    const feePayer = String(priceState?.proposed_fee_payer || deal.fee_payer || 'split');
    const sellerSlipRequired = deal.deal_type !== 'meetup' && (feePayer === 'seller' || feePayer === 'split');

    switch (action) {
      case 'resolve_dispute': {
        // ปล่อยเงินให้ผู้ขาย — ดีลดำเนินต่อ
        await db.from('deals').update({
          status: 'packing',
          reject_reason: note || null,
        }).eq('id', id);
        // system message
        await db.from('messages').insert({
          deal_id: id, sender_id: null, sender_name: 'ระบบ',
          role: 'system', type: 'system',
          content: `แอดมินตัดสินข้อพิพาท: ดำเนินการต่อ (ปล่อยเงินให้ผู้ขาย)${note ? ` — ${note}` : ''}`,
        });
        break;
      }
      case 'cancel_refund': {
        // ยกเลิกดีล + คืนเงินผู้ซื้อ
        await db.from('deals').update({
          status: 'cancelled',
          reject_reason: note || null,
        }).eq('id', id);
        await db.from('messages').insert({
          deal_id: id, sender_id: null, sender_name: 'ระบบ',
          role: 'system', type: 'system',
          content: `แอดมินยกเลิกดีลและคืนเงินผู้ซื้อ${note ? ` — ${note}` : ''}`,
        });
        break;
      }
      case 'confirm_payment': {
        // ยืนยันรับเงิน (admin แทน middleman) — meetup ไป meetup_ready, ดีลปกติไป packing
        const isMeetup = deal.deal_type === 'meetup';
        if (!isMeetup) {
          if (!deal.payment_slip_file_id) return NextResponse.json({ error: 'ยังไม่มีสลิปผู้ซื้อให้ตรวจ' }, { status: 400 });
          if (!deal.payment_slip_verified_at) return NextResponse.json({ error: 'กรุณาตรวจสลิปผู้ซื้อก่อน' }, { status: 400 });
          if (sellerSlipRequired) {
            if (!priceState?.seller_fee_slip) return NextResponse.json({ error: 'ยังไม่มีสลิปค่าบริการของผู้ขาย' }, { status: 400 });
            if (!priceState?.seller_fee_slip_verified_at) return NextResponse.json({ error: 'กรุณาตรวจสลิปค่าบริการของผู้ขายก่อน' }, { status: 400 });
          }
        }
        await db.from('deals').update({
          status: isMeetup ? 'meetup_ready' : 'packing',
          middleman_confirmed_payment: true,
        }).eq('id', id);
        // meetup: ยืนยันรับเงิน = ตรวจสลิปครบทั้งสองฝ่าย (กันสถานะ "นัดเจอ" แต่สลิปยัง "รอตรวจ")
        if (isMeetup) {
          const now = new Date().toISOString();
          await db.from('deal_meetup').upsert({ deal_id: id, buyer_slip_verified_at: now, seller_slip_verified_at: now }, { onConflict: 'deal_id' });
        }
        await db.from('messages').insert({
          deal_id: id, sender_id: null, sender_name: 'ระบบ',
          role: 'system', type: 'system',
          content: isMeetup
            ? `แอดมินยืนยันสลิปเงินประกันแล้ว — เริ่มขั้นตอนนัดพบได้เลย${note ? ` (${note})` : ''}`
            : `แอดมินยืนยันรับเงินแล้ว — ผู้ขายเริ่มแพ็คสินค้าได้เลย${note ? ` (${note})` : ''}`,
        });
        break;
      }
      case 'verify_payment_slip': {
        if (deal.deal_type === 'meetup') return NextResponse.json({ error: 'ดีลนี้ใช้การตรวจสลิปแบบนัดรับอยู่แล้ว' }, { status: 400 });
        if (whichSlip !== 'buyer' && whichSlip !== 'seller') return NextResponse.json({ error: 'whichSlip ไม่ถูกต้อง' }, { status: 400 });
        const sideLabel = whichSlip === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย';
        let msg = '';
        if (whichSlip === 'buyer') {
          if (!deal.payment_slip_file_id) return NextResponse.json({ error: 'ยังไม่มีสลิปผู้ซื้อ' }, { status: 400 });
          if (ok) {
            await db.from('deals').update({ payment_slip_verified_at: new Date().toISOString() }).eq('id', id);
            msg = sellerSlipRequired && !priceState?.seller_fee_slip_verified_at
              ? '✅ ศูนย์กลางตรวจสลิปผู้ซื้อแล้ว (ถูกต้อง) — รอตรวจสลิปค่าบริการของผู้ขาย'
              : '✅ ศูนย์กลางตรวจสลิปผู้ซื้อแล้ว (ถูกต้อง)';
          } else {
            await db.from('deals').update({
              status: 'payment_pending',
              payment_slip_file_id: null,
              payment_slip_verified_at: null,
              reject_reason: note || null,
            }).eq('id', id);
            msg = `❌ สลิป${sideLabel}ไม่ถูกต้อง — กรุณาอัปโหลดใหม่อีกครั้ง${note ? ` (${note})` : ''}`;
          }
        } else {
          if (!sellerSlipRequired) return NextResponse.json({ error: 'ดีลนี้ไม่ต้องมีสลิปค่าบริการฝั่งผู้ขาย' }, { status: 400 });
          if (!priceState?.seller_fee_slip) return NextResponse.json({ error: 'ยังไม่มีสลิปค่าบริการของผู้ขาย' }, { status: 400 });
          if (ok) {
            await db.from('deal_price_state').upsert({ deal_id: id, seller_fee_slip_verified_at: new Date().toISOString() }, { onConflict: 'deal_id' });
            msg = deal.payment_slip_verified_at
              ? '✅ ศูนย์กลางตรวจสลิปค่าบริการของผู้ขายแล้ว (ถูกต้อง) — พร้อมยืนยันรับเงิน'
              : '✅ ศูนย์กลางตรวจสลิปค่าบริการของผู้ขายแล้ว (ถูกต้อง) — รอตรวจสลิปผู้ซื้อ';
          } else {
            await db.from('deal_price_state').upsert({ deal_id: id, seller_fee_slip: null, seller_fee_slip_verified_at: null }, { onConflict: 'deal_id' });
            msg = `❌ สลิป${sideLabel}ไม่ถูกต้อง — กรุณาอัปโหลดใหม่อีกครั้ง${note ? ` (${note})` : ''}`;
          }
        }
        await db.from('messages').insert({
          deal_id: id, sender_id: null, sender_name: 'ระบบ',
          role: 'system', type: 'system', content: msg,
        });
        break;
      }
      case 'verify_meetup_slip': {
        // ข้อ5: ศูนย์กลางตรวจสลิปเงินประกันรายฝ่าย (whichSlip = buyer|seller, ok = true/false)
        if (deal.deal_type !== 'meetup') return NextResponse.json({ error: 'ดีลนี้ไม่ใช่รับประกันเดินทาง' }, { status: 400 });
        if (whichSlip !== 'buyer' && whichSlip !== 'seller') return NextResponse.json({ error: 'whichSlip ไม่ถูกต้อง' }, { status: 400 });
        const { data: md } = await db.from('deal_meetup').select('*').eq('deal_id', id).maybeSingle();
        if (!md) return NextResponse.json({ error: 'ไม่พบข้อมูลเงินประกัน' }, { status: 404 });
        const sideLabel = whichSlip === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย';
        let msg = '';
        if (ok) {
          await db.from('deal_meetup').upsert({ deal_id: id, [`${whichSlip}_slip_verified_at`]: new Date().toISOString() }, { onConflict: 'deal_id' });
          const buyerV = whichSlip === 'buyer' ? true : !!md.buyer_slip_verified_at;
          const sellerV = whichSlip === 'seller' ? true : !!md.seller_slip_verified_at;
          if (buyerV && sellerV) {
            await db.from('deals').update({ status: 'meetup_ready' }).eq('id', id);
            msg = '✅ ศูนย์กลางตรวจสลิปเงินประกันครบทั้งสองฝ่ายแล้ว — เริ่มขั้นตอนนัดพบได้เลย';
          } else {
            msg = `✅ ศูนย์กลางตรวจสลิป${sideLabel}แล้ว (ถูกต้อง) — รออีกฝ่าย`;
          }
        } else {
          // ตีกลับ: ล้างสลิป+ผลตรวจของฝ่ายนั้น แล้วถอยสถานะกลับไปวางเงินใหม่
          await db.from('deal_meetup').upsert({ deal_id: id, [`${whichSlip}_slip`]: null, [`${whichSlip}_slip_verified_at`]: null }, { onConflict: 'deal_id' });
          await db.from('deals').update({ status: 'payment_pending' }).eq('id', id);
          msg = `❌ สลิป${sideLabel}ไม่ถูกต้อง — กรุณาวางเงินประกันและอัปสลิปใหม่อีกครั้ง${note ? ` (${note})` : ''}`;
        }
        await db.from('messages').insert({
          deal_id: id, sender_id: null, sender_name: 'ระบบ', role: 'system', type: 'system', content: msg,
        });
        break;
      }
      case 'delete_deal': {
        await deleteDealById(db, id);
        return NextResponse.json({ ok: true });
      }
      case 'mark_meetup_refund': {
        if (!outcome) return NextResponse.json({ error: 'Missing outcome' }, { status: 400 });

        const meetupUpdate: Record<string, unknown> = { refund_outcome: outcome };
        if (outcome === 'frozen') {
          meetupUpdate.refund_decision_note = note || null;
        } else if (outcome === 'buyer_all') {
          if (fileId) meetupUpdate.buyer_refund_slip = fileId;
          meetupUpdate.refund_decision_note = note || null;
          meetupUpdate.refunded_at = new Date().toISOString();
        } else if (outcome === 'seller_all') {
          if (fileId) meetupUpdate.seller_refund_slip = fileId;
          meetupUpdate.refund_decision_note = note || null;
          meetupUpdate.refunded_at = new Date().toISOString();
        } else if (outcome === 'both') {
          // upload แยกฝ่าย (whichSlip = 'buyer' | 'seller')
          if (whichSlip === 'buyer' && fileId) meetupUpdate.buyer_refund_slip = fileId;
          if (whichSlip === 'seller' && fileId) meetupUpdate.seller_refund_slip = fileId;
          meetupUpdate.refund_decision_note = note || null;
          // mark refunded_at เมื่อทั้งสองฝ่ายได้รับสลิปแล้ว
          const { data: existing } = await db.from('deal_meetup').select('buyer_refund_slip,seller_refund_slip').eq('deal_id', id).maybeSingle();
          const buyerDone = whichSlip === 'buyer' ? !!fileId : !!existing?.buyer_refund_slip;
          const sellerDone = whichSlip === 'seller' ? !!fileId : !!existing?.seller_refund_slip;
          if (buyerDone && sellerDone) meetupUpdate.refunded_at = new Date().toISOString();
        }

        await db.from('deal_meetup').upsert({ deal_id: id, ...meetupUpdate }, { onConflict: 'deal_id' });
        await db.from('messages').insert({
          deal_id: id, sender_id: null, sender_name: 'ระบบ',
          role: 'system', type: 'system',
          content: `แอดมินบันทึกการคืนเงินประกัน: ${outcome}${note ? ` — ${note}` : ''}`,
        });
        break;
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const { data: updated } = await db.from('deals').select('*').eq('id', id).maybeSingle();
    return NextResponse.json({ deal: updated });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
