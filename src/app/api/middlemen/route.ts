import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser } from '@/lib/supabaseServer';
import { getMiddlemanWallet } from '../_lib/financeLedger';

export async function GET(req: NextRequest) {
  try {
    await verifyUser(req);
    const db = getAdminClient();

    const { searchParams } = req.nextUrl;
    const filterProvince = searchParams.get('province') || '';
    const filterTier = searchParams.get('tier') || '';
    const filterQuery = (searchParams.get('q') || '').trim().toLowerCase();
    const filterNeed = (searchParams.get('need') || '').trim().toLowerCase();

    let query = db.from('middleman_applications').select('*').eq('status', 'approved').limit(200);
    if (filterProvince) query = query.eq('work_province', filterProvince);
    if (filterTier) query = query.eq('tier', filterTier);
    const { data: docs } = await query;

    const userIds = (docs || []).map(d => d.user_id).filter(Boolean);
    const { data: profiles } = userIds.length
      ? await db.from('profiles').select('id, phone, display_name, review_score, review_count').in('id', userIds)
      : { data: [] };
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    const middlemen = await Promise.all((docs || []).map(async doc => {
      const p = profileMap.get(doc.user_id);
      const displayName = p?.display_name || doc.full_name_id || '';
      const wallet = await getMiddlemanWallet(db, String(doc.user_id || '')).catch(() => null);
      return {
        userId: doc.user_id as string,
        code: String(doc.user_id || '').slice(-6).toUpperCase(),
        name: displayName,
        tier: doc.tier || 'Bronze',
        categories: Array.isArray(doc.categories) ? doc.categories.join(',') : '',
        workProvince: doc.work_province || '',
        phone: p?.phone || '',
        reviewScore: Number(p?.review_score) || 0,
        reviewCount: Number(p?.review_count) || 0,
        wallet,
      };
    }));

    const filtered = middlemen.filter(mm => {
      const haystack = [mm.name, mm.userId, mm.code, mm.categories, mm.workProvince, mm.tier].join(' ').toLowerCase();
      if (filterQuery && !haystack.includes(filterQuery)) return false;
      if (filterNeed && !haystack.includes(filterNeed)) return false;
      return true;
    });

    return NextResponse.json({ middlemen: filtered });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
