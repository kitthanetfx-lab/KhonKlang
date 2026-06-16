import { NextRequest, NextResponse } from 'next/server';
import { Databases, Permission, Role } from 'node-appwrite';
import { verifyAdmin, getAdminClient, DB_ID } from '../../admin/_lib';

const COL = 'app_config';
const DOC = 'fees';

// ค่าธรรมเนียม/ค่าบริการเริ่มต้น (แอดมินปรับได้ในหน้าตั้งค่า)
const DEFAULTS = {
  escrowFeePercent: 2.5,  // ซื้อขายผ่านกลาง (ออนไลน์) — % ของราคา
  escrowFeeMin: 20,       // ขั้นต่ำ (บาท)
  simpleFeePercent: 2,    // ซื้อขายผ่านกลางแบบง่าย (ส่งตรง) — %
  simpleFeeMin: 20,
  inspectionFee: 100,     // ค่าตรวจสอบสินค้า (บาท)
  packingFee: 50,         // ค่าแพ็คสินค้า (บาท)
  onsiteBaseFee: 300,     // ค่าบริการนัดออนไซต์ ฐาน (บาท)
  onsitePerKm: 5,         // ค่าเดินทางออนไซต์ (บาท/กม.)
  meetupFeePercent: 0,    // รับประกันเดินทาง — %
  meetupFeeMin: 50,       // ค่าบริการรับประกันเดินทางขั้นต่ำ (บาท)
};
type FeeConfig = typeof DEFAULTS;
const FEE_KEYS = Object.keys(DEFAULTS) as (keyof FeeConfig)[];

async function ensureConfig(db: Databases) {
  try {
    await db.getCollection(DB_ID, COL);
  } catch {
    await db.createCollection(DB_ID, COL, 'App Config', [Permission.read(Role.any())]).catch(() => {});
    await db.createStringAttribute(DB_ID, COL, 'data', 4000, false, '').catch(() => {});
  }
}

async function readConfig(db: Databases): Promise<FeeConfig> {
  try {
    const doc = await db.getDocument(DB_ID, COL, DOC) as unknown as { data?: string };
    const saved = JSON.parse(doc.data || '{}');
    return { ...DEFAULTS, ...saved };
  } catch {
    return DEFAULTS;
  }
}

export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = new Databases(getAdminClient());
    const fees = await readConfig(db);
    return NextResponse.json({ fees });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message ?? 'error' }, { status: e.status ?? 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = new Databases(getAdminClient());
    const body = await req.json();

    // sanitize: เก็บเฉพาะ key ที่รู้จัก และเป็นตัวเลข >= 0
    const clean: Partial<FeeConfig> = {};
    for (const k of FEE_KEYS) {
      const v = Number(body[k]);
      clean[k] = (isFinite(v) && v >= 0) ? v : DEFAULTS[k];
    }
    const data = JSON.stringify(clean).slice(0, 3900);

    await ensureConfig(db);
    // เผื่อ attribute เพิ่งถูกสร้างและยังไม่พร้อม — ลองซ้ำสองสามครั้ง
    let lastErr: unknown = null;
    for (let i = 0; i < 6; i++) {
      try {
        try { await db.updateDocument(DB_ID, COL, DOC, { data }); }
        catch { await db.createDocument(DB_ID, COL, DOC, { data }); }
        return NextResponse.json({ fees: clean, ok: true });
      } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 1000)); }
    }
    throw lastErr;
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message ?? 'error' }, { status: e.status ?? 500 });
  }
}
