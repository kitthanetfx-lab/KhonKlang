'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Preview = {
  id: string;
  title: string;
  shareTitle: string;
  description: string;
  displayPrice: number;
  isAuction: boolean;
  imageUrl: string;
  url: string;
  auction?: { timeRemainingLabel: string; bidCount: number } | null;
};

export function ChatMarketplacePreview({ listingId }: { listingId: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/marketplace/preview/${listingId}`);
        if (!r.ok) { if (!cancelled) setFailed(true); return; }
        const data = await r.json();
        if (!cancelled) setPreview(data);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [listingId]);

  if (failed) {
    return (
      <Link href={`/marketplace/${listingId}`} className="dm-link-card dm-link-card--fallback">
        ดูสินค้าบนตลาด →
      </Link>
    );
  }

  if (!preview) {
    return <div className="dm-link-card dm-link-card--loading">กำลังโหลดรายละเอียดสินค้า…</div>;
  }

  const priceLabel = preview.isAuction
    ? (preview.auction?.bidCount ? 'ราคาปัจจุบัน' : 'เริ่มต้น')
    : 'ราคา';

  return (
    <Link href={`/marketplace/${preview.id}`} className="dm-link-card">
      {preview.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview.imageUrl} alt="" className="dm-link-card-img" />
      ) : (
        <div className="dm-link-card-img dm-link-card-img--empty">📦</div>
      )}
      <div className="dm-link-card-body">
        <span className="dm-link-card-site">กลางฮับ · {preview.isAuction ? 'ประมูล' : 'ตลาด'}</span>
        <strong className="dm-link-card-title">{preview.title}</strong>
        <span className="dm-link-card-price">{priceLabel} ฿{preview.displayPrice.toLocaleString('th-TH')}</span>
        {preview.isAuction && preview.auction && (
          <span className="dm-link-card-meta">{preview.auction.timeRemainingLabel}</span>
        )}
        {preview.description && (
          <span className="dm-link-card-desc">{preview.description}</span>
        )}
      </div>
    </Link>
  );
}
