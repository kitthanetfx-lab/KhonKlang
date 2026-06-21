import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser } from '@/lib/supabaseServer';
import { readServiceControlsConfig } from '../../_lib/appConfig';
import { syncMiddlemanApplicationLedger } from '../../_lib/financeLedger';

export async function GET(req: NextRequest) {
  try {
    const me = await verifyUser(req).catch(() => null);
    if (!me) return NextResponse.json({ status: null });

    const db = getAdminClient();
    const { data: docs } = await db.from('middleman_applications').select('status').eq('user_id', me.id).limit(1);
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
      fullNameId, idNumber,
      depositIntent, tier,
      categories, workProvince, terms,
      bankAcct, bankName, bankOwner,
      idCardFileId, bookbankFileId, slipFileId,
    } = body;

    if (!fullNameId || !idNumber) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    const services = await readServiceControlsConfig(db);
    if (!services.middlemanRegistration.enabled) {
      return NextResponse.json({ error: services.middlemanRegistration.note || 'การสมัครคนกลางถูกปิดชั่วคราว' }, { status: 403 });
    }

    const { data: existing } = await db.from('middleman_applications').select('id').eq('user_id', me.id).limit(1);
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'บัญชีนี้เคยยื่นสมัครคนกลางแล้ว กรุณารอผลตรวจสอบหรือดูสถานะในโปรไฟล์' }, { status: 409 });
    }

    const { data: doc, error } = await db.from('middleman_applications').insert({
      user_id: me.id,
      full_name_id: fullNameId, id_number: idNumber,
      deposit_intent: depositIntent || 0,
      tier: tier || 'Bronze',
      categories: Array.isArray(categories) ? categories : [],
      work_province: workProvince || '',
      terms: terms || '',
      bank_acct: bankAcct || '',
      bank_name: bankName || '',
      bank_owner: bankOwner || '',
      id_card_file_id: idCardFileId || '',
      bookbank_file_id: bookbankFileId || '',
      slip_file_id: slipFileId || '',
      status: 'pending_review',
    }).select().single();
    if (error) throw new Error(error.message);
    await syncMiddlemanApplicationLedger(db, doc as Record<string, unknown>);

    // Save bank info + status + tier intent to profile (visible in profile page)
    await db.from('profiles').update({
      middleman_status: 'pending_review',
      middleman_tier_intent: tier || 'Bronze',
      bank_acct: bankAcct || '',
      bank_name: bankName || '',
      bank_owner: bankOwner || '',
    }).eq('id', me.id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Middleman register error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
