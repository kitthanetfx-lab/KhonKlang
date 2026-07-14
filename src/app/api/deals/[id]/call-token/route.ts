import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser } from '@/lib/supabaseServer';
import { createCallToken, livekitConfigured, LIVEKIT_NOT_READY } from '@/lib/livekit';

/**
 * GET — ออก LiveKit token สำหรับวิดีโอคอลในดีล
 * เฉพาะคู่ดีล (ผู้ขาย/ผู้ซื้อ/คนกลาง) และแอดมินเท่านั้น — คนนอกเข้าห้องไม่ได้
 * (แทนห้อง Jitsi สาธารณะแบบเดิมที่ใครรู้ dealId ก็เข้าได้)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const me = await verifyUser(req);
    if (!livekitConfigured()) return NextResponse.json({ error: LIVEKIT_NOT_READY }, { status: 503 });

    const db = getAdminClient();
    const { data: deal, error } = await db.from('deals')
      .select('id, seller_id, buyer_id, middleman_id, status').eq('id', id).single();
    if (error || !deal) return NextResponse.json({ error: 'ไม่พบดีล' }, { status: 404 });

    const isParty = [deal.seller_id, deal.buyer_id, deal.middleman_id].includes(me.id);
    let isAdmin = false;
    if (!isParty) {
      const { data: p } = await db.from('profiles').select('role').eq('id', me.id).maybeSingle();
      isAdmin = p?.role === 'admin';
    }
    if (!isParty && !isAdmin) return NextResponse.json({ error: 'เฉพาะผู้เกี่ยวข้องในดีลเท่านั้น' }, { status: 403 });

    const { data: profile } = await db.from('profiles').select('display_name').eq('id', me.id).maybeSingle();
    const { token, url } = await createCallToken({
      room: `deal-${deal.id}`,
      identity: me.id,
      name: profile?.display_name || 'ผู้ใช้',
    });
    return NextResponse.json({ token, url });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}
