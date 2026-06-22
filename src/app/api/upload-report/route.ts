import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser, HttpError } from '@/lib/supabaseServer';

const BUCKET_ID = 'report-files';
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
    if (!okType) return NextResponse.json({ error: 'รองรับเฉพาะรูปภาพหรือ PDF' }, { status: 400 });

    const db = getAdminClient();
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    // โฟลเดอร์ตาม user id — กันชื่อไฟล์ของคนละคนไปกองรวมกันจนแยกไม่ออกในหน้า Storage
    const fileId = `${me.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await db.storage.from(BUCKET_ID).upload(fileId, buf, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw new Error(error.message);

    return NextResponse.json({ fileId, fileName: file.name });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[upload-report]', msg);
    return NextResponse.json({ error: status === 401 ? 'กรุณาเข้าสู่ระบบก่อน' : msg }, { status });
  }
}
