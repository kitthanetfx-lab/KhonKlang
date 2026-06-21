import { authHeaders } from './supabase';
import { compressImage } from './imageCompress';

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

const MAX_BYTES = 8 * 1024 * 1024; // 8MB หลังบีบอัด

async function uploadOne(file: File | null | undefined, headers: Record<string, string>, label: string): Promise<string> {
  if (!file) return '';
  // บีบอัดรูปก่อนส่ง — รูปจากกล้องมือถือมักใหญ่เกินลิมิต request ของเซิร์ฟเวอร์
  const prepared = await compressImage(file);
  if (prepared.size > MAX_BYTES) {
    throw new Error(`ไฟล์ "${label}" ใหญ่เกิน 8MB กรุณาเลือกไฟล์ที่เล็กลง`);
  }
  const form = new FormData();
  form.append('file', prepared);
  const res = await fetch('/api/upload-kyc', {
    method: 'POST',
    headers,
    body: form,
  });
  if (!res.ok) {
    if (res.status === 413) throw new Error(`ไฟล์ "${label}" ใหญ่เกินกว่าเซิร์ฟเวอร์รับได้ กรุณาเลือกไฟล์ที่เล็กลง`);
    if (res.status === 401) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง');
    const d = await res.json().catch(() => ({} as { error?: string }));
    throw new Error(d.error ? `อัปโหลด "${label}" ไม่สำเร็จ: ${d.error}` : `อัปโหลด "${label}" ไม่สำเร็จ (${res.status})`);
  }
  const { fileId } = await res.json();
  return fileId as string;
}

/**
 * อัปโหลดไฟล์ KYC ทั้งหมดผ่าน /api/upload-kyc
 * คืนค่า object ที่มี fileId ของแต่ละไฟล์
 */
export async function uploadKycFiles(files: KycFiles): Promise<KycFileIds> {
  const headers = await authHeaders();
  if (!headers.Authorization) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง');
  const [idCard, bookbank, companyCert, slip] = await Promise.all([
    uploadOne(files.idCard,      headers, 'บัตรประชาชน'),
    uploadOne(files.bookbank,    headers, 'หน้าสมุดบัญชี'),
    uploadOne(files.companyCert, headers, 'หนังสือรับรองบริษัท'),
    uploadOne(files.slip,        headers, 'สลิปการโอนเงิน'),
  ]);
  return { idCard, bookbank, companyCert, slip };
}
