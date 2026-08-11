'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/Icon';

export type DealMediaLightboxItem = {
  url: string;
  isVideo: boolean;
  label?: string;
};

type Props = {
  items: DealMediaLightboxItem[];
  active: number;
  onClose: () => void;
  onChange: (index: number) => void;
  ariaLabel?: string;
};

export function DealMediaLightbox({ items, active, onClose, onChange, ariaLabel = 'ดูหลักฐาน' }: Props) {
  const current = items[active];
  const hasMany = items.length > 1;

  const goPrev = useCallback(() => {
    onChange((active - 1 + items.length) % items.length);
  }, [active, items.length, onChange]);

  const goNext = useCallback(() => {
    onChange((active + 1) % items.length);
  }, [active, items.length, onChange]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && hasMany) goPrev();
      else if (e.key === 'ArrowRight' && hasMany) goNext();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, goPrev, goNext, hasMany]);

  if (!current || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="deal-product-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={onClose}
    >
      <button type="button" className="deal-product-lightbox-close" onClick={onClose} aria-label="ปิด">
        ✕
      </button>

      {hasMany && (
        <>
          <button
            type="button"
            className="deal-product-lightbox-nav deal-product-lightbox-nav--prev"
            onClick={e => { e.stopPropagation(); goPrev(); }}
            aria-label="ก่อนหน้า"
          >
            <Icon name="chevronRight" size={26} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <button
            type="button"
            className="deal-product-lightbox-nav deal-product-lightbox-nav--next"
            onClick={e => { e.stopPropagation(); goNext(); }}
            aria-label="ถัดไป"
          >
            <Icon name="chevronRight" size={26} />
          </button>
        </>
      )}

      <div className="deal-product-lightbox-stage" onClick={e => e.stopPropagation()}>
        {current.isVideo ? (
          <video key={current.url} src={current.url} controls playsInline autoPlay className="deal-product-lightbox-media" />
        ) : (
          <img src={current.url} alt={current.label || `หลักฐาน ${active + 1}`} className="deal-product-lightbox-media" />
        )}
        <p className="deal-product-lightbox-counter">
          {current.label ? `${current.label} · ` : ''}{active + 1} / {items.length}
        </p>
      </div>
    </div>,
    document.body,
  );
}
