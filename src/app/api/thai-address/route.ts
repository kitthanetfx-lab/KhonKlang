import { NextResponse } from 'next/server';

const BASE = 'https://raw.githubusercontent.com/kongvut/thai-province-data/master';

// cache in-memory for the lifetime of the serverless function
let cache: Record<string, unknown> | null = null;

export async function GET() {
  if (cache) {
    return NextResponse.json(cache, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' },
    });
  }

  try {
    const [provinces, amphures, tambons] = await Promise.all([
      fetch(`${BASE}/api_province.json`, { next: { revalidate: 86400 } }).then(r => r.json()),
      fetch(`${BASE}/api_amphure.json`, { next: { revalidate: 86400 } }).then(r => r.json()),
      fetch(`${BASE}/api_tambon.json`,  { next: { revalidate: 86400 } }).then(r => r.json()),
    ]);

    cache = { provinces, amphures, tambons };

    return NextResponse.json(cache, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' },
    });
  } catch (err) {
    console.error('thai-address fetch error:', err);
    return NextResponse.json({ error: 'โหลดข้อมูลที่อยู่ไม่สำเร็จ' }, { status: 500 });
  }
}
