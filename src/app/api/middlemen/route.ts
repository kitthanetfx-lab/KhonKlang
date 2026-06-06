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

// GET /api/middlemen — list approved middlemen for buyer to select
export async function GET(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const c = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setJWT(jwt);
    await new Account(c).get();

    const { db, users } = getAdmin();
    const docs = await db.listDocuments(DB_ID, 'middleman_applications', [
      Query.equal('status', 'approved'),
      Query.limit(100),
    ]).then(r => r.documents).catch(() => []);

    // For each approved application, fetch the user's public info
    const middlemen = await Promise.all(docs.map(async doc => {
      let phone = '';
      let displayName = doc.fullNameId || '';
      try {
        const u = await users.get(doc.userId);
        const prefs = (u.prefs || {}) as Record<string, string>;
        phone = prefs.phone || '';
        displayName = prefs.displayName || u.name || displayName;
      } catch { /* ignore */ }
      return {
        userId:      doc.userId,
        name:        displayName,
        tier:        doc.tier        || 'Bronze',
        categories:  doc.categories  || '',
        workProvince: doc.workProvince || '',
        phone,
      };
    }));

    return NextResponse.json({ middlemen });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
