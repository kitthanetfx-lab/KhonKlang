import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser, HttpError } from '@/lib/supabaseServer';

/** ดีลทั้งหมดของฉัน (ทุกบทบาท) + ข้อความล่าสุดของแต่ละดีล — ใช้ทำหน้าประวัติ/กล่องข้อความ */
export async function GET(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const db = getAdminClient();

    const [asBuyer, asSeller, asMm] = await Promise.all([
      db.from('deals').select('*').eq('buyer_id', me.id).order('created_at', { ascending: false }).limit(100),
      db.from('deals').select('*').eq('seller_id', me.id).order('created_at', { ascending: false }).limit(100),
      db.from('deals').select('*').eq('middleman_id', me.id).order('created_at', { ascending: false }).limit(100),
    ]);

    const seen = new Set<string>();
    const all = [...(asBuyer.data || []), ...(asSeller.data || []), ...(asMm.data || [])]
      .filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; })
      .slice(0, 80);

    const deals = await Promise.all(all.map(async d => {
      let lastMsg: { content: string; type: string; senderName: string; role: string; createdAt: string } | null = null;
      const { data: msgs } = await db.from('messages').select('content, type, sender_name, role, created_at')
        .eq('deal_id', d.id).order('created_at', { ascending: false }).limit(1);
      const doc = msgs?.[0];
      if (doc) lastMsg = { content: doc.content || '', type: doc.type || 'text', senderName: doc.sender_name || '', role: doc.role || '', createdAt: doc.created_at || '' };
      const myRole = d.buyer_id === me.id ? 'buyer' : d.seller_id === me.id ? 'seller' : 'middleman';
      return {
        id: d.id, title: d.title, price: d.price, status: d.status,
        buyerName: d.buyer_name, sellerName: d.seller_name, middlemanName: d.middleman_name,
        createdAt: d.created_at, myRole, lastMsg,
      };
    }));

    deals.sort((a, b) => {
      const ta = a.lastMsg?.createdAt || a.createdAt || '';
      const tb = b.lastMsg?.createdAt || b.createdAt || '';
      return tb.localeCompare(ta);
    });

    return NextResponse.json({ deals });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
