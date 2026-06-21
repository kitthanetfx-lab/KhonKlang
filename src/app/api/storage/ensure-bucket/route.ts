/**
 * POST /api/storage/ensure-bucket
 * ตรวจให้บัคเก็ต kyc-docs มีอยู่ (สร้างให้ถ้ายังไม่มี) — เรียกจาก client ก่อนอัปโหลดไฟล์ครั้งแรก
 */
import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseServer';

const BUCKET_ID = 'kyc-docs';

export async function POST() {
  try {
    const db = getAdminClient();
    const { data: existing } = await db.storage.getBucket(BUCKET_ID);
    if (existing) return NextResponse.json({ ok: true, existed: true });

    const { error } = await db.storage.createBucket(BUCKET_ID, {
      public: true,
      fileSizeLimit: 30 * 1024 * 1024,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, existed: false });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('ensure-bucket error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
