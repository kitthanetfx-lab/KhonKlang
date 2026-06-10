import { NextRequest, NextResponse } from 'next/server';
import { Client, Storage, Account, ID, Permission, Role } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';

const ENDPOINT   = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const API_KEY    = process.env.APPWRITE_API_KEY!;
const BUCKET_ID  = 'kyc_docs';

function getStorage() {
  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);
  return new Storage(client);
}

function getUserFromJwt(jwt: string) {
  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setJWT(jwt);
  return new Account(client).get();
}

async function ensureBucket(storage: Storage) {
  try {
    await storage.getBucket(BUCKET_ID);
  } catch {
    await storage.createBucket(
      BUCKET_ID,
      'KYC Documents',
      [
        Permission.read(Role.users()),
        Permission.create(Role.users()),
      ],
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentUser = await getUserFromJwt(jwt).catch(() => null);
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'ไม่พบไฟล์ที่อัปโหลด' }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 10MB กรุณาเลือกไฟล์ที่เล็กลง' }, { status: 413 });
    }
    const okType = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!okType) {
      return NextResponse.json({ error: 'รองรับเฉพาะไฟล์รูปภาพหรือ PDF' }, { status: 400 });
    }

    const storage = getStorage();
    await ensureBucket(storage);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const inputFile = InputFile.fromBuffer(buffer, file.name);

    const result = await storage.createFile(BUCKET_ID, ID.unique(), inputFile, [
      Permission.read(Role.user(currentUser.$id)),
      Permission.update(Role.user(currentUser.$id)),
      Permission.delete(Role.user(currentUser.$id)),
    ]);
    return NextResponse.json({ fileId: result.$id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[upload-kyc]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
