/** ออเดอร์จากตลาดซื้อขาย / ประมูลที่ชนะแล้ว (ไม่รวมนัดรับ) */

export type MarketplaceOrderInput = {
  source?: string | null;
  deal_type?: string | null;
};

export type MarketplaceDealState = MarketplaceOrderInput & {
  status?: string | null;
  buyer_id?: string | null;
  payment_slip_file_id?: string | null;
};

/** ตลาดซื้อขายราคาตายตัว (ไม่รวมประมูล / นัดรับ) */
export function isMarketplaceOrder(deal: MarketplaceOrderInput): boolean {
  return deal.source === 'listing' && deal.deal_type !== 'auction' && deal.deal_type !== 'meetup';
}

/** รายการจากร้าน (ตลาด + ประมูล) ไม่รวมนัดรับ */
export function isListingStoreOrder(deal: MarketplaceOrderInput): boolean {
  return deal.source === 'listing' && deal.deal_type !== 'meetup';
}

/**
 * ออเดอร์ที่ใช้ checkout แบบตลาด (ที่อยู่ → โอน → ติดตาม)
 * — ตลาดซื้อขายทุกกรณี
 * — ประมูลเมื่อมีผู้ชนะ (มี buyer_id) แล้ว
 */
export function isListingCheckoutOrder(deal: MarketplaceDealState): boolean {
  if (!isListingStoreOrder(deal)) return false;
  if (deal.deal_type === 'auction') return !!deal.buyer_id;
  return true;
}

/** ขายแล้ว — ล็อกถาวร (หลังแอดมินยืนยันเงิน → packing) */
export function isMarketplaceSold(deal: MarketplaceDealState): boolean {
  if (!isListingCheckoutOrder(deal)) return false;
  return [
    'packing', 'shipped_to_buyer', 'delivered', 'completed',
    'shipped_to_middleman', 'middleman_received', 'middleman_checking',
  ].includes(String(deal.status || ''));
}

/** จองแล้ว — อัปสลิปแล้ว รอแอดมิน (ห้ามซื้อทับ) */
export function isMarketplaceReserved(deal: MarketplaceDealState): boolean {
  if (!isListingCheckoutOrder(deal)) return false;
  return deal.status === 'payment_uploaded';
}

/** ผู้ซื้อกำลัง checkout (ยังไม่อัปสลิป) — ประกาศยัง posted */
export function isMarketplaceCheckoutActive(deal: MarketplaceDealState): boolean {
  if (!isListingCheckoutOrder(deal)) return false;
  const s = String(deal.status || '');
  if (!deal.buyer_id) return false;
  if (isMarketplaceSold(deal) || isMarketplaceReserved(deal)) return false;
  return (s === 'posted' || s === 'payment_pending') && !deal.payment_slip_file_id;
}

export function canJoinMarketplaceAsBuyer(
  deal: MarketplaceDealState,
  userId: string,
): { ok: boolean; error?: string } {
  if (!isMarketplaceOrder(deal)) return { ok: false, error: 'ไม่ใช่ออเดอร์ตลาด' };
  if (isMarketplaceSold(deal)) return { ok: false, error: 'สินค้าขายแล้ว' };
  if (isMarketplaceReserved(deal)) return { ok: false, error: 'มีผู้จองแล้ว รอตรวจสลิป' };

  const s = String(deal.status || '');
  if (!['posted', 'payment_pending', 'waiting_buyer'].includes(s)) {
    return { ok: false, error: 'สินค้านี้ไม่พร้อมขายแล้ว' };
  }

  if (deal.buyer_id === userId) return { ok: true };
  if (!deal.buyer_id) return { ok: true };
  if (!deal.payment_slip_file_id) return { ok: true };
  return { ok: false, error: 'มีผู้ซื้อกำลังชำระเงินอยู่' };
}

export type MarketplaceBuyUiState =
  | 'sold'
  | 'reserved'
  | 'continue_checkout'
  | 'can_buy'
  | 'unavailable';

/** สถานะปุ่มซื้อบนหน้ารายละเอียดตลาด */
export function marketplaceListingBuyState(
  deal: MarketplaceDealState,
  userId?: string,
): MarketplaceBuyUiState {
  if (!isMarketplaceOrder(deal)) return 'unavailable';
  if (isMarketplaceSold(deal)) return 'sold';
  if (isMarketplaceReserved(deal)) {
    return userId && deal.buyer_id === userId ? 'continue_checkout' : 'reserved';
  }
  if (deal.status === 'posted' || deal.status === 'payment_pending') {
    if (userId && deal.buyer_id === userId) return 'continue_checkout';
    if (!deal.buyer_id || !deal.payment_slip_file_id) return 'can_buy';
    return 'unavailable';
  }
  return 'unavailable';
}

/** ผู้ขายจัดส่งตรงถึงผู้ซื้อ (ไม่ผ่านคนกลาง) — ตลาด / ประมูลจากร้าน / simple */
export function isDirectShipOrder(deal: MarketplaceOrderInput & { deal_type?: string | null }): boolean {
  return isListingStoreOrder(deal) || deal.deal_type === 'simple';
}

export function marketplaceShippingCost(deal: { shipping_cost?: number | null }): number {
  return Math.max(0, Math.round(Number(deal.shipping_cost) || 0));
}

/** ยอดที่ผู้ซื้อตลาดต้องโอน = ราคาสินค้า (รวม GP แล้ว) + ค่าขนส่ง */
export function marketplaceBuyerPayAmount(deal: { price?: number | null; shipping_cost?: number | null }): number {
  return Math.max(0, Math.round(Number(deal.price) || 0)) + marketplaceShippingCost(deal);
}

/** สถานะที่ถือว่ามีคำสั่งซื้อตลาด (ผู้ซื้อ) ยังไม่จบ */
export const MARKETPLACE_ORDER_ACTIVE_STATUSES = [
  'posted', 'payment_pending', 'payment_uploaded', 'packing', 'shipped_to_buyer', 'delivered',
] as const;

export function isActiveMarketplaceBuyerOrder(deal: MarketplaceDealState): boolean {
  if (!isListingCheckoutOrder(deal) || !deal.buyer_id) return false;
  const s = String(deal.status || '');
  if (['cancelled', 'disputed', 'completed'].includes(s)) return false;
  return (MARKETPLACE_ORDER_ACTIVE_STATUSES as readonly string[]).includes(s);
}

export type MarketplaceCheckoutPhase = 'address' | 'payment' | 'status';

/** ขั้นหน้า checkout ตลาด (Shopee-style) */
export function marketplaceCheckoutPhase(
  deal: MarketplaceDealState,
  shippingConfirmed: boolean,
): MarketplaceCheckoutPhase {
  const s = String(deal.status || '');
  if (isMarketplaceCheckoutActive(deal) && !shippingConfirmed) return 'address';
  if (isMarketplaceCheckoutActive(deal) && shippingConfirmed) return 'payment';
  if (['payment_uploaded', 'packing', 'shipped_to_buyer', 'delivered', 'completed', 'cancelled', 'disputed'].includes(s)) {
    return 'status';
  }
  return shippingConfirmed ? 'payment' : 'address';
}

export function marketplaceCheckoutStepIndex(phase: MarketplaceCheckoutPhase): number {
  if (phase === 'address') return 1;
  if (phase === 'payment') return 2;
  return 3;
}

export function marketplaceOrderStatusLabel(status: string): string {
  const map: Record<string, string> = {
    posted: 'รอโอนเงิน',
    payment_pending: 'รอโอนเงิน',
    payment_uploaded: 'รอตรวจสลิป',
    packing: 'กำลังแพ็ค',
    shipped_to_buyer: 'จัดส่งแล้ว',
    delivered: 'รอยืนยันรับ',
    completed: 'สำเร็จ',
    cancelled: 'ยกเลิก',
    disputed: 'มีปัญหา',
  };
  return map[status] || status;
}

/** สถานะสินค้าฝั่งบอร์ดผู้ขาย (ตลาด/ประมูล) */
export function sellerListingStatusLabel(deal: MarketplaceDealState): string {
  const s = String(deal.status || '');
  if (s === 'posted' && !deal.buyer_id) return 'รอขาย';
  if ((s === 'posted' || s === 'payment_pending') && deal.buyer_id && !deal.payment_slip_file_id) {
    return 'กำลังตรวจสอบ';
  }
  if (s === 'payment_uploaded') return 'กำลังตรวจสอบ';
  if (s === 'packing') return 'กำลังแพ็ค';
  if (s === 'shipped_to_buyer' || s === 'delivered') return 'จัดส่งแล้ว';
  if (s === 'completed') return 'ขายแล้ว';
  if (s === 'cancelled') return 'ยกเลิก';
  if (s === 'disputed') return 'มีปัญหา';
  if (s === 'buyer_joined' || s === 'terms_pending') return 'กำลังตรวจสอบ';
  return marketplaceOrderStatusLabel(s);
}

export function sellerListingStatusClass(deal: MarketplaceDealState): string {
  const label = sellerListingStatusLabel(deal);
  if (label === 'รอขาย') return 'sb-blue';
  if (label === 'กำลังตรวจสอบ') return 'sb-amber';
  if (label === 'กำลังแพ็ค') return 'sb-purple';
  if (label === 'จัดส่งแล้ว') return 'sb-teal';
  if (label === 'ขายแล้ว') return 'sb-green';
  if (label === 'ยกเลิก') return 'sb-gray';
  if (label === 'มีปัญหา') return 'sb-red';
  return 'sb-gray';
}

/** สินค้าที่แสดงเป็นขายแล้วบนหน้าร้านสาธารณะ (ไม่โชว์สถานะดำเนินงาน) */
export const PUBLIC_SHOP_SOLD_STATUSES = [
  'payment_uploaded', 'packing', 'shipped_to_buyer', 'delivered', 'completed',
] as const;

export function isPublicShopSold(deal: { status?: string | null }): boolean {
  return (PUBLIC_SHOP_SOLD_STATUSES as readonly string[]).includes(String(deal.status || ''));
}
