import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyAdmin, getAdminClient, HttpError } from '@/lib/supabaseServer';
import { readFeesConfig } from '../../_lib/financeLedger';
import type { FeeConfig } from '@/lib/fees';

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
  sellerRegFee: 199, middlemanRegFee: 499,
  promoPercent: 0,
};
const COMPANY_DEFAULTS = {
  companyPromptPay: '', companyBankName: '', companyBankAcct: '', companyBankHolder: '', companyQrFileId: '',
  promoStart: '', promoEnd: '', promoLabel: '',
  // ลิงก์วีดีโอ (YouTube embed URL) แนะนำการใช้งานหน้าแรก — ตั้งจากหน้าควบคุมสถานะบริการ
  promoVideoUrl: '',
};
const BOOL_DEFAULTS = { promoEnabled: false, promoFree: false };
const PROMO_SCOPE_OPTIONS = ['all', 'seller', 'middleman'];
const NUM_KEYS = Object.keys(NUM_DEFAULTS) as (keyof typeof NUM_DEFAULTS)[];
const COMPANY_KEYS = Object.keys(COMPANY_DEFAULTS) as (keyof typeof COMPANY_DEFAULTS)[];
const BOOL_KEYS = Object.keys(BOOL_DEFAULTS) as (keyof typeof BOOL_DEFAULTS)[];
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
  promoEnabled: 'promo_enabled', promoScope: 'promo_scope', promoPercent: 'promo_percent', promoFree: 'promo_free',
  promoStart: 'promo_start', promoEnd: 'promo_end', promoLabel: 'promo_label',
  promoVideoUrl: 'promo_video_url',
};

type FeeConfigKey = keyof FeeConfig;

async function writeFeesConfig(db: SupabaseClient, fees: FeeConfig) {
  const row: Record<string, unknown> = { id: true };
  for (const [camel, col] of Object.entries(COLUMN_OF)) row[col] = fees[camel as FeeConfigKey];
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
    const feeBody = (body?.fees ?? body) as Record<string, unknown> | undefined;
    const hasFeePayload = !!feeBody && typeof feeBody === 'object' && (
      NUM_KEYS.some(key => key in feeBody) ||
      COMPANY_KEYS.some(key => key in feeBody) ||
      BOOL_KEYS.some(key => key in feeBody) ||
      'returnShippingBy' in feeBody ||
      'promoScope' in feeBody
    );

    // sanitize: อัปเดตเฉพาะ key ที่ส่งมาจริง — key ที่ไม่ได้ส่งต้องคงค่าเดิมไว้ ไม่ใช่รีเซ็ตเป็นค่า default
    const cleanFees: Partial<FeeConfig> = {};
    for (const k of NUM_KEYS) {
      if (!feeBody || !(k in feeBody)) continue;
      const v = Number(feeBody[k]);
      cleanFees[k] = (isFinite(v) && v >= 0) ? v : currentFees[k];
    }
    if (feeBody && 'promoPercent' in feeBody) {
      cleanFees.promoPercent = Math.min(100, Math.max(0, Number(feeBody.promoPercent) || 0));
    }
    if (feeBody && 'returnShippingBy' in feeBody) {
      cleanFees.returnShippingBy = RETURN_OPTIONS.includes(feeBody.returnShippingBy as string)
        ? (feeBody.returnShippingBy as FeeConfig['returnShippingBy']) : currentFees.returnShippingBy;
    }
    if (feeBody && 'promoScope' in feeBody) {
      cleanFees.promoScope = PROMO_SCOPE_OPTIONS.includes(feeBody.promoScope as string)
        ? (feeBody.promoScope as FeeConfig['promoScope']) : currentFees.promoScope;
    }
    for (const k of COMPANY_KEYS) {
      if (!feeBody || !(k in feeBody)) continue;
      cleanFees[k] = String(feeBody[k] ?? '').slice(0, 500);
    }
    for (const k of BOOL_KEYS) {
      if (!feeBody || !(k in feeBody)) continue;
      cleanFees[k] = !!feeBody[k];
    }

    const nextFees = hasFeePayload ? { ...currentFees, ...cleanFees } : currentFees;

    if (hasFeePayload) await writeFeesConfig(db, nextFees);

    return NextResponse.json({ fees: nextFees, ok: true });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
