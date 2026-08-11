'use client';

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { DealMediaLightbox, type DealMediaLightboxItem } from '@/components/deal/DealMediaLightbox';

function isVideoName(name?: string) {
  return !!name?.match(/\.(mp4|mov|avi|webm|m4v|mkv)$/i);
}

export type PackingUploadEvidence = {
  file_id: string;
  file_name?: string;
};

type StepDef = { step: 1 | 2 | 3; title: string };

type Props = {
  steps: StepDef[];
  slots: (PackingUploadEvidence | null)[];
  compact?: boolean;
  fileUrl: (fileId: string) => string;
  canUploadStep: (step: 1 | 2 | 3) => boolean;
  uploadPreview: { url: string; name: string } | null;
  activeUploadStep: 1 | 2 | 3 | null;
  onPickFile: (step: 1 | 2 | 3) => void;
  onDelete?: (item: PackingUploadEvidence) => void;
  canDelete?: (item: PackingUploadEvidence) => boolean;
  evidenceFull?: boolean;
};

/** อัปโหลด 3 ขั้นแพ็ค (ผู้ขาย) — คลิกรูป/วิดีโอขยาย lightbox ได้ */
export function DealPackingUploadGrid({
  steps,
  slots,
  compact = false,
  fileUrl,
  canUploadStep,
  uploadPreview,
  activeUploadStep,
  onPickFile,
  onDelete,
  canDelete,
  evidenceFull = false,
}: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const lightboxItems = useMemo<DealMediaLightboxItem[]>(() => (
    slots.flatMap((slot, idx) => {
      if (!slot?.file_id) return [];
      return [{
        url: fileUrl(slot.file_id),
        isVideo: isVideoName(slot.file_name),
        label: steps[idx]?.title || `ขั้นตอน ${idx + 1}`,
      }];
    })
  ), [slots, steps, fileUrl]);

  const slotToLightboxIndex = useMemo(() => {
    const map = new Map<number, number>();
    let li = 0;
    slots.forEach((slot, idx) => {
      if (slot?.file_id) {
        map.set(idx, li);
        li += 1;
      }
    });
    return map;
  }, [slots]);

  function openSlot(index: number) {
    const li = slotToLightboxIndex.get(index);
    if (li == null) return;
    setLightboxIndex(li);
  }

  return (
    <>
      <div className={`pack-upload-grid${compact ? ' pack-upload-grid--simple' : ''}`}>
        {steps.map(item => {
          const slotIndex = item.step - 1;
          const uploaded = slots[slotIndex];
          const previewVisible = activeUploadStep === item.step && uploadPreview?.url;
          const locked = !canUploadStep(item.step);
          const isVideo = isVideoName(uploaded?.file_name);

          return (
            <div
              key={item.step}
              className={`pack-upload-slot${compact ? ' pack-upload-slot--simple' : ''}${locked ? ' is-locked' : ''}`}
            >
              <div className="pack-upload-slot-step">ขั้นตอน {item.step}</div>
              {uploaded ? (
                <button
                  type="button"
                  className="pack-upload-slot-open"
                  onClick={() => openSlot(slotIndex)}
                  aria-label={`ขยายดู${item.title}`}
                >
                  <div className="pack-upload-slot-media">
                    {isVideo ? (
                      <video src={fileUrl(uploaded.file_id)} muted playsInline className="pack-upload-slot-media-el" />
                    ) : (
                      <img src={fileUrl(uploaded.file_id)} alt={uploaded.file_name || item.title} className="pack-upload-slot-media-el" />
                    )}
                    {isVideo && <span className="pack-seller-evidence-play" aria-hidden>▶</span>}
                    <span className="pack-seller-evidence-zoom" aria-hidden>🔍</span>
                  </div>
                </button>
              ) : (
                <div className="pack-upload-slot-media">
                  {previewVisible ? (
                    <img src={uploadPreview!.url} alt={uploadPreview!.name} className="pack-upload-slot-media-el" />
                  ) : (
                    <div className="pack-upload-slot-placeholder">{item.step}</div>
                  )}
                </div>
              )}
              <div className="pack-upload-slot-status">
                {uploaded ? '✅ แล้ว' : locked ? `รอ ${item.step - 1}` : item.title}
              </div>
              <button
                type="button"
                className="btn btn-soft btn-block btn-sm"
                disabled={locked || !!uploaded}
                onClick={() => {
                  if (evidenceFull) return;
                  onPickFile(item.step);
                }}
              >
                <Icon name="upload" size={14} /> {uploaded ? 'แล้ว' : `ไฟล์ ${item.step}`}
              </button>
              {uploaded && onDelete && canDelete?.(uploaded) && (
                <button
                  type="button"
                  className="btn btn-ghost btn-block btn-sm pack-upload-slot-delete"
                  onClick={() => onDelete(uploaded)}
                >
                  ลบ / อัปใหม่
                </button>
              )}
            </div>
          );
        })}
      </div>

      {lightboxIndex != null && (
        <DealMediaLightbox
          items={lightboxItems}
          active={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onChange={setLightboxIndex}
          ariaLabel="ดูหลักฐานแพ็คสินค้า"
        />
      )}
    </>
  );
}
