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
  // Just check if exists; creation is done manually in Appwrite Console
  // Bucket "deal_files" must have: read=any, create=users
  try {
    await storage.getBucket(BUCKET_ID);
  } catch {
    // Try to create — may fail if API key lacks buckets.write scope
    // In that case, create the bucket manually in Appwrite Console > Storage
    await storage.createBucket(BUCKET_ID, 'Deal Files', [
      Permission.read(Role.any()),
      Permission.create(Role.users()),
    ], false, undefined, undefined, ['jpg','jpeg','png','gif','webp','mp4','mov','avi','pdf'])
    .catch(() => {}); // Ignore if creation fails (bucket may already exist or no permission)
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
    co