'use client';

/* eslint-disable @next/next/no-img-element */

import { useRef } from 'react';
import { Icon } from '@/components/Icon';
import { useGlobalLoadingOptional } from '@/components/GlobalLoadingProvider';
import { uploadDealFile, type DealUploadResult } from '@/lib/uploadDealFile';

export type CreateDealMedia = DealUploadResult;

type Props = {
  items: CreateDealMedia[];
  onChange: (items: CreateDealMedia[]) => void;
  uploading: boolean;
  onUploading: (v: boolean) => void;
  onError: (msg: string) => void;
  userId?: string;
};

export function DealCreateMediaField({ items, onChange, uploading, onUploading, onError, userId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const globalLoading = useGlobalLoadingOptional();

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    if (!userId) {
      onError('กรุณาเข้าสู่ระบบก่อนอัปโหลดรูป/วิดีโอ');
      return;
    }
    onUploading(true);
    globalLoading?.beginLoading();
    onError('');
    const errors: string[] = [];
    const uploaded: CreateDealMedia[] = [];
    try {
      for (const file of Array.from(files)) {
        try {
          uploaded.push(await uploadDealFile(file, userId));
        } catch (err: unknown) {
          errors.push(err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ');
        }
      }
      if (uploaded.length) onChange([...items, ...uploaded]);
      if (errors.length) onError(errors.join(' · '));
    } finally {
      onUploading(false);
      globalLoading?.endLoading();
    }
  }

  function remove(fileId: string) {
    onChange(items.filter(i => i.fileId !== fileId));
  }

  return (
    <div className="deal-field simple-deal-media">
      <label>รูป/วิดีโอสินค้า</label>
      <p className="simple-deal-media-hint">อัปโหลดได้ไม่จำกัด — ใช้ระบบเดียวกับหลักฐานในห้องดีล · แตะ × เพื่อลบ</p>
      {items.length > 0 && (
        <div className="simple-deal-media-grid">
          {items.map(item => (
            <div key={item.fileId} className="simple-deal-media-item">
              {item.isVideo ? (
                <div className="simple-deal-media-video">
                  <span aria-hidden>🎬</span>
                  <span className="simple-deal-media-vname">{item.fileName}</span>
                </div>
              ) : (
                <img src={item.url} alt={item.fileName} />
              )}
              <button type="button" className="simple-deal-media-remove" onClick={() => remove(item.fileId)} aria-label="ลบ">×</button>
            </div>
          ))}
        </div>
      )}
      <div className="dr-card" style={{ marginTop: items.length ? 10 : 0 }}>
        <button type="button" data-upload-trigger onClick={() => inputRef.current?.click()} disabled={uploading} className="btn btn-soft btn-block">
          <Icon name="upload" size={16} /> {uploading ? 'กำลังอัปโหลด…' : 'เลือกไฟล์ (รูป/วิดีโอ)'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*,.heic,.heif"
          multiple
          style={{ display: 'none' }}
          onChange={e => { void handleFiles(e.target.files); e.target.value = ''; }}
        />
      </div>
    </div>
  );
}
