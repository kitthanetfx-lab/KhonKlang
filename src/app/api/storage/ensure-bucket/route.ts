/**
 * POST /api/storage/ensure-bucket
 * สร้าง KYC storage bucket ถ้ายังไม่มี
 * เรียกจาก client ก่อน upload ไฟล์ครั้งแรก
 */
import { NextResponse } from 'next/server';
import { Client, Storage, Permission, Role } from 'node-appwrite';

const BUCKET_ID = 'kyc_docs';

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

    // Check if bucket exists
    try {
      await s.getBucket(BUCKET_ID);
      return NextResponse.json({ ok: true, existed: true });
    } catch {
      // Create bucket
      await s.createBucket(
        BUCKET_ID,
        'KYC Documents',
        [
          Permission.read(Role.users()),
          Permission.write(Role.users()),
          Permission.read(Role.team('admin')),
        ],
        false,   // fileSecurity
        true,    // enabled
        30 * 1024 * 1024, // maxFileSize: 30MB
        ['jpg', 'jpeg', 'png', 'heic', 'pdf', 'webp'],
      );
      return NextResponse.json({ ok: true, existed: false });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('ensure-bucket error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
