'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import { formatWarranty } from '@/lib/warranty';

function isVideoPath(fileId: string) {
  return /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(fileId);
}

type MediaItem = { fileId: string; url: string; isVideo: boolean };

type Props = {
  images?: string[];
  warrantyYears?: number | null;
  warrantyMonths?: number | null;
  warrantyDays?: number | null;
  /** ขนาดเล็กสำหรับหน้ารอ join — ให้จบในหน้าเดียวไม่ต้องเลื่อน */
  compact?: boolean;
};

export function DealProductGallery({ images = [], warrantyYears, warrantyMonths, warrantyDays, compact = false }: Props) {
  const warranty = formatWarranty(warrantyYears, warrantyMonths, warrantyDays);
  const items = useMemo<MediaItem[]>(() => images.map(fileId => ({
    fileId,
    url: fileViewUrl(DEAL_BUCKET, fileId),
    isVideo: isVideoPath(fileId),
  })), [images]);

  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
  }, [images]);

  if (items.length === 0 && !warranty) return null;

  const current = items[active];
  const hasMany = items.length > 1;

  function goPrev() {
    setActive(i => (i - 1 + items.length) % items.length);
  }

  function goNext() {
    setActive(i => (i + 1) % items.length);
  }

  return (
    <div className={`deal-product-gallery${compact ? ' deal-product-gallery--compact' : ''}`}>
      {warranty && (
        <div className="deal-product-warranty">
          <span className="deal-product-warranty-ic" aria-hidden>🛡️</span>
          <span>เงื่อนไขประกัน: <strong>{warranty}</strong></span>
        </div>
      )}

      {items.length > 0 && current && (
        <div className="deal-product-viewer">
          <div className="deal-product-main">
            {hasMany && (
              <button type="button" className="deal-product-nav deal-product-nav--prev" onClick={goPrev} aria-label="รูปก่อนหน้า">
                <Icon name="chevronRight" size={22} style={{ transform: 'rotate(180deg)' }} />
              </button>
            )}

            <div className="deal-product-main-frame">
              {current.isVideo ? (
                <video src={current.url} controls playsInline className="deal-product-main-media" />
              ) : (
                <a href={current.url} target="_blank" rel="noopener noreferrer" className="deal-product-main-link">
                  <img src={current.url} alt={`รูปสินค้า ${active + 1}`} className="deal-product-main-media" />
                </a>
              )}
            </div>

            {hasMany && (
              <button type="button" className="deal-product-nav deal-product-nav--next" onClick={goNext} aria-label="รูปถัดไป">
                <Icon name="chevronRight" size={22} />
              </button>
            )}
          </div>

          {hasMany && (
            <div className="deal-product-thumbs" role="tablist" aria-label="รูปสินค้าทั้งหมด">
              {items.map((item, i) => (
                <button
                  key={item.fileId}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  aria-label={item.isVideo ? `วิดีโอ ${i + 1}` : `รูป ${i + 1}`}
                  className={`deal-product-thumb${i === active ? ' is-active' : ''}`}
                  onClick={() => setActive(i)}
                >
                  {item.isVideo ? (
                    <span className="deal-product-thumb-video">🎬</span>
                  ) : (
                    <img src={item.url} alt="" loading="lazy" />
                  )}
                </button>
              ))}
            </div>
          )}

          {hasMany && (
            <p className="deal-product-counter">{active + 1} / {items.length}</p>
          )}
        </div>
      )}
    </div>
  );
}
