import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyAdmin, getAdminClient, HttpError } from '@/lib/supabaseServer';
import { readFeesConfig } from '../../_lib/financeLedger';

// ค่าธรรมเนียม/ค่าบริการแบบตัวเลข (แอดมินปรับได้ในหน้าตั้งค่า)
const NUM_DEFAULTS = {
  escrowFeePercent: 2.5, escrowFeeMin: 20,
  middlemanFeePercent: 1.5, middlemanFeeMin: 30,
  platformCutPercent: 20,
  simpleFeePercent: 2, simpleFeeMin: 20,
  inspectionFee: 100, packingFee: 50,
  depositBronze: 1000, depositSilver: 5000, depositGold: 20000, depositPlatinum: 50000,
  failedDealFee: 50,
  onsiteBaseFee: 300, onsitePerKm: 5,
  meetupFeePercent: 0, meetupFeeMin: 50,
  sellerRegFee: 0, middlemanRegFee: 0,
};
const STR_DEFAULTS = { returnShippingBy: 'buyer' as 'buyer' | 'seller' | 'split' };
const COMPANY_DEFAULTS = {
  companyPromptPay: '', companyBankName: '', companyBankAcct: '', companyBankHolder: '', companyQrFileId: '',
};
const NUM_KEYS = Object.keys(NUM_DEFAULTS) as (keyof typeof NUM_DEFAULTS)[];
const COMPANY_KEYS = Object.keys(COMPANY_DEFAULTS) as (keyof typeof COMPANY_DEFAULTS)[];
const RETURN_OPTIONS = ['buyer', 'seller', 'split'];

const COLUMN_OF: Record<string, string> = {
  escrowFeePercent: 'escrow_fee_percent', escrowFeeMin: 'escrow_fee_min',
  middlemanFeePercent: 'middleman_fee_percent', middlemanFeeMin: 'middleman_fee_min',
  platformCutPercent: 'platform_cut_percent',
  simpleFeePercent: 'simple_fee_percent', simpleFeeMin: 'simple_fee_min',
  inspectionFee: 'inspection_fee', packingFee: 'packing_fee',
  depositBronze: 'deposit_bronze', depositSilver: 'deposit_silver', depositGold: 'deposit_gold', depositPlatinum: 'deposit_platinum',
  failedDealFee: 'failed_deal_fee',
  onsiteBaseFee: 'onsite_base_fee', onsitePerKm: 'onsite_per_km',
  meetupFeePercent: 'meetup_fee_percent', meetupFeeMin: 'meetup_fee_min',
  sellerRegFee: 'seller_reg_fee', middlemanRegFee: 'middleman_reg_fee',
  returnShippingBy: 'return_shipping_by',
  companyPromptPay: 'company_prompt_pay', companyBankName: 'company_bank_name',
  companyBankAcct: 'company_bank_acct', companyBankHolder: 'company_bank_holder', companyQrFileId: 'company_qr_file_id',
};

async function writeFeesConfig(db: SupabaseClient, fees: Record<string, number | string>) {
  const row: Record<string, unknown> = { id: true };
  for (const [camel, col] of Object.entries(COLUMN_OF)) row[col] = fees[camel];
  const { error } = await db.from('fee_config').upsert(row, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const fees = await readFeesConfig(db);
    return NextResponse.json({ fees });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const body = await req.json();
    const currentFees = await readFeesConfig(db);
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

    if (hasFeePayload) await writeFeesConfig(db, nextFees as Record<string, number | string>);

    return NextResponse.json({ fees: nextFees, ok: true });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
