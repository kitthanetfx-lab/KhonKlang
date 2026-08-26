import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseServer';
import { syncExpiredAuctions } from '../../_lib/auctionSync';

/** ปิด/ต่อเวลาประมูลที่หมดเวลา — Vercel Hobby ใช้ cron ได้วันละครั้ง (สำรอง; หน้ารายการก็ sync อยู่แล้ว) */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const auth = req.headers.get('authorization') || '';
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getAdminClient();
    await syncExpiredAuctions(db, 50);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
