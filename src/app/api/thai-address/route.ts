import { NextRequest, NextResponse } from 'next/server';

type Amphure = { id: number; n: string; p: number };
type Tambon  = { id: number; n: string; a: number; z: number };

// cache ใน memory ของ serverless function
let _amph: Amphure[] | null = null;
let _tamb: Tambon[]  | null = null;
let _loading = false;

async function ensureData() {
  if (_amph && _tamb) return true;
  if (_loading) {
    // รอ max 8s
    for (let i = 0; i < 80; i++) {
      await new Promise(r => setTimeout(r, 100));
      if (_amph && _tamb) return true;
    }
    return false;
  }
  _loading = true;
  try {
    const BASE = 'https://cdn.jsdelivr.net/gh/kongvut/thai-province-data@master';
    const [a, t] = await Promise.all([
      fetch(`${BASE}/api_amphure.json`, { next: { revalidate: 86400 } }).then(r => r.json()),
      fetch(`${BASE}/api_tambon.json`,  { next: { revalidate: 86400 } }).then(r => r.json()),
    ]);
    _amph = a.map((x: any) => ({ id: x.id, n: x.name_th, p: x.province_id }));
    _tamb = t.map((x: any) => ({ id: x.id, n: x.name_th, a: x.amphure_id, z: x.zip_code }));
    return true;
  } catch (e) {
    console.error('thai-address CDN error:', e);
    _loading = false;
    return false;
  }
}

const H = { 'Cache-Control': 'public, s-maxage=3600' };

export async function GET(req: NextRequest) {
  const ok = await ensureData();
  if (!ok) return NextResponse.json([], { status: 503, headers: H });

  const p = req.nextUrl.searchParams;
  const type = p.get('type');
  const pid  = parseInt(p.get('pid') || '0');
  const aid  = parseInt(p.get('aid') || '0');

  if (type === 'amphures') return NextResponse.json(_amph!.filter(a => a.p === pid), { headers: H });
  if (type === 'tambons')  return NextResponse.json(_tamb!.filter(t => t.a === aid), { headers: H });

  return NextResponse.json([], { headers: H });
}
