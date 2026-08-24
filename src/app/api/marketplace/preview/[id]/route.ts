import { NextResponse } from 'next/server';
import { getMarketplaceListingShareMeta, formatMarketplaceShareTitle } from '@/lib/marketplaceShareMeta';

export const dynamic = 'force-dynamic';

/** ข้อมูล preview สำหรับแชท in-app — ไม่ต้อง login */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meta = await getMarketplaceListingShareMeta(id);
  if (!meta) {
    return NextResponse.json({ error: 'ไม่พบสินค้า' }, { status: 404 });
  }

  return NextResponse.json({
    id: meta.id,
    title: meta.title,
    shareTitle: formatMarketplaceShareTitle(meta),
    description: meta.shortDescription || meta.description,
    displayPrice: meta.displayPrice,
    isAuction: meta.isAuction,
    imageUrl: meta.imageUrls[0] || '',
    url: `https://www.glanghub.com/marketplace/${meta.id}`,
    auction: meta.auction ? {
      timeRemainingLabel: meta.auction.timeRemainingLabel,
      bidCount: meta.auction.bidCount,
    } : null,
  });
}
