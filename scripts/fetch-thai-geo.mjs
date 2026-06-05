// รันตอน prebuild เพื่อ generate ไฟล์ static สำหรับ Thai address dropdown
// Vercel มี internet ตอน build ดึงข้อมูลได้ปกติ

import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'thai-geo.json');

// ถ้ามีไฟล์แล้ว ไม่ต้อง fetch ซ้ำ (local dev)
if (existsSync(OUT)) {
  console.log('[thai-geo] already exists, skipping fetch');
  process.exit(0);
}

const BASE = 'https://cdn.jsdelivr.net/gh/kongvut/thai-province-data@master';

try {
  console.log('[thai-geo] fetching data...');
  const [p, a, t] = await Promise.all([
    fetch(`${BASE}/api_province.json`).then(r => r.json()),
    fetch(`${BASE}/api_amphure.json`).then(r => r.json()),
    fetch(`${BASE}/api_tambon.json`).then(r => r.json()),
  ]);

  const data = {
    provinces: p.map(x => ({ id: x.id, n: x.name_th })),
    amphures:  a.map(x => ({ id: x.id, n: x.name_th, p: x.province_id })),
    tambons:   t.map(x => ({ id: x.id, n: x.name_th, a: x.amphure_id, z: x.zip_code })),
  };

  writeFileSync(OUT, JSON.stringify(data));
  console.log(`[thai-geo] done — ${(JSON.stringify(data).length / 1024).toFixed(0)} KB`);
} catch (err) {
  // ถ้า fetch ไม่ได้ ให้ build ต่อได้ปกติ (dropdown จะว่างเปล่า)
  console.warn('[thai-geo] fetch failed (non-fatal):', err.message);
}
