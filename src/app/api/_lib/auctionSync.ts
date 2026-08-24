import type { SupabaseClient } from '@supabase/supabase-js';
import { autoBidStepAmount, rowToAuctionPublic, resolveAuctionDurationMinutes, type AuctionAutoBidRow, type AuctionRow } from '@/lib/auction';
import { computeAuctionGp } from '@/lib/fees';
import { readFeesConfig } from './financeLedger';
import { notifyUsers } from './notify';
import { notifyUserLineOverbid, notifySellerLineNewBid } from '@/lib/lineUserNotify';
import { holdAuctionDeposit, releaseLosingAuctionDeposits } from './userWallet';

/** แนบข้อมูลประมูลให้รายการ deals */
export async function attachAuctions<T extends { id: string; deal_type?: string }>(
  db: SupabaseClient,
  deals: T[],
): Promise<(T & { auction?: ReturnType<typeof rowToAuctionPublic> })[]> {
  const ids = deals.filter(d => d.deal_type === 'auction').map(d => d.id);
  if (!ids.length) return deals.map(d => ({ ...d }));
  const { data } = await db.from('deal_auction').select('*').in('deal_id', ids);
  const map = new Map((data || []).map(r => [r.deal_id as string, rowToAuctionPublic(r as AuctionRow)]));
  return deals.map(d => ({ ...d, auction: map.get(d.id) }));
}

/** ปิดประมูลที่หมดเวลา (เรียกก่อนแสดงรายการ/รายละเอียด) */
export async function syncExpiredAuctions(db: SupabaseClient, limit = 30) {
  const now = new Date().toISOString();
  const { data } = await db.from('deal_auction')
    .select('deal_id')
    .is('ended_at', null)
    .lt('ends_at', now)
    .limit(limit);
  for (const row of data || []) {
    await finalizeAuction(db, row.deal_id as string);
  }
}

/** ปิดประมูลรายการเดียว — มอบผู้ชนะเข้าดีล · ไม่มี bid วนเวลาใหม่ */
export async function finalizeAuction(db: SupabaseClient, dealId: string) {
  const { data: auction } = await db.from('deal_auction').select('*').eq('deal_id', dealId).maybeSingle();
  if (!auction || auction.ended_at) return auction;

  const now = new Date();
  if (new Date(auction.ends_at).getTime() > now.getTime()) return auction;

  const bidCount = Number(auction.bid_count) || 0;
  const hasWinner = !!(auction.current_bidder_id && auction.current_bid != null);

  if (!hasWinner && bidCount === 0) {
    const durationMinutes = resolveAuctionDurationMinutes(auction, 72 * 60);
    const newEndsAt = new Date(now.getTime() + durationMinutes * 60 * 1000).toISOString();
    await db.from('deal_auction').update({
      ends_at: newEndsAt,
      duration_minutes: durationMinutes,
    }).eq('deal_id', dealId);

    const { data: deal } = await db.from('deals').select('seller_id, title').eq('id', dealId).maybeSingle();
    if (deal?.seller_id) {
      await notifyUsers(db, [deal.seller_id as string], {
        title: '🔁 ประมูลเปิดรอบใหม่',
        body: `"${deal.title || 'ประมูล'}" หมดเวลาโดยไม่มีผู้ bid — ระบบต่อเวลาอีก ${durationMinutes >= 1440 ? `${Math.round(durationMinutes / 1440)} วัน` : durationMinutes >= 60 ? `${Math.round(durationMinutes / 60)} ชม.` : `${durationMinutes} นาที`}`,
        link: `/marketplace/${dealId}`,
      }).catch(() => {});
    }

    return { ...auction, ends_at: newEndsAt, duration_minutes: durationMinutes };
  }

  const endedAt = now.toISOString();
  await db.from('deal_auction').update({ ended_at: endedAt }).eq('deal_id', dealId);

  const { data: deal } = await db.from('deals').select('*').eq('id', dealId).maybeSingle();
  if (!deal || deal.status !== 'posted') return auction;

  if (hasWinner) {
    const winningBid = Math.round(Number(auction.current_bid));
    const fees = await readFeesConfig(db);
    const gp = computeAuctionGp(fees, winningBid);

    await db.from('deals').update({
      buyer_id: auction.current_bidder_id,
      buyer_name: auction.current_bidder_name || '',
      price: winningBid,
      list_gross_price: winningBid,
      status: 'posted',
      seller_accepted_terms: true,
      buyer_accepted_terms: true,
      fee_payer: deal.fee_payer || 'buyer',
    }).eq('id', dealId);

    await releaseLosingAuctionDeposits(db, {
      dealId,
      winnerId: String(auction.current_bidder_id),
      title: String(deal.title || 'ประมูล'),
    }).catch(() => {});

    await notifyUsers(db, [auction.current_bidder_id as string], {
      title: '🔨 คุณชนะประมูล!',
      body: `"${deal.title}" — ราคาที่ชนะ ฿${winningBid.toLocaleString()} กรุณาชำระเงิน (มัดจำยังถูกล็อกไว้จนกว่าจะชำระครบ)`,
      link: `/cart/checkout/${dealId}`,
    });
    if (deal.seller_id) {
      await notifyUsers(db, [deal.seller_id as string], {
        title: '🔨 ประมูลของคุณปิดแล้ว',
        body: `"${deal.title}" ขายได้ ฿${winningBid.toLocaleString()} (สุทธิ ~฿${gp.sellerReceive.toLocaleString()}) โดย ${auction.current_bidder_name || 'ผู้ชนะ'} — รอผู้ซื้อโอนเงิน`,
        link: `/dashboard/seller`,
      });
    }
  } else {
    await releaseLosingAuctionDeposits(db, {
      dealId,
      winnerId: null,
      title: String(deal.title || 'ประมูล'),
    }).catch(() => {});
  }

  return { ...auction, ended_at: endedAt };
}

async function loadLiveAuction(db: SupabaseClient, dealId: string) {
  const { data: auction } = await db.from('deal_auction').select('*').eq('deal_id', dealId).maybeSingle();
  if (!auction || auction.ended_at) return null;
  if (new Date(auction.ends_at).getTime() <= Date.now()) return null;
  return auction as AuctionRow;
}

async function loadAutoBids(db: SupabaseClient, dealId: string): Promise<AuctionAutoBidRow[]> {
  const { data } = await db.from('auction_auto_bids')
    .select('*')
    .eq('deal_id', dealId)
    .order('max_amount', { ascending: false })
    .order('created_at', { ascending: true });
  return (data || []) as AuctionAutoBidRow[];
}

/** บันทึก bid ลง DB (manual หรือ auto) */
async function recordAuctionBid(
  db: SupabaseClient,
  dealId: string,
  dealTitle: string,
  sellerId: string | null,
  auction: AuctionRow,
  bidderId: string,
  bidderName: string,
  bidAmount: number,
  opts?: { notify?: boolean; previousBidderId?: string | null },
) {
  const { data: prior } = await db.from('auction_bids').select('id').eq('deal_id', dealId).eq('bidder_id', bidderId).limit(1);
  const isNewBidder = !(prior?.length);

  await db.from('auction_bids').insert({
    deal_id: dealId,
    bidder_id: bidderId,
    bidder_name: bidderName,
    amount: bidAmount,
  });

  await db.from('deal_auction').update({
    current_bid: bidAmount,
    current_bidder_id: bidderId,
    current_bidder_name: bidderName,
    bid_count: (Number(auction.bid_count) || 0) + 1,
    unique_bidder_count: (Number(auction.unique_bidder_count) || 0) + (isNewBidder ? 1 : 0),
  }).eq('deal_id', dealId);

  await db.from('deals').update({ price: bidAmount }).eq('id', dealId);

  if (opts?.notify === false) return;

  if (sellerId && sellerId !== bidderId) {
    await notifyUsers(db, [sellerId], {
      title: '🔨 มี bid ใหม่ในประมูลของคุณ',
      body: `"${dealTitle}" — bid ล่าสุด ฿${bidAmount.toLocaleString()} โดย ${bidderName}`,
      link: `/marketplace/${dealId}`,
    }).catch(() => {});
    await notifySellerLineNewBid(db, sellerId, {
      title: dealTitle,
      amount: bidAmount,
      dealId,
      bidderName,
    }).catch(() => {});
  }
  const prevLeader = opts?.previousBidderId ?? auction.current_bidder_id;
  if (prevLeader && prevLeader !== bidderId) {
    await notifyUsers(db, [prevLeader as string], {
      title: '🔨 มีคน overbid คุณแล้ว',
      body: `"${dealTitle}" — มี bid ใหม่ ฿${bidAmount.toLocaleString()}`,
      link: `/marketplace/${dealId}`,
    }).catch(() => {});
    await notifyUserLineOverbid(db, prevLeader as string, {
      title: dealTitle,
      amount: bidAmount,
      dealId,
    }).catch(() => {});
  }
}

/** หา auto-bid ถัดไปที่ควรวาง — สู้ทีละ step ของผู้ตั้ง (อย่างน้อยขั้นต่ำรายการ) */
function pickNextAutoBid(
  auction: AuctionRow,
  autos: AuctionAutoBidRow[],
): { bidder: AuctionAutoBidRow; amount: number } | null {
  if (!autos.length) return null;
  const pub = rowToAuctionPublic(auction);
  const minNext = pub.minNextBid;
  const inc = pub.bidIncrement;
  const sorted = [...autos].sort((a, b) => {
    if (b.max_amount !== a.max_amount) return b.max_amount - a.max_amount;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const nextAmountFor = (auto: AuctionAutoBidRow) => {
    const step = autoBidStepAmount(inc, auto.step_amount);
    if (pub.currentBid == null) return Math.min(auto.max_amount, minNext);
    const jump = pub.currentBid + step;
    return Math.min(auto.max_amount, Math.max(minNext, jump));
  };

  const top = sorted[0];
  const second = sorted.find(a => a.bidder_id !== top.bidder_id) || null;

  if (!second) {
    if (pub.currentBidderId === top.bidder_id) return null;
    if (top.max_amount < minNext) return null;
    const amount = nextAmountFor(top);
    if (amount < minNext) return null;
    return { bidder: top, amount };
  }

  const topStep = autoBidStepAmount(inc, top.step_amount);
  const visibleCap = Math.min(top.max_amount, second.max_amount + topStep);

  if (pub.currentBidderId === top.bidder_id) {
    if (pub.currentBid != null && pub.currentBid >= visibleCap) return null;
    if (second.max_amount < minNext) return null;
    const amount = nextAmountFor(second);
    if (amount < minNext) return null;
    return { bidder: second, amount };
  }

  if (top.max_amount < minNext) return null;
  const amount = nextAmountFor(top);
  if (amount < minNext) return null;
  return { bidder: top, amount };
}

/** วน auto-bid จน stable */
export async function resolveAutoBids(db: SupabaseClient, dealId: string, dealTitle: string, sellerId: string | null) {
  for (let round = 0; round < 40; round++) {
    const auction = await loadLiveAuction(db, dealId);
    if (!auction) break;

    const autos = await loadAutoBids(db, dealId);
    const next = pickNextAutoBid(auction, autos);
    if (!next) break;
    if (next.bidder.bidder_id === auction.current_bidder_id && next.amount <= (auction.current_bid ?? 0)) break;

    const prevLeader = auction.current_bidder_id;
    await recordAuctionBid(db, dealId, dealTitle, sellerId, auction, next.bidder.bidder_id, next.bidder.bidder_name, next.amount, {
      notify: true,
      previousBidderId: prevLeader,
    });
  }
}

/** วาง bid (+ ตั้ง max auto-bid ได้) */
export async function placeAuctionBid(
  db: SupabaseClient,
  dealId: string,
  bidderId: string,
  bidderName: string,
  amount: number,
  options?: { maxBid?: number | null; stepAmount?: number | null; clearAutoBid?: boolean },
) {
  const { data: deal } = await db.from('deals').select('id, seller_id, status, deal_type, title').eq('id', dealId).maybeSingle();
  if (!deal || deal.deal_type !== 'auction') throw new Error('ไม่ใช่รายการประมูล');
  if (deal.status !== 'posted') throw new Error('ประมูลนี้ปิดแล้ว');
  if (deal.seller_id === bidderId) throw new Error('ไม่สามารถ bid สินค้าของตัวเองได้');

  let auction = await loadLiveAuction(db, dealId);
  if (!auction) {
    const { data: raw } = await db.from('deal_auction').select('*').eq('deal_id', dealId).maybeSingle();
    if (!raw) throw new Error('ไม่พบข้อมูลประมูล');
    if (raw.ended_at) throw new Error('ประมูลปิดแล้ว');
    if (new Date(raw.ends_at).getTime() <= Date.now()) {
      await finalizeAuction(db, dealId);
      throw new Error('ประมูลหมดเวลาแล้ว');
    }
    auction = raw as AuctionRow;
  }

  const pub = rowToAuctionPublic(auction);
  let bidAmount = Math.round(amount);
  const maxBid = options?.maxBid != null && isFinite(options.maxBid) ? Math.round(Number(options.maxBid)) : null;
  const stepAmount = options?.stepAmount != null && isFinite(options.stepAmount)
    ? Math.max(0, Math.round(Number(options.stepAmount)))
    : 0;

  if (options?.clearAutoBid) {
    await db.from('auction_auto_bids').delete().eq('deal_id', dealId).eq('bidder_id', bidderId);
  } else if (maxBid != null) {
    if (maxBid < pub.minNextBid) {
      throw new Error(`ราคาสูงสุดต้องไม่ต่ำกว่าราคา bid ขั้นต่ำ ฿${pub.minNextBid.toLocaleString()}`);
    }
    if (maxBid < bidAmount) {
      throw new Error('ราคาสูงสุดที่สู้ต้องไม่ต่ำกว่าราคา bid ครั้งนี้');
    }
    const effectiveStep = autoBidStepAmount(pub.bidIncrement, stepAmount);
    if (stepAmount > 0 && stepAmount < pub.bidIncrement) {
      throw new Error(`จำนวนเงินต่อบิดต้องไม่ต่ำกว่าขั้นต่ำรายการ ฿${pub.bidIncrement.toLocaleString()}`);
    }
    bidAmount = Math.min(bidAmount, maxBid);
  }

  if (bidAmount < pub.minNextBid) {
    throw new Error(`ราคา bid ต่ำเกินไป — ต้องอย่างน้อย ฿${pub.minNextBid.toLocaleString()}`);
  }

  const bidDeposit = Math.max(0, Math.round(Number(auction.bid_deposit) || 0));
  if (bidDeposit > 0) {
    await holdAuctionDeposit(db, {
      dealId,
      bidderId,
      amount: bidDeposit,
      title: String(deal.title || 'ประมูล'),
    });
  }

  if (!options?.clearAutoBid && maxBid != null) {
    const effectiveStep = autoBidStepAmount(pub.bidIncrement, stepAmount);
    await db.from('auction_auto_bids').upsert({
      deal_id: dealId,
      bidder_id: bidderId,
      bidder_name: bidderName,
      max_amount: maxBid,
      step_amount: stepAmount > 0 ? effectiveStep : 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'deal_id,bidder_id' });
  }

  const prevLeader = auction.current_bidder_id;
  await recordAuctionBid(db, dealId, deal.title, deal.seller_id, auction, bidderId, bidderName, bidAmount, {
    previousBidderId: prevLeader,
  });

  await resolveAutoBids(db, dealId, deal.title, deal.seller_id);

  const { data: updated } = await db.from('deal_auction').select('*').eq('deal_id', dealId).single();
  return rowToAuctionPublic(updated as AuctionRow);
}

/** ซื้อทันทีในรายการประมูล — ปิดประมูลและมอบให้ผู้ซื้อ */
export async function executeAuctionBuyNow(
  db: SupabaseClient,
  dealId: string,
  buyerId: string,
  buyerName: string,
  shippingProvider?: string | null,
) {
  const { data: deal } = await db.from('deals').select('*').eq('id', dealId).maybeSingle();
  if (!deal || deal.deal_type !== 'auction') throw new Error('ไม่ใช่รายการประมูล');
  if (deal.status !== 'posted') throw new Error('สินค้านี้ไม่พร้อมขายแล้ว');
  if (deal.seller_id === buyerId) throw new Error('ไม่สามารถซื้อสินค้าของตัวเองได้');
  if (deal.buyer_id && deal.buyer_id !== buyerId) throw new Error('มีผู้ซื้อแล้ว');

  const { data: auction } = await db.from('deal_auction').select('*').eq('deal_id', dealId).maybeSingle();
  if (!auction || auction.ended_at) throw new Error('ประมูลปิดแล้ว');
  if (new Date(auction.ends_at).getTime() <= Date.now()) {
    await finalizeAuction(db, dealId);
    throw new Error('ประมูลหมดเวลาแล้ว');
  }

  const buyNow = auction.buy_now_price != null ? Math.round(Number(auction.buy_now_price)) : null;
  if (!buyNow || buyNow <= 0) throw new Error('รายการนี้ไม่มีราคาซื้อทันที');

  const currentBid = auction.current_bid != null ? Math.round(Number(auction.current_bid)) : null;
  if (currentBid != null && currentBid >= buyNow) {
    throw new Error('ราคาประมูลถึงระดับที่ไม่สามารถซื้อทันทีได้แล้ว');
  }

  const { sanitizeShippingProviders } = await import('@/lib/logistics');
  const allowedProviders = sanitizeShippingProviders(deal.shipping_providers);
  let buyerShippingProvider: string | null = null;
  if (allowedProviders.length > 0) {
    const chosen = String(shippingProvider || '').trim();
    if (!chosen || !allowedProviders.includes(chosen)) throw new Error('กรุณาเลือกขนส่ง');
    buyerShippingProvider = chosen;
  }

  const now = new Date().toISOString();
  await db.from('deal_auction').update({ ended_at: now }).eq('deal_id', dealId);

  const fees = await readFeesConfig(db);
  const gp = computeAuctionGp(fees, buyNow);

  await db.from('deals').update({
    buyer_id: buyerId,
    buyer_name: buyerName,
    price: buyNow,
    list_gross_price: buyNow,
    status: 'posted',
    seller_accepted_terms: true,
    buyer_accepted_terms: true,
    fee_payer: deal.fee_payer || 'buyer',
    ...(buyerShippingProvider ? { buyer_shipping_provider: buyerShippingProvider } : {}),
  }).eq('id', dealId);

  await releaseLosingAuctionDeposits(db, {
    dealId,
    winnerId: buyerId,
    title: String(deal.title || 'ประมูล'),
  }).catch(() => {});

  await notifyUsers(db, [buyerId], {
    title: '⚡ ซื้อทันทีสำเร็จ!',
    body: `"${deal.title}" — ฿${buyNow.toLocaleString()} กรุณาชำระเงิน`,
    link: `/cart/checkout/${dealId}`,
  });
  if (deal.seller_id) {
    await notifyUsers(db, [deal.seller_id as string], {
      title: '⚡ มีคนซื้อทันที!',
      body: `"${deal.title}" ขายได้ ฿${buyNow.toLocaleString()} (สุทธิ ~฿${gp.sellerReceive.toLocaleString()}) โดย ${buyerName}`,
      link: `/dashboard/seller`,
    });
  }

  const { data: updated } = await db.from('deal_auction').select('*').eq('deal_id', dealId).single();
  return { auction: rowToAuctionPublic(updated as AuctionRow), dealId };
}

/** deal_id ที่ user เคย bid หรือตั้ง auto-bid */
export async function getMyAuctionDealIds(db: SupabaseClient, userId: string): Promise<string[]> {
  const [bidsRes, autoRes] = await Promise.all([
    db.from('auction_bids').select('deal_id').eq('bidder_id', userId),
    db.from('auction_auto_bids').select('deal_id').eq('bidder_id', userId),
  ]);
  const ids = new Set<string>();
  for (const row of bidsRes.data || []) ids.add(row.deal_id as string);
  for (const row of autoRes.data || []) ids.add(row.deal_id as string);
  return [...ids];
}

export async function getMyAutoBid(
  db: SupabaseClient,
  dealId: string,
  userId: string,
): Promise<{ maxAmount: number; stepAmount: number } | null> {
  const { data } = await db.from('auction_auto_bids')
    .select('max_amount, step_amount')
    .eq('deal_id', dealId)
    .eq('bidder_id', userId)
    .maybeSingle();
  if (data?.max_amount == null) return null;
  return {
    maxAmount: Number(data.max_amount),
    stepAmount: Number(data.step_amount) || 0,
  };
}

/** @deprecated ใช้ getMyAutoBid */
export async function getMyAutoBidMax(db: SupabaseClient, dealId: string, userId: string): Promise<number | null> {
  const row = await getMyAutoBid(db, dealId, userId);
  return row?.maxAmount ?? null;
}
