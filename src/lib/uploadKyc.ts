import { account } from './appwrite';

export interface KycFiles {
  idCard?:      File | null;
  bookbank?:    File | null;
  companyCert?: File | null;
  slip?:        File | null;
}

export interface KycFileIds {
  idCard:      string;
  bookbank:    string;
  companyCert: string;
  slip:        string;
}

async function uploadOne(file: File | null | undefined, jwt: string): Promise<string> {
  if (!file) return '';
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/upload-kyc', {
    method: 'POST',
    headers: { 'x-session-jwt': jwt },
    body: form,
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || `Upload failed (${res.status})`);
  }
  const { fileId } = await res.json();
  return fileId as string;
}

/**
 * อัปโหลดไฟล์ KYC ทั้งหมดผ่าน /api/upload-kyc
 * คืนค่า object ที่มี fileId ของแต่ละไฟล์
 */
export async function uploadKycFiles(files: KycFiles): Promise<KycFileIds> {
  const jwt = (await account.createJWT()).jwt;
  const [idCard, bookbank, companyCert, slip] = await Promise.all([
    uploadOne(files.idCard,      jwt),
    uploadOne(files.bookbank,    jwt),
    uploadOne(files.companyCert, jwt),
    uploadOne(files.slip,        jwt),
  ]);
  return { idCard, bookbank, companyCert, slip };
}
