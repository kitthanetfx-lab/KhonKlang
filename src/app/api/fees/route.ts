// GET /api/fees — อ่านค่าธรรมเนียมที่แอดมินตั้งไว้ (สาธารณะ อ่านอย่างเดียว)
// ใช้แสดงให้ผู้บริโภครับรู้ค่าบริการตั้งแต่ต้น
import { NextResponse } from 'next/server';
import { Client, Databases } from 'node-appwrite';
import { FEE_DEFAULTS } from '@/lib/fees';

const DB_ID = 'khonklang_db';
const COL = 'app_config';
const DOC = 'fees';

function adminDb() {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Databases(c);
}

export async function GET() {
  try {
    const doc = await adminDb().getDocument(DB_ID, COL, DOC) as unknown as { data?: string };
    const saved = JSON.parse(doc.data || '{}');
    return NextResponse.json({ fees: { ...FEE_DEFAULTS, ...saved } });
  } catch {
    // ยังไม่ได้ตั้งค่า → ใช้ค่าเริ่มต้น
    return NextResponse.json({ fees: FEE_DEFAULTS });
  }
}
