'use client';

/* eslint-disable @next/next/no-img-element */

import { authHeaders } from '@/lib/supabase';
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
};

export function SimpleDealMediaUpload({ items, onChange, uploading, onUploading, onError }: Props) {
  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    onUploading(true);
    onError('');
    try {
      const headers = await authHeaders();
      const uploaded: UploadedMedia[] = [];
      for (const file of Array.from(files)) {
        if (!isVideoFile(file) && !file.type.startsWith('image/')) {
          onError(`${file.name}: รองรับเฉพาะรูปภาพและวิดีโอ`);
          continue;
        }
        if (file.size > 30 * 1024 * 1024) {
          onError(`${file.name}: ไฟล์ใหญ่เกิน 30MB`);
          continue;
        }
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/upload-deal', { method: 'POST', headers, body: fd });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || `อัปโหลด ${file.name} ไม่สำเร็จ`);
        uploaded.push({
          fileId: d.fileId,
          url: d.url,
          name: file.name,
          isVideo: isVideoFile(file),
        });
      }
      if (uploaded.length) onChange([...items, ...uploaded]);
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
          <input type="file" accept="image/*,video/*" multiple hidden onChange={e => { void handleFiles(e.target.files); e.target.value = ''; }} />
        </label>
      </div>
    </div>
  );
}
