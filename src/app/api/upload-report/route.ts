import { NextRequest, NextResponse } from 'next/server';
import { Client, Storage, ID, Permission, Role } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';

const BUCKET_ID = 'report_files';

function getStorage() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Storage(client);
}

async function ensureBucket(storage: Storage) {
  try { await storage.getBucket(BUCKET_ID); return; } catch { /* create below */ }
  try {
    await storage.createBucket(
      BUCKET_ID,
      'Scam Report Files',
      [Permission.read(Role.any()), Permission.create(Role.users())],
      false, true,
      15 * 1024 * 1024,
      ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf'],
    );
  } catch (err) {
    try { await storage.getBucket(BUCKET_ID); return; } catch {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('buckets.write')) {
        throw new Error('ยังไม่มี bucket `report_files` และ API key ไม่มีสิทธิ์สร้างอัตโนมัติ กรุณาสร้างใน Appwrite Console');
      }
      throw err;
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'ไม่พบไฟล์ที่อัปโหลด' }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 10MB กรุณาเลือกไฟล์ที่เล็กลง' }, { status: 413 });
    }
    const okType = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!okType) return NextResponse.json({ error: 'รองรับเฉพาะรูปภาพหรือ PDF' }, { status: 400 });

    const storage = getStorage();
    await ensureBucket(storage);

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await storage.createFile(BUCKET_ID, ID.unique(), InputFile.fromBuffer(buffer, file.name));
    return NextResponse.json({ fileId: result.$id, fileName: file.name });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[upload-report]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
