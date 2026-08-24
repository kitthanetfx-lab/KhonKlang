import { NextResponse } from 'next/server';
import { getMarketplaceListingShareMeta } from '@/lib/marketplaceShareMeta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE = 'https://www.glanghub.com';

/** รูปสินค้าสำหรับ og:image — โฮสต์บน glanghub.com (Facebook โหลดได้เสถียรกว่า Supabase ตรงๆ) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const meta = await getMarketplaceListingShareMeta(id);
    const imageUrl = meta?.imageUrls[0];
    if (!imageUrl) {
      return NextResponse.redirect(`${SITE}/og-tag.webp`, 302);
    }

    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      return NextResponse.redirect(`${SITE}/og-tag.webp`, 302);
    }

    const body = await res.arrayBuffer();
    const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';

    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch (err) {
    console.error('[og/product]', id, err);
    return NextResponse.redirect(`${SITE}/og-tag.webp`, 302);
  }
}
