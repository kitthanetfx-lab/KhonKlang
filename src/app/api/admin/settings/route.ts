import { NextRequest, NextResponse } from 'next/server';
import { Databases } from 'node-appwrite';
import { verifyAdmin, getAdminClient } from '../../admin/_lib';
import { readJsonConfig, writeJsonConfig } from '../../_lib/appConfig';

const DOC = 'fees';

// ค่าธรรมเนียม/ค่าบริการแบบตัวเลข (แอดมินปรับได้ในหน้าตั้งค่า)
const NUM_DEFAULTS = {
  escrowFeePercent: 2.5,    // ซื้อขายผ่านกลาง (ออนไลน์) — ค่าธรรมเนียมระบบ % ของราคา
  escrowFeeMin: 20,         // ขั้นต่ำ (บาท)
  middlemanFeePercent: 1.5, // ค่าบริการคนกลาง — % ของราคา
  middlemanFeeMin: 30,      // ค่าบริการคนกลางขั้นต่ำ (บาท)
  platformCutPercent: 20,   // ส่วนแบ่งแพลตฟอร์มจากค่าบริการคนกลาง (%)
  simpleFeePercent: 2,      // ซื้อขายผ่านกลางแบบง่าย (ส่งตรง) — %
  simpleFeeMin: 20,
  inspectionFee: 100,       // ค่าตรวจสอบสินค้า (บาท)
  packingFee: 50,           // ค่าแพ็คสินค้า (บาท)
  depositBronze: 1000,      // เครดิตประกันคนกลางตามเทียร์ (บาท)
  depositSilver: 5000,
  depositGold: 20000,
  depositPlatinum: 50000,
  failedDealFee: 50,        // ค่าจัดการเมื่อดีลไม่สำเร็จ/ตีกลับ (บาท)
  onsiteBaseFee: 300,       // ค่าบริการนัดออนไซต์ ฐาน (บาท)
  onsitePerKm: 5,           // ค่าเดินทางออนไซต์ (บาท/กม.)
  meetupFeePercent: 0,      // รับประกันเดินทาง — %
  meetupFeeMin: 50,         // ค่าบริการรับประกันเดินทางขั้นต่ำ (บาท)
  sellerRegFee: 0,          // ค่าสมัครผู้ขาย (บาท)
  middlemanRegFee: 0,       // ค่าสมัครคนกลาง (บาท)
};
// ค่าตั้งแบบตัวเลือก (string)
const STR_DEFAULTS = {
  returnShippingBy: 'buyer' as 'buyer' | 'seller' | 'split', // ผู้รับผิดชอบค่าส่งคืนเมื่อตีกลับ
};
// บัญชีรับเงินของบริษัท (free text) — ลูกค้าโอนเข้าตรงนี้
const COMPANY_DEFAULTS = {
  companyPromptPay: '', companyBankName: '', companyBankAcct: '', companyBankHolder: '', companyQrFileId: '',
};
const DEFAULTS = { ...NUM_DEFAULTS, ...STR_DEFAULTS, ...COMPANY_DEFAULTS };
type FeeConfig = typeof DEFAULTS;
const NUM_KEYS = Object.keys(NUM_DEFAULTS) as (keyof typeof NUM_DEFAULTS)[];
const COMPANY_KEYS = Object.keys(COMPANY_DEFAULTS) as (keyof typeof COMPANY_DEFAULTS)[];
const RETURN_OPTIONS = ['buyer', 'seller', 'split'];

async function readConfig(db: Databases): Promise<FeeConfig> {
  return readJsonConfig(db, DOC, DEFAULTS);
}

export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = new Databases(getAdminClient());
    const fees = await readConfig(db);
    return NextResponse.json({ fees });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message ?? 'error' }, { status: e.status ?? 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = new Databases(getAdminClient());
    const body = await req.json();
    const currentFees = await readConfig(db);
    const feeBody = body?.fees ?? body;
    const hasFeePayload = feeBody && typeof feeBody === 'object' && NUM_KEYS.some(key => key in feeBody);

    // sanitize: เก็บเฉพาะ key ที่รู้จัก ตัวเลข >= 0 และตัวเลือกที่ถูกต้อง
    const cleanFees: Record<string, number | string> = {};
    for (const k of NUM_KEYS) {
      const v = Number(feeBody?.[k]);
      cleanFees[k] = (isFinite(v) && v >= 0) ? v : NUM_DEFAULTS[k];
    }
    cleanFees.returnShippingBy = RETURN_OPTIONS.includes(feeBody?.returnShippingBy) ? feeBody.returnShippingBy : STR_DEFAULTS.returnShippingBy;
    for (const k of COMPANY_KEYS) cleanFees[k] = String(feeBody?.[k] ?? '').slice(0, 200);

    const nextFees = hasFeePayload ? { ...currentFees, ...cleanFees } : currentFees;

    if (hasFeePayload) await writeJsonConfig(db, DOC, nextFees);

    return NextResponse.json({ fees: nextFees, ok: true });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message ?? 'error' }, { status: e.status ?? 500 });
  }
}
