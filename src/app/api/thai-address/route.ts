import { NextRequest, NextResponse } from 'next/server';

// Data bundled with npm package — no external fetch needed
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { searchAddressByProvince, searchAddressByDistrict } = require('thai-address-database');

type Entry = { district: string; amphoe: string; province: string; zipcode: string };

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type     = searchParams.get('type');
  const province = searchParams.get('province') || '';
  const amphoe   = searchParams.get('amphoe') || '';

  const headers = { 'Cache-Control': 'public, s-maxage=86400' };

  if (type === 'amphures') {
    // ดึง อำเภอ ทั้งหมดของจังหวัด
    const entries: Entry[] = searchAddressByProvince(province) || [];
    const unique = [...new Set(
      entries
        .filter((e: Entry) => e.province === province)
        .map((e: Entry) => e.amphoe)
    )].sort();
    return NextResponse.json(unique, { headers });
  }

  if (type === 'tambons') {
    // ดึง ตำบล + รหัสไปรษณีย์ ของ อำเภอ นั้น
    const entries: Entry[] = searchAddressByProvince(province) || [];
    const filtered = entries.filter(
      (e: Entry) => e.province === province && e.amphoe === amphoe
    );
    // unique tambons with zipcode
    const seen = new Set<string>();
    const result: { name: string; zip: string }[] = [];
    for (const e of filtered) {
      if (!seen.has(e.district)) {
        seen.add(e.district);
        result.push({ name: e.district, zip: e.zipcode });
      }
    }
    return NextResponse.json(result.sort((a, b) => a.name.localeCompare(b.name, 'th')), { headers });
  }

  return NextResponse.json({ error: 'invalid type' }, { status: 400 });
}
