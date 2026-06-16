import { NextRequest, NextResponse } from 'next/server';
import { Databases, Users, Query } from 'node-appwrite';
import { verifyAdmin, getAdminClient, DB_ID } from '../_lib';

export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);

    const client    = getAdminClient();
    const databases = new Databases(client);
    const users     = new Users(client);

    const [usersRes, sellersRes, middlemenRes, onsiteRes] = await Promise.allSettled([
      users.list([Query.limit(1)]),
      databases.listDocuments(DB_ID, 'seller_applications', [Query.limit(100)]),
      databases.listDocuments(DB_ID, 'middleman_applications', [Query.limit(100)]),
      databases.listDocuments(DB_ID, 'onsite_jobs', [Query.limit(200)]),
    ]);

    const totalUsers   = usersRes.status === 'fulfilled' ? usersRes.value.total : 0;
    const sellers      = sellersRes.status === 'fulfilled' ? sellersRes.value.documents : [];
    const middlemen    = middlemenRes.status === 'fulfilled' ? middlemenRes.value.documents : [];
    const onsite       = onsiteRes.status === 'fulfilled' ? onsiteRes.value.documents : [];

    return NextResponse.json({
      totalUsers,
      pendingSellers:    sellers.filter(d => d.status === 'pending_review').length,
      approvedSellers:   sellers.filter(d => d.status === 'approved').length,
      pendingMiddlemen:  middlemen.filter(d => d.status === 'pending_review').length,
      approvedMiddlemen: middlemen.filter(d => d.status === 'approved').length,
      onsiteOpen:        onsite.filter(d => ['open', 'quoted'].includes(String(d.status))).length,
      onsiteActive:      onsite.filter(d => ['accepted', 'in_progress'].includes(String(d.status))).length,
      onsiteTotal:       onsite.length,
      recentSellers:    sellers.sort((a,b) => b.$createdAt.localeCompare(a.$createdAt)).slice(0, 5),
      recentMiddlemen:  middlemen.sort((a,b) => b.$createdAt.localeCompare(a.$createdAt)).slice(0, 5),
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message ?? 'error' }, { status: e.status ?? 500 });
  }
}
