import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser } from '@/lib/supabaseServer';

const BUCKET_ID = 'deal-files';
const MAX_SIZE = 30 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const me = await verifyUser(req);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 30MB' }, { status: 413 });

    const db = getAdminClient();
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const fileId = `${me.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await db.storage.from(BUCKET_ID).upload(fileId, buf, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
    if (error) throw new Error(error.message);

    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET_ID}/${fileId}`;

    return NextResponse.json({ fileId, fileName: file.name, url, mimeType: file.type });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[upload-deal]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
