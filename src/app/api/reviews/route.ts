import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser, HttpError } from '@/lib/supabaseServer';

type TargetRole = 'buyer' | 'seller' | 'middleman' | 'platform';
const VALID_ROLES: TargetRole[] = ['buyer', 'seller', 'middleman', 'platform'];

export async function GET(req: NextRequest) {
  try {
    const db = getAdminClient();
    const dealId = req.nextUrl.searchParams.get('dealId') || '';
    const targetId = req.nextUrl.searchParams.get('targetId') || '';

    // All reviews for a deal (for deal members) — ?dealId=...&all=true
    if (dealId && req.nextUrl.searchParams.get('all') === 'true') {
      await verifyUser(req); // must be authenticated
      const { data } = await db.from('reviews')
        .select('reviewer_name, reviewer_role, target_role, rating, tags, created_at')
        .eq('deal_id', dealId)
        .order('reviewer_role')
        .order('target_role');
      return NextResponse.json({ items: data || [] });
    }

    // Has the current user already reviewed this deal?
    if (dealId) {
      const me = await verifyUser(req);
      const { count } = await db.from('reviews').select('id', { count: 'exact', head: true })
        .eq('deal_id', dealId).eq('reviewer_id', me.id);
      return NextResponse.json({ reviewed: (count || 0) > 0 });
    }

    // Public aggregate for a user (seller / middleman / buyer)
    if (targetId) {
      const { data, count } = await db.from('reviews').select('rating, tags, comment, reviewer_role, created_at', { count: 'exact' })
        .eq('target_id', targetId).order('created_at', { ascending: false }).limit(100);
      const docs = data || [];
      const score = docs.length ? docs.reduce((s, d) => s + (d.rating || 0), 0) / docs.length : 0;
      return NextResponse.json({
        score: Number(score.toFixed(2)),
        count: count || 0,
        recent: docs.slice(0, 10).map(d => ({ rating: d.rating, tags: d.tags, comment: d.comment, reviewerRole: d.reviewer_role, createdAt: d.created_at })),
      });
    }

    return NextResponse.json({ error: 'ระบุ dealId หรือ targetId' }, { status: 400 });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const db = getAdminClient();

    const body = await req.json();
    const dealId: string = body.dealId || '';
    const items: { targetRole: TargetRole; rating: number; tags?: string[]; comment?: string }[] = Array.isArray(body.items) ? body.items : [];
    if (!dealId || items.length === 0) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });

    const { data: deal, error: dealErr } = await db.from('deals').select('status, buyer_id, seller_id, middleman_id').eq('id', dealId).single();
    if (dealErr || !deal) return NextResponse.json({ error: 'ไม่พบดีล' }, { status: 404 });
    if (deal.status !== 'completed') return NextResponse.json({ error: 'รีวิวได้เมื่อดีลเสร็จสมบูรณ์เท่านั้น' }, { status: 400 });

    const myRole: TargetRole | '' =
      deal.buyer_id === me.id ? 'buyer' :
      deal.seller_id === me.id ? 'seller' :
      deal.middleman_id === me.id ? 'middleman' : '';
    if (!myRole) return NextResponse.json({ error: 'เฉพาะผู้ร่วมดีลเท่านั้นที่รีวิวได้' }, { status: 403 });

    // One submission per reviewer per deal (also DB-enforced via unique constraint)
    const { count: dupCount } = await db.from('reviews').select('id', { count: 'exact', head: true })
      .eq('deal_id', dealId).eq('reviewer_id', me.id);
    if ((dupCount || 0) > 0) return NextResponse.json({ error: 'คุณรีวิวดีลนี้ไปแล้ว' }, { status: 409 });

    const { data: myProfile } = await db.from('profiles').select('display_name').eq('id', me.id).maybeSingle();

    // Server derives target IDs from the deal — client cannot spoof them
    const targetIdOf: Record<TargetRole, string | null> = {
      buyer: deal.buyer_id, seller: deal.seller_id, middleman: deal.middleman_id, platform: null,
    };

    const created: string[] = [];
    const insertErrors: string[] = [];
    for (const it of items) {
      const role = it.targetRole;
      const rating = Math.round(Number(it.rating));
      if (!VALID_ROLES.includes(role) || role === myRole) continue;
      if (!(rating >= 1 && rating <= 5)) continue;
      const targetId = targetIdOf[role];
      if (role !== 'platform' && !targetId) continue; // e.g. deal without middleman

      const { error } = await db.from('reviews').insert({
        deal_id: dealId,
        reviewer_id: me.id,
        reviewer_name: myProfile?.display_name || '',
        reviewer_role: myRole,
        target_id: targetId,   // null สำหรับ platform — ต้องมี ALTER TABLE reviews ALTER COLUMN target_id DROP NOT NULL
        target_role: role,
        rating,
        tags: (it.tags || []).slice(0, 6),
        comment: String(it.comment || '').slice(0, 1000),
      });
      if (!error) {
        created.push(role);
      } else {
        // surface DB error (เช่น NOT NULL constraint บน target_id) แทนการเงียบ
        insertErrors.push(`${role}: ${error.message}`);
        console.error('[reviews] insert error', role, error.message);
      }
      // review_score / review_count on profiles is kept in sync by a DB trigger
    }

    if (created.length === 0) {
      const errMsg = insertErrors.length ? insertErrors.join('; ') : 'ไม่มีรีวิวที่บันทึกได้';
      return NextResponse.json({ error: errMsg }, { status: 400 });
    }
    return NextResponse.json({ ok: true, created, warnings: insertErrors.length ? insertErrors : undefined });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
