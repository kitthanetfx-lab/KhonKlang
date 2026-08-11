import { supabase, DEAL_BUCKET } from '@/lib/supabase';
import { compressImage, isImageFile } from '@/lib/imageCompress';
import { compressVideo, isVideoFile } from '@/lib/videoCompress';

export type DealUploadResult = {
  fileId: string;
  url: string;
  fileName: string;
  isVideo: boolean;
};

async function authHeadersFresh(): Promise<Record<string, string>> {
  let { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  const exp = session.expires_at ? session.expires_at * 1000 : 0;
  if (exp && exp - Date.now() < 60_000) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    session = refreshed.session ?? session;
  }
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

/** อัปโหลดรูป/วิดีโอเข้า deal-files — logic เดียวกับ uploadFile ในห้องดีล */
export async function uploadDealFile(
  file: File,
  userId: string,
  onProgress?: (pct: number, label?: string) => void,
): Promise<DealUploadResult> {
  if (!isVideoFile(file) && !isImageFile(file)) {
    throw new Error(`${file.name}: รองรับเฉพาะรูปภาพและวิดีโอ`);
  }
  if (file.size > 30 * 1024 * 1024) {
    throw new Error(`${file.name}: ไฟล์ใหญ่เกิน 30MB`);
  }

  if (isVideoFile(file)) {
    let prepared: File;
    try {
      prepared = await compressVideo(file, (pct, label) => onProgress?.(pct, label || 'กำลังบีบอัดวิดีโอ...'));
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'VIDEO_TOO_LONG') throw new Error('วิดีโอยาวเกิน 5 นาที — กรุณาตัดหรือถ่ายใหม่');
      if (code === 'UNSUPPORTED') throw new Error('เบราว์เซอร์บีบอัดวิดีโอไม่ได้ — ลอง Chrome/Safari เวอร์ชันล่าสุด');
      throw new Error('บีบอัดวิดีโอไม่สำเร็จ');
    }
    if (prepared.size > 50 * 1024 * 1024) {
      throw new Error('วิดีโอหลังบีบอัดยังใหญ่เกิน 50MB');
    }
    onProgress?.(0, 'กำลังอัปโหลด...');
    const ext = (prepared.name.split('.').pop() || 'webm').toLowerCase();
    const path = `${userId || 'guest'}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(DEAL_BUCKET).upload(path, prepared, {
      contentType: prepared.type || 'video/webm',
    });
    if (error) throw new Error(error.message || 'อัปโหลดวิดีโอไม่สำเร็จ');
    const url = supabase.storage.from(DEAL_BUCKET).getPublicUrl(path).data.publicUrl;
    return { fileId: path, url, fileName: file.name, isVideo: true };
  }

  let headers = await authHeadersFresh();
  if (!headers.Authorization) throw new Error('กรุณาเข้าสู่ระบบก่อนอัปโหลด');

  const prepared = await compressImage(file);
  const fd = new FormData();
  fd.append('file', prepared);

  let res = await fetch('/api/upload-deal', { method: 'POST', headers, body: fd });
  if (res.status === 401) {
    headers = await authHeadersFresh();
    if (!headers.Authorization) throw new Error('เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่');
    res = await fetch('/api/upload-deal', { method: 'POST', headers, body: fd });
  }
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error ? String(d.error) : 'อัปโหลดไม่สำเร็จ');

  return {
    fileId: d.fileId,
    url: d.url || URL.createObjectURL(prepared),
    fileName: file.name,
    isVideo: false,
  };
}
