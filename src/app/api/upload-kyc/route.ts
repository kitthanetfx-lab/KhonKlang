import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser } from '@/lib/supabaseServer';

const BUCKET_ID = 'kyc-docs';
const MAX_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const me = await verifyUser(req);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'ไม่พบไฟล์ที่อัปโหลด' }, { status: 400 });
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 10MB กรุณาเลือกไฟล์ที่เล็กลง' }, { status: 413 });
    }
    const okType = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!okType) {
      return NextResponse.json({ error: 'รองรับเฉพาะไฟล์รูปภาพหรือ PDF' }, { status: 400 });
    }

    const db = getAdminClient();
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const fileId = `${me.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await db.storage.from(BUCKET_ID).upload(fileId, buf, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw new Error(error.message);

    return NextResponse.json({ fileId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[upload-kyc]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
