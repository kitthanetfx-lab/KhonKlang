import type { Metadata } from 'next';
import { getMarketplaceListingShareMeta, formatMarketplaceShareTitle } from '@/lib/marketplaceShareMeta';
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
  const shareTitle = formatMarketplaceShareTitle(meta);
  const url = `${SITE}/marketplace/${meta.id}`;
  // og:image ต้องอยู่โดเมน glanghub.com — Facebook มักไม่ดึงรูปจาก Supabase ตรงๆ
  const shareImage = meta.imageUrls[0]
    ? `${SITE}/api/og/product/${meta.id}`
    : `${SITE}/og-tag.webp`;
  const shareImageMeta = {
    url: shareImage,
    width: 1200,
    height: 630,
    alt: shareTitle,
  };

  return {
    title: pageTitle,
    description: meta.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title: shareTitle,
      description: meta.description,
      siteName: 'กลางฮับ',
      locale: 'th_TH',
      images: [shareImageMeta],
    },
    twitter: {
      card: 'summary_large_image',
      title: shareTitle,
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
