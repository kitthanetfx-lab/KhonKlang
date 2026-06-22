// ค่าธรรมเนียม/ค่าบริการของแพลตฟอร์ม — แหล่งข้อมูลกลาง ใช้ได้ทั้ง client และ server
// ค่าเริ่มต้น (ถ้าแอดมินยังไม่ตั้งใน /admin/settings) — ต้องตรงกับ /api/admin/settings

export interface FeeConfig {
  escrowFeePercent: number; escrowFeeMin: number;
  middlemanFeePercent: number; middlemanFeeMin: number; platformCutPercent: number;
  simpleFeePercent: number; simpleFeeMin: number;
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
}

export const FEE_DEFAULTS: FeeConfig = {
  escrowFeePercent: 2.5, escrowFeeMin: 20,
  middlemanFeePercent: 1.5, middlemanFeeMin: 30, platformCutPercent: 20,
  simpleFeePercent: 2, simpleFeeMin: 20,
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
};

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

/** คำนวณค่าบริการของดีลตามประเภท เพื่อแสดงให้ผู้ใช้รับรู้ตั้งแต่ต้น */
export function computeDealFees(c: FeeConfig, price: number, dealType?: string): FeeBreakdown {
  const p = Number(price) || 0;
  const lines: FeeLine[] = [];
  if (dealType === 'simple') {
    lines.push({ label: 'ค่าธรรมเนียมระบบ', amount: pct(p, c.simpleFeePercent, c.simpleFeeMin) });
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
