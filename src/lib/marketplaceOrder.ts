/** ออเดอร์จากตลาดซื้อขาย (ไม่รวมประมูล / นัดรับ) */

export type MarketplaceOrderInput = {
  source?: string | null;
  deal_type?: string | null;
};

export function isMarketplaceOrder(deal: MarketplaceOrderInput): boolean {
  return deal.source === 'listing' && deal.deal_type !== 'auction' && deal.deal_type !== 'meetup';
}

/** ผู้ขายจัดส่งตรงถึงผู้ซื้อ (ไม่ผ่านคนกลาง) */
export function isDirectShipOrder(deal: MarketplaceOrderInput & { deal_type?: string | null }): boolean {
  return isMarketplaceOrder(deal) || deal.deal_type === 'simple';
}

export function marketplaceShippingCost(deal: { shipping_cost?: number | null }): number {
  return Math.max(0, Math.round(Number(deal.shipping_cost) || 0));
}
