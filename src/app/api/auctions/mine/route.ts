import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser, HttpError } from '@/lib/supabaseServer';
import { computeMyAuctionStatus } from '@/lib/auction';
import { attachAuctions, getMyAuctionDealIds, syncExpiredAuctions } from '../../_lib/auctionSync';

async function attachImages<T extends { id: string }>(db: ReturnType<typeof getAdminClient>, deals: T[]) {
  const ids = deals.map(d => d.id);
  if (!ids.length) return deals.map(d => ({ ...d, images: [] as string[] }));
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
    const me = await verifyUser(req);
    const db = getAdminClient();
    await syncExpiredAuctions(db);

    const dealIds = await getMyAuctionDealIds(db, me.id);
    if (!dealIds.length) {
      return NextResponse.json({ deals: [] });
    }

    const { data: deals } = await db.from('deals')
      .select('*')
      .in('id', dealIds)
      .eq('deal_type', 'auction')
      .order('created_at', { ascending: false });

    const withImages = await attachImages(db, deals || []);
    const withAuction = await attachAuctions(db, withImages);

    const enriched = withAuction.map(d => ({
      ...d,
      myAuctionStatus: d.auction
        ? computeMyAuctionStatus(d.auction, me.id, d.buyer_id)
        : 'lost',
    }));

    return NextResponse.json({ deals: enriched });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status });
  }
}
