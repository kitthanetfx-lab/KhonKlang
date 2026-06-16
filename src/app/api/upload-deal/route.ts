import { NextRequest, NextResponse } from 'next/server';
import { Client, Storage, Account, ID, Permission, Role } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';

const BUCKET_ID = 'deal_files';

function getStorage() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Storage(client);
}

function getUserFromJwt(jwt: string) {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setJWT(jwt);
  return new Account(client).get();
}

const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi', 'webm', 'pdf'];

async function ensureBucket(storage: Storage) {
  try {
    const bucket = await storage.getBucket(BUCKET_ID) as unknown as { allowedFileExtensions?: string[] };
    // เปิดให้รองรับ .webm (วิดีโอคอลที่บันทึก) หากบัคเก็ตเดิมยังไม่อนุญาต
    const exts = bucket.allowedFileExtensions || [];
    if (exts.length && !exts.includes('webm')) {
      try {
        await storage.updateBucket(BUCKET_ID, 'Deal Files', [Permission.read(Role.any()), Permission.create(Role.users())], false, true, 30 * 1024 * 1024, Array.from(new Set([...exts, 'webm'])));
      } catch { /* ไม่มีสิทธิ์แก้บัคเก็ตก็ข้ามไป */ }
    }
    return;
  } catch {
    try {
      await storage.createBucket(
        BUCKET_ID,
        'Deal Files',
        [
          Permission.read(Role.any()),
          Permission.create(Role.users()),
        ],
        false,
        true,
        30 * 1024 * 1024,
        ALLOWED_EXT,
      );
      return;
    } catch (createErr) {
      try {
        await storage.getBucket(BUCKET_ID);
        return;
      } catch {
        const msg = createErr instanceof Error ? createErr.message : String(createErr);
        if (msg.includes('buckets.write')) {
          throw new Error('ยังอัปโหลดรูปสินค้าไม่ได้ เพราะ production ยังไม่มี bucket `deal_files` และ API key ปัจจุบันไม่มีสิทธิ์สร้าง bucket อัตโนมัติ กรุณาสร้าง bucket นี้ใน Appwrite Console หรือเพิ่ม scope `buckets.write`');
        }
        throw new Error(`ไม่พบบัคเก็ตรูปสินค้าและสร้างอัตโนมัติไม่สำเร็จ: ${msg}`);
      }
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentUser = await getUserFromJwt(jwt);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const storage = getStorage();
    await ensureBucket(storage);

    const buf = Buffer.from(await file.arrayBuffer());
    const result = await storage.createFile(
      BUCKET_ID,
      ID.unique(),
      InputFile.fromBuffer(buf, file.name),
      [
        Permission.read(Role.any()),
        Permission.update(Role.user(currentUser.$id)),
        Permission.delete(Role.user(currentUser.$id)),
      ],
    );

    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
    const project  = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
    const viewUrl  = `${endpoint}/storage/buckets/${BUCKET_ID}/files/${result.$id}/view?project=${project}`;

    return NextResponse.json({ fileId: result.$id, fileName: file.name, url: viewUrl, mimeType: file.type });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[upload-deal]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
