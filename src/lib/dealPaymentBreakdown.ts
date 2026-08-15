import { computeDealFees, type FeeConfig, type FeeLine } from './fees';
import { splitFeeByPayer } from './financeLedger';
import { isListingCheckoutOrder, marketplaceBuyerPayAmount, marketplaceShippingCost } from './marketplaceOrder';

export const FEE_PAYER_LABEL: Record<'buyer' | 'seller' | 'split', string> = {
  buyer: 'ผู้ซื้อจ่าย',
  seller: 'ผู้ขายจ่าย',
  split: 'หารครึ่ง',
};

export type DealPaymentBreakdown = {
  productPrice: number;
  shippingCost: number;
  serviceFeeTotal: number;
  serviceFeeLines: FeeLine[];
  feePayer: 'buyer' | 'seller' | 'split';
  feePayerLabel: string;
  buyerServiceShare: number;
  sellerServiceShare: number;
  /** ยอดที่ผู้ซื้อต้องโอนเข้าศูนย์กลาง (สินค้า + ขนส่ง + ค่าบริการส่วนผู้ซื้อ) */
  buyerTotalDue: number;
  /** ค่าบริการที่ผู้ขายต้องโอนแยก (ถ้ามี) */
  sellerServiceDue: number;
  /** ยอดสินค้าที่ผู้ขายได้รับเมื่อดีลสำเร็จ */
  sellerNetOnSuccess: number;
  isMarketplace: boolean;
};

export function dealShippingCost(deal: { shipping_cost?: number | null }): number {
  return Math.max(0, Math.round(Number(deal.shipping_cost) || 0));
}

type DealPaymentInput = {
  price?: number | null;
  shipping_cost?: number | null;
  deal_type?: string | null;
  source?: string | null;
  buyer_id?: string | null;
  fee_payer?: string | null;
};

type PriceStateInput = {
  proposed_fee_payer?: string | null;
} | null | undefined;

/** คำนวณยอดชำระแยกรายการ — ใช้ร่วม UI, ตรวจสลิป และ ledger */
export function computeDealPaymentBreakdown(
  deal: DealPaymentInput,
  priceState: PriceStateInput,
  fees: FeeConfig,
): DealPaymentBreakdown | null {
  if (deal.deal_type === 'meetup') return null;

  if (isListingCheckoutOrder(deal)) {
    const productPrice = Math.max(0, Math.round(Number(deal.price) || 0));
    const shippingCost = marketplaceShippingCost(deal);
    return {
      productPrice,
      shippingCost,
      serviceFeeTotal: 0,
      serviceFeeLines: [],
      feePayer: 'buyer',
      feePayerLabel: '—',
      buyerServiceShare: 0,
      sellerServiceShare: 0,
      buyerTotalDue: marketplaceBuyerPayAmount(deal),
      sellerServiceDue: 0,
      sellerNetOnSuccess: productPrice,
      isMarketplace: true,
    };
  }

  const productPrice = Math.max(0, Math.round(Number(deal.price) || 0));
  const shippingCost = dealShippingCost(deal);
  const fb = computeDealFees(fees, productPrice, String(deal.deal_type || ''));
  const split = splitFeeByPayer(fb.total, String(priceState?.proposed_fee_payer || deal.fee_payer || 'split'));

  return {
    productPrice,
    shippingCost,
    serviceFeeTotal: fb.total,
    serviceFeeLines: fb.lines,
    feePayer: split.feePayer,
    feePayerLabel: FEE_PAYER_LABEL[split.feePayer],
    buyerServiceShare: split.buyerShare,
    sellerServiceShare: split.sellerShare,
    buyerTotalDue: productPrice + shippingCost + split.buyerShare,
    sellerServiceDue: split.sellerShare,
    sellerNetOnSuccess: productPrice,
    isMarketplace: false,
  };
}

/** ยอดผู้ซื้อต้องโอน — shorthand สำหรับตรวจสลิป */
export function dealBuyerPayAmount(
  deal: DealPaymentInput,
  priceState: PriceStateInput,
  fees: FeeConfig,
): number {
  return computeDealPaymentBreakdown(deal, priceState, fees)?.buyerTotalDue ?? Math.max(0, Math.round(Number(deal.price) || 0));
}

/** ยอดผู้ขายต้องโอนค่าบริการ — shorthand สำหรับตรวจสลิป */
export function dealSellerServiceDue(
  deal: DealPaymentInput,
  priceState: PriceStateInput,
  fees: FeeConfig,
): number {
  return computeDealPaymentBreakdown(deal, priceState, fees)?.sellerServiceDue ?? 0;
}

const baht = (amount: number) => `฿${Math.round(amount).toLocaleString('th-TH')}`;

/** ข้อความสรุปยอดชำระสำหรับ LINE / แจ้งเตือน */
export function formatDealPaymentBreakdownLines(
  bd: DealPaymentBreakdown,
  opts?: { highlightSide?: 'buyer' | 'seller' },
): string[] {
  const lines: string[] = ['--- สรุปยอดชำระ ---'];
  lines.push(`ค่าสินค้า: ${baht(bd.productPrice)}`);
  lines.push(`ค่าขนส่ง: ${baht(bd.shippingCost)}`);

  if (!bd.isMarketplace) {
    lines.push(`ค่าบริการ (รวม): ${baht(bd.serviceFeeTotal)}`);
    for (const line of bd.serviceFeeLines) {
      lines.push(`  ↳ ${line.label}: ${baht(line.amount)}`);
    }
    lines.push(`ผู้จ่ายค่าบริการ: ${bd.feePayerLabel}`);
    lines.push(`  ↳ ส่วนผู้ซื้อ: ${baht(bd.buyerServiceShare)}`);
    lines.push(`  ↳ ส่วนผู้ขาย: ${baht(bd.sellerServiceShare)}`);
  }

  lines.push('--- ยอดที่ต้องโอน ---');
  const buyerMark = opts?.highlightSide === 'buyer' ? '▶ ' : '';
  lines.push(`${buyerMark}ผู้ซื้อ → ศูนย์กลาง: ${baht(bd.buyerTotalDue)}`);
  if (!bd.isMarketplace && bd.sellerServiceDue > 0) {
    const sellerMark = opts?.highlightSide === 'seller' ? '▶ ' : '';
    lines.push(`${sellerMark}ผู้ขาย → ค่าบริการ: ${baht(bd.sellerServiceDue)}`);
  }
  if (!bd.isMarketplace) {
    lines.push(`ผู้ขายได้รับสุทธิ: ${baht(bd.sellerNetOnSuccess)}`);
  }

  return lines;
}
