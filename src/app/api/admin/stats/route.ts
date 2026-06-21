import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient, HttpError } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();

    const [usersRes, sellersRes, middlemenRes, onsiteRes] = await Promise.all([
      db.from('profiles').select('id', { count: 'exact', head: true }),
      db.from('seller_applications').select('*').order('created_at', { ascending: false }).limit(100),
      db.from('middleman_applications').select('*').order('created_at', { ascending: false }).limit(100),
      db.from('onsite_jobs').select('*').limit(200),
    ]);

    const totalUsers = usersRes.count || 0;
    const sellers = sellersRes.data || [];
    const middlemen = middlemenRes.data || [];
    const onsite = onsiteRes.data || [];

    return NextResponse.json({
      totalUsers,
      pendingSellers: sellers.filter(d => d.status === 'pending_review').length,
      approvedSellers: sellers.filter(d => d.status === 'approved').length,
      pendingMiddlemen: middlemen.filter(d => d.status === 'pending_review').length,
      approvedMiddlemen: middlemen.filter(d => d.status === 'approved').length,
      onsiteOpen: onsite.filter(d => ['open', 'quoted'].includes(String(d.status))).length,
      onsiteActive: onsite.filter(d => ['accepted', 'in_progress'].includes(String(d.status))).length,
      onsiteTotal: onsite.length,
      recentSellers: sellers.slice(0, 5),
      recentMiddlemen: middlemen.slice(0, 5),
    });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
