import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Databases, DatabasesIndexType, ID, OrderBy, Permission, Role, Query, Users } from 'node-appwrite';

const DB_ID = 'khonklang_db';
const COL_REVIEWS = 'reviews';
const COL_DEALS = 'deals';

type TargetRole = 'buyer' | 'seller' | 'middleman' | 'platform';
const VALID_ROLES: TargetRole[] = ['buyer', 'seller', 'middleman', 'platform'];

function getAdmin() {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return { db: new Databases(c), users: new Users(c) };
}

function getUserFromJwt(jwt: string) {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setJWT(jwt);
  return new Account(c).get();
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function ensureReviewsCollection(db: Databases) {
  try { await db.getCollection(DB_ID, COL_REVIEWS); return; } catch { /* create below */ }
  try {
    await db.createCollection(DB_ID, COL_REVIEWS, 'Reviews', [
      Permission.read(Role.users()),
    ]);
    await Promise.all([
      db.createStringAttribute(DB_ID, COL_REVIEWS, 'dealId',       255, true),
      db.createStringAttribute(DB_ID, COL_REVIEWS, 'reviewerId',   255, true),
      db.createStringAttribute(DB_ID, COL_REVIEWS, 'reviewerName', 200, false, ''),
      db.createStringAttribute(DB_ID, COL_REVIEWS, 'reviewerRole',  30, false, ''),
      db.createStringAttribute(DB_ID, COL_REVIEWS, 'targetId',     255, false, ''),
      db.createStringAttribute(DB_ID, COL_REVIEWS, 'targetRole',    30, false, ''),
      db.createIntegerAttribute(DB_ID, COL_REVIEWS, 'rating', true, 1, 5),
      db.createStringAttribute(DB_ID, COL_REVIEWS, 'tags',        500, false, '[]'),
      db.createStringAttribute(DB_ID, COL_REVIEWS, 'comment',    1000, false, ''),
      db.createStringAttribute(DB_ID, COL_REVIEWS, 'createdAt',    30, false, ''),
    ]);
    // Wait for attributes to become available before indexing/writing
    for (let i = 0; i < 20; i += 1) {
      try {
        const col = await db.listAttributes(DB_ID, COL_REVIEWS);
        const all = (col.attributes as { status?: string }[]).every(a => a.status === 'available');
        if (all) break;
      } catch { /* keep polling */ }
      await sleep(500);
    }
    await Promise.all([
      { key: 'idx_deal',     attrs: ['dealId'] },
      { key: 'idx_reviewer', attrs: ['reviewerId'] },
      { key: 'idx_target',   attrs: ['targetId'] },
      { key: 'idx_trole',    attrs: ['targetRole'] },
    ].map(i => db.createIndex(DB_ID, COL_REVIEWS, i.key, DatabasesIndexType.Key, i.attrs, [OrderBy.Asc]).catch(() => {})));
  } catch (err) {
    // Tolerate keys without collections.write scope when collection already exists
    if (String(err).includes('missing scopes')) return;
    throw err;
  }
}

/** Update running average rating stored in the target user's prefs (merge, never replace blindly) */
async function applyRatingToUser(users: Users, userId: string, rating: number) {
  try {
    const u = await users.get(userId);
    const prefs = (u.prefs || {}) as Record<string, unknown>;
    const score = parseFloat(String(prefs.reviewScore || '0')) || 0;
    const count = parseInt(String(prefs.reviewCount || '0')) || 0;
    const newCount = count + 1;
    const newScore = (score * count + rating) / newCount;
    await users.updatePrefs(userId, { ...prefs, reviewScore: newScore.toFixed(2), reviewCount: String(newCount) });
  } catch { /* best effort — review document remains source of truth */ }
}

export async function GET(req: NextRequest) {
  try {
    const { db } = getAdmin();
    const dealId = req.nextUrl.searchParams.get('dealId') || '';
    const targetId = req.nextUrl.searchParams.get('targetId') || '';

    // Has the current user already reviewed this deal?
    if (dealId) {
      const jwt = req.headers.get('x-session-jwt');
      if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const me = await getUserFromJwt(jwt);
      const r = await db.listDocuments(DB_ID, COL_REVIEWS, [
        Query.equal('dealId', dealId),
        Query.equal('reviewerId', me.$id),
        Query.limit(1),
      ]).catch(() => ({ total: 0, documents: [] }));
      return NextResponse.json({ reviewed: r.total > 0 });
    }

    // Public aggregate for a user (seller / middleman / buyer)
    if (targetId) {
      const r = await db.listDocuments(DB_ID, COL_REVIEWS, [
        Query.equal('targetId', targetId),
        Query.orderDesc('createdAt'),
        Query.limit(100),
      ]).catch(() => ({ total: 0, documents: [] as Record<string, unknown>[] }));
      const docs = r.documents as { rating: number; tags: string; comment: string; reviewerRole: string; createdAt: string }[];
      const count = r.total;
      const score = docs.length ? docs.reduce((s, d) => s + (d.rating || 0), 0) / docs.length : 0;
      return NextResponse.json({
        score: Number(score.toFixed(2)),
        count,
        recent: docs.slice(0, 10).map(d => ({ rating: d.rating, tags: d.tags, comment: d.comment, reviewerRole: d.reviewerRole, createdAt: d.createdAt })),
      });
    }

    return NextResponse.json({ error: 'ระบุ dealId หรือ targetId' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const me = await getUserFromJwt(jwt);

    const body = await req.json();
    const dealId: string = body.dealId || '';
    const items: { targetRole: TargetRole; rating: number; tags?: string[]; comment?: string }[] = Array.isArray(body.items) ? body.items : [];
    if (!dealId || items.length === 0) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });

    const { db, users } = getAdmin();
    await ensureReviewsCollection(db);

    const deal = await db.getDocument(DB_ID, COL_DEALS, dealId);
    if (deal.status !== 'completed') return NextResponse.json({ error: 'รีวิวได้เมื่อดีลเสร็จสมบูรณ์เท่านั้น' }, { status: 400 });

    const myRole: TargetRole | '' =
      deal.buyerId === me.$id ? 'buyer' :
      deal.sellerId === me.$id ? 'seller' :
      deal.middlemanId === me.$id ? 'middleman' : '';
    if (!myRole) return NextResponse.json({ error: 'เฉพาะผู้ร่วมดีลเท่านั้นที่รีวิวได้' }, { status: 403 });

    // One submission per reviewer per deal
    const dup = await db.listDocuments(DB_ID, COL_REVIEWS, [
      Query.equal('dealId', dealId),
      Query.equal('reviewerId', me.$id),
      Query.limit(1),
    ]).catch(() => ({ total: 0 }));
    if (dup.total > 0) return NextResponse.json({ error: 'คุณรีวิวดีลนี้ไปแล้ว' }, { status: 409 });

    // Server derives target IDs from the deal — client cannot spoof them
    const targetIdOf: Record<TargetRole, string> = {
      buyer: deal.buyerId as string,
      seller: deal.sellerId as string,
      middleman: deal.middlemanId as string,
      platform: '',
    };

    const created: string[] = [];
    for (const it of items) {
      const role = it.targetRole;
      const rating = Math.round(Number(it.rating));
      if (!VALID_ROLES.includes(role) || role === myRole) continue;
      if (!(rating >= 1 && rating <= 5)) continue;
      const targetId = targetIdOf[role];
      if (role !== 'platform' && !targetId) continue; // e.g. deal without middleman

      await db.createDocument(DB_ID, COL_REVIEWS, ID.unique(), {
        dealId,
        reviewerId: me.$id,
        reviewerName: me.name || '',
        reviewerRole: myRole,
        targetId,
        targetRole: role,
        rating,
        tags: JSON.stringify((it.tags || []).slice(0, 6)),
        comment: String(it.comment || '').slice(0, 1000),
        createdAt: new Date().toISOString(),
      });
      created.push(role);
      if (role !== 'platform') await applyRatingToUser(users, targetId, rating);
    }

    if (created.length === 0) return NextResponse.json({ error: 'ไม่มีรีวิวที่บันทึกได้' }, { status: 400 });
    return NextResponse.json({ ok: true, created });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
