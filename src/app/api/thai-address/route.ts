import { NextResponse } from 'next/server';

// jsDelivr CDN เร็วกว่า raw.githubusercontent.com
const BASE = 'https://cdn.jsdelivr.net/gh/kongvut/thai-province-data@master';

let cache: Record<string, unknown> | null = null;

export async function GET() {
  if (cache) {
    return NextResponse.json(cache, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' },
    });
  }

  try {
    const [p, a, t] = await Promise.all([
      fetch(`${BASE}/api_province.json`).then(r => r.json()),
      fetch(`${BASE}/api_amphure.json`).then(r => r.json()),
      fetch(`${BASE}/api_tambon.json`).then(r => r.json()),
    ]);

    // compact format ลดขนาด payload
    cache = {
      provinces: p.map((x: any) => ({ id: x.id, n: x.name_th })),
      amphures:  a.map((x: any) => ({ id: x.id, n: x.name_th, p: x.province_id })),
      tambons:   t.map((x: any) => ({ id: x.id, n: x.name_th, a: x.amphure_id, z: x.zip_code })),
    };

    return NextResponse.json(cache, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' },
    });
  } catch (err) {
    console.error('thai-address error:', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
