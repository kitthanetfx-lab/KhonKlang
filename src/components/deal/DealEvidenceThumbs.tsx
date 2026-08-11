'use client';

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from 'react';
import { fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import { DealMediaLightbox, type DealMediaLightboxItem } from '@/components/deal/DealMediaLightbox';

export type DealEvidenceThumbItem = {
  id?: string;
  file_id: string;
  file_name?: string;
};

function isVideoName(name?: string) {
  return !!name?.match(/\.(mp4|mov|avi|webm|m4v|mkv)$/i);
}

type Props = {
  items: DealEvidenceThumbItem[];
  deletable?: boolean;
  onDelete?: (item: DealEvidenceThumbItem) => void;
  canDelete?: (item: DealEvidenceThumbItem) => boolean;
};

export function DealEvidenceThumbs({ items, deletable = false, onDelete, canDelete }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const lightboxItems = useMemo<DealMediaLightboxItem[]>(() => (
    items.map((item, i) => ({
      url: fileViewUrl(DEAL_BUCKET, item.file_id),
      isVideo: isVideoName(item.file_name),
      label: item.file_name || `ไฟล์ ${i + 1}`,
    }))
  ), [items]);

  if (items.length === 0) return null;

  return (
    <>
      <div className="deal-evidence-thumbs">
        {items.map((item, i) => {
          const isVideo = isVideoName(item.file_name);
          const url = fileViewUrl(DEAL_BUCKET, item.file_id);
          const showDelete = deletable && onDelete && (!canDelete || canDelete(item));

          return (
            <div key={item.id || i} className="deal-evidence-thumb-wrap">
              <button
                type="button"
                className="deal-evidence-thumb-btn"
                onClick={() => setLightboxIndex(i)}
                aria-label={`ขยายดู${item.file_name || `ไฟล์ ${i + 1}`}`}
              >
                {isVideo ? (
                  <video src={url} muted playsInline className="deal-evidence-thumb-media" />
                ) : (
                  <img src={url} alt={item.file_name || `ไฟล์ ${i + 1}`} className="deal-evidence-thumb-media" />
                )}
                {isVideo && <span className="deal-evidence-thumb-play" aria-hidden>▶</span>}
                <span className="deal-evidence-thumb-zoom" aria-hidden>🔍</span>
              </button>
              {showDelete && (
                <button
                  type="button"
                  className="deal-evidence-thumb-delete"
                  onClick={() => onDelete(item)}
                  title="ลบและอัปใหม่"
                  aria-label="ลบไฟล์"
                >
                  ✕
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
          ariaLabel="ดูหลักฐาน"
        />
      )}
    </>
  );
}
