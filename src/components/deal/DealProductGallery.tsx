'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setActive(0);
    setLightboxOpen(false);
  }, [images]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const hasMany = items.length > 1;
  const current = items[active];

  const goPrev = useCallback(() => {
    setActive(i => (i - 1 + items.length) % items.length);
  }, [items.length]);

  const goNext = useCallback(() => {
    setActive(i => (i + 1) % items.length);
  }, [items.length]);

  const openLightbox = useCallback((index: number) => {
    setActive(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  useEffect(() => {
    if (!lightboxOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft' && hasMany) goPrev();
      else if (e.key === 'ArrowRight' && hasMany) goNext();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [lightboxOpen, hasMany, goPrev, goNext, closeLightbox]);

  if (items.length === 0 && !warranty) return null;

  const lightboxNode = lightboxOpen && current && mounted ? createPortal(
    <div
      className="deal-product-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`ดูรูปสินค้า ${active + 1} จาก ${items.length}`}
      onClick={closeLightbox}
    >
      <button type="button" className="deal-product-lightbox-close" onClick={closeLightbox} aria-label="ปิด">
        ✕
      </button>

      {hasMany && (
        <>
          <button
            type="button"
            className="deal-product-lightbox-nav deal-product-lightbox-nav--prev"
            onClick={e => { e.stopPropagation(); goPrev(); }}
            aria-label="รูปก่อนหน้า"
          >
            <Icon name="chevronRight" size={26} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <button
            type="button"
            className="deal-product-lightbox-nav deal-product-lightbox-nav--next"
            onClick={e => { e.stopPropagation(); goNext(); }}
            aria-label="รูปถัดไป"
          >
            <Icon name="chevronRight" size={26} />
          </button>
        </>
      )}

      <div className="deal-product-lightbox-stage" onClick={e => e.stopPropagation()}>
        {current.isVideo ? (
          <video key={current.fileId} src={current.url} controls playsInline autoPlay className="deal-product-lightbox-media" />
        ) : (
          <img src={current.url} alt={`รูปสินค้า ${active + 1}`} className="deal-product-lightbox-media" />
        )}
        {hasMany && (
          <p className="deal-product-lightbox-counter">{active + 1} / {items.length}</p>
        )}
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
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
                  <button
                    type="button"
                    className="deal-product-main-link"
                    onClick={() => openLightbox(active)}
                    aria-label={`ขยายดูรูป ${active + 1}`}
                  >
                    <img src={current.url} alt={`รูปสินค้า ${active + 1}`} className="deal-product-main-media" />
                    <span className="deal-product-zoom-hint" aria-hidden>🔍 แตะเพื่อขยาย</span>
                  </button>
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
                    onClick={() => {
                      setActive(i);
                      if (!item.isVideo) openLightbox(i);
                    }}
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
      {lightboxNode}
    </>
  );
}
