import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser } from '@/lib/supabaseServer';
import { createCallToken, livekitConfigured, LIVEKIT_NOT_READY } from '@/lib/livekit';
import { notifyUsers } from '@/app/api/_lib/notify';

/**
 * GET — ออก LiveKit token สำหรับวิดีโอคอลในดีล
 * แจ้ง push สายเรียกเข้าซ้ำ (backup) เมื่อผู้โทรขอ token — กันกรณี start_call ไม่ถึงมือถือ
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const me = await verifyUser(req);
    if (!livekitConfigured()) return NextResponse.json({ error: LIVEKIT_NOT_READY }, { status: 503 });

    const db = getAdminClient();
    const { data: deal, error } = await db.from('deals')
      .select('id, title, seller_id, buyer_id, middleman_id, status').eq('id', id).single();
    if (error || !deal) return NextResponse.json({ error: 'ไม่พบดีล' }, { status: 404 });

    const isParty = [deal.seller_id, deal.buyer_id, deal.middleman_id].includes(me.id);
    let isAdmin = false;
    if (!isParty) {
      const { data: p } = await db.from('profiles').select('role').eq('id', me.id).maybeSingle();
      isAdmin = p?.role === 'admin';
    }
    if (!isParty && !isAdmin) return NextResponse.json({ error: 'เฉพาะผู้เกี่ยวข้องในดีลเท่านั้น' }, { status: 403 });

    const { data: profile } = await db.from('profiles').select('display_name').eq('id', me.id).maybeSingle();
    const callerName = profile?.display_name || 'ผู้ใช้';

    // backup ring — ตอนผู้โทรเข้าห้อง LiveKit จริง (แอpปิดอยู่ก็ได้รับ push)
    const recipients = [deal.seller_id, deal.buyer_id, deal.middleman_id]
      .filter((uid): uid is string => typeof uid === 'string' && !!uid && uid !== me.id);
    if (recipients.length) {
      await notifyUsers(db, recipients, {
        title: `📞 สายเรียกเข้า: ${deal.title || 'ดีล'}`,
        body: `${callerName} กำลังโทรหาคุณ — กดเพื่อรับสาย`,
        link: `/deal/${id}?call=1`,
        kind: 'call',
        data: { type: 'incoming_call', dealId: id, mode: 'video', callerName },
      });
    }

    const { token, url } = await createCallToken({
      room: `deal-${deal.id}`,
      identity: me.id,
      name: callerName,
    });
    return NextResponse.json({ token, url });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}
