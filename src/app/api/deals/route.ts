import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser, HttpError } from '@/lib/supabaseServer';
import { notifyUsers } from '../_lib/notify';
import { readServiceControlsConfig } from '../_lib/appConfig';
import { syncDealLedger, readFeesConfig } from '../_lib/financeLedger';
import { computeMarketplaceGp } from '@/lib/fees';
import { sanitizeShippingProviders } from '@/lib/logistics';
import { computeAuctionEndsAt, resolveAuctionDurationMinutes, type AuctionDurationInput } from '@/lib/auction';
import { attachAuctions, syncExpiredAuctions } from '../_lib/auctionSync';

// แนบ images: string[] (file_id เรียงตาม position) ให้แต่ละดีล — แทน imageFileIds JSON blob เดิมบน deals row
async function attachImages<T extends { id: string }>(db: ReturnType<typeof getAdminClient>, deals: T[]): Promise<(T & { images: string[] })[]> {
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

export async function GET(req: NextRequest) {
  try {
    const role = req.nextUrl.searchParams.get('role') || 'seller';
    const db = getAdminClient();

    const authHeader = req.headers.get('authorization') || req.headers.get('x-session-jwt');
    if (role === 'buyer' && !authHeader) {
      await syncExpiredAuctions(db);
      const { data } = await db.from('deals').select('*').eq('status', 'posted').order('created_at', { ascending: false }).limit(100);
      const withImages = await attachImages(db, data || []);
      return NextResponse.json({ deals: await attachAuctions(db, withImages) });
    }

    const me = await verifyUser(req);

    if (role === 'middleman') {
      const { data: deals } = await db.from('deals').select('*').eq('middleman_id', me.id).order('created_at', { ascending: false }).limit(100);
      const rows = deals || [];
      const ids = Array.from(new Set(rows.flatMap(d => [d.buyer_id, d.seller_id]).filter(Boolean)));
      const { data: profiles } = ids.length ? await db.from('profiles').select('id, phone').in('id', ids) : { data: [] };
      const phoneOf = new Map((profiles || []).map(p => [p.id, p.phone || '']));
      const enriched = rows.map(d => ({ ...d, buyerPhone: phoneOf.get(d.buyer_id) || '', sellerPhone: phoneOf.get(d.seller_id) || '' }));
      return NextResponse.json({ deals: await attachImages(db, enriched) });
    }

    if (role === 'buyer') {
      await syncExpiredAuctions(db);
      const [posted, mine] = await Promise.all([
        db.from('deals').select('*').eq('status', 'posted').order('created_at', { ascending: false }).limit(100),
        db.from('deals').select('*').eq('buyer_id', me.id).order('created_at', { ascending: false }).limit(100),
      ]);
      const seen = new Set<string>();
      const unique = [...(posted.data || []), ...(mine.data || [])].filter(d => {
        if (seen.has(d.id)) return false;
        seen.add(d.id); return true;
      });
      const withImages = await attachImages(db, unique);
      return NextResponse.json({ deals: await attachAuctions(db, withImages) });
    }

    const { data } = await db.from('deals').select('*').eq('seller_id', me.id).order('created_at', { ascending: false }).limit(100);
    const withImages = await attachImages(db, data || []);
    return NextResponse.json({ deals: await attachAuctions(db, withImages) });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const body = await req.json();
    const { title, description, price, category, creatorRole, condition, location, sellingMode, imageFileIds, source, dealType, meetupData, serviceIntent, listGrossPrice, auctionData, shippingCost, shippingProviders, warrantyYears, warrantyMonths, warrantyDays, feePayer } = body;
    if (!title || price == null) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    const isAuction = dealType === 'auction';
    const isBuyer = creatorRole === 'buyer';

    const db = getAdminClient();
    const { data: profile } = await db.from('profiles').select('display_name, seller_status, role').eq('id', me.id).single();
    const sellerStatus = profile?.seller_status || '';
    const accountRole = profile?.role || '';
    if (!isBuyer && source === 'listing' && sellerStatus !== 'approved' && !['seller', 'admin'].includes(accountRole)) {
      return NextResponse.json({ error: 'บัญชีนี้ยังไม่ได้รับอนุมัติเป็นผู้ขาย จึงยังลงประกาศขายสาธารณะไม่ได้' }, { status: 403 });
    }

    const serviceControls = await readServiceControlsConfig(db);
    if (dealType === 'simple' && !serviceControls.tradeSimple.enabled) {
      return NextResponse.json({ error: serviceControls.tradeSimple.note || 'บริการซื้อขายผ่านกลางแบบง่ายถูกปิดชั่วคราว' }, { status: 403 });
    }
    if (dealType === 'meetup' && !serviceControls.meetupGuarantee.enabled) {
      return NextResponse.json({ error: serviceControls.meetupGuarantee.note || 'บริการนัดรับรับประกันการเดินทางถูกปิดชั่วคราว' }, { status: 403 });
    }
    if (serviceIntent === 'safezone' && !serviceControls.meetupSafeZone.enabled) {
      return NextResponse.json({ error: serviceControls.meetupSafeZone.note || 'บริการนัดรับ Safe Zone ถูกปิดชั่วคราว' }, { status: 403 });
    }
    if (source === 'listing') {
      if (!serviceControls.marketplace.enabled) {
        return NextResponse.json({ error: serviceControls.marketplace.note || 'โซนตลาดถูกปิดชั่วคราว จึงยังลงประกาศไม่ได้' }, { status: 403 });
      }
    } else if (!dealType && serviceIntent !== 'safezone' && !serviceControls.tradeOnline.enabled) {
      return NextResponse.json({ error: serviceControls.tradeOnline.note || 'บริการซื้อขายผ่านกลางถูกปิดชั่วคราว' }, { status: 403 });
    }

    let listingShippingCost = 0;
    let listingShippingProviders: string[] = [];
    if (source === 'listing') {
      listingShippingCost = Math.max(0, Math.round(Number(shippingCost) || 0));
      listingShippingProviders = sanitizeShippingProviders(shippingProviders);
      if (listingShippingProviders.length === 0) {
        return NextResponse.json({ error: 'กรุณาเลือกขนส่งอย่างน้อย 1 รายการ' }, { status: 400 });
      }
    }

    const name = profile?.display_name || '';
    const dealNumberSeed = crypto.randomUUID();

    let dealPrice = Math.max(0, Math.round(Number(price)));
    let storedGross: number | null = null;
    if (!isBuyer && source === 'listing' && !isAuction) {
      const fees = await readFeesConfig(db);
      const gross = listGrossPrice != null ? Number(listGrossPrice) : dealPrice;
      const gp = computeMarketplaceGp(fees, gross);
      dealPrice = gp.displayPrice;
      storedGross = gp.sellerPrice;
    }

    const resolvedDealType = dealType === 'meetup' ? 'meetup' : dealType === 'simple' ? 'simple' : dealType === 'auction' ? 'auction' : 'normal';
    const simpleShippingCost = resolvedDealType === 'simple'
      ? Math.max(0, Math.round(Number(shippingCost) || 0))
      : 0;

    const wYears = Math.max(0, Math.min(99, Math.round(Number(warrantyYears) || 0)));
    const wMonths = Math.max(0, Math.min(11, Math.round(Number(warrantyMonths) || 0)));
    const wDays = Math.max(0, Math.min(30, Math.round(Number(warrantyDays) || 0)));
    const resolvedFeePayer = ['buyer', 'seller', 'split'].includes(String(feePayer)) ? String(feePayer) : 'buyer';

    const { data: doc, error } = await db.from('deals').insert({
      id: dealNumberSeed,
      deal_number: `KKL-${dealNumberSeed.replace(/-/g, '').slice(-8).toUpperCase()}`,
      seller_id: isBuyer ? null : me.id,
      seller_name: isBuyer ? '' : name,
      buyer_id: isBuyer ? me.id : null,
      buyer_name: isBuyer ? name : '',
      title, description: description || '', price: dealPrice,
      list_gross_price: storedGross,
      category: category || '', condition: condition || '', location: location || '',
      selling_mode: isAuction ? 'escrow,chat' : (sellingMode || 'normal'),
      source: source === 'listing' ? 'listing' : 'private',
      deal_type: resolvedDealType,
      status: isBuyer ? 'waiting_seller' : 'posted',
      creator_id: me.id,
      shipping_cost: source === 'listing' ? listingShippingCost : simpleShippingCost,
      shipping_providers: source === 'listing' ? listingShippingProviders : [],
      warranty_years: resolvedDealType === 'simple' ? wYears : 0,
      warranty_months: resolvedDealType === 'simple' ? wMonths : 0,
      warranty_days: resolvedDealType === 'simple' ? wDays : 0,
      fee_payer: resolvedDealType === 'simple' ? resolvedFeePayer : null,
    }).select().single();
    if (error || !doc) throw new Error(error?.message || 'create deal failed');

    if (resolvedDealType === 'simple') {
      await db.from('deal_price_state').upsert({
        deal_id: doc.id,
        agreed: true,
        proposed_price: dealPrice,
        proposed_fee_payer: resolvedFeePayer,
        fee_payer_selection_buyer: resolvedFeePayer,
        fee_payer_selection_seller: resolvedFeePayer,
      }, { onConflict: 'deal_id' });
    }

    if (isAuction && source === 'listing') {
      const ad = (auctionData || {}) as AuctionDurationInput & { bidIncrement?: number; bidDeposit?: number; buyNowPrice?: number | null };
      const bidIncrement = Math.max(1, Math.round(Number(ad.bidIncrement) || 10));
      const bidDeposit = Math.round(Number(ad.bidDeposit) || 0);
      if (bidDeposit < 1) throw new Error('กรุณาตั้งมัดจำสิทธิประมูล (อย่างน้อย ฿1)');
      const durationMinutes = resolveAuctionDurationMinutes(ad);
      const endsAt = computeAuctionEndsAt(ad);
      let buyNowPrice: number | null = null;
      if (ad.buyNowPrice != null && ad.buyNowPrice !== '') {
        buyNowPrice = Math.round(Number(ad.buyNowPrice));
        if (!Number.isFinite(buyNowPrice) || buyNowPrice <= dealPrice) {
          throw new Error('ราคาซื้อทันทีต้องสูงกว่าราคาเริ่มต้น');
        }
      }
      const { error: aErr } = await db.from('deal_auction').insert({
        deal_id: doc.id,
        display_start_price: dealPrice,
        bid_increment: bidIncrement,
        bid_deposit: bidDeposit,
        buy_now_price: buyNowPrice,
        duration_minutes: durationMinutes,
        ends_at: endsAt,
      });
      if (aErr) throw new Error(aErr.message);
    }

    if (dealType === 'meetup' && meetupData) {
      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(meetupData); } catch { /* malformed — fall back to empty */ }
      await db.from('deal_meetup').insert({
        deal_id: doc.id,
        buyer_loc: parsed.buyerLoc || null,
        seller_loc: parsed.sellerLoc || null,
        buyer_fee: Math.round(Number(parsed.buyerFee) || 0),
        seller_fee: Math.round(Number(parsed.sellerFee) || 0),
        legacy_meta: { ratePerKm: parsed.ratePerKm, feeWho: parsed.feeWho, fee: parsed.fee },
      });
    }
    if (imageFileIds?.length) {
      await db.from('deal_images').insert(imageFileIds.map((fileId: string, position: number) => ({ deal_id: doc.id, file_id: fileId, position })));
    }

    await syncDealLedger(db, doc as Record<string, unknown>).catch(() => {});

    if (body.inviteUserId && typeof body.inviteUserId === 'string' && body.inviteUserId !== me.id) {
      await notifyUsers(db, [body.inviteUserId], {
        title: '🚗 คุณถูกชวนทำดีลนัดรับ',
        body: `${name || 'สมาชิก'} ชวนคุณนัดรับ "${title}" — เข้าไประบุที่อยู่ของคุณและตกลงจุดนัดพบได้เลย`,
        link: `/deal/${doc.id}`,
      });
    }

    if (body.wantedId && typeof body.wantedId === 'string') {
      try {
        const { data: wanted } = await db.from('wanted_posts').select('user_id').eq('id', body.wantedId).single();
        if (wanted?.user_id && wanted.user_id !== me.id) {
          await notifyUsers(db, [wanted.user_id], {
            title: `📢 มีผู้เสนอขายตามประกาศหาของคุณ`,
            body: `${name || 'สมาชิก'} เสนอขาย "${title}" ราคา ฿${Number(price).toLocaleString()} — กดเข้าดูดีลและเข้าร่วมเป็นผู้ซื้อได้เลย`,
            link: `/deal/${doc.id}`,
          });
        }
      } catch { /* ประกาศอาจถูกลบ — ไม่กระทบการสร้างดีล */ }
    }

    return NextResponse.json({ deal: doc });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
