import { NextRequest, NextResponse } from 'next/server';
import { Client, Storage, ID, Permission, Role } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';

const BUCKET_ID = 'deal_files';

function getStorage() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Storage(client);
}

async function ensureBucket(storage: Storage) {
  try { await storage.getBucket(BUCKET_ID); }
  catch {
    await storage.createBucket(BUCKET_ID, 'Deal Files', [
      Permission.read(Role.users()),
      Permission.create(Role.users()),
    ], false, undefined, undefined, ['jpg','jpeg','png','gif','webp','mp4','mov','avi','pdf']);
  }
}

export async function POST(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const storage = getStorage();
    await ensureBucket(storage);

    const buf = Buffer.from(await file.arrayBuffer());
    const result = await storage.createFile(BUCKET_ID, ID.unique(), InputFile.fromBuffer(buf, file.name));

    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
    const project  = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
    const viewUrl  = `${endpoint}/storage/buckets/${BUCKET_ID}/files/${result.$id}/view?project=${project}`;

    return NextResponse.json({ fileId: result.$id, fileName: file.name, url: viewUrl, mimeType: file.type });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
