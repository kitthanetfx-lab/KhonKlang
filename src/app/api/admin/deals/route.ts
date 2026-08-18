import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient, HttpError } from '@/lib/supabaseServer';
import { deleteDealById } from '../../_lib/deleteDeal';
import {
  getAdminDealCounts,
  loadAdminDealSnapshot,
  dealMatchesStatusTab,
  type AdminDealSnapshot,
} from '../../_lib/adminDealQueue';
import { maybeNotifyAdminLineQueues } from '../../_lib/adminLineNotifyHook';
import {
  dealMatchesCategory,
  isBareListing,
  onsiteMatchesTab,
  parseAdminDealCategory,
  type AdminStatusTab,
} from '@/lib/adminDealCategory';
import { readFeesConfig, syncDealLedger } from '../../_lib/financeLedger';
import { resolveFeePayer } from '@/lib/dealPaymentBreakdown';
import { isListingCheckoutOrder, isMarketplaceSold } from '@/lib/marketplaceOrder';
import { notifyUsers } from '../../_lib/notify';
import { settleAuctionCancel, releaseAuctionDepositOnPaid } from '../../_lib/userWallet';

async function attachDealImages<T extends { id: string }>(
  db: ReturnType<typeof getAdminClient>,
  deals: T[],
): Promise<(T & { images: string[] })[]> {
  const ids = deals.map(d => d.id);
  if (!ids.length) return deals.map(d => ({ ...d, images: [] }));
  const { data } = await db.from('deal_images').select('deal_id, file_id, position').in('deal_id', ids).order('position', { ascending: true });
  const map = new Map<string, string[]>();
  for (const row of data || []) {
    const arr = map.get(row.deal_id) || [];
    arr.push(row.file_id);
    map.set(row.deal_id, arr);
  }
  return deals.map(d => ({ ...d, images: map.get(d.id) || [] }));
}

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

/** นับจำนวนดีลทุก tab พร้อมกัน: ?filter=counts&category=trade */
async function getCounts(db: ReturnType<typeof getAdminClient>, category?: string | null) {
  return getAdminDealCounts(db, category);
}

/** รายการดีลสำหรับแอดมิน: ?filter=disputed&category=trade | counts */
export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const filter = req.nextUrl.searchParams.get('filter') || 'disputed';
    const category = parseAdminDealCategory(req.nextUrl.searchParams.get('category'));

    if (filter === 'counts') {
      const counts = await getCounts(db, category);
      return NextResponse.json({ counts });
    }

    if (filter === 'slipok_health') {
      const { getSlipokHealth } = await import('@/lib/slipok');
      return NextResponse.json(await getSlipokHealth());
    }

    const statusTab = filter as AdminStatusTab;

    if (category === 'consign') {
      return NextResponse.json({ documents: [], total: 0 });
    }

    if (category === 'onsite') {
      const { data } = await db.from('onsite_jobs').select('*').order('created_at', { ascending: false }).limit(200);
      const jobs = (data || []).filter(j => onsiteMatchesTab(j, statusTab));
      return NextResponse.json({ documents: jobs, total: jobs.length, kind: 'onsite' });
    }

    const fees = await readFeesConfig(db);
    let query = db.from('deals').select('*').order('created_at', { ascending: false }).limit(300);
    if (filter === 'disputed') query = query.eq('status', 'disputed');
    else if (filter === 'completed') query = query.eq('status', 'completed');
    else if (filter === 'meetup_refund') query = query.eq('deal_type', 'meetup').eq('status', 'completed');
    else if (filter === 'confirm_pay') query = query.eq('status', 'payment_uploaded');
    else if (filter === 'pay_seller') query = query.eq('status', 'completed').neq('deal_type', 'meetup');
    else if (filter === 'refund_pending') query = query.eq('status', 'cancelled').neq('deal_type', 'meetup');
    else if (filter === 'middleman_fee') query = query.eq('status', 'completed').not('middleman_id', 'is', null);
    else if (filter === 'active') query = query.not('status', 'in', '(completed,cancelled,disputed)');

    const { data } = await query;
    let deals = (data || []).filter(d => !isBareListing(d) && dealMatchesCategory(d, category));

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

    documents = await attachDealImages(db, documents);

    // กรองเพิ่มฝั่ง JS เพราะต้องเช็คฟิลด์ที่อยู่ใน deal_price_state/deal_meetup (join แล้วถึงรู้)
    if (filter === 'pay_seller') documents = documents.filter(d => !d.priceState?.payout_slip_file_id);
    else if (filter === 'refund_pending') documents = documents.filter(d => !!d.payment_slip_file_id && !d.priceState?.refund_slip_file_id);
    else if (filter === 'middleman_fee') documents = documents.filter(d => !d.priceState?.middleman_fee_sent_at);
    else if (filter === 'meetup_refund') documents = documents.filter(d => !d.meetup?.refund_outcome);

    if (filter === 'active') {
      const snapshots: AdminDealSnapshot[] = documents.map(d => ({
        deal: d,
        priceState: d.priceState,
        meetup: d.meetup,
      }));
      documents = snapshots
        .filter(s => dealMatchesStatusTab(s, 'active', fees))
        .map(s => documents.find(d => d.id === s.deal.id)!)
        .filter(Boolean);
    }

    return NextResponse.json({ documents, total: documents.length, kind: 'deal' });
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
    const { id, action, note, outcome, fileId, whichSlip, ok, shippingCost } = body as {
      id: string; action: string; note?: string;
      outcome?: 'buyer_all' | 'seller_all' | 'both' | 'frozen';
      fileId?: string; whichSlip?: 'buyer' | 'seller'; ok?: boolean;
      shippingCost?: number;
    };

    if (!id || !action) return NextResponse.json({ error: 'Missing id or action' }, { status: 400 });

    // ดึงดีลปัจจุบัน
    const { data: deal, error: dealErr } = await db.from('deals').select('*').eq('id', id).maybeSingle();
    if (dealErr || !deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    const beforeSnapshot = await loadAdminDealSnapshot(db, deal);
    const { data: priceState } = await db.from('deal_price_state').select('*').eq('deal_id', id).maybeSingle();
    const feePayer = resolveFeePayer(deal, priceState);
    const sellerSlipRequired = !isListingCheckoutOrder(deal)
      && deal.deal_type !== 'meetup'
      && (feePayer === 'seller' || feePayer === 'split');

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
        await settleAuctionCancel(db, deal, deal.deal_type === 'auction' && Boolean(deal.buyer_id));
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
        await releaseAuctionDepositOnPaid(db, deal).catch(() => {});
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
            const mkt = isListingCheckoutOrder(deal);
            await db.from('deals').update({
              status: mkt ? 'posted' : 'payment_pending',
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
      case 'cancel_marketplace_checkout': {
        if (!isListingCheckoutOrder(deal)) {
          return NextResponse.json({ error: 'ใช้ได้เฉพาะคำสั่งซื้อตลาด/ประมูล' }, { status: 400 });
        }
        if (!deal.buyer_id) {
          return NextResponse.json({ error: 'ดีลนี้ยังไม่มีผู้ซื้อ' }, { status: 400 });
        }
        if (isMarketplaceSold(deal)) {
          return NextResponse.json({ error: 'ขายแล้ว/กำลังจัดส่ง — ยกเลิกไม่ได้' }, { status: 400 });
        }
        if (!['posted', 'payment_pending', 'payment_uploaded'].includes(String(deal.status))) {
          return NextResponse.json({ error: 'สถานะดีลนี้ยกเลิกคำสั่งซื้อไม่ได้' }, { status: 400 });
        }
        const reason = String(note || 'แอดมินยกเลิกคำสั่งซื้อ').slice(0, 500);
        const buyerId = String(deal.buyer_id);
        let msg = '';
        if (deal.deal_type === 'auction') {
          await db.from('deals').update({
            status: 'cancelled',
            reject_reason: reason,
            payment_slip_file_id: null,
            payment_slip_verified_at: null,
            middleman_confirmed_payment: false,
          }).eq('id', id);
          msg = `แอดมินยกเลิกคำสั่งซื้อประมูล${note ? `: ${note}` : ''}`;
          await settleAuctionCancel(db, deal, Boolean(deal.buyer_id));
        } else {
          await db.from('deals').update({
            status: 'posted',
            buyer_id: null,
            buyer_name: null,
            buyer_shipping_provider: null,
            payment_slip_file_id: null,
            payment_slip_verified_at: null,
            middleman_confirmed_payment: false,
            reject_reason: reason,
          }).eq('id', id);
          await db.from('deal_price_state').upsert(
            { deal_id: id, buyer_shipping_confirmed_at: null },
            { onConflict: 'deal_id' },
          );
          msg = `แอดมินยกเลิกคำสั่งซื้อ — เปิดขายต่อบนตลาด${note ? `: ${note}` : ''}`;
        }
        await db.from('messages').insert({
          deal_id: id, sender_id: null, sender_name: 'ระบบ',
          role: 'system', type: 'system', content: msg,
        });
        await notifyUsers(db, [buyerId], {
          title: `ยกเลิกคำสั่งซื้อ: ${deal.title || 'สินค้า'}`,
          body: msg,
          link: deal.deal_type === 'auction' ? `/marketplace/${id}` : `/marketplace/${id}`,
        });
        break;
      }
      case 'update_shipping_cost': {
        if (deal.deal_type !== 'simple') {
          return NextResponse.json({ error: 'แก้ค่าขนส่งได้เฉพาะดีลแบบง่าย' }, { status: 400 });
        }
        if (!['payment_pending', 'payment_uploaded'].includes(String(deal.status))) {
          return NextResponse.json({ error: 'แก้ค่าขนส่งได้เฉพาะก่อนยืนยันรับเงิน' }, { status: 400 });
        }
        const nextShipping = Math.max(0, Math.round(Number(shippingCost) || 0));
        await db.from('deals').update({ shipping_cost: nextShipping }).eq('id', id);
        await db.from('messages').insert({
          deal_id: id, sender_id: null, sender_name: 'ระบบ',
          role: 'system', type: 'system',
          content: `📦 แอดมินอัปเดตค่าขนส่งเป็น ฿${nextShipping.toLocaleString()} — ยอดตรวจสลิปผู้ซื้อจะคำนวณใหม่`,
        });
        if (deal.payment_slip_file_id) {
          const { runAutoSlipVerification } = await import('../../_lib/slipAutoVerify');
          await db.from('deals').update({ reject_reason: '', payment_slip_verified_at: null }).eq('id', id);
          await runAutoSlipVerification(db, id, 'buyer');
        }
        await syncDealLedger(db, { ...deal, shipping_cost: nextShipping } as Record<string, unknown>);
        break;
      }
      case 'rerun_slip_verify': {
        const side: 'buyer' | 'seller' = whichSlip === 'seller' ? 'seller' : 'buyer';
        const { runAutoSlipVerification, runAutoMeetupSlipVerification } = await import('../../_lib/slipAutoVerify');

        if (deal.deal_type === 'meetup') {
          const { data: md } = await db.from('deal_meetup').select('*').eq('deal_id', id).maybeSingle();
          const slipField = side === 'buyer' ? 'buyer_slip' : 'seller_slip';
          if (!md?.[slipField]) {
            return NextResponse.json({ error: `ยังไม่มีสลิป${side === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย'}` }, { status: 400 });
          }
          await db.from('deal_meetup').upsert({
            deal_id: id,
            [`${side}_slip_verified_at`]: null,
          }, { onConflict: 'deal_id' });
          await db.from('deals').update({ reject_reason: '' }).eq('id', id);
          const autoResult = await runAutoMeetupSlipVerification(db, id, side);
          await db.from('messages').insert({
            deal_id: id, sender_id: null, sender_name: 'ระบบ',
            role: 'system', type: 'system',
            content: `🔄 แอดมินสั่งตรวจสลิปเงินประกัน${side === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย'}อัตโนมัติอีกครั้ง`,
          });
          const { data: updated } = await db.from('deals').select('*').eq('id', id).maybeSingle();
          if (updated) await maybeNotifyAdminLineQueues(db, beforeSnapshot, updated, {
            skipSteps: autoResult.skipConfirmPayLine ? ['confirm_pay'] : [],
          });
          return NextResponse.json({ deal: autoResult.deal || updated });
        }

        if (side === 'buyer') {
          if (!deal.payment_slip_file_id) {
            return NextResponse.json({ error: 'ยังไม่มีสลิปผู้ซื้อ' }, { status: 400 });
          }
          await db.from('deals').update({
            reject_reason: '',
            payment_slip_verified_at: null,
          }).eq('id', id);
        } else {
          if (!priceState?.seller_fee_slip) {
            return NextResponse.json({ error: 'ยังไม่มีสลิปค่าบริการของผู้ขาย' }, { status: 400 });
          }
          await db.from('deal_price_state').upsert({
            deal_id: id,
            seller_fee_slip_verified_at: null,
          }, { onConflict: 'deal_id' });
        }
        const autoResult = await runAutoSlipVerification(db, id, side);
        await db.from('messages').insert({
          deal_id: id, sender_id: null, sender_name: 'ระบบ',
          role: 'system', type: 'system',
          content: `🔄 แอดมินสั่งตรวจสลิป${side === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย'}อัตโนมัติอีกครั้ง`,
        });
        const { data: updated } = await db.from('deals').select('*').eq('id', id).maybeSingle();
        if (updated) await maybeNotifyAdminLineQueues(db, beforeSnapshot, updated, {
          skipSteps: autoResult.skipConfirmPayLine ? ['confirm_pay'] : [],
        });
        return NextResponse.json({ deal: autoResult.deal || updated });
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
    if (updated) await maybeNotifyAdminLineQueues(db, beforeSnapshot, updated);
    return NextResponse.json({ deal: updated });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
