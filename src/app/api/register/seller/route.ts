import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser } from '@/lib/supabaseServer';
import { readServiceControlsConfig } from '../../_lib/appConfig';
import { syncSellerApplicationLedger } from '../../_lib/financeLedger';

export async function GET(req: NextRequest) {
  try {
    const me = await verifyUser(req).catch(() => null);
    if (!me) return NextResponse.json({ status: null });

    const db = getAdminClient();
    const { data: docs } = await db.from('seller_applications').select('status').eq('user_id', me.id).limit(1);
    if (docs && docs.length > 0) {
      return NextResponse.json({ status: docs[0].status || 'pending_review' });
    }
    return NextResponse.json({ status: null });
  } catch {
    return NextResponse.json({ status: null });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const db = getAdminClient();

    const body = await req.json();
    const {
      sellerType, fullNameId, idNumber,
      province, address, onlineLink,
      companyName, companyRegNum,
      bankAcct, bankName, bankOwner,
      companyBankAcct, companyBankName,
      idCardFileId, companyCertFileId, bookbankFileId, slipFileId,
      shopName, shopTagline, shopAvatarFileId,
    } = body;

    if (!sellerType || !fullNameId || !idNumber) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    const services = await readServiceControlsConfig(db);
    if (!services.sellerRegistration.enabled) {
      return NextResponse.json({ error: services.sellerRegistration.note || 'การสมัครผู้ขายถูกปิดชั่วคราว' }, { status: 403 });
    }

    const { data: existing } = await db.from('seller_applications').select('id').eq('user_id', me.id).limit(1);
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'บัญชีนี้เคยยื่นสมัครผู้ขายแล้ว กรุณารอผลตรวจสอบหรือดูสถานะในโปรไฟล์' }, { status: 409 });
    }

    const { data: doc, error } = await db.from('seller_applications').insert({
      user_id: me.id,
      seller_type: sellerType, full_name_id: fullNameId, id_number: idNumber,
      province: province || '',
      address: address || '',
      online_link: onlineLink || '',
      company_name: companyName || '',
      company_reg_num: companyRegNum || '',
      bank_acct: bankAcct || '',
      bank_name: bankName || '',
      bank_owner: bankOwner || '',
      company_bank_acct: companyBankAcct || '',
      company_bank_name: companyBankName || '',
      id_card_file_id: idCardFileId || '',
      company_cert_file_id: companyCertFileId || '',
      bookbank_file_id: bookbankFileId || '',
      slip_file_id: slipFileId || '',
      status: 'pending_review',
      reject_reason: '',
    }).select().single();
    if (error) throw new Error(error.message);
    await syncSellerApplicationLedger(db, doc as Record<string, unknown>);

    // Save bank info + status + ข้อมูลร้านเบื้องต้น to profile
    const profileUpdate: Record<string, unknown> = {
      seller_status: 'pending_review',
      bank_acct: bankAcct || '',
      bank_name: bankName || '',
      bank_owner: bankOwner || '',
    };
    if (shopName != null && String(shopName).trim()) profileUpdate.shop_name = String(shopName).trim().slice(0, 120);
    if (shopTagline != null && String(shopTagline).trim()) profileUpdate.shop_tagline = String(shopTagline).trim().slice(0, 200);
    if (shopAvatarFileId) profileUpdate.shop_avatar_file_id = String(shopAvatarFileId).trim();
    await db.from('profiles').update(profileUpdate).eq('id', me.id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Seller register error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
