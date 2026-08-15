import type { SupabaseClient } from '@supabase/supabase-js';
import type { WalletApplyResult, WalletLedgerType } from '@/lib/userWallet';
import { notifyUsers } from './notify';

export class WalletInsufficientError extends Error {
  available: number;
  need: number;
  constructor(need: number, available = 0) {
    super(`ยอดในกระเป๋าไม่พอ — ต้องมีอย่างน้อย ฿${need.toLocaleString()} (คงเหลือ ฿${available.toLocaleString()})`);
    this.name = 'WalletInsufficientError';
    this.need = need;
    this.available = available;
  }
}

function isInsufficient(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err || '');
  return msg.includes('WALLET_INSUFFICIENT');
}

export async function ensureUserWallet(
  db: SupabaseClient,
  userId: string,
  displayName = '',
) {
  await db.from('user_wallets').upsert(
    { user_id: userId, display_name: displayName.slice(0, 200) },
    { onConflict: 'user_id' },
  );
}

export async function getUserWallet(db: SupabaseClient, userId: string, displayName = '') {
  await ensureUserWallet(db, userId, displayName);
  const { data } = await db.from('user_wallets').select('*').eq('user_id', userId).maybeSingle();
  return {
    userId,
    displayName: String(data?.display_name || displayName || ''),
    availableBalance: Number(data?.available_balance || 0),
    heldBalance: Number(data?.held_balance || 0),
    updatedAt: String(data?.updated_at || new Date().toISOString()),
  };
}

export async function applyUserWallet(
  db: SupabaseClient,
  args: {
    userId: string;
    amount: number;
    availableDelta: number;
    heldDelta: number;
    entryKey: string;
    type: WalletLedgerType;
    title: string;
    referenceType?: string;
    referenceId?: string;
    meta?: Record<string, unknown>;
    need?: number;
  },
): Promise<WalletApplyResult> {
  const { data, error } = await db.rpc('apply_user_wallet', {
    p_user_id: args.userId,
    p_amount: Math.round(args.amount),
    p_available_delta: Math.round(args.availableDelta),
    p_held_delta: Math.round(args.heldDelta),
    p_entry_key: args.entryKey.slice(0, 160),
    p_type: args.type,
    p_title: (args.title || '').slice(0, 200),
    p_reference_type: (args.referenceType || '').slice(0, 80),
    p_reference_id: (args.referenceId || '').slice(0, 80),
    p_meta: args.meta || {},
  });
  if (error) {
    if (isInsufficient(error)) {
      const wallet = await getUserWallet(db, args.userId).catch(() => null);
      throw new WalletInsufficientError(
        args.need ?? Math.abs(args.availableDelta),
        wallet?.availableBalance || 0,
      );
    }
    throw new Error(error.message);
  }
  const row = (data || {}) as WalletApplyResult;
  return {
    available_balance: Number(row.available_balance || 0),
    held_balance: Number(row.held_balance || 0),
    idempotent: Boolean(row.idempotent),
  };
}

export async function holdAuctionDeposit(
  db: SupabaseClient,
  opts: { dealId: string; bidderId: string; amount: number; title: string },
) {
  const amount = Math.round(opts.amount);
  if (amount <= 0) return null;

  const { data: existing } = await db
    .from('auction_deposit_holds')
    .select('*')
    .eq('deal_id', opts.dealId)
    .eq('bidder_id', opts.bidderId)
    .maybeSingle();
  if (existing?.status === 'held' || existing?.status === 'forfeited') return existing;

  await applyUserWallet(db, {
    userId: opts.bidderId,
    amount,
    availableDelta: -amount,
    heldDelta: amount,
    entryKey: `auction-hold:${opts.dealId}:${opts.bidderId}`,
    type: 'auction_hold',
    title: `ล็อกมัดจำประมูล — ${opts.title}`.slice(0, 200),
    referenceType: 'auction',
    referenceId: opts.dealId,
    need: amount,
  });

  const { data } = await db.from('auction_deposit_holds').upsert({
    deal_id: opts.dealId,
    bidder_id: opts.bidderId,
    amount,
    status: 'held',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'deal_id,bidder_id' }).select().maybeSingle();
  return data;
}

export async function releaseAuctionDeposit(
  db: SupabaseClient,
  opts: { dealId: string; bidderId: string; title: string; reason?: string },
) {
  const { data: hold } = await db
    .from('auction_deposit_holds')
    .select('*')
    .eq('deal_id', opts.dealId)
    .eq('bidder_id', opts.bidderId)
    .maybeSingle();
  if (!hold || hold.status !== 'held') return hold;
  const amount = Math.round(Number(hold.amount) || 0);
  if (amount <= 0) return hold;

  await applyUserWallet(db, {
    userId: opts.bidderId,
    amount,
    availableDelta: amount,
    heldDelta: -amount,
    entryKey: `auction-release:${opts.dealId}:${opts.bidderId}`,
    type: 'auction_release',
    title: (opts.reason || `คืนมัดจำประมูล — ${opts.title}`).slice(0, 200),
    referenceType: 'auction',
    referenceId: opts.dealId,
  });

  const { data } = await db.from('auction_deposit_holds').update({
    status: 'released',
    updated_at: new Date().toISOString(),
  }).eq('id', hold.id).select().maybeSingle();
  return data;
}

export async function releaseLosingAuctionDeposits(
  db: SupabaseClient,
  opts: { dealId: string; winnerId?: string | null; title: string },
) {
  const { data: holds } = await db
    .from('auction_deposit_holds')
    .select('*')
    .eq('deal_id', opts.dealId)
    .eq('status', 'held');
  for (const hold of holds || []) {
    if (opts.winnerId && hold.bidder_id === opts.winnerId) continue;
    await releaseAuctionDeposit(db, {
      dealId: opts.dealId,
      bidderId: hold.bidder_id,
      title: opts.title,
      reason: `คืนมัดจำประมูล (ไม่ได้ชนะ) — ${opts.title}`,
    }).catch(() => {});
  }
}

export async function forfeitAuctionDepositToSeller(
  db: SupabaseClient,
  opts: { dealId: string; bidderId: string; sellerId: string; title: string },
) {
  const { data: hold } = await db
    .from('auction_deposit_holds')
    .select('*')
    .eq('deal_id', opts.dealId)
    .eq('bidder_id', opts.bidderId)
    .maybeSingle();
  if (!hold || hold.status !== 'held') return hold;
  const amount = Math.round(Number(hold.amount) || 0);
  if (amount <= 0) return hold;

  await applyUserWallet(db, {
    userId: opts.bidderId,
    amount,
    availableDelta: 0,
    heldDelta: -amount,
    entryKey: `auction-forfeit:${opts.dealId}:${opts.bidderId}`,
    type: 'auction_forfeit',
    title: `หักมัดจำประมูล (ไม่รับของ) — ${opts.title}`.slice(0, 200),
    referenceType: 'auction',
    referenceId: opts.dealId,
  });

  if (opts.sellerId && opts.sellerId !== opts.bidderId) {
    await applyUserWallet(db, {
      userId: opts.sellerId,
      amount,
      availableDelta: amount,
      heldDelta: 0,
      entryKey: `auction-forfeit-credit:${opts.dealId}:${opts.sellerId}`,
      type: 'auction_forfeit_credit',
      title: `ค่าเสียเวลาประมูล — ${opts.title}`.slice(0, 200),
      referenceType: 'auction',
      referenceId: opts.dealId,
    });
  }

  const { data } = await db.from('auction_deposit_holds').update({
    status: 'forfeited',
    updated_at: new Date().toISOString(),
  }).eq('id', hold.id).select().maybeSingle();
  return data;
}

/** ยกเลิกประมูลที่ยังไม่มีผู้ชนะ — คืนมัดจำทุกคน */
export async function releaseAllAuctionDeposits(
  db: SupabaseClient,
  opts: { dealId: string; title: string },
) {
  await releaseLosingAuctionDeposits(db, { dealId: opts.dealId, winnerId: null, title: opts.title });
}

export async function settleAuctionCancel(
  db: SupabaseClient,
  deal: { id: string; title?: string; seller_id?: string | null; buyer_id?: string | null; deal_type?: string },
  ended: boolean,
) {
  if (deal.deal_type !== 'auction') return;
  const title = String(deal.title || 'ประมูล');
  if (ended && deal.buyer_id && deal.seller_id) {
    await forfeitAuctionDepositToSeller(db, {
      dealId: deal.id,
      bidderId: String(deal.buyer_id),
      sellerId: String(deal.seller_id),
      title,
    }).catch(() => {});
    await releaseLosingAuctionDeposits(db, {
      dealId: deal.id,
      winnerId: String(deal.buyer_id),
      title,
    }).catch(() => {});
    await notifyUsers(db, [String(deal.buyer_id)], {
      title: 'มัดจำประมูลถูกหัก',
      body: `"${title}" — ชนะแล้วไม่รับของ ระบบหักมัดจำเป็นค่าเสียเวลาให้ผู้ขาย`,
      link: '/wallet',
    }).catch(() => {});
    await notifyUsers(db, [String(deal.seller_id)], {
      title: 'ได้รับค่าเสียเวลาประมูล',
      body: `"${title}" — มัดจำผู้ชนะถูกโอนเข้ากระเป๋าของคุณแล้ว`,
      link: '/wallet',
    }).catch(() => {});
    return;
  }
  await releaseAllAuctionDeposits(db, { dealId: deal.id, title }).catch(() => {});
}

export async function releaseAuctionDepositOnPaid(
  db: SupabaseClient,
  deal: { id: string; title?: string; buyer_id?: string | null; deal_type?: string },
) {
  if (deal.deal_type !== 'auction' || !deal.buyer_id) return;
  await releaseAuctionDeposit(db, {
    dealId: deal.id,
    bidderId: String(deal.buyer_id),
    title: String(deal.title || 'ประมูล'),
    reason: `คืนมัดจำประมูล (ชำระครบ) — ${deal.title || 'ประมูล'}`,
  });
}
