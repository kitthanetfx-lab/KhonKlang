import { getMarketplaceListingShareMeta } from '@/lib/marketplaceShareMeta';
import { renderMarketplaceOgImage } from '@/lib/og/renderMarketplaceOgImage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meta = await getMarketplaceListingShareMeta(id);
  const response = await renderMarketplaceOgImage(meta);
  response.headers.set(
    'Cache-Control',
    'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
  );
  return response;
}
