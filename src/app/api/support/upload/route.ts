import { NextRequest, NextResponse } from 'next/server';
import { Client, Storage, Account, ID, Permission, Role } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';

/**
 * ใช้บัคเก็ต `deal_files` ที่มีอยู่แล้วร่วมกับฟีเจอร์อื่น (ไม่สร้างบัคเก็ตใหม่ `support_files`)
 * เพราะแพลน Appwrite ปัจจุบันจำกัดจำนวนบัคเก็ตสูงสุดไว้ และ project ใช้ครบโควต้าแล้ว
 * ("The maximum number of buckets allowed for the selected plan has reached")
 */
const BUCKET_ID = 'deal_files';
const MAX_SIZE = 8 * 1024 * 1024;

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

/** POST — อัปโหลดรูปสำหรับแชทศูนย์ช่วยเหลือ (ทั้งฝั่งลูกค้าและพนักงานใช้ endpoint เดียวกัน) */
export async function POST(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentUser = await getUserFromJwt(jwt);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'รองรับเฉพาะไฟล์รูปภาพ' }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 8MB' }, { status: 400 });

    const storage = getStorage();

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
    console.error('[support/upload]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
