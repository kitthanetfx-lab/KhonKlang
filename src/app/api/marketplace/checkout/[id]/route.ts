import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser, HttpError } from '@/lib/supabaseServer';
import {
  isListingCheckoutOrder,
  marketplaceCheckoutPhase,
  marketplaceBuyerPayAmount,
  marketplaceOrderStatusLabel,
} from '@/lib/marketplaceOrder';
import { buildProfileAddress, isShippingAddressComplete, parseProfileAddress } from '@/lib/profileAddress';
import { getLogisticsProviderLabel } from '@/lib/logistics';

async function loadCheckout(db: ReturnType<typeof getAdminClient>, id: string, buyerId: string) {
  type ProfileRow = {
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
    phone?: string | null;
    address?: string | null;
  };

  const { data: deal, error } = await db.from('deals').select('*').eq('id', id).single();
  if (error || !deal) return null;
  if (!isListingCheckoutOrder(deal)) return { error: 'ไม่ใช่ออเดอร์ตลาด', status: 400 as const };
  if (deal.buyer_id !== buyerId) return { error: 'Forbidden', status: 403 as const };

  const [{ data: priceState }, { data: profileRow }, { data: images }, { data: packingEvidence }] = await Promise.all([
    db.from('deal_price_state').select('buyer_shipping_confirmed_at').eq('deal_id', id).maybeSingle(),
    db.from('profiles').select('first_name, last_name, display_name, phone, address').eq('id', buyerId).maybeSingle(),
    db.from('deal_images').select('file_id').eq('deal_id', id).order('position', { ascending: true }).limit(1),
    db.from('deal_evidence')
      .select('id, type, file_id, file_name, created_at')
      .eq('deal_id', id)
      .eq('type', 'packing')
      .order('created_at', { ascending: true })
      .limit(3),
  ]);

  const profile = (profileRow || {}) as ProfileRow;

  const shippingConfirmed = !!priceState?.buyer_shipping_confirmed_at || !!deal.payment_slip_file_id;
  const phase = marketplaceCheckoutPhase(deal, shippingConfirmed);

  return {
    deal,
    profile,
    imageFileId: images?.[0]?.file_id || '',
    shippingConfirmed,
    phase,
    shippingProviderLabel: deal.buyer_shipping_provider
      ? getLogisticsProviderLabel(String(deal.buyer_shipping_provider))
      : '',
    packingEvidence: packingEvidence || [],
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await verifyUser(req);
    const { id } = await params;
    const db = getAdminClient();
    const loaded = await loadCheckout(db, id, me.id);
    if (!loaded) return NextResponse.json({ error: 'ไม่พบคำสั่งซื้อ' }, { status: 404 });
    if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status });

    const { deal, profile, imageFileId, shippingConfirmed, phase, shippingProviderLabel, packingEvidence } = loaded;
    const packingSteps = [
      { step: 1, label: 'แพ็คสินค้า' },
      { step: 2, label: 'ไปส่งของ' },
      { step: 3, label: 'สลิป/QR พัสดุ' },
    ].map((meta, idx) => {
      const ev = packingEvidence[idx];
      return {
        step: meta.step,
        label: meta.label,
        fileId: ev?.file_id || '',
        fileName: ev?.file_name || '',
        uploaded: !!ev?.file_id,
      };
    });

    return NextResponse.json({
      order: {
        id: deal.id,
        title: deal.title,
        price: deal.price,
        shippingCost: deal.shipping_cost || 0,
        payAmount: marketplaceBuyerPayAmount(deal),
        status: deal.status,
        statusLabel: marketplaceOrderStatusLabel(String(deal.status)),
        sellerName: deal.seller_name || '',
        sellerId: deal.seller_id || '',
        buyerId: deal.buyer_id || '',
        buyerName: deal.buyer_name || '',
        middlemanId: deal.middleman_id || '',
        middlemanName: deal.middleman_name || '',
        paymentSlipFileId: deal.payment_slip_file_id || '',
        shippingProviderLabel,
        trackingNumber: deal.tracking_to_buyer || '',
        trackingProvider: deal.tracking_to_buyer_provider || '',
        listGrossPrice: deal.list_gross_price,
        dealType: deal.deal_type || 'normal',
        packingSteps,
      },
      profile: {
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        displayName: profile.display_name || '',
        phone: profile.phone || '',
        address: profile.address || '',
        addressFields: parseProfileAddress(String(profile.address || '')),
      },
      shippingConfirmed,
      phase,
      imageFileId,
    });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await verifyUser(req);
    const { id } = await params;
    const body = await req.json();
    const db = getAdminClient();

    const loaded = await loadCheckout(db, id, me.id);
    if (!loaded) return NextResponse.json({ error: 'ไม่พบคำสั่งซื้อ' }, { status: 404 });
    if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status });

    if (body.action === 'edit_shipping') {
      await db.from('deal_price_state').upsert(
        { deal_id: id, buyer_shipping_confirmed_at: null },
        { onConflict: 'deal_id' },
      );
      return NextResponse.json({ success: true, shippingConfirmed: false, phase: 'address' });
    }

    if (body.action === 'confirm_shipping') {
      const phone = String(body.phone || '').trim();
      const addrFields = {
        houseNo: String(body.houseNo || '').trim(),
        moo: String(body.moo || '').trim(),
        road: String(body.road || '').trim(),
        provinceName: String(body.provinceName || '').trim(),
        amphoreName: String(body.amphoreName || '').trim(),
        tambonName: String(body.tambonName || '').trim(),
        postalCode: String(body.postalCode || '').trim(),
      };
      if (!isShippingAddressComplete(phone, addrFields)) {
        return NextResponse.json({ error: 'กรุณากรอกเบอร์โทรและที่อยู่จัดส่งให้ครบ' }, { status: 400 });
      }
      const address = buildProfileAddress(addrFields);
      const { error: profileErr } = await db.from('profiles').update({ phone, address }).eq('id', me.id);
      if (profileErr) throw profileErr;

      const now = new Date().toISOString();
      await db.from('deal_price_state').upsert(
        { deal_id: id, buyer_shipping_confirmed_at: now },
        { onConflict: 'deal_id' },
      );
      await db.from('deal_messages').insert({
        deal_id: id,
        sender_id: me.id,
        sender_name: loaded.profile.display_name || `${loaded.profile.first_name || ''} ${loaded.profile.last_name || ''}`.trim() || 'ผู้ซื้อ',
        role: 'system',
        type: 'text',
        content: `ยืนยันที่อยู่จัดส่งแล้ว · ${phone} · ${address}`,
      });

      return NextResponse.json({ success: true, shippingConfirmed: true, phase: 'payment' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
