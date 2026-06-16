/**
 * POST /api/storage/ensure-deal-bucket
 * ตรวจให้บัคเก็ต deal_files มีอยู่ และอนุญาตสกุลไฟล์ที่จำเป็น (รวม .webm สำหรับวิดีโอคอลที่บันทึก)
 * เรียกจาก client ก่อนอัปโหลดไฟล์ตรงเข้า Appwrite Storage (เลี่ยงลิมิตขนาด body ของ API route บน Vercel)
 */
import { NextResponse } from 'next/server';
import { Client, Storage, Permission, Role } from 'node-appwrite';

const BUCKET_ID = 'deal_files';
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi', 'webm', 'pdf'];

function getAdminStorage() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Storage(client);
}

export async function POST() {
  try {
    const s = getAdminStorage();
    try {
      const bucket = await s.getBucket(BUCKET_ID) as unknown as { allowedFileExtensions?: string[] };
      const exts = bucket.allowedFileExtensions || [];
      if (exts.length && !exts.includes('webm')) {
        try {
          await s.updateBucket(BUCKET_ID, 'Deal Files', [Permission.read(Role.any()), Permission.create(Role.users())], false, true, 30 * 1024 * 1024, Array.from(new Set([...exts, 'webm'])));
        } catch { /* ไม่มีสิทธิ์แก้บัคเก็ตก็ข้ามไป */ }
      }
      return NextResponse.json({ ok: true, existed: true });
    } catch {
      await s.createBucket(
        BUCKET_ID, 'Deal Files',
        [Permission.read(Role.any()), Permission.create(Role.users())],
        false, true, 30 * 1024 * 1024, ALLOWED_EXT,
      );
      return NextResponse.json({ ok: true, existed: false });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
