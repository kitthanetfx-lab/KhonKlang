import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient, verifyUser } from '@/lib/supabaseServer';
import { syncOnsiteJobLedger, readFeesConfig } from '../../_lib/financeLedger';
import { getTierCreditLimit } from '@/lib/financeLedger';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await verifyUser(req);
    const db = getAdminClient();
    const { data: doc, error } = await db.from('onsite_jobs').select('*').eq('id', id).single();
    if (error || !doc) return NextResponse.json({ error: 'ไม่พบงาน' }, { status: 404 });
    return NextResponse.json({ job: doc });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function getDeposit(db: SupabaseClient, uid: string): Promise<number> {
  const [{ data: profile }, fees] = await Promise.all([
    db.from('profiles').select('middleman_tier_intent').eq('id', uid).maybeSingle(),
    readFeesConfig(db),
  ]);
  const tier = profile?.middleman_tier_intent || 'Bronze';
  return getTierCreditLimit(fees, tier);
}

// PATCH actions:
//   submit_quote  (middleman): open → quoted
//   accept_quote  (buyer):     quoted → accepted
//   reject_quote  (buyer):     quoted → open (resets middleman)
//   start_work    (middleman): accepted → in_progress
//   complete      (middleman): in_progress → completed
//   cancel        (buyer):     open|quoted → cancelled
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const me = await verifyUser(req);
    const body = await req.json();
    const { action } = body;

    const db = getAdminClient();
    const { data: job, error: jobErr } = await db.from('onsite_jobs').select('*').eq('id', id).single();
    if (jobErr || !job) return NextResponse.json({ error: 'ไม่พบงาน' }, { status: 404 });
    const now = new Date().toISOString();

    let update: Record<string, unknown> = {};

    if (action === 'submit_quote') {
      if (job.status !== 'open') return NextResponse.json({ error: 'งานไม่ได้อยู่สถานะ open' }, { status: 400 });
      const { travelFee, serviceFee, estimatedArrival, conditions } = body;
      const deposit = await getDeposit(db, me.id);
      const { data: profile } = await db.from('profiles').select('display_name').eq('id', me.id).maybeSingle();
      update = {
        status: 'quoted',
        middleman_id: me.id,
        middleman_name: profile?.display_name || '',
        middleman_deposit: deposit,
        travel_fee: Number(travelFee) || 0,
        service_fee: Number(serviceFee) || 0,
        estimated_arrival: estimatedArrival || '',
        conditions: conditions || '',
        quoted_at: now,
      };
    } else if (action === 'accept_quote') {
      if (job.buyer_id !== me.id) return NextResponse.json({ error: 'ไม่ใช่ผู้ว่าจ้าง' }, { status: 403 });
      if (job.status !== 'quoted') return NextResponse.json({ error: 'ยังไม่มีใบเสนอราคา' }, { status: 400 });
      update = { status: 'accepted', accepted_at: now };
    } else if (action === 'reject_quote') {
      if (job.buyer_id !== me.id) return NextResponse.json({ error: 'ไม่ใช่ผู้ว่าจ้าง' }, { status: 403 });
      update = {
        status: 'open',
        middleman_id: null, middleman_name: '', middleman_deposit: 0,
        travel_fee: 0, service_fee: 0, estimated_arrival: '', conditions: '', quoted_at: null,
      };
    } else if (action === 'start_work') {
      if (job.middleman_id !== me.id) return NextResponse.json({ error: 'ไม่ใช่คนกลางที่ได้รับงาน' }, { status: 403 });
      if (job.status !== 'accepted') return NextResponse.json({ error: 'ยังไม่ได้รับการอนุมัติ' }, { status: 400 });
      update = { status: 'in_progress', started_at: now };
    } else if (action === 'complete') {
      if (job.middleman_id !== me.id) return NextResponse.json({ error: 'ไม่ใช่คนกลางที่ได้รับงาน' }, { status: 403 });
      if (job.status !== 'in_progress') return NextResponse.json({ error: 'งานยังไม่ได้เริ่มต้น' }, { status: 400 });
      update = { status: 'completed', completed_at: now, report_notes: body.reportNotes || '' };
    } else if (action === 'cancel') {
      if (job.buyer_id !== me.id) return NextResponse.json({ error: 'ไม่ใช่ผู้ว่าจ้าง' }, { status: 403 });
      if (['completed', 'in_progress'].includes(job.status as string))
        return NextResponse.json({ error: 'ไม่สามารถยกเลิกได้ในขั้นตอนนี้' }, { status: 400 });
      update = { status: 'cancelled' };
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const { data: updated, error } = await db.from('onsite_jobs').update(update).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    await syncOnsiteJobLedger(db, updated as Record<string, unknown>);
    return NextResponse.json({ job: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
