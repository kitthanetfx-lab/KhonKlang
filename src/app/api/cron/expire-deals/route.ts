import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseServer';
import { isListingStoreOrder } from '@/lib/marketplaceOrder';
import { deleteDealById } from '../../_lib/deleteDeal';

/** ลบดีลส่วนตัวที่อีกฝ่ายยังไม่เข้าร่วมเกิน 2 วัน — ยกเว้นตลาดและประมูล */
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
    const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const { data: stale, error } = await db
      .from('deals')
      .select('id, deal_number, status, created_at, source, deal_type')
      .in('status', ['posted', 'waiting_seller', 'waiting_buyer'])
      .neq('source', 'listing')
      .lt('created_at', cutoff)
      .limit(200);
    if (error) throw new Error(error.message);

    const candidates = (stale || []).filter(row =>
      row.deal_type !== 'auction' && !isListingStoreOrder(row),
    );
    const skipped = (stale?.length || 0) - candidates.length;

    const deleted: string[] = [];
    const failed: { id: string; error: string }[] = [];
    for (const row of candidates) {
      try {
        const ok = await deleteDealById(db, row.id);
        if (ok) deleted.push(row.id);
      } catch (err: unknown) {
        failed.push({ id: row.id, error: String(err) });
      }
    }

    return NextResponse.json({
      ok: true,
      cutoff,
      scanned: stale?.length || 0,
      skipped,
      deleted: deleted.length,
      deletedIds: deleted,
      failed,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
