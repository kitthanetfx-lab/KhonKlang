'use client';

/* eslint-disable @next/next/no-img-element */

import { CSSProperties, ReactNode, useMemo, useState } from 'react';
import { DealMediaLightbox, type DealMediaLightboxItem } from '@/components/deal/DealMediaLightbox';

export function isDealVideoFile(name?: string) {
  return !!name?.match(/\.(mp4|mov|avi|webm|m4v|mkv)$/i);
}

export function isDealImageFile(name?: string) {
  return !!name?.match(/\.(jpg|jpeg|png|gif|webp|bmp|heic)$/i);
}

type ClickableProps = {
  url: string;
  alt?: string;
  label?: string;
  isVideo?: boolean;
  maxHeight?: number | string;
  objectFit?: 'cover' | 'contain';
  className?: string;
  style?: CSSProperties;
  /** เติมพื้นที่ slot แบบ aspect-ratio (ใช้ใน grid แพ็ค) */
  fill?: boolean;
};

/** รูป/วิดีโอเดี่ยว — คลิกแล้วเปิด popup เท่านั้น */
export function DealClickableMedia({
  url, alt, label, isVideo, maxHeight = 220, objectFit = 'contain', className, style, fill = false,
}: ClickableProps) {
  const [open, setOpen] = useState(false);
  const items: DealMediaLightboxItem[] = [{ url, isVideo: !!isVideo, label: label || alt }];
  const mediaStyle: CSSProperties = fill
    ? { objectFit, width: '100%', height: '100%', maxHeight: 'none' }
    : { objectFit, maxHeight };

  return (
    <>
      <button
        type="button"
        className={`deal-clickable-media${fill ? ' deal-clickable-media--fill' : ''}${className ? ` ${className}` : ''}`}
        style={style}
        onClick={() => setOpen(true)}
        aria-label={`ขยายดู${label || alt || 'ไฟล์'}`}
      >
        {isVideo ? (
          <>
            <video src={url} muted playsInline className="deal-clickable-media-el" style={mediaStyle} />
            <span className="deal-clickable-media-play" aria-hidden>▶</span>
          </>
        ) : (
          <img src={url} alt={alt || label || ''} className="deal-clickable-media-el" style={mediaStyle} />
        )}
        <span className="deal-clickable-media-zoom" aria-hidden>🔍</span>
      </button>
      {open && (
        <DealMediaLightbox
          items={items}
          active={0}
          onClose={() => setOpen(false)}
          onChange={() => {}}
          ariaLabel={label || alt || 'ดูไฟล์'}
        />
      )}
    </>
  );
}

type OpenLinkProps = {
  url: string;
  label?: string;
  isVideo?: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/** ลิงก์ข้อความ — คลิกแล้วเปิด popup (ไม่เปิดแท็บใหม่) */
export function DealMediaOpenLink({ url, label, isVideo, children, className, style }: OpenLinkProps) {
  const [open, setOpen] = useState(false);
  const items: DealMediaLightboxItem[] = [{ url, isVideo: !!isVideo, label: label || 'ดูไฟล์' }];

  return (
    <>
      <button
        type="button"
        className={`deal-media-open-link${className ? ` ${className}` : ''}`}
        style={style}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      {open && (
        <DealMediaLightbox
          items={items}
          active={0}
          onClose={() => setOpen(false)}
          onChange={() => {}}
          ariaLabel={label || 'ดูไฟล์'}
        />
      )}
    </>
  );
}

export type DealMediaThumbSource = {
  id?: string;
  fileId: string;
  fileName?: string;
  label?: string;
  url?: string;
};

type GalleryProps = {
  items: DealMediaThumbSource[];
  resolveUrl?: (fileId: string) => string;
  thumbHeight?: number;
  thumbWidth?: number | string;
  showLabels?: boolean;
};

/** แถบรูปย่อ — จัดกึ่งกลาง + คลิกเปิด popup */
export function DealMediaThumbGallery({
  items,
  resolveUrl,
  thumbHeight = 90,
  thumbWidth = 'min(130px, 28vw)',
  showLabels = true,
}: GalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const lightboxItems = useMemo<DealMediaLightboxItem[]>(() => (
    items.map((item, i) => {
      const url = item.url ?? resolveUrl?.(item.fileId) ?? '';
      return {
        url,
        isVideo: isDealVideoFile(item.fileName),
        label: item.label || item.fileName || `ไฟล์ ${i + 1}`,
      };
    })
  ), [items, resolveUrl]);

  if (items.length === 0) return null;

  return (
    <>
      <div className="deal-media-thumb-gallery">
        {items.map((item, i) => {
          const url = item.url ?? resolveUrl?.(item.fileId) ?? '';
          const isVideo = isDealVideoFile(item.fileName);
          const label = item.label || item.fileName || `ไฟล์ ${i + 1}`;
          return (
            <div key={item.id ?? item.fileId ?? i} className="deal-media-thumb-cell" style={{ width: thumbWidth }}>
              <button
                type="button"
                className="deal-media-thumb-btn"
                style={{ height: thumbHeight }}
                onClick={() => setLightboxIndex(i)}
                aria-label={`ขยายดู${label}`}
              >
                {isVideo ? (
                  <video src={url} muted playsInline className="deal-media-thumb-img" />
                ) : (
                  <img src={url} alt={label} className="deal-media-thumb-img" />
                )}
                {isVideo && <span className="deal-media-thumb-play" aria-hidden>▶</span>}
                <span className="deal-media-thumb-zoom" aria-hidden>🔍</span>
              </button>
              {showLabels && label && <p className="deal-media-thumb-label">{label}</p>}
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
