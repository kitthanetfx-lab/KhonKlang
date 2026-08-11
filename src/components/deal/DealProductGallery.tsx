'use client';

/* eslint-disable @next/next/no-img-element */

import { fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import { formatWarranty } from '@/lib/warranty';

function isVideoPath(fileId: string) {
  return /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(fileId);
}

type Props = {
  images?: string[];
  warrantyYears?: number | null;
  warrantyMonths?: number | null;
  warrantyDays?: number | null;
};

export function DealProductGallery({ images = [], warrantyYears, warrantyMonths, warrantyDays }: Props) {
  const warranty = formatWarranty(warrantyYears, warrantyMonths, warrantyDays);
  if (images.length === 0 && !warranty) return null;

  return (
    <div className="deal-product-gallery">
      {warranty && (
        <div className="deal-product-warranty">
          <span className="deal-product-warranty-ic" aria-hidden>🛡️</span>
          <span>เงื่อนไขประกัน: <strong>{warranty}</strong></span>
        </div>
      )}
      {images.length > 0 && (
        <div className="deal-product-media-grid">
          {images.map(fileId => {
            const url = fileViewUrl(DEAL_BUCKET, fileId);
            const video = isVideoPath(fileId);
            return video ? (
              <a key={fileId} href={url} target="_blank" rel="noopener noreferrer" className="deal-product-media deal-product-media--video">
                <span>🎬</span>
                <span>วิดีโอ</span>
              </a>
            ) : (
              <a key={fileId} href={url} target="_blank" rel="noopener noreferrer" className="deal-product-media">
                <img src={url} alt="รูปสินค้า" loading="lazy" />
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
