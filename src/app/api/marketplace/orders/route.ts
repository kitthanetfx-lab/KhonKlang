import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser, HttpError } from '@/lib/supabaseServer';
import { isMarketplaceOrder, isActiveMarketplaceBuyerOrder, marketplaceOrderStatusLabel, marketplaceBuyerPayAmount } from '@/lib/marketplaceOrder';

/** คำสั่งซื้อตลาดของผู้ซื้อ — ?count=1 คืนเฉพาะจำนวนที่ยังดำเนินการ */
export async function GET(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const db = getAdminClient();
    const countOnly = req.nextUrl.searchParams.get('count') === '1';

    const { data, error } = await db
      .from('deals')
      .select('id, title, price, status, shipping_cost, seller_name, payment_slip_file_id, created_at, deal_type, source, buyer_id')
      .eq('buyer_id', me.id)
      .eq('source', 'listing')
      .neq('deal_type', 'auction')
      .neq('deal_type', 'meetup')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    const orders = (data || []).filter(d => isMarketplaceOrder(d) && d.buyer_id);
    const ids = orders.map(d => d.id);
    const imgMap = new Map<string, string>();
    if (ids.length) {
      const { data: imgs } = await db.from('deal_images').select('deal_id, file_id, position').in('deal_id', ids).order('position', { ascending: true });
      for (const row of imgs || []) {
        if (!imgMap.has(row.deal_id)) imgMap.set(row.deal_id, row.file_id);
      }
    }
    const active = orders.filter(d => isActiveMarketplaceBuyerOrder(d));

    if (countOnly) {
      return NextResponse.json({ count: active.length });
    }

    const mapped = orders.map(d => ({
      id: d.id,
      title: d.title,
      price: d.price,
      status: d.status,
      statusLabel: marketplaceOrderStatusLabel(String(d.status)),
      shippingCost: d.shipping_cost || 0,
      payAmount: marketplaceBuyerPayAmount(d),
      sellerName: d.seller_name || '',
      hasSlip: !!d.payment_slip_file_id,
      createdAt: d.created_at,
      imageFileId: imgMap.get(d.id) || '',
      isActive: isActiveMarketplaceBuyerOrder(d),
    }));

    return NextResponse.json({ orders: mapped, activeCount: active.length });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
