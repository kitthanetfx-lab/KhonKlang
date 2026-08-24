import type { Metadata } from 'next';
import { getMarketplaceListingShareMeta } from '@/lib/marketplaceShareMeta';
import { MarketplaceDetailClient } from './MarketplaceDetailClient';

const SITE = 'https://www.glanghub.com';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const meta = await getMarketplaceListingShareMeta(id);

  if (!meta) {
    return {
      title: 'ไม่พบสินค้า | กลางฮับ',
      description: 'ไม่พบรายการสินค้าที่ต้องการบนกลางฮับ',
    };
  }

  const pageTitle = `${meta.title} | ${meta.isAuction ? 'ประมูล' : 'ตลาด'} กลางฮับ`;
  const url = `${SITE}/marketplace/${meta.id}`;
  // og:image ต้องเป็น URL รูปจริงที่ Facebook โหลดได้ทันที — ไม่ใช้ API สร้างรูป (ไม่เสถียร)
  const productImage = meta.imageUrls[0] || '';
  const shareImage = productImage || `${SITE}/og-tag.webp`;
  const shareImageMeta = productImage
    ? { url: shareImage, alt: meta.title }
    : { url: shareImage, width: 1200, height: 630, alt: meta.title };

  return {
    title: pageTitle,
    description: meta.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title: meta.title,
      description: meta.description,
      siteName: 'กลางฮับ',
      locale: 'th_TH',
      images: [shareImageMeta],
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description,
      images: [shareImage],
    },
  };
}

export default async function MarketplaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MarketplaceDetailClient listingId={id} />;
}
