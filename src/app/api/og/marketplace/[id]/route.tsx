import { NextResponse } from 'next/server';
import { getMarketplaceListingShareMeta } from '@/lib/marketplaceShareMeta';
import { renderMarketplaceOgImage } from '@/lib/og/renderMarketplaceOgImage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE = 'https://www.glanghub.com';

function ogFallbackRedirect(meta: Awaited<ReturnType<typeof getMarketplaceListingShareMeta>>) {
  const target = meta?.imageUrls[0] || `${SITE}/og-tag.webp`;
  return NextResponse.redirect(target, 302);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let meta: Awaited<ReturnType<typeof getMarketplaceListingShareMeta>> = null;

  try {
    meta = await getMarketplaceListingShareMeta(id);
    const response = await renderMarketplaceOgImage(meta);
    response.headers.set(
      'Cache-Control',
      'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    );
    return response;
  } catch (err) {
    console.error('[og/marketplace]', id, err);
    if (!meta) {
      try {
        meta = await getMarketplaceListingShareMeta(id);
      } catch {
        return NextResponse.redirect(`${SITE}/og-tag.webp`, 302);
      }
    }
    return ogFallbackRedirect(meta);
  }
}
