import { NextRequest, NextResponse } from 'next/server';
import data from './geo-data.json';

const H = { 'Cache-Control': 'public, s-maxage=86400' };

// data.a = { province: string[] }   (amphures)
// data.t = { "province|amphoe": [name, zip][] }  (tambons)

export async function GET(req: NextRequest) {
  const p    = req.nextUrl.searchParams;
  const type = p.get('type');
  const prov = p.get('province') || '';
  const amph = p.get('amphoe')   || '';

  if (type === 'amphures') {
    const list = (data.a as Record<string, string[]>)[prov] ?? [];
    return NextResponse.json(list, { headers: H });
  }

  if (type === 'tambons') {
    const key  = `${prov}|${amph}`;
    const list = (data.t as Record<string, [string, string][]>)[key] ?? [];
    return NextResponse.json(list, { headers: H });
  }

  return NextResponse.json([], { headers: H });
}
