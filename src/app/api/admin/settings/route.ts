import { NextRequest, NextResponse } from 'next/server';
import { Databases, Permission, Role } from 'node-appwrite';
import { verifyAdmin, getAdminClient, DB_ID } from '../../admin/_lib';

const COL = 'app_config';
const DOC = 'fees';

// ค่าธรรมเนียม/ค่าบริการแบบตัวเลข (แอดมินปรับได้ในหน้าตั้งค่า)
const NUM_DEFAULTS = {
  escrowFeePercent: 2.5,    // ซื้อขายผ่านกลาง (ออนไลน์) — ค่าธรรมเนียมระบบ % ของราคา
  escrowFeeMin: 20,         // ขั้นต่ำ (บาท)
  middlemanFeePercent: 1.5, // ค่าบริการคนกลาง — % ของราคา
  middlemanFeeMin: 30,      // ค่าบริการคนกลางขั้นต่ำ (บาท)
  platformCutPercent: 20,   // ส่วนแบ่งแพลตฟอร์มจากค่าบริการคนกลาง (%)
  simpleFeePercent: 2,      // ซื้อขายผ่านกลางแบบง่าย (ส่งตรง) — %
  simpleFeeMin: 20,
  inspectionFee: 100,       // ค่าตรวจสอบสินค้า (บาท)
  packingFee: 50,           // ค่าแพ็คสินค้า (บาท)
  depositBronze: 1000,      // เครดิตประกันคนกลางตามเทียร์ (บาท)
  depositSilver: 5000,
  depositGold: 20000,
  depositPlatinum: 50000,
  failedDealFee: 50,        // ค่าจัดการเมื่อดีลไม่สำเร็จ/ตีกลับ (บาท)
  onsiteBaseFee: 300,       // ค่าบริการนัดออนไซต์ ฐาน (บาท)
  onsitePerKm: 5,           // ค่าเดินทางออนไซต์ (บาท/กม.)
  meetupFeePercent: 0,      // รับประกันเดินทาง — %
  meetupFeeMin: 50,         // ค่าบริการรับประกันเดินทางขั้นต่ำ (บาท)
  sellerRegFee: 0,          // ค่าสมัครผู้ขาย (บาท)
  middlemanRegFee: 0,       // ค่าสมัครคนกลาง (บาท)
};
// ค่าตั้งแบบตัวเลือก (string)
const STR_DEFAULTS = {
  returnShippingBy: 'buyer' as 'buyer' | 'seller' | 'split', // ผู้รับผิดชอบค่าส่งคืนเมื่อตีกลับ
};
const DEFAULTS = { ...NUM_DEFAULTS, ...STR_DEFAULTS };
type FeeConfig = typeof DEFAULTS;
const NUM_KEYS = Object.keys(NUM_DEFAULTS) as (keyof typeof NUM_DEFAULTS)[];
const RETURN_OPTIONS = ['buyer', 'seller', 'split'];

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

    // sanitize: เก็บเฉพาะ key ที่รู้จัก ตัวเลข >= 0 และตัวเลือกที่ถูกต้อง
    const clean: Record<string, number | string> = {};
    for (const k of NUM_KEYS) {
      const v = Number(body[k]);
      clean[k] = (isFinite(v) && v >= 0) ? v : NUM_DEFAULTS[k];
    }
    clean.returnShippingBy = RETURN_OPTIONS.includes(body.returnShippingBy) ? body.returnShippingBy : STR_DEFAULTS.returnShippingBy;
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
