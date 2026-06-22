import { NextRequest, NextResponse } from 'next/server';
import { verifyUser, getAdminClient, HttpError } from '@/lib/supabaseServer';
import { syncMiddlemanDepositLedger, getConfirmedDepositTotal, readFeesConfig } from '../../_lib/financeLedger';
import { getTierCreditLimit } from '@/lib/financeLedger';

/** GET — ดูประวัติการโอนเงินค้ำประกันของตัวเอง + ยอดที่ยืนยันแล้ว/ยอดที่ tier ตัวเองต้องค้ำ */
export async function GET(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const db = getAdminClient();

    const { data: profile } = await db.from('profiles').select('middleman_status, middleman_tier, middleman_tier_intent').eq('id', me.id).maybeSingle();
    if (!profile || profile.middleman_status !== 'approved') {
      return NextResponse.json({ error: 'เฉพาะคนกลางที่ได้รับอนุมัติแล้วเท่านั้น' }, { status: 403 });
    }

    const [{ data: deposits }, confirmedTotal, fees] = await Promise.all([
      db.from('middleman_deposits').select('*').eq('middleman_id', me.id).order('created_at', { ascending: false }).limit(100),
      getConfirmedDepositTotal(db, me.id),
      readFeesConfig(db),
    ]);

    const tier = profile.middleman_tier || profile.middleman_tier_intent || 'Bronze';
    const tierTarget = getTierCreditLimit(fees, tier);

    return NextResponse.json({ deposits: deposits || [], confirmedTotal, tier, tierTarget });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status });
  }
}

/** POST — แจ้งโอนเงินค้ำประกัน (รอ admin ตรวจสอบสลิปและอนุมัติก่อนถึงจะได้เครดิตจริง) */
export async function POST(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const db = getAdminClient();

    const { data: profile } = await db.from('profiles').select('middleman_status, display_name').eq('id', me.id).maybeSingle();
    if (!profile || profile.middleman_status !== 'approved') {
      return NextResponse.json({ error: 'เฉพาะคนกลางที่ได้รับอนุมัติแล้วเท่านั้น' }, { status: 403 });
    }

    const { amount, slipFileId } = await req.json();
    const amt = Math.round(Number(amount) || 0);
    if (!amt || amt <= 0) return NextResponse.json({ error: 'กรุณากรอกจำนวนเงินที่โอน' }, { status: 400 });
    if (!slipFileId) return NextResponse.json({ error: 'กรุณาอัปโหลดสลิปการโอนเงิน' }, { status: 400 });

    const { data: created, error } = await db.from('middleman_deposits').insert({
      middleman_id: me.id,
      amount: amt,
      slip_file_id: String(slipFileId).slice(0, 255),
      status: 'pending_review',
    }).select().single();
    if (error) throw new Error(error.message);

    await syncMiddlemanDepositLedger(db, created as Record<string, unknown>);

    return NextResponse.json({ success: true, deposit: created });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status });
  }
}
