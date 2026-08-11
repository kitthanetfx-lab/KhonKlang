'use client';

/* eslint-disable @next/next/no-img-element */

import { supabase } from '@/lib/supabase';
import { compressImage, isImageFile } from '@/lib/imageCompress';
import { isVideoFile } from '@/lib/videoCompress';

export type UploadedMedia = {
  fileId: string;
  url: string;
  name: string;
  isVideo: boolean;
};

type Props = {
  items: UploadedMedia[];
  onChange: (items: UploadedMedia[]) => void;
  uploading: boolean;
  onUploading: (v: boolean) => void;
  onError: (msg: string) => void;
  loginHref?: string;
};

async function uploadHeaders(): Promise<Record<string, string>> {
  let { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  const exp = session.expires_at ? session.expires_at * 1000 : 0;
  if (exp && exp - Date.now() < 60_000) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    session = refreshed.session ?? session;
  }
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export function SimpleDealMediaUpload({ items, onChange, uploading, onUploading, onError, loginHref }: Props) {
  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    onUploading(true);
    onError('');
    const errors: string[] = [];
    try {
      let headers = await uploadHeaders();
      if (!headers.Authorization) {
        onError(loginHref
          ? 'กรุณาเข้าสู่ระบบก่อนอัปโหลดรูป/วิดีโอ'
          : 'กรุณาเข้าสู่ระบบก่อนอัปโหลดรูป/วิดีโอ');
        return;
      }

      const uploaded: UploadedMedia[] = [];
      for (const raw of Array.from(files)) {
        const video = isVideoFile(raw);
        if (!video && !isImageFile(raw)) {
          errors.push(`${raw.name}: รองรับเฉพาะรูปภาพและวิดีโอ`);
          continue;
        }
        if (raw.size > 30 * 1024 * 1024) {
          errors.push(`${raw.name}: ไฟล์ใหญ่เกิน 30MB`);
          continue;
        }

        const file = video ? raw : await compressImage(raw);
        const fd = new FormData();
        fd.append('file', file);

        let res = await fetch('/api/upload-deal', { method: 'POST', headers, body: fd });
        if (res.status === 401) {
          headers = await uploadHeaders();
          if (!headers.Authorization) {
            onError('เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง');
            return;
          }
          res = await fetch('/api/upload-deal', { method: 'POST', headers, body: fd });
        }

        const d = await res.json().catch(() => ({}));
        if (!res.ok) {
          errors.push(d.error ? String(d.error) : `อัปโหลด ${raw.name} ไม่สำเร็จ`);
          continue;
        }

        uploaded.push({
          fileId: d.fileId,
          url: d.url || URL.createObjectURL(file),
          name: raw.name,
          isVideo: video,
        });
      }

      if (uploaded.length) onChange([...items, ...uploaded]);
      if (errors.length) {
        onError(errors.join(' · '));
      } else if (!uploaded.length) {
        onError('อัปโหลดไม่สำเร็จ — กรุณาลองใหม่');
      }
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ');
    } finally {
      onUploading(false);
    }
  }

  function remove(fileId: string) {
    onChange(items.filter(i => i.fileId !== fileId));
  }

  return (
    <div className="deal-field simple-deal-media">
      <label>รูป/วิดีโอสินค้า</label>
      <p className="simple-deal-media-hint">อัปโหลดได้ไม่จำกัด — แตะ × เพื่อลบออก</p>
      <div className="simple-deal-media-grid">
        {items.map(item => (
          <div key={item.fileId} className="simple-deal-media-item">
            {item.isVideo ? (
              <div className="simple-deal-media-video">
                <span aria-hidden>🎬</span>
                <span className="simple-deal-media-vname">{item.name}</span>
              </div>
            ) : (
              <img src={item.url} alt={item.name} />
            )}
            <button type="button" className="simple-deal-media-remove" onClick={() => remove(item.fileId)} aria-label="ลบ">×</button>
          </div>
        ))}
        <label className="simple-deal-media-add">
          <span>{uploading ? '⏳' : '📷'}</span>
          <span className="simple-deal-media-add-lbl">{uploading ? 'อัปโหลด…' : 'เพิ่ม'}</span>
          <input
            type="file"
            accept="image/*,video/*,.heic,.heif"
            multiple
            style={{ display: 'none' }}
            onChange={e => { void handleFiles(e.target.files); e.target.value = ''; }}
          />
        </label>
      </div>
    </div>
  );
}
