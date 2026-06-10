import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Databases, Users, Query } from 'node-appwrite';

const DB_ID = 'khonklang_db';

function getAdmin() {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return { db: new Databases(c), users: new Users(c) };
}

export async function GET(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const c = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setJWT(jwt);
    await new Account(c).get();

    const { searchParams } = req.nextUrl;
    const filterProvince = searchParams.get('province') || '';
    const filterTier     = searchParams.get('tier')     || '';
    const filterQuery    = (searchParams.get('q') || '').trim().toLowerCase();
    const filterNeed     = (searchParams.get('need') || '').trim().toLowerCase();

    const { db, users } = getAdmin();
    const queries: string[] = [Query.equal('status', 'approved'), Query.limit(200)];
    if (filterProvince) queries.push(Query.equal('workProvince', filterProvince));
    if (filterTier)     queries.push(Query.equal('tier', filterTier));

    const docs = await db.listDocuments(DB_ID, 'middleman_applications', queries)
      .then(r => r.documents).catch(() => []);

    const middlemen = await Promise.all(docs.map(async doc => {
      let phone = '', displayName = (doc.fullNameId as string) || '';
      let reviewScore = 0, reviewCount = 0;
      try {
        const u = await users.get(doc.userId as string);
        const p = ((u.prefs || {}) as Record<string, string>);
        phone       = p.phone       || '';
        displayName = p.displayName || u.name || displayName;
        reviewScore = parseFloat(p.reviewScore || '0') || 0;
        reviewCount = parseInt(p.reviewCount   || '0') || 0;
      } catch {}
      return {
        userId:       doc.userId       as string,
        code:         String(doc.userId || '').slice(-6).toUpperCase(),
        name:         displayName,
        tier:         (doc.tier        as string) || 'Bronze',
        categories:   (doc.categories  as string) || '',
        workProvince: (doc.workProvince as string) || '',
        phone, reviewScore, reviewCount,
      };
    }));

    const filtered = middlemen.filter(mm => {
      const haystack = [
        mm.name,
        mm.userId,
        mm.code,
        mm.categories,
        mm.workProvince,
        mm.tier,
      ].join(' ').toLowerCase();

      if (filterQuery && !haystack.includes(filterQuery)) return false;
      if (filterNeed && !haystack.includes(filterNeed)) return false;
      return true;
    });

    return NextResponse.json({ middlemen: filtered });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
