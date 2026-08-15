import { ImageResponse } from 'next/og';
import type { MarketplaceShareMeta } from '@/lib/marketplaceShareMeta';

export const OG_SIZE = { width: 1200, height: 630 };

async function loadFonts() {
  const bold = await fetch(
    'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/ibmplexsansthai/IBMPlexSansThai-Bold.ttf',
  ).then(r => r.arrayBuffer());
  return [{ name: 'TH', data: bold, weight: 700 as const, style: 'normal' as const }];
}

function ImageSlot({ src, label }: { src?: string; label: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={180}
        height={180}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    );
  }
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #eef4ff 0%, #dbeafe 100%)',
        color: '#64748b',
        fontSize: 42,
      }}
    >
      {label}
    </div>
  );
}

export async function renderMarketplaceOgImage(meta: MarketplaceShareMeta | null) {
  const fonts = await loadFonts();

  if (!meta) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f4f6fb',
            color: '#64748b',
            fontFamily: 'TH',
            fontSize: 40,
            fontWeight: 700,
          }}
        >
          ไม่พบสินค้า · กลางฮับ
        </div>
      ),
      { ...OG_SIZE, fonts },
    );
  }

  const imgs = [
    meta.imageUrls[0],
    meta.imageUrls[1] || meta.imageUrls[0],
    meta.imageUrls[2] || meta.imageUrls[0],
  ];
  const accent = meta.isAuction ? '#7c3aed' : '#2563eb';
  const accentSoft = meta.isAuction ? '#f5f3ff' : '#eef4ff';
  const priceLabel = meta.isAuction
    ? ((meta.auction?.bidCount ?? 0) > 0 ? 'ราคาปัจจุบัน' : 'ราคาเริ่ม')
    : 'ราคา';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          fontFamily: 'TH',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '22px 28px',
            background: accentSoft,
            borderBottom: `3px solid ${accent}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                background: accent,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              ก
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>กลางฮับ GLANGHUB</span>
              <span style={{ fontSize: 16, color: '#64748b' }}>
                {meta.isAuction ? 'ตลาดประมูล' : 'ตลาดซื้อขาย'}
              </span>
            </div>
          </div>
          <div
            style={{
              padding: '10px 18px',
              borderRadius: 999,
              background: accent,
              color: '#fff',
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            {meta.isAuction ? '🔨 ประมูล' : '🛒 ขายสินค้า'}
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, padding: '24px 28px', gap: 24 }}>
          <div style={{ width: 420, display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 12, height: 196 }}>
              <div style={{ flex: 1, borderRadius: 16, overflow: 'hidden', border: '2px solid #e2e8f0' }}>
                <ImageSlot src={imgs[0]} label="📦" />
              </div>
              <div style={{ flex: 1, borderRadius: 16, overflow: 'hidden', border: '2px solid #e2e8f0' }}>
                <ImageSlot src={imgs[1]} label="📦" />
              </div>
            </div>
            <div style={{ height: 196, borderRadius: 16, overflow: 'hidden', border: '2px solid #e2e8f0' }}>
              <ImageSlot src={imgs[2]} label="📦" />
            </div>
          </div>

          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minWidth: 0,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {meta.category && (
                  <span style={{ padding: '6px 12px', borderRadius: 999, background: '#f1f5f9', color: '#334155', fontSize: 16, fontWeight: 600 }}>
                    {meta.category}
                  </span>
                )}
                {meta.condition && (
                  <span style={{ padding: '6px 12px', borderRadius: 999, background: '#f1f5f9', color: '#334155', fontSize: 16, fontWeight: 600 }}>
                    {meta.condition}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 34, fontWeight: 700, color: '#0f172a', lineHeight: 1.25, maxHeight: 90, overflow: 'hidden' }}>
                {meta.title.length > 70 ? `${meta.title.slice(0, 68)}…` : meta.title}
              </div>
              {meta.shortDescription && (
                <div style={{ fontSize: 20, color: '#475569', lineHeight: 1.45, maxHeight: 60, overflow: 'hidden' }}>
                  {meta.shortDescription.length > 100 ? `${meta.shortDescription.slice(0, 98)}…` : meta.shortDescription}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {meta.isAuction && meta.auction && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ padding: '8px 14px', borderRadius: 12, background: accentSoft, color: accent, fontSize: 18, fontWeight: 700 }}>
                    ⏱ {meta.auction.timeRemainingLabel}
                  </span>
                  <span style={{ padding: '8px 14px', borderRadius: 12, background: '#f8fafc', color: '#334155', fontSize: 18, fontWeight: 700 }}>
                    👥 {meta.auction.uniqueBidderCount} คนบิด · {meta.auction.bidCount} bid
                  </span>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 14,
                  padding: '16px 20px',
                  borderRadius: 18,
                  background: meta.isAuction ? accentSoft : '#ecfdf5',
                  border: `2px solid ${meta.isAuction ? '#ddd6fe' : '#bbf7d0'}`,
                }}
              >
                <span style={{ fontSize: 22, color: '#64748b', fontWeight: 600 }}>{priceLabel}</span>
                <span style={{ fontSize: 56, fontWeight: 700, color: meta.isAuction ? accent : '#15803d', letterSpacing: '-0.02em' }}>
                  ฿{meta.displayPrice.toLocaleString('th-TH')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
