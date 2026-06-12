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

    const [dealsRes, middlemenRes, platformRes, listingsRes, meetupRes, scamRes, mmReviewRes] = await Promise.allSettled([
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
      // ประกาศขายที่เปิดอยู่ในตลาด — นับต่อหมวดหมู่
      db.listDocuments(DB_ID, 'deals', [
        Query.equal('status', 'posted'),
        Query.equal('source', 'listing'),
        Query.select(['category']),
        Query.limit(1000),
      ]),
      // ดีลนัดรับ (ประกันการเดินทาง) ทั้งหมด
      db.listDocuments(DB_ID, 'deals', [
        Query.equal('dealType', 'meetup'),
        Query.limit(1),
      ]),
      // รายชื่อคนโกงที่ตรวจสอบและเผยแพร่แล้ว
      db.listDocuments(DB_ID, 'scam_reports', [
        Query.equal('status', 'approved'),
        Query.limit(1),
      ]),
      // รีวิวคนกลาง — ใช้คำนวณคะแนนเฉลี่ย
      db.listDocuments(DB_ID, 'reviews', [
        Query.equal('targetRole', 'middleman'),
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

    // นับประกาศต่อหมวด (ค่าจริงจากประกาศที่เปิดอยู่เท่านั้น)
    const categories: Record<string, number> = {};
    let listingTotal = 0;
    if (listingsRes.status === 'fulfilled') {
      listingTotal = listingsRes.value.total;
      for (const d of listingsRes.value.documents as { category?: string }[]) {
        const c = (d.category || '').trim() || 'อื่นๆ';
        categories[c] = (categories[c] || 0) + 1;
      }
    }

    const meetupDeals = meetupRes.status === 'fulfilled' ? meetupRes.value.total : 0;
    const scamRecords = scamRes.status === 'fulfilled' ? scamRes.value.total : 0;

    let middlemanRating = 0, middlemanReviews = 0;
    if (mmReviewRes.status === 'fulfilled') {
      const ratings = (mmReviewRes.value.documents as { rating?: number }[]).map(d => Number(d.rating) || 0).filter(Boolean);
      middlemanReviews = mmReviewRes.value.total;
      if (ratings.length) middlemanRating = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
    }

    return NextResponse.json({
      completedDeals, protectedValue, middlemen, satisfaction, reviewCount,
      categories, listingTotal, meetupDeals, scamRecords, middlemanRating, middlemanReviews,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
