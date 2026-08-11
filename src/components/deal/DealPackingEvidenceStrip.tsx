'use client';

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from 'react';
import { fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import { DealMediaLightbox, type DealMediaLightboxItem } from '@/components/deal/DealMediaLightbox';

function isVideoName(name?: string) {
  return !!name?.match(/\.(mp4|mov|avi|webm|m4v|mkv)$/i);
}

export type PackingEvidenceSlot = {
  file_id: string;
  file_name?: string;
} | null;

type Props = {
  slots: PackingEvidenceSlot[];
  labels: string[];
};

export function DealPackingEvidenceStrip({ slots, labels }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const lightboxItems = useMemo<DealMediaLightboxItem[]>(() => (
    slots.flatMap((slot, idx) => {
      if (!slot?.file_id) return [];
      return [{
        url: fileViewUrl(DEAL_BUCKET, slot.file_id),
        isVideo: isVideoName(slot.file_name),
        label: labels[idx] || `ขั้นตอน ${idx + 1}`,
      }];
    })
  ), [slots, labels]);

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
      <div className="pack-seller-evidence-grid">
        {slots.map((uploaded, idx) => {
          const clickable = !!uploaded?.file_id;
          const isVideo = isVideoName(uploaded?.file_name);
          const url = uploaded?.file_id ? fileViewUrl(DEAL_BUCKET, uploaded.file_id) : '';
          const label = labels[idx] || `ขั้นตอน ${idx + 1}`;

          return (
            <div key={idx} className="pack-seller-evidence-slot">
              {clickable ? (
                <button
                  type="button"
                  className="pack-seller-evidence-open"
                  onClick={() => openSlot(idx)}
                  aria-label={`ขยายดู${label}`}
                >
                  <div className="pack-seller-evidence-media">
                    {isVideo ? (
                      <video src={url} muted playsInline className="pack-seller-evidence-img" />
                    ) : (
                      <img src={url} alt={label} className="pack-seller-evidence-img" />
                    )}
                    {isVideo && <span className="pack-seller-evidence-play" aria-hidden>▶</span>}
                    <span className="pack-seller-evidence-zoom" aria-hidden>🔍</span>
                  </div>
                </button>
              ) : (
                <div className="pack-seller-evidence-media pack-seller-evidence-media--empty">
                  <span className="pack-seller-evidence-placeholder">{idx + 1}</span>
                </div>
              )}
              <div className="pack-seller-evidence-label">
                {uploaded ? `✅ ${label}` : label}
              </div>
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
          ariaLabel="ดูหลักฐานจากผู้ขาย"
        />
      )}
    </>
  );
}
