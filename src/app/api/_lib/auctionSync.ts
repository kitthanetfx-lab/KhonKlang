import type { SupabaseClient } from '@supabase/supabase-js';
import { rowToAuctionPublic, type AuctionRow } from '@/lib/auction';
import { computeAuctionGp } from '@/lib/fees';
import { readFeesConfig } from './financeLedger';
import { notifyUsers } from './notify';

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

/** ปิดประมูลรายการเดียว — มอบผู้ชนะเข้าดีล */
export async function finalizeAuction(db: SupabaseClient, dealId: string) {
  const { data: auction } = await db.from('deal_auction').select('*').eq('deal_id', dealId).maybeSingle();
  if (!auction || auction.ended_at) return auction;

  const now = new Date();
  if (new Date(auction.ends_at).getTime() > now.getTime()) return auction;

  const endedAt = now.toISOString();
  await db.from('deal_auction').update({ ended_at: endedAt }).eq('deal_id', dealId);

  const { data: deal } = await db.from('deals').select('*').eq('id', dealId).maybeSingle();
  if (!deal || deal.status !== 'posted') return auction;

  if (auction.current_bidder_id && auction.current_bid != null) {
    const winningBid = Math.round(Number(auction.current_bid));
    const fees = await readFeesConfig(db);
    const gp = computeAuctionGp(fees, winningBid);

    await db.from('deals').update({
      buyer_id: auction.current_bidder_id,
      buyer_name: auction.current_bidder_name || '',
      price: winningBid,
      list_gross_price: winningBid,
      status: 'buyer_joined',
    }).eq('id', dealId);

    await notifyUsers(db, [auction.current_bidder_id as string], {
      title: '🔨 คุณชนะประมูล!',
      body: `"${deal.title}" — ราคาที่ชนะ ฿${winningBid.toLocaleString()} เข้าห้องดีลเพื่อดำเนินการต่อ`,
      link: `/deal/${dealId}`,
    });
    if (deal.seller_id) {
      await notifyUsers(db, [deal.seller_id as string], {
        title: '🔨 ประมูลของคุณปิดแล้ว',
        body: `"${deal.title}" ขายได้ ฿${winningBid.toLocaleString()} (สุทธิ ~฿${gp.sellerReceive.toLocaleString()}) โดย ${auction.current_bidder_name || 'ผู้ชนะ'}`,
        link: `/deal/${dealId}`,
      });
    }
  }

  return { ...auction, ended_at: endedAt };
}

/** วาง bid */
export async function placeAuctionBid(
  db: SupabaseClient,
  dealId: string,
  bidderId: string,
  bidderName: string,
  amount: number,
) {
  const { data: deal } = await db.from('deals').select('id, seller_id, status, deal_type, title').eq('id', dealId).maybeSingle();
  if (!deal || deal.deal_type !== 'auction') throw new Error('ไม่ใช่รายการประมูล');
  if (deal.status !== 'posted') throw new Error('ประมูลนี้ปิดแล้ว');
  if (deal.seller_id === bidderId) throw new Error('ไม่สามารถ bid สินค้าของตัวเองได้');

  const { data: auction } = await db.from('deal_auction').select('*').eq('deal_id', dealId).maybeSingle();
  if (!auction) throw new Error('ไม่พบข้อมูลประมูล');
  if (auction.ended_at) throw new Error('ประมูลปิดแล้ว');
  if (new Date(auction.ends_at).getTime() <= Date.now()) {
    await finalizeAuction(db, dealId);
    throw new Error('ประมูลหมดเวลาแล้ว');
  }

  const pub = rowToAuctionPublic(auction as AuctionRow);
  const bidAmount = Math.round(amount);
  if (bidAmount < pub.minNextBid) {
    throw new Error(`ราคา bid ต่ำเกินไป — ต้องอย่างน้อย ฿${pub.minNextBid.toLocaleString()}`);
  }

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

  if (deal.seller_id && deal.seller_id !== bidderId) {
    await notifyUsers(db, [deal.seller_id as string], {
      title: '🔨 มี bid ใหม่ในประมูลของคุณ',
      body: `"${deal.title}" — bid ล่าสุด ฿${bidAmount.toLocaleString()} โดย ${bidderName}`,
      link: `/marketplace/${dealId}`,
    }).catch(() => {});
  }
  if (auction.current_bidder_id && auction.current_bidder_id !== bidderId) {
    await notifyUsers(db, [auction.current_bidder_id as string], {
      title: '🔨 มีคน overbid คุณแล้ว',
      body: `"${deal.title}" — มี bid ใหม่ ฿${bidAmount.toLocaleString()}`,
      link: `/marketplace/${dealId}`,
    }).catch(() => {});
  }

  const { data: updated } = await db.from('deal_auction').select('*').eq('deal_id', dealId).single();
  return rowToAuctionPublic(updated as AuctionRow);
}
