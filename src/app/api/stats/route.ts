import { NextResponse } from 'next/server';
import { Client, Databases, Query } from 'node-appwrite';

const DB_ID = 'khonklang_db';

export const revalidate = 60; // cache 60s — public homepage stats

function getDb() {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Databases(c);
}

export async function GET() {
  try {
    const db = getDb();

    const [dealsRes, middlemenRes, platformRes] = await Promise.allSettled([
      db.listDocuments(DB_ID, 'deals', [
        Query.equal('status', 'completed'),
        Query.select(['price']),
        Query.limit(1000),
      ]),
      db.listDocuments(DB_ID, 'middleman_applications', [
        Query.equal('status', 'approved'),
        Query.limit(1),
      ]),
      db.listDocuments(DB_ID, 'reviews', [
        Query.equal('targetRole', 'platform'),
        Query.select(['rating']),
        Query.limit(1000),
      ]),
    ]);

    const completedDeals = dealsRes.status === 'fulfilled' ? dealsRes.value.total : 0;
    const protectedValue = dealsRes.status === 'fulfilled'
      ? (dealsRes.value.documents as { price?: number }[]).reduce((s, d) => s + (Number(d.price) || 0), 0)
      : 0;
    const middlemen = middlemenRes.status === 'fulfilled' ? middlemenRes.value.total : 0;

    let satisfaction = 0, reviewCount = 0;
    if (platformRes.status === 'fulfilled') {
      const ratings = (platformRes.value.documents as { rating?: number }[]).map(d => Number(d.rating) || 0).filter(Boolean);
      reviewCount = platformRes.value.total;
      if (ratings.length) satisfaction = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length / 5) * 1000) / 10;
    }

    return NextResponse.json({ completedDeals, protectedValue, middlemen, satisfaction, reviewCount });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
