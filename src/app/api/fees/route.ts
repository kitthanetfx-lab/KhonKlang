// GET /api/fees — อ่านค่าธรรมเนียมที่แอดมินตั้งไว้ (สาธารณะ อ่านอย่างเดียว)
// ใช้แสดงให้ผู้บริโภครับรู้ค่าบริการตั้งแต่ต้น
import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseServer';
import { readFeesConfig } from '../_lib/financeLedger';

export async function GET() {
  try {
    const db = getAdminClient();
    const fees = await readFeesConfig(db);
    return NextResponse.json({ fees });
  } catch {
    const { FEE_DEFAULTS } = await import('@/lib/fees');
    return NextResponse.json({ fees: FEE_DEFAULTS });
  }
}
