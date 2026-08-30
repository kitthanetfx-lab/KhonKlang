import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient, verifyUser, HttpError } from '@/lib/supabaseServer';
import { notifyUsers } from '../../_lib/notify';
import { syncDealLedger, readFeesConfig } from '../../_lib/financeLedger';
import { loadAdminDealSnapshot } from '../../_lib/adminDealQueue';
import { maybeNotifyAdminLineQueues, maybeNotifyAdminInAppQueues } from '../../_lib/adminLineNotifyHook';
import { runAutoSlipVerification, runAutoMeetupSlipVerification } from '../../_lib/slipAutoVerify';
import { getTierCreditLimit } from '@/lib/financeLedger';
import { computeDealFees, FEE_DEFAULTS, computeSimpleDealShare, simpleCreatorSide, computeMarketplaceGp } from '@/lib/fees';
import { dealSellerServiceDue } from '@/lib/dealPaymentBreakdown';
import { getLogisticsProviderLabel, sanitizeShippingProviders } from '@/lib/logistics';
import {
  isDirectShipOrder,
  isMarketplaceOrder,
  isListingCheckoutOrder,
  canJoinMarketplaceAsBuyer,
  isMarketplaceSold,
} from '@/lib/marketplaceOrder';
import { finalizeAuction } from '../../_lib/auctionSync';
import { adminDealsPagePath, getDealCategory } from '@/lib/adminDealCategory';
import { rowToAuctionPublic, computeAuctionEndsAt, resolveAuctionDurationMinutes, type AuctionRow, type AuctionDurationInput } from '@/lib/auction';
import { settleAuctionCancel, releaseAuctionDepositOnPaid } from '../../_lib/userWallet';

// หา user id ของแอดมินทั้งหมด เพื่อแจ้งเตือนเรื่องเงิน/ข้อพิพาท
async function getAdminIds(db: SupabaseClient): Promise<string[]> {
  const { data } = await db.from('profiles').select('id').eq('role', 'admin').limit(200);
  return (data || []).map(r => r.id as string);
}

// เครดิตประกันคนกลางตามเทียร์ (วางตอนทุกฝ่ายตกลงราคา/อนุมัติดีล)
async function getMmDeposit(db: SupabaseClient, uid: string): Promise<number> {
  const [{ data: profile }, fees] = await Promise.all([
    db.from('profiles').select('middleman_tier, middleman_tier_intent').eq('id', uid).maybeSingle(),
    readFeesConfig(db),
  ]);
  const tier = profile?.middleman_tier || profile?.middleman_tier_intent || 'Bronze';
  return getTierCreditLimit(fees, tier);
}

// ดึงเลขบัญชี/ธนาคารของผู้ใช้ — ใช้แสดงในดีลเพื่อสรุปว่าต้องโอนคืนเข้าบัญชีไหน
async function getBankInfo(db: SupabaseClient, uid?: string | null): Promise<{ bankName: string; bankAcct: string; bankOwner: string } | null> {
  if (!uid) return null;
  const { data: u } = await db.from('profiles').select('bank_name, bank_acct, bank_owner, display_name').eq('id', uid).maybeSingle();
  if (!u) return null;
  const bankName = u.bank_name || '';
  const bankAcct = u.bank_acct || '';
  const bankOwner = u.bank_owner || u.display_name || '';
  if (!bankName && !bankAcct) return null;
  return { bankName, bankAcct, bankOwner };
}

const POST_PAYMENT_STATUSES = new Set([
  'packing', 'shipped_to_middleman', 'middleman_received', 'middleman_checking',
  'shipped_to_buyer', 'delivered', 'completed',
]);

/** ที่อยู่จัดส่งผู้ซื้อ — แสดงเฉพาะผู้ขายหลังยืนยันรับเงินแล้ว */
async function getBuyerShippingForSeller(
  db: SupabaseClient,
  deal: Record<string, unknown>,
  viewerId: string,
  viewerRole: string,
): Promise<{ name: string; phone: string; address: string } | null> {
  if (deal.deal_type === 'meetup') return null;
  if (!POST_PAYMENT_STATUSES.has(String(deal.status))) return null;
  const isSeller = viewerId === deal.seller_id;
  const isAdmin = viewerRole === 'admin';
  if (!isSeller && !isAdmin) return null;
  if (!deal.buyer_id) return null;

  const { data: p } = await db.from('profiles')
    .select('phone, address, display_name')
    .eq('id', deal.buyer_id as string)
    .maybeSingle();

  return {
    name: String(deal.buyer_name || p?.display_name || '-').trim() || '-',
    phone: String(p?.phone || '').trim(),
    address: String(p?.address || '').trim(),
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getAdminClient();
    // Public GET — no auth required so anyone with the link can view
    const { data: deal, error } = await db.from('deals').select('*').eq('id', id).single();
    if (error || !deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });

    if (deal.deal_type === 'auction') {
      await finalizeAuction(db, id);
    }

    let current = deal;
    if (deal.deal_type === 'auction') {
      const { data: refreshed } = await db.from('deals').select('*').eq('id', id).single();
      if (refreshed) current = refreshed;
    }
    // ตลาด/ประมูลชนะ: payment_pending โดยไม่มีสลิป = checkout ค้าง → คืน posted
    if (isListingCheckoutOrder(current) && current.status === 'payment_pending' && !current.payment_slip_file_id) {
      const { data: fixed } = await db.from('deals').update({ status: 'posted' }).eq('id', id).select().single();
      if (fixed) current = fixed;
    }
    // ประมูลเก่าที่ค้าง buyer_joined → ย้ายเข้า checkout แบบตลาด
    if (
      current.source === 'listing'
      && current.deal_type === 'auction'
      && current.buyer_id
      && ['buyer_joined', 'terms_pending'].includes(String(current.status))
    ) {
      const { data: fixed } = await db.from('deals').update({
        status: 'posted',
        seller_accepted_terms: true,
        buyer_accepted_terms: true,
        fee_payer: current.fee_payer || 'buyer',
      }).eq('id', id).select().single();
      if (fixed) current = fixed;
    }
    // simple deal: ครบทั้งสองฝ่ายแล้ว → ข้ามยืนยันเงื่อนไข ไปโอนเงินเลย (รองรับดีลเก่าที่ค้าง buyer_joined)
    if (
      current.deal_type === 'simple'
      && ['buyer_joined', 'terms_pending'].includes(String(current.status))
      && current.seller_id && current.buyer_id
    ) {
      const { data: fixed } = await db.from('deals').update({
        status: 'payment_pending',
        seller_accepted_terms: true,
        buyer_accepted_terms: true,
        fee_payer: current.fee_payer || 'buyer',
      }).eq('id', id).select().single();
      if (fixed) current = fixed;
    }
    // Self-heal: ทั้งสองฝ่าย (และคนกลางถ้ามี) ยอมรับครบแล้วแต่สถานะค้างที่ขั้นยอมรับ
    // (เกิดได้จาก race ตอนสองฝ่ายกดยอมรับพร้อมกัน) → ดันไปขั้นคุย/เก็บหลักฐานก่อนโอนเงิน
    // ข้าม listing checkout (ตลาด/ประมูล) — ไม่ดันเข้า payment_pending แบบคนกลาง
    if (
      !isListingCheckoutOrder(current)
      && ['buyer_joined', 'terms_pending'].includes(String(current.status))
      && current.seller_accepted_terms && current.buyer_accepted_terms
      && (!current.middleman_id || current.middleman_accepted_terms)
    ) {
      const { data: fixed } = await db.from('deals').update({ status: 'payment_pending' }).eq('id', id).select().single();
      if (fixed) current = fixed;
    }

    const [priceStateRes, meetupRes, evidenceRes, imagesRes, buyerBank, sellerBank, middlemanBank] = await Promise.all([
      db.from('deal_price_state').select('*').eq('deal_id', id).maybeSingle(),
      db.from('deal_meetup').select('*').eq('deal_id', id).maybeSingle(),
      db.from('deal_evidence').select('*').eq('deal_id', id).order('created_at', { ascending: true }),
      db.from('deal_images').select('file_id').eq('deal_id', id).order('position', { ascending: true }),
      getBankInfo(db, current.buyer_id),
      getBankInfo(db, current.seller_id),
      getBankInfo(db, current.middleman_id),
    ]);

    // default 'buyer' สำหรับ fee_payer_selection ของทั้งสองฝ่าย (requirement: เริ่มต้นผู้ซื้อจ่าย)
    // ถ้า DB ยังเป็น null (row เก่า หรือยังไม่ได้เลือก) ให้คืนค่า default ออกไป
    const rawPs = priceStateRes.data || {};
    const psWithDefaults = {
      ...rawPs,
      fee_payer_selection_buyer: rawPs.fee_payer_selection_buyer || 'buyer',
      fee_payer_selection_seller: rawPs.fee_payer_selection_seller || 'buyer',
    };

    let simpleShare = null;
    if (current.deal_type === 'simple') {
      const fees = await readFeesConfig(db);
      let creatorProfile: { seller_status?: string; middleman_status?: string; display_name?: string } | null = null;
      if (current.creator_id) {
        const { data } = await db.from('profiles')
          .select('display_name, seller_status, middleman_status')
          .eq('id', current.creator_id).maybeSingle();
        creatorProfile = data;
      }
      const share = computeSimpleDealShare(fees, Number(current.price) || 0, {
        sellerStatus: creatorProfile?.seller_status,
        middlemanStatus: creatorProfile?.middleman_status,
      });
      simpleShare = {
        ...share,
        creatorId: current.creator_id || null,
        creatorName: creatorProfile?.display_name || '',
        creatorSide: simpleCreatorSide(current),
      };
    }

    let buyerShipping: { name: string; phone: string; address: string } | null = null;
    let myAutoBidMax: number | null = null;
    let myAutoBidStep: number | null = null;
    let myAuctionStatus: string | null = null;
    let myDepositHold: { locked: boolean; amount: number; status: string | null } | null = null;
    let viewerId: string | null = null;
    let hasLineNotify = false;
    try {
      const me = await verifyUser(req);
      viewerId = me.id;
      buyerShipping = await getBuyerShippingForSeller(db, current, me.id, me.role);
      const { data: vp } = await db.from('profiles').select('line_user_id').eq('id', me.id).maybeSingle();
      hasLineNotify = Boolean(String(vp?.line_user_id || '').trim());
    } catch {
      // public view — ไม่ส่งข้อมูลส่วนตัวผู้ซื้อ
    }

    let sellerShop: {
      sellerId: string; name: string; location: string; address: string;
      tagline: string; avatarFileId: string;
    } | null = null;
    if (current.seller_id && ['posted', 'waiting_seller', 'waiting_buyer'].includes(String(current.status))) {
      const { data: sp } = await db.from('profiles')
        .select('shop_name, shop_tagline, shop_location, shop_address, shop_public, shop_avatar_file_id')
        .eq('id', current.seller_id)
        .maybeSingle();
      if (sp?.shop_public && String(sp.shop_name || '').trim()) {
        sellerShop = {
          sellerId: current.seller_id,
          name: String(sp.shop_name).trim(),
          location: String(sp.shop_location || '').trim(),
          address: String(sp.shop_address || '').trim(),
          tagline: String(sp.shop_tagline || '').trim(),
          avatarFileId: String(sp.shop_avatar_file_id || '').trim(),
        };
      }
    }

    let auction = null;
    let auctionBids: unknown[] = [];
    if (current.deal_type === 'auction') {
      const [auctionRes, bidsRes] = await Promise.all([
        db.from('deal_auction').select('*').eq('deal_id', id).maybeSingle(),
        db.from('auction_bids').select('*').eq('deal_id', id).order('created_at', { ascending: false }).limit(20),
      ]);
      if (auctionRes.data) auction = rowToAuctionPublic(auctionRes.data as AuctionRow);
      auctionBids = bidsRes.data || [];
      if (auction && viewerId) {
        const { getMyAutoBid } = await import('../../_lib/auctionSync');
        const { computeMyAuctionStatus } = await import('@/lib/auction');
        const { getAuctionDepositLock } = await import('../../_lib/userWallet');
        const mine = await getMyAutoBid(db, id, viewerId);
        myAutoBidMax = mine?.maxAmount ?? null;
        myAutoBidStep = mine?.stepAmount ? mine.stepAmount : null;
        myAuctionStatus = computeMyAuctionStatus(auction, viewerId, current.buyer_id);
        myDepositHold = await getAuctionDepositLock(db, id, viewerId, auction.bidDeposit);
      }
    }

    return NextResponse.json({
      deal: { ...current, images: (imagesRes.data || []).map(r => r.file_id) },
      priceState: psWithDefaults,
      meetup: meetupRes.data || null,
      evidence: evidenceRes.data || [],
      buyerBank, sellerBank, middlemanBank,
      simpleShare,
      buyerShipping,
      sellerShop,
      auction,
      auctionBids,
      myAutoBidMax,
      myAutoBidStep,
      myAuctionStatus,
      myDepositHold,
      hasLineNotify,
      lineOaUrl: process.env.NEXT_PUBLIC_LINE_OA_ADD_FRIEND_URL || process.env.NEXT_PUBLIC_LINE_OA_URL || '',
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const me = await verifyUser(req);
    const db = getAdminClient();
    const { data: meProfile } = await db.from('profiles').select('display_name').eq('id', me.id).maybeSingle();
    const myName = meProfile?.display_name || '';

    const body = await req.json();
    const { action } = body;

    const { data: deal, error: dealErr } = await db.from('deals').select('*').eq('id', id).single();
    if (dealErr || !deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    const beforeSnapshot = await loadAdminDealSnapshot(db, deal);

    const isSeller    = deal.seller_id    === me.id;
    const isMiddleman = deal.middleman_id === me.id;
    const isBuyer      = deal.buyer_id     === me.id;

    let updates: Record<string, unknown> = {};
    let priceUpdates: Record<string, unknown> = {};
    const meetupUpdates: Record<string, unknown> = {};
    let evidenceInsert: Record<string, unknown> | null = null;
    let replaceChatTranscript = false;
    let systemMsg = '';
    let writeChatMsg = true; // บางเหตุการณ์ (เช่น เข้ามาดูห้อง) แจ้งเตือนอย่างเดียว ไม่ลงแชท

    // โหลด deal_price_state / deal_meetup ตามต้องการ (เฉพาะ action ที่ใช้)
    const needsPriceState = ['select_fee_payer', 'accept_terms', 'confirm_payment', 'price_propose', 'price_agree', 'evidence_done', 'seller_fee_paid', 'propose_mm_fees', 'accept_mm_fees', 'request_chat_back', 'request_evidence', 'request_payout'].includes(action);
    const needsMeetup = action.startsWith('meetup_');
    const [pdRow, mdRow] = await Promise.all([
      needsPriceState ? db.from('deal_price_state').select('*').eq('deal_id', id).maybeSingle().then(r => r.data) : Promise.resolve(null),
      needsMeetup ? db.from('deal_meetup').select('*').eq('deal_id', id).maybeSingle().then(r => r.data) : Promise.resolve(null),
    ]);
    const pd = pdRow || {};
    const md = mdRow || {};

    switch (action) {
      case 'select_fee_payer': {
        // ผู้ซื้อ/ผู้ขายเลือกผู้จ่ายค่าบริการในขั้นตอนที่ 1
        if (!isSeller && !isBuyer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (!['buyer', 'seller', 'split'].includes(body.feePayer)) {
          return NextResponse.json({ error: 'Invalid feePayer' }, { status: 400 });
        }

        // ตั้งค่าฟิลด์สำหรับตัวเอง, คงค่าอีกฝ่ายไว้
        const myField = isSeller ? 'fee_payer_selection_seller' : 'fee_payer_selection_buyer';
        const otherField = isSeller ? 'fee_payer_selection_buyer' : 'fee_payer_selection_seller';
        const mySelection = body.feePayer;
        // default 'buyer' ถ้าอีกฝ่ายยังไม่ได้เลือก (ตรงกับ GET ที่คืน default 'buyer')
        const otherSelection = pd[otherField] || 'buyer';

        // อัปเดต priceState: ตั้งค่าฟิลด์ของตัวเอง, คงอีกฝ่ายไว้
        priceUpdates[myField] = mySelection;
        // ถ้าอีกฝ่ายมีค่าอยู่แล้ว ให้คงไว้
        if (pd[otherField]) {
          priceUpdates[otherField] = pd[otherField];
        }

        // เช็คว่าทั้งสองฝ่ายเลือกเหมือนกันไหม (default 'buyer' ถ้าอีกฝ่ายยังไม่เลือก)
        if (otherSelection === mySelection) {
          // ตรงกัน -> ตั้งค่า deal.fee_payer
          updates = { fee_payer: mySelection };
          priceUpdates.agreed = true;
          systemMsg = `ทั้งสองฝ่ายตกลงผู้จ่ายค่าบริการแล้ว: ${mySelection === 'buyer' ? 'ผู้ซื้อจ่าย' : mySelection === 'seller' ? 'ผู้ขายจ่าย' : 'หารครึ่ง'}`;
        } else {
          // ยังไม่ตรงกัน -> ล้าง deal.fee_payer ถ้ามี
          updates = { fee_payer: null };
          priceUpdates.agreed = false;
          systemMsg = `${isBuyer ? 'ผู้ซื้อ' : 'ผู้ขาย'}เลือก ${mySelection === 'buyer' ? 'ผู้ซื้อจ่าย' : mySelection === 'seller' ? 'ผู้ขายจ่าย' : 'หารครึ่ง'} — รออีกฝ่ายเลือกให้ตรงกัน`;
        }
        break;
      }
      case 'join_as_buyer': {
        if (isSeller || isMiddleman)
          return NextResponse.json({ error: 'ไม่สามารถเป็นผู้ซื้อได้' }, { status: 400 });

        if (isMarketplaceOrder(deal)) {
          const joinCheck = canJoinMarketplaceAsBuyer(deal, me.id);
          if (!joinCheck.ok)
            return NextResponse.json({ error: joinCheck.error || 'สินค้านี้ไม่พร้อมขายแล้ว' }, { status: 400 });
          const allowedProviders = sanitizeShippingProviders(deal.shipping_providers);
          if (allowedProviders.length > 0) {
            const chosen = String(body.shippingProvider || '').trim();
            if (!chosen || !allowedProviders.includes(chosen)) {
              return NextResponse.json({ error: 'กรุณาเลือกขนส่ง' }, { status: 400 });
            }
            updates.buyer_shipping_provider = chosen;
          }
          const shipLabel = updates.buyer_shipping_provider
            ? getLogisticsProviderLabel(String(updates.buyer_shipping_provider))
            : '';
          const takingOver = !!deal.buyer_id && deal.buyer_id !== me.id;
          const isResume = deal.buyer_id === me.id;
          updates = {
            ...updates,
            buyer_id: me.id,
            buyer_name: myName,
            status: 'posted',
            seller_accepted_terms: true,
            buyer_accepted_terms: true,
            fee_payer: deal.fee_payer || 'buyer',
            ...(takingOver ? { payment_slip_file_id: null, payment_slip_verified_at: null } : {}),
          };
          if (isResume && !takingOver) {
            systemMsg = shipLabel
              ? `${myName} ดำเนินการสั่งซื้อต่อ · ขนส่ง: ${shipLabel}`
              : `${myName} ดำเนินการสั่งซื้อต่อ`;
          } else {
            systemMsg = shipLabel
              ? `${myName} สั่งซื้อจากตลาด · ขนส่ง: ${shipLabel} — รอโอนเงิน`
              : `${myName} สั่งซื้อจากตลาด — รอโอนเงิน`;
            if (deal.seller_id && deal.seller_id !== me.id) {
              await notifyUsers(db, [deal.seller_id], {
                title: takingOver ? '🛒 มีผู้ซื้อใหม่ (แทนที่คำสั่งเดิม)' : '🛒 มีคนสั่งซื้อสินค้าในตลาด',
                body: `${myName} สั่งซื้อ "${deal.title || 'สินค้า'}" — รอผู้ซื้อโอนเงิน`,
                link: '/dashboard/seller',
              }).catch(() => {});
            }
          }
          break;
        }

        if (!['posted', 'waiting_buyer'].includes(deal.status))
          return NextResponse.json({ error: 'สินค้านี้ไม่พร้อมขายแล้ว' }, { status: 400 });
        if (deal.buyer_id)
          return NextResponse.json({ error: 'มีผู้ซื้อแล้ว' }, { status: 400 });
        const allowedProviders = sanitizeShippingProviders(deal.shipping_providers);
        if (allowedProviders.length > 0) {
          const chosen = String(body.shippingProvider || '').trim();
          if (!chosen || !allowedProviders.includes(chosen)) {
            return NextResponse.json({ error: 'กรุณาเลือกขนส่ง' }, { status: 400 });
          }
          updates.buyer_shipping_provider = chosen;
        }
        const shipLabel = updates.buyer_shipping_provider
          ? getLogisticsProviderLabel(String(updates.buyer_shipping_provider))
          : '';
        {
          const newStatus = deal.seller_id ? 'buyer_joined' : 'waiting_seller';
          updates = { ...updates, buyer_id: me.id, buyer_name: myName, status: newStatus };
          if (deal.deal_type === 'simple' && deal.seller_id) {
            updates.status = 'payment_pending';
            updates.seller_accepted_terms = true;
            updates.buyer_accepted_terms = true;
            updates.fee_payer = deal.fee_payer || 'buyer';
            priceUpdates = {
              agreed: true,
              proposed_price: deal.price,
              proposed_fee_payer: deal.fee_payer || 'buyer',
              fee_payer_selection_buyer: deal.fee_payer || 'buyer',
              fee_payer_selection_seller: deal.fee_payer || 'buyer',
            };
            systemMsg = shipLabel
              ? `${myName} เข้าร่วมเป็นผู้ซื้อ · ขนส่ง: ${shipLabel} — พร้อมโอนเงินได้เลย`
              : `${myName} เข้าร่วมเป็นผู้ซื้อ — พร้อมโอนเงินได้เลย`;
          } else {
            systemMsg = shipLabel
              ? `${myName} เข้าร่วมเป็นผู้ซื้อ · ขนส่ง: ${shipLabel}`
              : `${myName} เข้าร่วมเป็นผู้ซื้อ`;
          }
        }
        break;
      }
      case 'join_as_seller': {
        if (!['posted', 'waiting_seller'].includes(deal.status))
          return NextResponse.json({ error: 'Deal not available' }, { status: 400 });
        if (isBuyer || isMiddleman)
          return NextResponse.json({ error: 'ไม่สามารถเป็นผู้ขายได้' }, { status: 400 });
        if (deal.seller_id)
          return NextResponse.json({ error: 'มีผู้ขายแล้ว' }, { status: 400 });
        const newSt = deal.buyer_id ? 'buyer_joined' : 'waiting_buyer';
        updates = { seller_id: me.id, seller_name: myName, status: newSt };
        if (deal.deal_type === 'simple' && deal.buyer_id) {
          updates.status = 'payment_pending';
          updates.seller_accepted_terms = true;
          updates.buyer_accepted_terms = true;
          updates.fee_payer = deal.fee_payer || 'buyer';
          priceUpdates = {
            agreed: true,
            proposed_price: deal.price,
            proposed_fee_payer: deal.fee_payer || 'buyer',
            fee_payer_selection_buyer: deal.fee_payer || 'buyer',
            fee_payer_selection_seller: deal.fee_payer || 'buyer',
          };
          systemMsg = `${myName} เข้าร่วมเป็นผู้ขาย — พร้อมโอนเงินได้เลย`;
        } else {
          systemMsg = `${myName} เข้าร่วมเป็นผู้ขาย`;
        }
        break;
      }
      case 'select_middleman': {
        if (!isBuyer)
          return NextResponse.json({ error: 'ผู้ซื้อเท่านั้นที่เลือกคนกลางได้' }, { status: 403 });
        if (!body.middlemanId || !body.middlemanName)
          return NextResponse.json({ error: 'Missing middlemanId' }, { status: 400 });
        if (body.middlemanId === deal.buyer_id)
          return NextResponse.json({ error: 'ผู้ซื้อไม่สามารถเป็นคนกลางในดีลของตัวเองได้' }, { status: 400 });
        if (body.middlemanId === deal.seller_id)
          return NextResponse.json({ error: 'ผู้ขายไม่สามารถเป็นคนกลางในดีลที่ตัวเองขายได้' }, { status: 400 });
        updates = { middleman_id: body.middlemanId, middleman_name: body.middlemanName, status: 'terms_pending' };
        systemMsg = `ผู้ซื้อเลือก ${body.middlemanName} เป็นคนกลาง`;
        break;
      }
      case 'accept_terms': {
        // Check fee payer selections first — default 'buyer' ถ้า DB ยังเป็น null (requirement: เริ่มต้นผู้ซื้อจ่าย)
        const buyerSel = pd.fee_payer_selection_buyer || 'buyer';
        const sellerSel = pd.fee_payer_selection_seller || 'buyer';

        if (!buyerSel || !sellerSel || buyerSel !== sellerSel) {
          return NextResponse.json({ error: 'ต้องเลือกผู้จ่ายค่าบริการให้ตรงกันทั้งสองฝ่ายก่อนยอมรับเงื่อนไข' }, { status: 400 });
        }

        if (isSeller)    updates.seller_accepted_terms    = true;
        if (isMiddleman) updates.middleman_accepted_terms = true;
        if (isBuyer)     updates.buyer_accepted_terms     = true;
        const sc = isSeller    ? true : deal.seller_accepted_terms;
        const mc = isMiddleman ? true : deal.middleman_accepted_terms;
        const bc = isBuyer     ? true : deal.buyer_accepted_terms;
        const hasMm = !!deal.middleman_id;
        if (sc && bc && (!hasMm || mc)) {
          // Set the fee_payer on the deal (ใช้ค่าที่ตกลงกัน — default 'buyer' ถ้าไม่มี)
          updates.fee_payer = buyerSel;
          updates.status = 'payment_pending';
          // flow ใหม่: ตัดขั้นตกลงราคาออก → auto-mark agreed ที่นี่เลย (กัน downstream code พัง)
          priceUpdates.agreed = true;
          priceUpdates.proposed_price = deal.price;
          priceUpdates.proposed_fee_payer = buyerSel;
          systemMsg = 'ทุกฝ่ายยอมรับเงื่อนไขแล้ว — เริ่มคุย 3 ฝ่ายและเก็บหลักฐานได้';
        } else {
          const who = isSeller ? 'ผู้ขาย' : isMiddleman ? 'คนกลาง' : 'ผู้ซื้อ';
          systemMsg = `${who} ยอมรับเงื่อนไขแล้ว`;
        }
        break;
      }
      case 'propose_mm_fees': {
        if (!isMiddleman) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const mmFee = Math.max(0, Math.round(Number(body.mmFee) || 0));
        const inspFee = Math.max(0, Math.round(Number(body.inspectionFee) || 0));
        priceUpdates = { proposed_mm_fee: mmFee, proposed_inspection_fee: inspFee, mm_fee_accepted_seller: false, mm_fee_accepted_buyer: false };
        systemMsg = `คนกลางเสนอค่าบริการ ฿${mmFee.toLocaleString()} และค่าตรวจสอบสินค้า ฿${inspFee.toLocaleString()} — รอผู้ซื้อและผู้ขายยืนยัน`;
        break;
      }
      case 'accept_mm_fees': {
        if (!isSeller && !isBuyer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (isSeller) priceUpdates = { mm_fee_accepted_seller: true };
        if (isBuyer)  priceUpdates = { mm_fee_accepted_buyer:  true };
        const sellerOk = isSeller ? true : !!pd.mm_fee_accepted_seller;
        const buyerOk  = isBuyer  ? true : !!pd.mm_fee_accepted_buyer;
        const who = isSeller ? 'ผู้ขาย' : 'ผู้ซื้อ';
        systemMsg = sellerOk && buyerOk
          ? `ทั้งผู้ซื้อและผู้ขายยอมรับค่าบริการคนกลางแล้ว`
          : `${who} ยอมรับค่าบริการคนกลางแล้ว — รออีกฝ่าย`;
        break;
      }
      case 'upload_payment': {
        // ผู้ซื้ออัปโหลดสลิปโอนเงินค่าสินค้า (และค่ากลางถ้า fee_payer = 'buyer')
        // flip status → payment_uploaded เพื่อให้ admin เห็นในคิว "⚡ ยืนยันรับเงิน" ของหน้าดีล & ข้อพิพาท
        // (admin จะเช็คเองว่าผู้ขายอัปสลิปค่าบริการครบไหนก่อนกดยืนยัน → packing)
        if (!isBuyer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (!body.fileId) return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
        if (isListingCheckoutOrder(deal)) {
          if (!['posted', 'payment_pending'].includes(deal.status)) {
            return NextResponse.json({ error: 'ไม่สามารถอัปสลิปในขั้นตอนนี้ได้' }, { status: 400 });
          }
        }
        updates = { payment_slip_file_id: String(body.fileId), payment_slip_verified_at: null, status: 'payment_uploaded' };
        systemMsg = 'ผู้ซื้ออัปโหลดหลักฐานการโอนเงินแล้ว';
        break;
      }
      case 'upload_middleman_fee': {
        // ผู้ขายอัปโหลดสลิปโอนค่ากลาง (กรณี fee_payer = 'seller' หรือ 'split')
        if (!isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (!body.fileId) return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
        priceUpdates = { seller_fee_slip: String(body.fileId), seller_fee_slip_verified_at: null };
        systemMsg = 'ผู้ขายโอนค่าบริการส่วนของตนแล้ว — รอศูนย์กลางตรวจสอบ';
        break;
      }
      case 'confirm_payment': {
        // MM ยืนยันรับเงิน — flow ใหม่: เช็ค guard เข้มงวด ต้องมีสลิป + หลักฐาน ครบทั้งสองฝ่ายก่อนเข้า packing
        if (!isMiddleman) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        // 1) สลิปผู้ซื้อ
        if (!deal.payment_slip_file_id) {
          return NextResponse.json({ error: 'ยังรอผู้ซื้ออัปสลิปการโอนเงิน' }, { status: 400 });
        }
        // 2) สลิปผู้ขาย (กรณี seller/split)
        const fees = await readFeesConfig(db);
        const sellerShare = dealSellerServiceDue(deal, pd, fees);
        if (sellerShare > 0 && !pd.seller_fee_slip) {
          return NextResponse.json({ error: 'ยังรอผู้ขายอัปสลิปค่าบริการ' }, { status: 400 });
        }
        // 3) หลักฐาน — regular ต้องครบทั้งสองฝ่าย · simple ใช้รูปสินค้าตอนสร้างดีล (deal_images)
        if (deal.deal_type === 'simple') {
          const { data: productImages } = await db.from('deal_images').select('file_id').eq('deal_id', id).limit(1);
          if (!productImages?.length) {
            return NextResponse.json({ error: 'ยังไม่มีรูป/วิดีโอสินค้าในดีล (อัปตอนสร้างดีล)' }, { status: 400 });
          }
        } else {
          const evidenceList = (await db.from('deal_evidence').select('uploaded_by').eq('deal_id', id).then(r => r.data)) || [];
          const hasBuyerEvidence = evidenceList.some((e: { uploaded_by?: string }) => e.uploaded_by === deal.buyer_id);
          const hasSellerEvidence = evidenceList.some((e: { uploaded_by?: string }) => e.uploaded_by === deal.seller_id);
          if (!hasBuyerEvidence || !hasSellerEvidence) {
            return NextResponse.json({ error: 'ยังรอทั้งสองฝ่ายอัปหลักฐาน (แชท/รูป/วิดีโอ)' }, { status: 400 });
          }
        }
        updates = { status: 'packing', middleman_confirmed_payment: true };
        systemMsg = 'คนกลางยืนยันรับเงินแล้ว — ผู้ขายเริ่มแพ็คสินค้า';
        await releaseAuctionDepositOnPaid(db, deal).catch(() => {});
        break;
      }
      case 'add_evidence': {
        // flow ใหม่: ในขั้น payment_pending ทั้งผู้ซื้อและผู้ขายอัปโหลดหลักฐานได้ (แยกอิสระ)
        // ขั้นอื่น (packing/receive/check) ยังอัพได้ตาม role เดิม
        if (deal.status === 'payment_pending' && !isSeller && !isBuyer) {
          return NextResponse.json({ error: 'ในขั้นนี้เฉพาะผู้ซื้อ/ผู้ขายอัปโหลดหลักฐานได้' }, { status: 403 });
        }
        const { evidenceType, fileId, fileName, content } = body;
        // type default = 'other' ถ้าไม่ได้ส่งมา (flow ใหม่ simple ไม่ต้องเลือกประเภท)
        const finalType = evidenceType || 'other';
        // chat_text เก็บประวัติการสนทนาทั้งหมดเป็นหลักฐานชิ้นเดียว (ไม่ใช่ทีละข้อความ) จึงต้องยาวกว่าแคปทั่วไป 200 ตัวอักษร
        const contentCap = finalType === 'chat_text' ? 4000 : 200;
        replaceChatTranscript = finalType === 'chat_text';
        evidenceInsert = {
          deal_id: id,
          type: finalType,
          file_id: fileId || '',
          file_name: fileName || '',
          content: content ? String(content).slice(0, contentCap) : '',
          uploaded_by: me.id,
          uploader_name: myName,
        };
        const label: Record<string, string> = {
          packing: 'วิดีโอแพ็คของ', testing: 'วิดีโอทดสอบสินค้า',
          receive: 'วิดีโอรับสินค้า', check: 'วิดีโอตรวจสินค้า',
          chat: 'หลักฐานจากแชท', chat_text: 'ประวัติการสนทนา', call: 'วิดีโอคอลที่บันทึก',
          other: 'หลักฐาน',
        };
        systemMsg = `เก็บ${label[finalType] || finalType}เป็นหลักฐานแล้ว`;
        break;
      }
      case 'delete_evidence': {
        // ลบหลักฐาน — เฉพาะไอเทมที่ตัวเองอัปโหลด
        const evidenceId = String(body.evidenceId || '');
        if (!evidenceId) return NextResponse.json({ error: 'Missing evidenceId' }, { status: 400 });
        const { data: evidenceItem } = await db.from('deal_evidence').select('uploaded_by').eq('id', evidenceId).eq('deal_id', id).maybeSingle();
        if (!evidenceItem) return NextResponse.json({ error: 'ไม่พบหลักฐาน' }, { status: 404 });
        if (evidenceItem.uploaded_by !== me.id) return NextResponse.json({ error: 'ลบได้เฉพาะหลักฐานที่คุณอัปโหลดเอง' }, { status: 403 });
        await db.from('deal_evidence').delete().eq('id', evidenceId).eq('deal_id', id);
        systemMsg = 'ลบหลักฐานแล้ว';
        break;
      }
      case 'seller_done_packing': {
        if (!isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const trackingNumber = String(body.trackingNumber || '').trim();
        let trackingProvider = String(body.trackingProvider || '').trim();
        if (!trackingNumber) return NextResponse.json({ error: 'กรุณากรอกเลขพัสดุ' }, { status: 400 });
        // ตลาด/ประมูล — ผู้ซื้อเลือกขนส่งแล้วตอนสั่งซื้อ ผู้ขายใช้ตัวเดียวกัน
        if (isListingCheckoutOrder(deal)) {
          const buyerChosen = String(deal.buyer_shipping_provider || '').trim();
          if (buyerChosen) {
            if (trackingProvider && trackingProvider !== buyerChosen) {
              return NextResponse.json({ error: 'ต้องใช้ขนส่งที่ผู้ซื้อเลือกไว้แล้ว' }, { status: 400 });
            }
            trackingProvider = buyerChosen;
          }
        }
        if (!trackingProvider) return NextResponse.json({ error: 'กรุณาเลือกผู้ให้บริการขนส่ง' }, { status: 400 });
        const providerLabel = getLogisticsProviderLabel(trackingProvider);
        if (isDirectShipOrder(deal)) {
          updates = {
            status: 'shipped_to_buyer',
            tracking_to_buyer: trackingNumber,
            tracking_to_buyer_provider: trackingProvider,
          };
          systemMsg = `ผู้ขายจัดส่งสินค้าให้ผู้ซื้อโดยตรงแล้ว (${providerLabel}: ${trackingNumber}) — ผู้ซื้ออย่าลืมถ่ายวิดีโอก่อนแกะกล่อง`;
        } else {
          updates = {
            status: 'shipped_to_middleman',
            tracking_to_middleman: trackingNumber,
            tracking_to_middleman_provider: trackingProvider,
          };
          systemMsg = `ผู้ขายจัดส่งสินค้าแล้ว (${providerLabel}: ${trackingNumber})`;
        }
        break;
      }
      case 'middleman_received': {
        if (!isMiddleman) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        updates = { status: 'middleman_checking' };
        systemMsg = 'คนกลางรับสินค้าแล้ว — กำลังตรวจสอบ';
        break;
      }
      case 'buyer_confirm_check': {
        if (!isBuyer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        updates = { buyer_confirmed_check: true };
        systemMsg = 'ผู้ซื้อยืนยันว่าสินค้าไม่มีปัญหา';
        break;
      }
      case 'middleman_ship_to_buyer': {
        if (!isMiddleman) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (!deal.buyer_confirmed_check) return NextResponse.json({ error: 'รอผู้ซื้อยืนยันก่อน' }, { status: 400 });
        const trackingNumber = String(body.trackingNumber || '').trim();
        const trackingProvider = String(body.trackingProvider || '').trim();
        if (!trackingNumber) return NextResponse.json({ error: 'กรุณากรอกเลขพัสดุ' }, { status: 400 });
        if (!trackingProvider) return NextResponse.json({ error: 'กรุณาเลือกผู้ให้บริการขนส่ง' }, { status: 400 });
        const providerLabel = getLogisticsProviderLabel(trackingProvider);
        updates = {
          status: 'shipped_to_buyer',
          tracking_to_buyer: trackingNumber,
          tracking_to_buyer_provider: trackingProvider,
        };
        systemMsg = `คนกลางจัดส่งให้ผู้ซื้อแล้ว (${providerLabel}: ${trackingNumber})`;
        break;
      }
      case 'buyer_received': {
        if (!isBuyer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        updates = { status: 'completed' };
        systemMsg = 'ผู้ซื้อรับสินค้าแล้ว — ดีลเสร็จสมบูรณ์ 🎉';
        break;
      }
      case 'cancel': {
        if (!isSeller && !isMiddleman && !isBuyer)
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (isListingCheckoutOrder(deal) && !isMarketplaceSold(deal)) {
          if (deal.status === 'payment_uploaded') {
            return NextResponse.json({ error: 'อัปสลิปแล้ว รอตรวจ — ติดต่อทีมงานหากต้องการยกเลิก' }, { status: 400 });
          }
          if (['posted', 'payment_pending'].includes(deal.status)) {
            // ประมูลที่ปิดแล้ว — ยกเลิกคำสั่งซื้อ (ไม่เปิดประมูลใหม่)
            if (deal.deal_type === 'auction') {
              updates = { status: 'cancelled', reject_reason: body.reason || 'ผู้ซื้อยกเลิกหลังชนะประมูล' };
              systemMsg = `ยกเลิกคำสั่งซื้อประมูล${body.reason ? ': ' + body.reason : ''}`;
              await settleAuctionCancel(db, deal, Boolean(deal.buyer_id));
              break;
            }
            updates = {
              status: 'posted',
              buyer_id: null,
              buyer_name: null,
              buyer_shipping_provider: null,
              payment_slip_file_id: null,
              payment_slip_verified_at: null,
              buyer_accepted_terms: false,
              reject_reason: body.reason || '',
            };
            systemMsg = `ยกเลิกคำสั่งซื้อ${body.reason ? ': ' + body.reason : ''} — เปิดขายต่อบนตลาด`;
            break;
          }
        }
        updates = { status: 'cancelled', reject_reason: body.reason || '' };
        systemMsg = `ยกเลิกดีล${body.reason ? ': ' + body.reason : ''}`;
        if (deal.deal_type === 'auction') {
          await settleAuctionCancel(db, deal, Boolean(deal.buyer_id));
        }
        break;
      }
      case 'dispute': {
        updates = { status: 'disputed', reject_reason: body.reason || '' };
        systemMsg = `แจ้งปัญหา: ${body.reason || 'ไม่ระบุ'}`;
        break;
      }
      case 'start_call': {
        const isParty = isSeller || isMiddleman || isBuyer;
        const mode = body.mode === 'voice' ? 'voice' : 'video';
        // ฝัง caller id + mode ใน content ด้วย prefix 📞| เพื่อให้ client แยก "ฉันโทร" vs "คนอื่นโทรเข้า" ได้
        systemMsg = `📞|caller=${me.id}|mode=${mode}|${myName || 'ผู้ใช้'}${isParty ? '' : ' (ผู้สนใจจากลิงก์แชร์)'} เริ่ม${mode === 'voice' ? 'โทรเสียง' : 'วิดีโอคอล'} — กดเข้าร่วมได้เลย`;
        break;
      }
      case 'end_call': {
        systemMsg = `📞|end|${myName || 'ผู้ใช้'} วางสายแล้ว`;
        break;
      }
      case 'meetup_set_location': {
        if (deal.deal_type !== 'meetup') return NextResponse.json({ error: 'ดีลนี้ไม่ใช่รับประกันเดินทาง' }, { status: 400 });
        if (!isBuyer && !isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const loc = body.loc || {};
        const clean = {
          province: String(loc.province || '').slice(0, 60),
          amphoe: String(loc.amphoe || '').slice(0, 80),
          tambon: String(loc.tambon || '').slice(0, 80),
        };
        if (!clean.province || !clean.amphoe || !clean.tambon)
          return NextResponse.json({ error: 'กรุณาเลือกที่อยู่ให้ครบถึงระดับตำบล' }, { status: 400 });
        if (md.buyer_slip || md.seller_slip) return NextResponse.json({ error: 'วางเงินประกันแล้ว แก้ที่อยู่ไม่ได้' }, { status: 400 });
        if (isBuyer) meetupUpdates.buyer_loc = clean; else meetupUpdates.seller_loc = clean;
        systemMsg = `📍 ${isBuyer ? 'ผู้ซื้อ' : 'ผู้ขาย'}ระบุที่อยู่แล้ว: ต.${clean.tambon} อ.${clean.amphoe} จ.${clean.province}`;
        break;
      }
      case 'meetup_propose': {
        if (deal.deal_type !== 'meetup') return NextResponse.json({ error: 'ดีลนี้ไม่ใช่รับประกันเดินทาง' }, { status: 400 });
        if (!isBuyer && !isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const amount = Math.round(Number(body.amount));
        if (!(amount >= 50 && amount <= 999999999)) return NextResponse.json({ error: 'ยอดประกันไม่ถูกต้อง (ขั้นต่ำ ฿50)' }, { status: 400 });
        if (md.buyer_slip || md.seller_slip) return NextResponse.json({ error: 'มีการวางเงินประกันแล้ว เปลี่ยนยอดไม่ได้ — ติดต่อทีมงานหากจำเป็น' }, { status: 400 });
        meetupUpdates.pending_deposit = amount;
        meetupUpdates.pending_by = isBuyer ? 'buyer' : 'seller';
        if (body.meetLabel) meetupUpdates.pending_meet_label = String(body.meetLabel).slice(0, 200);
        // แนบการปรับราคา/ค่าบริการมากับข้อเสนอจุดนัด (popup รวมทุกอย่าง)
        let extra = '';
        if (body.price !== undefined && body.price !== null && String(body.price) !== '') {
          const p = Math.round(Number(body.price));
          if (p >= 1 && p <= 999999999) { meetupUpdates.pending_price = p; extra += ` · ราคาใหม่ ฿${p.toLocaleString()}`; }
        } else { meetupUpdates.pending_price = null; }
        if (['buyer', 'seller', 'split'].includes(body.feePayer)) {
          meetupUpdates.pending_fee_payer = body.feePayer;
          extra += ` · ค่าบริการ ${body.feePayer === 'buyer' ? 'ผู้ซื้อจ่าย' : body.feePayer === 'seller' ? 'ผู้ขายจ่าย' : 'หารครึ่ง'}`;
        } else { meetupUpdates.pending_fee_payer = null; }
        systemMsg = `💰 ${isBuyer ? 'ผู้ซื้อ' : 'ผู้ขาย'}เสนอ${body.meetLabel ? `จุดนัด "${String(body.meetLabel).slice(0, 200)}" + ` : 'เปลี่ยน'}เงินประกัน ฿${amount.toLocaleString()}/ฝ่าย${extra} — รออีกฝ่ายกดยอมรับ`;
        break;
      }
      case 'meetup_respond': {
        if (deal.deal_type !== 'meetup') return NextResponse.json({ error: 'ดีลนี้ไม่ใช่รับประกันเดินทาง' }, { status: 400 });
        if (!isBuyer && !isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (!md.pending_deposit) return NextResponse.json({ error: 'ไม่มีข้อเสนอที่รอการตอบรับ' }, { status: 400 });
        const meSide = isBuyer ? 'buyer' : 'seller';
        if (body.accept) {
          if (md.pending_by === meSide) return NextResponse.json({ error: 'ผู้เสนอกดยอมรับเองไม่ได้ — ต้องให้อีกฝ่ายยอมรับ' }, { status: 400 });
          meetupUpdates.deposit = md.pending_deposit;
          if (md.pending_meet_label) meetupUpdates.meet_label = md.pending_meet_label;
          // apply การปรับราคา/ค่าบริการที่แนบมากับข้อเสนอ + คำนวณค่าบริการรายฝ่ายใหม่
          let extra = '';
          if (md.pending_price) { updates.price = md.pending_price; extra += ` · ราคา ฿${Number(md.pending_price).toLocaleString()}`; }
          if (md.pending_fee_payer) { updates.fee_payer = md.pending_fee_payer; extra += ` · ค่าบริการ ${md.pending_fee_payer === 'buyer' ? 'ผู้ซื้อจ่าย' : md.pending_fee_payer === 'seller' ? 'ผู้ขายจ่าย' : 'หารครึ่ง'}`; }
          if (md.pending_price || md.pending_fee_payer) {
            const newPrice = Number(md.pending_price || deal.price) || 0;
            const newFeePayer = (md.pending_fee_payer || deal.fee_payer || 'split') as 'buyer' | 'seller' | 'split';
            const cfg = await readFeesConfig(db);
            const totalFee = computeDealFees(cfg, newPrice, 'meetup').total;
            meetupUpdates.buyer_fee = newFeePayer === 'buyer' ? totalFee : newFeePayer === 'split' ? Math.ceil(totalFee / 2) : 0;
            meetupUpdates.seller_fee = newFeePayer === 'seller' ? totalFee : newFeePayer === 'split' ? Math.floor(totalFee / 2) : 0;
          }
          systemMsg = `✅ ตกลงกันแล้ว${md.pending_meet_label ? `: ${md.pending_meet_label}` : ''} — เงินประกัน ฿${Number(md.pending_deposit).toLocaleString()}/ฝ่าย${extra} วางเงินได้เลย`;
        } else {
          systemMsg = md.pending_by === meSide
            ? `↩️ ${meSide === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย'}ยกเลิกข้อเสนอ`
            : `❌ ${meSide === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย'}ปฏิเสธข้อเสนอ ฿${Number(md.pending_deposit).toLocaleString()} — เสนอใหม่หรือคุยกันในแชทได้`;
        }
        meetupUpdates.pending_deposit = null;
        meetupUpdates.pending_by = null;
        meetupUpdates.pending_meet_label = null;
        meetupUpdates.pending_price = null;
        meetupUpdates.pending_fee_payer = null;
        break;
      }
      case 'meetup_deposit': {
        if (deal.deal_type !== 'meetup') return NextResponse.json({ error: 'ดีลนี้ไม่ใช่รับประกันเดินทาง' }, { status: 400 });
        if (!isBuyer && !isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (!body.fileId) return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
        if (!md.deposit) return NextResponse.json({ error: 'ต้องตกลงจุดนัดพบและยอดประกันกับอีกฝ่ายก่อนวางเงิน' }, { status: 400 });
        // อัปสลิป + รีเซ็ตผลตรวจของฝ่ายตัวเอง (กรณีอัปใหม่หลังถูกตีกลับ)
        if (isBuyer) { meetupUpdates.buyer_slip = body.fileId; meetupUpdates.buyer_slip_verified_at = null; }
        else { meetupUpdates.seller_slip = body.fileId; meetupUpdates.seller_slip_verified_at = null; }
        const bothSlipped = isBuyer ? (!!md.seller_slip) : (!!md.buyer_slip);
        if (bothSlipped) {
          // ข้อ4/5: วางครบ 2 ฝ่าย → ส่งให้ศูนย์กลางตรวจสลิป (ไม่ข้ามไปนัดเจอทันที)
          updates.status = 'payment_uploaded';
          systemMsg = '✅ ทั้งสองฝ่ายวางเงินประกันแล้ว — รอศูนย์กลางตรวจสลิป เมื่อตรวจครบจะเริ่มขั้นตอนนัดพบทันที';
        } else {
          systemMsg = `${isBuyer ? 'ผู้ซื้อ' : 'ผู้ขาย'}วางเงินประกันเดินทางแล้ว — รออีกฝ่าย`;
        }
        break;
      }
      case 'meetup_depart': {
        if (deal.deal_type !== 'meetup') return NextResponse.json({ error: 'ดีลนี้ไม่ใช่รับประกันเดินทาง' }, { status: 400 });
        if (!isBuyer && !isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (deal.status !== 'meetup_ready') return NextResponse.json({ error: 'ต้องวางเงินประกันครบทั้งสองฝ่ายก่อน' }, { status: 400 });
        if (isBuyer) meetupUpdates.buyer_departed_at = new Date().toISOString();
        else meetupUpdates.seller_departed_at = new Date().toISOString();
        systemMsg = `🚗 ${isBuyer ? 'ผู้ซื้อ' : 'ผู้ขาย'}เริ่มออกเดินทางแล้ว — มุ่งหน้าสู่จุดนัดพบ`;
        break;
      }
      case 'meetup_position': {
        if (deal.deal_type !== 'meetup') return NextResponse.json({ error: 'ดีลนี้ไม่ใช่รับประกันเดินทาง' }, { status: 400 });
        if (!isBuyer && !isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const lat = Number(body.lat), lng = Number(body.lng);
        if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
          return NextResponse.json({ error: 'พิกัดไม่ถูกต้อง' }, { status: 400 });
        const pos = { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5, at: new Date().toISOString() };
        if (isBuyer) meetupUpdates.buyer_pos = pos; else meetupUpdates.seller_pos = pos;
        // ไม่ตั้ง systemMsg — อัปเดตเงียบ
        break;
      }
      case 'meetup_met': {
        if (deal.deal_type !== 'meetup') return NextResponse.json({ error: 'ดีลนี้ไม่ใช่รับประกันเดินทาง' }, { status: 400 });
        if (!isBuyer && !isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (deal.status !== 'meetup_ready') return NextResponse.json({ error: 'ต้องวางเงินประกันครบทั้งสองฝ่ายก่อน' }, { status: 400 });
        if (isBuyer) meetupUpdates.buyer_met = true; else meetupUpdates.seller_met = true;
        const bothMet = isBuyer ? (!!md.seller_met) : (!!md.buyer_met);
        if (bothMet) {
          updates.status = 'completed';
          systemMsg = '🎉 นัดเจอสำเร็จทั้งสองฝ่าย! บริษัท กลางฮับ จำกัด จะโอนเงินประกันคืนให้ทั้งคู่เต็มจำนวน (หักเฉพาะค่าบริการ)';
        } else {
          systemMsg = `${isBuyer ? 'ผู้ซื้อ' : 'ผู้ขาย'}ยืนยันว่านัดเจอสำเร็จ — รออีกฝ่ายยืนยัน`;
        }
        break;
      }
      case 'meetup_ack_departure': {
        // ข้อ5: รับทราบว่าอีกฝ่ายออกเดินทางแล้ว (mutual acknowledge)
        if (deal.deal_type !== 'meetup') return NextResponse.json({ error: 'ดีลนี้ไม่ใช่รับประกันเดินทาง' }, { status: 400 });
        if (!isBuyer && !isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (isBuyer) {
          if (!md.seller_departed_at) return NextResponse.json({ error: 'อีกฝ่ายยังไม่ได้ออกเดินทาง' }, { status: 400 });
          meetupUpdates.seller_departed_ack_at = new Date().toISOString();
        } else {
          if (!md.buyer_departed_at) return NextResponse.json({ error: 'อีกฝ่ายยังไม่ได้ออกเดินทาง' }, { status: 400 });
          meetupUpdates.buyer_departed_ack_at = new Date().toISOString();
        }
        systemMsg = `🤝 ${isBuyer ? 'ผู้ซื้อ' : 'ผู้ขาย'}รับทราบว่าอีกฝ่ายออกเดินทางแล้ว`;
        break;
      }
      case 'progress_ping': {
        // ข้อ4: แจ้งเตือนอีกฝ่ายเมื่อเรากดไปขั้นต่อไป + บันทึก chat_done_* ลง priceState
        // (เดิมใช้ system message แต่ message persist ค้างทำให้ step ขึ้นเองโดยไม่ได้กด)
        if (!isSeller && !isBuyer && !isMiddleman) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const whoLabel = isSeller ? 'ผู้ขาย' : isBuyer ? 'ผู้ซื้อ' : 'คนกลาง';
        if (body.stage === 'to_evidence') {
          // บันทึก flag ใน priceState — ใช้แทน hasProgressPing เพื่อกัน stale system message
          priceUpdates = isSeller
            ? { chat_done_seller: true }
            : isBuyer
            ? { chat_done_buyer: true }
            : { chat_done_middleman: true };
          systemMsg = deal.middleman_id
            ? `📋 ${whoLabel}คุย 3 ฝ่ายเสร็จแล้ว — กำลังไปขั้นตรวจหลักฐาน`
            : `📋 ${whoLabel}คุยรายละเอียดเสร็จแล้ว — กำลังไปขั้นตรวจหลักฐาน`;
        }
        else return NextResponse.json({ error: 'Unknown stage' }, { status: 400 });
        break;
      }
      case 'visit': {
        const roleLabel = isSeller ? 'ผู้ขาย' : isBuyer ? 'ผู้ซื้อ' : isMiddleman ? 'คนกลาง' : 'ผู้สนใจจากลิงก์แชร์';
        systemMsg = `👀 ${myName || 'ผู้ใช้'} (${roleLabel}) เข้ามาดูห้องดีล`;
        writeChatMsg = false;
        break;
      }
      case 'price_propose': {
        if (!isSeller && !isBuyer) return NextResponse.json({ error: 'เฉพาะผู้ซื้อหรือผู้ขายที่เสนอราคาใหม่ได้' }, { status: 403 });
        if (!['posted', 'waiting_seller', 'waiting_buyer', 'buyer_joined', 'terms_pending', 'payment_pending'].includes(deal.status))
          return NextResponse.json({ error: 'ดีลเลยขั้นตอนตกลงราคาแล้ว' }, { status: 400 });
        const price = Math.round(Number(body.price));
        if (!(price >= 1 && price <= 999999999)) return NextResponse.json({ error: 'ราคาไม่ถูกต้อง' }, { status: 400 });
        const feePayer = ['buyer', 'seller', 'split'].includes(body.feePayer)
          ? body.feePayer
          : (pd.proposed_fee_payer || deal.fee_payer || 'split');
        const who = isSeller ? 'seller' : isBuyer ? 'buyer' : 'middleman';
        priceUpdates = {
          proposed_price: price, proposed_fee_payer: feePayer, proposed_by: who, proposal_kind: 'reprice', agreed: false,
          seller_agreed: isSeller, buyer_agreed: isBuyer, middleman_agreed: isMiddleman,
        };
        const fpLabel = feePayer === 'buyer' ? 'ผู้ซื้อจ่าย' : feePayer === 'seller' ? 'ผู้ขายจ่าย' : 'หารครึ่ง';
        systemMsg = `💬 ${who === 'seller' ? 'ผู้ขาย' : who === 'buyer' ? 'ผู้ซื้อ' : 'คนกลาง'}เสนอราคา ฿${price.toLocaleString()} · ค่าบริการ: ${fpLabel} — รอทุกฝ่ายกดตกลง`;
        break;
      }
      case 'price_agree': {
        if (!isSeller && !isBuyer && !isMiddleman) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const who = isSeller ? 'seller' : isBuyer ? 'buyer' : 'middleman';
        const requestedFeePayer = ['buyer', 'seller', 'split'].includes(body.feePayer) ? body.feePayer : undefined;
        let proposedPrice = pd.proposed_price;
        let proposedFeePayer = pd.proposed_fee_payer;
        let proposalKind = pd.proposal_kind;
        let proposedBy = pd.proposed_by;
        let sellerAgreed = !!pd.seller_agreed, buyerAgreed = !!pd.buyer_agreed, middlemanAgreed = !!pd.middleman_agreed;

        if (!proposedPrice) {
          proposedFeePayer = requestedFeePayer || (deal.fee_payer || 'split');
          proposedPrice = Number(deal.price) || 0;
          proposalKind = 'current';
          proposedBy = who;
        } else if (requestedFeePayer && requestedFeePayer !== proposedFeePayer) {
          proposedFeePayer = requestedFeePayer;
          proposedBy = who;
          sellerAgreed = isSeller; buyerAgreed = isBuyer; middlemanAgreed = isMiddleman;
          priceUpdates = {
            proposed_price: proposedPrice, proposed_fee_payer: proposedFeePayer, proposed_by: proposedBy, proposal_kind: proposalKind,
            agreed: false, seller_agreed: sellerAgreed, buyer_agreed: buyerAgreed, middleman_agreed: middlemanAgreed,
          };
          const fpLabel = requestedFeePayer === 'buyer' ? 'ผู้ซื้อจ่าย' : requestedFeePayer === 'seller' ? 'ผู้ขายจ่าย' : 'หารครึ่ง';
          systemMsg = `🔁 ${who === 'seller' ? 'ผู้ขาย' : who === 'buyer' ? 'ผู้ซื้อ' : 'คนกลาง'}เปลี่ยนผู้จ่ายค่าบริการเป็น ${fpLabel} — ต้องรอทุกฝ่ายยอมรับใหม่`;
          break;
        }
        if (isSeller) sellerAgreed = true;
        if (isBuyer) buyerAgreed = true;
        if (isMiddleman) middlemanAgreed = true;
        const hasMm = !!deal.middleman_id;
        const allAgreed = sellerAgreed && buyerAgreed && (!hasMm || middlemanAgreed);
        priceUpdates = {
          proposed_price: proposedPrice, proposed_fee_payer: proposedFeePayer, proposed_by: proposedBy, proposal_kind: proposalKind,
          seller_agreed: sellerAgreed, buyer_agreed: buyerAgreed, middleman_agreed: middlemanAgreed, agreed: allAgreed,
        };
        if (allAgreed) {
          updates.price = proposedPrice;
          updates.fee_payer = proposedFeePayer;
          let mmDepositHeld = 0;
          if (hasMm) {
            mmDepositHeld = await getMmDeposit(db, String(deal.middleman_id));
            priceUpdates.mm_deposit_held = mmDepositHeld;
          }
          const fpLabel = proposedFeePayer === 'buyer' ? 'ผู้ซื้อจ่าย' : proposedFeePayer === 'seller' ? 'ผู้ขายจ่าย' : 'หารครึ่ง';
          systemMsg = proposalKind === 'reprice'
            ? `✅ ทุกฝ่ายตกลงราคา ฿${Number(proposedPrice).toLocaleString()} · ค่าบริการ: ${fpLabel} แล้ว${hasMm ? ` (คนกลางวางเครดิตประกัน ฿${Number(mmDepositHeld).toLocaleString()})` : ''} — พร้อมเข้าสู่ขั้นโอนเงิน`
            : `✅ ทุกฝ่ายยืนยันใช้ราคาเดิม ฿${Number(proposedPrice).toLocaleString()} · ค่าบริการ: ${fpLabel} แล้ว${hasMm ? ` (คนกลางวางเครดิตประกัน ฿${Number(mmDepositHeld).toLocaleString()})` : ''} — พร้อมเข้าสู่ขั้นโอนเงิน`;
        } else {
          const whoLabel = isSeller ? 'ผู้ขาย' : isBuyer ? 'ผู้ซื้อ' : 'คนกลาง';
          systemMsg = proposalKind === 'reprice'
            ? `${whoLabel}${isMiddleman ? ' อนุมัติดีล + วางเครดิตประกัน' : ' ตกลงราคานี้'}แล้ว — รอฝ่ายอื่น`
            : `${whoLabel}${isMiddleman ? ' รับรู้ราคาเดิม + อนุมัติดีล' : ' ยืนยันใช้ราคาเดิม'}แล้ว — รอฝ่ายอื่น`;
        }
        break;
      }
      case 'evidence_done': {
        if (!isSeller && !isBuyer && !isMiddleman) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const sellerDone = isSeller ? true : !!pd.evidence_done_seller;
        const buyerDone = isBuyer ? true : !!pd.evidence_done_buyer;
        const middlemanDone = isMiddleman ? true : !!pd.evidence_done_middleman;
        priceUpdates = { evidence_done_seller: sellerDone, evidence_done_buyer: buyerDone, evidence_done_middleman: middlemanDone };
        const hasMm = !!deal.middleman_id;
        const allDone = sellerDone && buyerDone && (!hasMm || middlemanDone);
        systemMsg = allDone ? '📁 ทุกฝ่ายยืนยันเก็บหลักฐานเรียบร้อย — ไปขั้นโอนเงินได้เลย' : `${isSeller ? 'ผู้ขาย' : isBuyer ? 'ผู้ซื้อ' : 'คนกลาง'}ยืนยันเก็บหลักฐานแล้ว — รอฝ่ายอื่น`;
        break;
      }
      case 'request_evidence': {
        // ผู้ซื้อ/คนกลาง ขอหลักฐานเพิ่มจากผู้ขาย → reset evidence_done_* เป็น false (ต้องยืนยันใหม่หลังได้รับหลักฐานเพิ่ม)
        // ผู้ขายห้ามขอเอง (ผู้ขายเป็นฝ่ายอัปโหลด)
        if (!isBuyer && !isMiddleman) return NextResponse.json({ error: 'เฉพาะผู้ซื้อ/คนกลางขอหลักฐานเพิ่มได้' }, { status: 403 });
        const detail = String(body.detail || '').trim().slice(0, 300);
        priceUpdates = { evidence_done_seller: false, evidence_done_buyer: false, evidence_done_middleman: false };
        systemMsg = `🔍 ${isBuyer ? 'ผู้ซื้อ' : 'คนกลาง'} ขอหลักฐานเพิ่ม${detail ? `: ${detail}` : ' — โปรดอัปโหลดเพิ่ม'}`;
        break;
      }
      case 'request_chat_back': {
        // ขอกลับไปหน้าแชท — ต้องให้ทั้งผู้ซื้อและผู้ขาย (และคนกลางถ้ามี) ยินยอมก่อน
        if (!isSeller && !isBuyer && !isMiddleman) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const hasMm2 = !!deal.middleman_id;
        const reqSeller = isSeller ? true : !!pd.chat_back_req_seller;
        const reqBuyer  = isBuyer  ? true : !!pd.chat_back_req_buyer;
        const reqMm     = isMiddleman ? true : !!pd.chat_back_req_middleman;
        const allReq = reqSeller && reqBuyer && (!hasMm2 || reqMm);
        if (allReq) {
          // ทุกฝ่ายยินยอม → ล้าง evidence_done และ chat_back_req ทั้งหมด
          priceUpdates = {
            evidence_done_seller: false, evidence_done_buyer: false, evidence_done_middleman: false,
            chat_back_req_seller: false, chat_back_req_buyer: false, chat_back_req_middleman: false,
          };
          systemMsg = '↩️ ทุกฝ่ายยินยอม — กลับสู่ขั้นตอนคุยกันและเก็บหลักฐานอีกครั้ง';
        } else {
          priceUpdates = {
            chat_back_req_seller: reqSeller,
            chat_back_req_buyer: reqBuyer,
            chat_back_req_middleman: reqMm,
          };
          systemMsg = `${isSeller ? 'ผู้ขาย' : isBuyer ? 'ผู้ซื้อ' : 'คนกลาง'}ขอกลับไปแชทใหม่ — รอฝ่ายอื่นยืนยัน`;
        }
        break;
      }
      case 'seller_fee_paid': {
        if (!isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (!body.fileId) return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
        priceUpdates = { seller_fee_slip: String(body.fileId), seller_fee_slip_verified_at: null };
        systemMsg = 'ผู้ขายโอนค่าบริการส่วนของตนแล้ว — รอศูนย์กลางตรวจสอบ';
        break;
      }
      case 'request_payout': {
        if (!isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (deal.deal_type !== 'simple') return NextResponse.json({ error: 'ขอรับเงินแบบนี้ใช้กับดีลผ่านกลางแบบง่ายเท่านั้น' }, { status: 400 });
        if (deal.status !== 'completed') return NextResponse.json({ error: 'ขอรับเงินได้เมื่อผู้ซื้อยืนยันรับสินค้าแล้ว' }, { status: 400 });
        if (pd.payout_requested_at) {
          writeChatMsg = false;
          break;
        }
        const { count: reviewCount } = await db.from('reviews').select('id', { count: 'exact', head: true })
          .eq('deal_id', id).eq('reviewer_id', me.id);
        if ((reviewCount || 0) === 0) {
          return NextResponse.json({ error: 'กรุณารีวิวดิลก่อนขอรับเงินค่าสินค้า' }, { status: 400 });
        }
        priceUpdates = { payout_requested_at: new Date().toISOString() };
        systemMsg = 'ผู้ขายรีวิวแล้วและขอรับเงินค่าสินค้า — รอศูนย์กลางโอนเงิน';
        break;
      }
      case 'update_listing': {
        if (!isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (deal.source !== 'listing' || deal.status !== 'posted' || deal.buyer_id) {
          return NextResponse.json({ error: 'แก้ไขได้เฉพาะประกาศที่ยังไม่มีผู้ซื้อ' }, { status: 400 });
        }
        const nextTitle = String(body.title || deal.title || '').trim();
        if (!nextTitle) return NextResponse.json({ error: 'กรุณากรอกชื่อสินค้า' }, { status: 400 });
        const nextCondition = String(body.condition || deal.condition || '').trim();
        if (!nextCondition) return NextResponse.json({ error: 'กรุณาเลือกสภาพสินค้า' }, { status: 400 });
        const nextShippingProviders = sanitizeShippingProviders(body.shippingProviders ?? deal.shipping_providers);
        if (nextShippingProviders.length === 0) {
          return NextResponse.json({ error: 'กรุณาเลือกขนส่งอย่างน้อย 1 รายการ' }, { status: 400 });
        }
        const nextShippingCost = Math.max(0, Math.round(Number(body.shippingCost ?? deal.shipping_cost) || 0));
        const isAuctionListing = deal.deal_type === 'auction';
        let nextPrice = Number(deal.price) || 0;
        let nextGross: number | null = deal.list_gross_price ?? null;
        if (body.price != null) {
          const gross = Math.max(0, Math.round(Number(body.price)));
          if (isAuctionListing) {
            nextPrice = gross;
            nextGross = null;
          } else {
            const fees = await readFeesConfig(db);
            const gp = computeMarketplaceGp(fees, gross);
            nextPrice = gp.displayPrice;
            nextGross = gp.sellerPrice;
          }
        }
        updates = {
          title: nextTitle,
          description: body.description != null ? String(body.description) : deal.description,
          category: body.category != null ? String(body.category) : deal.category,
          condition: nextCondition,
          location: body.location != null ? String(body.location) : deal.location,
          price: nextPrice,
          list_gross_price: nextGross,
          shipping_cost: nextShippingCost,
          shipping_providers: nextShippingProviders,
        };
        if (Array.isArray(body.imageFileIds)) {
          await db.from('deal_images').delete().eq('deal_id', id);
          const fileIds = body.imageFileIds.filter((f: unknown): f is string => typeof f === 'string' && f.length > 0);
          if (fileIds.length) {
            await db.from('deal_images').insert(fileIds.map((fileId: string, position: number) => ({ deal_id: id, file_id: fileId, position })));
          }
        }
        if (isAuctionListing && body.auctionData && typeof body.auctionData === 'object') {
          const ad = body.auctionData as Record<string, unknown>;
          const auctionPatch: Record<string, unknown> = {};
          if (ad.bidIncrement != null) auctionPatch.bid_increment = Math.max(1, Math.round(Number(ad.bidIncrement) || 10));
          if (ad.bidDeposit != null) {
            const { data: liveAuction } = await db.from('deal_auction').select('bid_count').eq('deal_id', id).maybeSingle();
            if (Number(liveAuction?.bid_count || 0) > 0) {
              return NextResponse.json({ error: 'มีคนบิดแล้ว เปลี่ยนมัดจำสิทธิประมูลไม่ได้' }, { status: 400 });
            }
            const dep = Math.round(Number(ad.bidDeposit) || 0);
            if (dep < 1) return NextResponse.json({ error: 'มัดจำสิทธิประมูลต้องอย่างน้อย ฿1' }, { status: 400 });
            auctionPatch.bid_deposit = dep;
          }
          const hasDuration = ad.durationMinutes != null
            || ad.durationDays != null
            || ad.durationHoursPart != null
            || ad.durationMinutesPart != null
            || ad.durationHours != null;
          if (hasDuration) {
            auctionPatch.ends_at = computeAuctionEndsAt(ad as AuctionDurationInput);
            auctionPatch.duration_minutes = resolveAuctionDurationMinutes(ad as AuctionDurationInput);
          }
          if (ad.buyNowPrice !== undefined) {
            const { data: liveAuction } = await db.from('deal_auction').select('bid_count, display_start_price').eq('deal_id', id).maybeSingle();
            if (Number(liveAuction?.bid_count || 0) > 0) {
              return NextResponse.json({ error: 'มีคนบิดแล้ว เปลี่ยนราคาซื้อทันทีไม่ได้' }, { status: 400 });
            }
            const startPrice = nextPrice ?? Number(liveAuction?.display_start_price) ?? 0;
            if (ad.buyNowPrice === null || ad.buyNowPrice === '') {
              auctionPatch.buy_now_price = null;
            } else {
              const bin = Math.round(Number(ad.buyNowPrice));
              if (!Number.isFinite(bin) || bin <= startPrice) {
                return NextResponse.json({ error: 'ราคาซื้อทันทีต้องสูงกว่าราคาเริ่มต้น' }, { status: 400 });
              }
              auctionPatch.buy_now_price = bin;
            }
          }
          if (body.price != null) auctionPatch.display_start_price = nextPrice;
          if (Object.keys(auctionPatch).length) {
            await db.from('deal_auction').update(auctionPatch).eq('deal_id', id);
          }
        }
        writeChatMsg = false;
        systemMsg = '';
        break;
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    let updated = deal;
    if (Object.keys(updates).length > 0) {
      const { data } = await db.from('deals').update(updates).eq('id', id).select().single();
      if (data) updated = data;
    }
    if (Object.keys(priceUpdates).length > 0) {
      await db.from('deal_price_state').upsert({ deal_id: id, ...priceUpdates }, { onConflict: 'deal_id' });
    }
    if (Object.keys(meetupUpdates).length > 0) {
      await db.from('deal_meetup').upsert({ deal_id: id, ...meetupUpdates }, { onConflict: 'deal_id' });
    }
    if (evidenceInsert) {
      if (replaceChatTranscript) {
        const { data: existingChatEvidence } = await db
          .from('deal_evidence')
          .select('id')
          .eq('deal_id', id)
          .eq('type', 'chat_text')
          .order('created_at', { ascending: true });

        const keepId = existingChatEvidence?.[0]?.id;
        if (keepId) {
          await db.from('deal_evidence').update(evidenceInsert).eq('id', keepId);
          const duplicateIds = (existingChatEvidence || []).slice(1).map(row => row.id).filter(Boolean);
          if (duplicateIds.length) {
            await db.from('deal_evidence').delete().in('id', duplicateIds);
          }
        } else {
          await db.from('deal_evidence').insert(evidenceInsert);
        }
      } else {
        await db.from('deal_evidence').insert(evidenceInsert);
      }
    }

    // กัน race / ดีลเก่า: simple ครบสองฝ่าย → payment_pending · regular/meetup ต้องยอมรับเงื่อนไขครบ
    if (
      !isListingCheckoutOrder(updated)
      && ['buyer_joined', 'terms_pending'].includes(String(updated.status))
      && (
        (updated.deal_type === 'simple' && updated.seller_id && updated.buyer_id)
        || (updated.seller_accepted_terms && updated.buyer_accepted_terms
          && (!updated.middleman_id || updated.middleman_accepted_terms))
      )
    ) {
      // อ่าน fee_payer_selection อีกครั้งเพื่อเซ็ต fee_payer บน deal (default 'buyer' ถ้า null)
      const finalPd = (await db.from('deal_price_state').select('*').eq('deal_id', id).maybeSingle().then(r => r.data)) || {};
      const finalBuyerSel = finalPd.fee_payer_selection_buyer || 'buyer';
      const finalSellerSel = finalPd.fee_payer_selection_seller || 'buyer';
      const agreedFeePayer = finalBuyerSel === finalSellerSel ? finalBuyerSel : 'buyer';
      const { data: fixed } = await db.from('deals').update({ status: 'payment_pending', fee_payer: agreedFeePayer }).eq('id', id).select().single();
      if (fixed) {
        updated = fixed;
        if (!systemMsg || /ยอมรับเงื่อนไขแล้ว$/.test(systemMsg)) systemMsg = 'ทุกฝ่ายยอมรับเงื่อนไขแล้ว — เริ่มคุย 3 ฝ่ายและเก็บหลักฐานได้';
      }
    }

    if (systemMsg) {
      if (writeChatMsg) {
        await db.from('messages').insert({
          deal_id: id, sender_id: null, sender_name: 'ระบบ',
          role: 'system', type: 'system', content: systemMsg, file_id: '', file_name: '',
        });
      }

      // แจ้งเตือนทุกฝ่ายในดีล ยกเว้นคนที่กดเอง
      const recipients = [updated.seller_id, updated.buyer_id, updated.middleman_id]
        .filter((x): x is string => typeof x === 'string' && !!x && x !== me.id)
        .filter(x => !(action === 'select_middleman' && x === updated.middleman_id));
      if (recipients.length) {
        if (action === 'start_call') {
          // สายเรียกเข้า → high-priority push + VoIP (iOS) + full-screen intent (Android)
          // ฝั่ง native ใช้ data payload (type/dealId/mode/callerName) สร้างหน้าจอรับสายเต็มจอ
          const callMode = body.mode === 'voice' ? 'voice' : 'video';
          const callLabel = callMode === 'voice' ? 'โทรเสียง' : 'วิดีโอคอล';
          await notifyUsers(db, recipients, {
            title: `📞 สายเรียกเข้า: ${updated.title || 'ดีล'}`,
            body: `${myName || 'ผู้ใช้'} กำลัง${callLabel}หาคุณ — กดเพื่อรับสาย`,
            link: `/deal/${id}?call=1`,
            kind: 'call',
            data: { type: 'incoming_call', dealId: id, mode: callMode, callerName: myName || 'ผู้ใช้' },
          });
        } else {
          const title =
            action === 'visit' ? `👀 มีคนเข้ามาดูห้องดีล: ${updated.title || ''}` :
            `ดีล: ${updated.title || 'ไม่มีชื่อ'}`;
          // เพิ่มข้อมูล data เพื่อบอกฝั่ง native ว่ามีข้อเสนอใหม่
          const dataPayload: Record<string, string> = { dealId: id };
          if (action === 'price_propose') {
            dataPayload.type = 'price_proposal';
            dataPayload.proposedBy = updated.proposed_by || '';
            dataPayload.proposedPrice = String(updated.proposed_price || '');
            dataPayload.proposedFeePayer = updated.proposed_fee_payer || '';
          } else if (action === 'price_agree') {
            dataPayload.type = 'price_agreement';
          }
          // ผู้ซื้อตลาด/ประมูล → checkout · ผู้ขาย → บอร์ดผู้ขาย
          if (isListingCheckoutOrder(updated)) {
            await Promise.all(recipients.map(uid => notifyUsers(db, [uid], {
              title,
              body: systemMsg,
              link: uid === updated.buyer_id ? `/cart/checkout/${id}` : '/dashboard/seller',
              data: dataPayload,
            })));
          } else {
            await notifyUsers(db, recipients, {
              title,
              body: systemMsg,
              link: `/deal/${id}`,
              data: dataPayload,
            });
          }
        }
      }

      // แจ้งคนกลางแบบเจาะจงเมื่อถูกเลือก
      if (action === 'select_middleman' && updated.middleman_id && updated.middleman_id !== me.id) {
        await notifyUsers(db, [updated.middleman_id as string], {
          title: '🤝 คุณถูกเลือกเป็นคนกลาง!',
          body: `ดีล "${updated.title || 'ไม่มีชื่อ'}" มูลค่า ฿${Number(updated.price || 0).toLocaleString()} — เข้าไปยอมรับเงื่อนไขเพื่อเริ่มงานได้เลย`,
          link: `/deal/${id}`,
        });
      }

      // แจ้งเตือนแอดมินเมื่อมีข้อพิพาท (ดีล & ข้อพิพาท — ไม่ใช่หน้าการเงิน)
      if (action === 'dispute') {
        const admins = await getAdminIds(db);
        if (admins.length) {
          const category = getDealCategory(updated);
          await notifyUsers(db, admins, {
            title: `⚠️ มีข้อพิพาท: ${updated.title || 'ดีล'}`,
            body: `${systemMsg} — เข้าไปจัดการที่ดีล & ข้อพิพาท`,
            link: adminDealsPagePath(category, 'disputed'),
          });
        }
      }
    }

    const postActionSnapshot = await loadAdminDealSnapshot(db, updated);

    if (action === 'upload_payment' || action === 'upload_middleman_fee' || action === 'seller_fee_paid') {
      try {
        const trigger = action === 'upload_payment' ? 'buyer' : 'seller';
        const autoResult = await runAutoSlipVerification(db, id, trigger);
        updated = autoResult.deal as typeof updated;
      } catch (err) {
        console.error('[slipAutoVerify]', err);
      }
    }
    if (action === 'meetup_deposit') {
      try {
        const trigger = isBuyer ? 'buyer' : 'seller';
        const autoResult = await runAutoMeetupSlipVerification(db, id, trigger);
        updated = autoResult.deal as typeof updated;
      } catch (err) {
        console.error('[slipAutoVerify meetup]', err);
      }
    }

    await syncDealLedger(db, updated as Record<string, unknown>).catch(() => {});
    // แจ้ง LINE + กระดิ่ง 2 ช่วง: หลัง action หลัก (confirm_pay) แล้วหลังตรวจสลิป (pay_seller ฯลฯ)
    await maybeNotifyAdminLineQueues(db, beforeSnapshot, postActionSnapshot.deal);
    await maybeNotifyAdminInAppQueues(db, beforeSnapshot, postActionSnapshot.deal, { onlySteps: ['confirm_pay', 'pay_seller'] });
    await maybeNotifyAdminLineQueues(db, postActionSnapshot, updated);
    await maybeNotifyAdminInAppQueues(db, postActionSnapshot, updated, { onlySteps: ['confirm_pay', 'pay_seller'] });
    // คืน evidence list ล่าสุดด้วย — กัน frontend re-fetch ทับ optimistic update จนภาพหาย
    let latestEvidence: unknown[] | undefined;
    if (evidenceInsert || action === 'delete_evidence') {
      const { data: evRows } = await db.from('deal_evidence').select('*').eq('deal_id', id).order('created_at', { ascending: true });
      latestEvidence = evRows || [];
    }
    return NextResponse.json({ deal: updated, evidence: latestEvidence });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
