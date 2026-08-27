// ค่าธรรมเนียม/ค่าบริการของแพลตฟอร์ม — แหล่งข้อมูลกลาง ใช้ได้ทั้ง client และ server
// ค่าเริ่มต้น (ถ้าแอดมินยังไม่ตั้งใน /admin/settings) — ต้องตรงกับ /api/admin/settings

export interface FeeConfig {
  escrowFeePercent: number; escrowFeeMin: number;
  middlemanFeePercent: number; middlemanFeeMin: number; platformCutPercent: number;
  simpleFeePercent: number; simpleFeeMin: number;
  /** ขั้นต่ำค่าธรรมเนียมดีลแบบง่าย เมื่อราคาสินค้าต่ำกว่า ฿1,000 */
  simpleFeeMinUnder1000: number;
  /** @deprecated ใช้ simpleShareTier* แทน — เก็บไว้ backward compat */
  simpleMiddlemanSharePercent: number;
  simpleShareTier1Multiplier: number; simpleShareTier1Percent: number;
  simpleShareTier2Multiplier: number; simpleShareTier2Percent: number;
  simpleShareTier3Multiplier: number; simpleShareTier3Percent: number;
  inspectionFee: number; packingFee: number;
  depositBronze: number; depositSilver: number; depositGold: number; depositPlatinum: number;
  failedDealFee: number;
  onsiteBaseFee: number; onsitePerKm: number;
  meetupFeePercent: number; meetupFeeMin: number;
  sellerRegFee: number; middlemanRegFee: number;
  returnShippingBy: 'buyer' | 'seller' | 'split';
  // บัญชีรับเงินของบริษัท (ลูกค้าโอนเข้าตรงนี้)
  companyPromptPay: string; companyBankName: string; companyBankAcct: string; companyBankHolder: string; companyQrFileId: string;
  // โปรโมชัน/ส่วนลดค่าสมัคร (ผู้ขาย/คนกลาง) ตามช่วงเวลาที่กำหนด
  promoEnabled: boolean; promoScope: 'all' | 'seller' | 'middleman';
  promoPercent: number; promoFree: boolean;
  promoStart: string; promoEnd: string; promoLabel: string;
  // ลิงก์วีดีโอ (YouTube embed URL) แนะนำการใช้งานที่แสดงในหน้าแรก — ตั้งได้จากหน้าควบคุมสถานะบริการ
  promoVideoUrl: string;
  /** GP% บวกเข้าราคาที่ผู้ขายตั้ง — ราคาที่แสดงในตลาด = ราคาผู้ขาย + GP */
  marketplaceGpPercent: number;
  /** % ของ GP ที่คืนให้ผู้ขาย (ส่วนที่เหลือเป็นของแพลตฟอร์ม) */
  marketplaceGpCommissionPercent: number;
  /** GP% หักจากราคาประมูลสุดท้าย (ผู้ชนะจ่ายเต็มจำนวน bid) */
  auctionGpPercent: number;
  /** % ของ GP ประมูลที่คืนให้ผู้ขาย */
  auctionGpCommissionPercent: number;
}

export const FEE_DEFAULTS: FeeConfig = {
  escrowFeePercent: 2.5, escrowFeeMin: 20,
  middlemanFeePercent: 1.5, middlemanFeeMin: 30, platformCutPercent: 20,
  simpleFeePercent: 2, simpleFeeMin: 20, simpleFeeMinUnder1000: 20, simpleMiddlemanSharePercent: 18,
  simpleShareTier1Multiplier: 1, simpleShareTier1Percent: 30,
  simpleShareTier2Multiplier: 2, simpleShareTier2Percent: 40,
  simpleShareTier3Multiplier: 4, simpleShareTier3Percent: 50,
  inspectionFee: 100, packingFee: 50,
  depositBronze: 1000, depositSilver: 5000, depositGold: 20000, depositPlatinum: 50000,
  failedDealFee: 50,
  onsiteBaseFee: 300, onsitePerKm: 5,
  meetupFeePercent: 0, meetupFeeMin: 50,
  sellerRegFee: 199, middlemanRegFee: 499,
  returnShippingBy: 'buyer',
  companyPromptPay: '', companyBankName: '', companyBankAcct: '', companyBankHolder: '', companyQrFileId: '',
  promoEnabled: false, promoScope: 'all',
  promoPercent: 0, promoFree: false,
  promoStart: '', promoEnd: '', promoLabel: '',
  promoVideoUrl: '',
  marketplaceGpPercent: 20, marketplaceGpCommissionPercent: 30,
  auctionGpPercent: 20, auctionGpCommissionPercent: 30,
};

export interface MarketplaceGpBreakdown {
  /** ราคาที่ผู้ขายตั้ง (ราคาฐาน) */
  sellerPrice: number;
  gpPercent: number;
  /** จำนวน GP ที่บวกเข้า (เช่น 20% ของ 100 = 20) */
  gpAmount: number;
  /** ราคาที่ผู้บริโภคเห็นในตลาด = sellerPrice + gpAmount */
  displayPrice: number;
  commissionPercent: number;
  /** คอมมิชชั่นคืนผู้ขาย (% ของ GP) */
  sellerCommission: number;
  /** รายได้ผู้ขายเมื่อขายได้ = sellerPrice + sellerCommission */
  sellerReceive: number;
  /** ส่วนที่แพลตฟอร์มได้ = gpAmount − sellerCommission */
  platformKeep: number;
}

/** คำนวณ GP ตลาดขาย — บวก GP เข้าราคาผู้ขาย แล้วแบ่ง GP ให้ผู้ขาย/แพลตฟอร์ม */
export function computeMarketplaceGp(config: FeeConfig, sellerPrice: number): MarketplaceGpBreakdown {
  const base = Math.max(0, Math.round(Number(sellerPrice) || 0));
  const gpPercent = Math.min(100, Math.max(0, Number(config.marketplaceGpPercent) || 0));
  const commissionPercent = Math.min(100, Math.max(0, Number(config.marketplaceGpCommissionPercent) || 0));
  const gpAmount = Math.round(base * gpPercent / 100);
  const displayPrice = base + gpAmount;
  const sellerCommission = Math.round(gpAmount * commissionPercent / 100);
  const platformKeep = gpAmount - sellerCommission;
  return {
    sellerPrice: base, gpPercent, gpAmount, displayPrice,
    commissionPercent, sellerCommission,
    sellerReceive: base + sellerCommission,
    platformKeep,
  };
}

export interface AuctionGpBreakdown {
  /** ราคาประมูลสุดท้าย — ผู้ชนะจ่ายเต็มจำนวน */
  finalPrice: number;
  gpPercent: number;
  /** GP ที่หักจากราคาปิด */
  gpAmount: number;
  commissionPercent: number;
  /** คืนผู้ขาย (% ของ GP) */
  sellerCommission: number;
  /** ผู้ขายได้รับจริง = finalPrice − gpAmount + sellerCommission */
  sellerReceive: number;
  platformKeep: number;
}

/** คำนวณ GP ตลาดประมูล — หักจากราคาปิดประมูล (ไม่บวกตอนเปิดประมูล) */
export function computeAuctionGp(config: FeeConfig, finalPrice: number): AuctionGpBreakdown {
  const gross = Math.max(0, Math.round(Number(finalPrice) || 0));
  const gpPercent = Math.min(100, Math.max(0, Number(config.auctionGpPercent) || 0));
  const commissionPercent = Math.min(100, Math.max(0, Number(config.auctionGpCommissionPercent) || 0));
  const gpAmount = Math.round(gross * gpPercent / 100);
  const sellerCommission = Math.round(gpAmount * commissionPercent / 100);
  const platformKeep = gpAmount - sellerCommission;
  const sellerReceive = gross - gpAmount + sellerCommission;
  return {
    finalPrice: gross, gpPercent, gpAmount, commissionPercent,
    sellerCommission, sellerReceive, platformKeep,
  };
}

/** โปรโมชันค่าสมัครกำลังใช้งานอยู่กับ scope นี้ไหม (เช็คทั้ง toggle + ขอบเขต + ช่วงวันที่) */
export function isPromoActive(c: FeeConfig, scope: 'seller' | 'middleman'): boolean {
  if (!c.promoEnabled) return false;
  if (c.promoScope !== 'all' && c.promoScope !== scope) return false;
  const now = Date.now();
  if (c.promoStart) {
    const t = new Date(c.promoStart).getTime();
    if (isFinite(t) && now < t) return false;
  }
  if (c.promoEnd) {
    const t = new Date(c.promoEnd).getTime();
    if (isFinite(t) && now > t) return false;
  }
  return true;
}

/** ค่าสมัคร "จริง" หลังหักโปรโมชัน (ถ้ามี) — ใช้ทั้งฝั่งแสดงผลและฝั่งบันทึกบัญชี */
export function effectiveRegFee(c: FeeConfig, scope: 'seller' | 'middleman'): number {
  const base = scope === 'seller' ? c.sellerRegFee : c.middlemanRegFee;
  if (!isPromoActive(c, scope)) return Math.max(0, Math.round(base));
  if (c.promoFree) return 0;
  const pct = Math.min(100, Math.max(0, Number(c.promoPercent) || 0));
  return Math.max(0, Math.round(base * (1 - pct / 100)));
}

export interface FeeLine { label: string; amount: number; }
export interface FeeBreakdown { lines: FeeLine[]; total: number; note?: string; }

const pct = (price: number, percent: number, min: number) => Math.max(Math.round((price * percent) / 100), Math.round(min));

export const SIMPLE_LOW_PRICE_THRESHOLD = 1000;

/** ขั้นต่ำค่าธรรมเนียมดีลแบบง่ายตามราคาสินค้า */
export function simpleFeeMinForPrice(c: FeeConfig, price: number): number {
  const p = Number(price) || 0;
  if (p > 0 && p < SIMPLE_LOW_PRICE_THRESHOLD) {
    const low = Math.round(Number(c.simpleFeeMinUnder1000) || 0);
    return low > 0 ? low : Math.round(Number(c.simpleFeeMin) || 0);
  }
  return Math.round(Number(c.simpleFeeMin) || 0);
}

/** คำนวณค่าบริการของดีลตามประเภท เพื่อแสดงให้ผู้ใช้รับรู้ตั้งแต่ต้น */
export function computeDealFees(c: FeeConfig, price: number, dealType?: string): FeeBreakdown {
  const p = Number(price) || 0;
  const lines: FeeLine[] = [];
  if (dealType === 'simple') {
    lines.push({ label: 'ค่าธรรมเนียมระบบ', amount: pct(p, c.simpleFeePercent, simpleFeeMinForPrice(c, p)) });
  } else if (dealType === 'meetup') {
    lines.push({ label: 'ค่าบริการรับประกันเดินทาง', amount: pct(p, c.meetupFeePercent, c.meetupFeeMin) });
  } else {
    lines.push({ label: 'ค่าธรรมเนียมระบบ (Escrow)', amount: pct(p, c.escrowFeePercent, c.escrowFeeMin) });
    lines.push({ label: 'ค่าบริการคนกลาง', amount: pct(p, c.middlemanFeePercent, c.middlemanFeeMin) });
    if (c.inspectionFee > 0) lines.push({ label: 'ค่าตรวจสอบสินค้า', amount: Math.round(c.inspectionFee) });
  }
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const note = dealType === 'meetup'
    ? 'ยังไม่รวมเงินประกันเดินทางที่วางคืนได้'
    : 'หากดีลไม่สำเร็จ/ตีกลับ อาจมีค่าจัดส่งคืนเพิ่มเติม';
  return { lines, total, note };
}

/** ผู้สร้างดีล simple (ไม่ว่าจะเป็นผู้ซื้อหรือผู้ขายในดีล) ลงทะเบียนทั้ง seller + middleman แล้วหรือยัง */
export function isSimpleShareEligible(profile?: { sellerStatus?: string; middlemanStatus?: string } | null): boolean {
  return profile?.sellerStatus === 'approved' && profile?.middlemanStatus === 'approved';
}

/** ฝ่ายของผู้สร้างดีลในดีลปัจจุบัน */
export function simpleCreatorSide(deal: { creator_id?: string | null; seller_id?: string | null; buyer_id?: string | null }): 'seller' | 'buyer' | 'unknown' {
  if (!deal.creator_id) return 'unknown';
  if (deal.creator_id === deal.seller_id) return 'seller';
  if (deal.creator_id === deal.buyer_id) return 'buyer';
  return 'unknown';
}

export const SIMPLE_CREATOR_SIDE_LABEL: Record<'seller' | 'buyer' | 'unknown', string> = {
  seller: 'ผู้ขาย (ผู้สร้างดีล)',
  buyer: 'ผู้ซื้อ (ผู้สร้างดีล)',
  unknown: 'ผู้สร้างดีล',
};

export interface SimpleShareTierResult {
  tier: number;
  multiplier: number;
  sharePercent: number;
  thresholdAmount: number;
}

/** เลือกชั้นคอมมิชชั่นดีลแบบง่าย — ค่าบริการดีลเทียบกับ (เท่า × ค่าคนกลางขั้นต่ำ) */
export function resolveSimpleShareTier(config: FeeConfig, totalFee: number): SimpleShareTierResult {
  const fee = Math.max(0, Number(totalFee) || 0);
  const baseline = Math.max(0, Number(config.middlemanFeeMin) || 0);
  const tiers = [
    { tier: 1, multiplier: Number(config.simpleShareTier1Multiplier), percent: Number(config.simpleShareTier1Percent) },
    { tier: 2, multiplier: Number(config.simpleShareTier2Multiplier), percent: Number(config.simpleShareTier2Percent) },
    { tier: 3, multiplier: Number(config.simpleShareTier3Multiplier), percent: Number(config.simpleShareTier3Percent) },
  ]
    .filter(t => t.multiplier > 0)
    .sort((a, b) => b.multiplier - a.multiplier);

  for (const t of tiers) {
    const threshold = baseline > 0 ? Math.round(t.multiplier * baseline) : 0;
    if (baseline <= 0 || fee >= threshold) {
      return {
        tier: t.tier,
        multiplier: t.multiplier,
        sharePercent: Math.min(100, Math.max(0, t.percent)),
        thresholdAmount: threshold,
      };
    }
  }
  return { tier: 0, multiplier: 0, sharePercent: 0, thresholdAmount: 0 };
}

export interface SimpleDealShareBreakdown {
  totalFee: number;
  creatorShare: number;
  platformShare: number;
  sharePercent: number;
  shareTier: number;
  shareTierMultiplier: number;
  shareThreshold: number;
  creatorEligible: boolean;
}

/** คำนวณคอมมิชชั่นดีลแบบง่าย — ผู้สร้างดีล (ผู้ซื้อหรือผู้ขาย) ที่ลงทะเบียนครบ */
export function computeSimpleDealShare(
  config: FeeConfig,
  price: number,
  creatorProfile?: { sellerStatus?: string; middlemanStatus?: string } | null,
): SimpleDealShareBreakdown {
  const totalFee = computeDealFees(config, price, 'simple').total;
  const tier = resolveSimpleShareTier(config, totalFee);
  const sharePercent = tier.sharePercent;
  const creatorEligible = isSimpleShareEligible(creatorProfile);
  const creatorShare = creatorEligible && sharePercent > 0 ? Math.round((totalFee * sharePercent) / 100) : 0;
  return {
    totalFee,
    creatorShare,
    platformShare: Math.max(totalFee - creatorShare, 0),
    sharePercent,
    shareTier: tier.tier,
    shareTierMultiplier: tier.multiplier,
    shareThreshold: tier.thresholdAmount,
    creatorEligible,
  };
}
