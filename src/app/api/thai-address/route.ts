import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

type Amphure = { id: number; n: string; p: number };
type Tambon  = { id: number; n: string; a: number; z: number };

let _amph: Amphure[] | null = null;
let _tamb: Tambon[]  | null = null;

function loadData() {
  if (_amph) return;
  const file = join(process.cwd(), 'public', 'thai-geo.json');
  if (!existsSync(file)) return;
  const raw = JSON.parse(readFileSync(file, 'utf-8'));
  _amph = raw.amphures;
  _tamb = raw.tambons;
}

export async function GET(req: NextRequest) {
  loadData();

  const { searchParams } = req.nextUrl;
  const type       = searchParams.get('type');
  const provinceId = parseInt(searchParams.get('pid') || '0');
  const amphureId  = parseInt(searchParams.get('aid') || '0');

  const h = { 'Cache-Control': 'public, s-maxage=86400' };

  if (type === 'amphures' && _amph) {
    return NextResponse.json(_amph.filter(a => a.p === provinceId), { headers: h });
  }
  if (type === 'tambons' && _tamb) {
    return NextResponse.json(_tamb.filter(t => t.a === amphureId), { headers: h });
  }

  return NextResponse.json({ error: 'not ready' }, { status: 503 });
}
