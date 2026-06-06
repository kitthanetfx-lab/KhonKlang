import { ID } from 'appwrite';
import { storage, KYC_BUCKET } from './appwrite';

let bucketReady = false;

/** ตรวจสอบ / สร้าง bucket ก่อน upload (เรียกครั้งเดียว) */
async function ensureBucket() {
  if (bucketReady) return;
  try {
    await fetch('/api/storage/ensure-bucket', { method: 'POST' });
    bucketReady = true;
  } catch {
    // ถ้า API ล้มเหลว ลอง upload ต่อเลย
    bucketReady = true;
  }
}

/**
 * Upload ไฟล์ไปที่ Appwrite Storage bucket "kyc_docs"
 * @returns Appwrite file ID
 */
export async function uploadKycFile(file: File): Promise<string> {
  await ensureBucket();
  const result = await storage.createFile(KYC_BUCKET, ID.unique(), file);
  return result.$id;
}

/**
 * Upload หลายไฟล์พร้อมกัน
 * @param files Record ของ label → File | null
 * @returns Record ของ label → fileId (หรือ '' ถ้าไม่มีไฟล์)
 */
export async function uploadKycFiles(
  files: Record<string, File | null>
): Promise<Record<string, string>> {
  await ensureBucket();
  const result: Record<string, string> = {};
  await Promise.all(
    Object.entries(files).map(async ([key, file]) => {
      if (file) {
        result[key] = await storage.createFile(KYC_BUCKET, ID.unique(), file).then(r => r.$id);
      } else {
        result[key] = '';
      }
    })
  );
  return result;
}
