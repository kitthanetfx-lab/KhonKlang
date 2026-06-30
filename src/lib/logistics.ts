export type LogisticsProvider = {
  id: string;
  label: string;
  trackingUrlBase?: string;
  trackingUrlBuilder?: (trackingNumber: string) => string;
};

export const TH_LOGISTICS_PROVIDERS: LogisticsProvider[] = [
  {
    id: 'thailand-post',
    label: 'ไปรษณีย์ไทย',
    trackingUrlBuilder: trackingNumber => `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(trackingNumber)}`,
  },
  {
    id: 'kex',
    label: 'KEX / Kerry',
    trackingUrlBuilder: trackingNumber => `https://th.kex-express.com/th/track/?track=${encodeURIComponent(trackingNumber)}`,
  },
  {
    id: 'flash',
    label: 'Flash Express',
    trackingUrlBuilder: trackingNumber => `https://www.flashexpress.co.th/fle/tracking?se=${encodeURIComponent(trackingNumber)}`,
  },
  {
    id: 'jt',
    label: 'J&T Express',
    trackingUrlBuilder: trackingNumber => `https://www.jtexpress.co.th/index/query/gzquery.html?billcodes=${encodeURIComponent(trackingNumber)}`,
  },
  {
    id: 'spx',
    label: 'SPX Express',
    trackingUrlBase: 'https://spx.co.th/',
  },
  {
    id: 'ninja-van',
    label: 'Ninja Van',
    trackingUrlBase: 'https://www.ninjavan.co/th-th/tracking',
  },
  {
    id: 'scg-express',
    label: 'SCG Express',
    trackingUrlBase: 'https://www.scgexpress.co.th/tracking',
  },
  {
    id: 'best',
    label: 'BEST Express',
    trackingUrlBase: 'https://www.best-inc.co.th/track',
  },
  {
    id: 'nim',
    label: 'NIM Express',
    trackingUrlBase: 'https://www.nimexpress.com/web/p/tracking',
  },
  {
    id: 'speed-d',
    label: 'Speed-D',
    trackingUrlBase: 'https://www.speeddservice.com/',
  },
  {
    id: 'dhl',
    label: 'DHL',
    trackingUrlBuilder: trackingNumber => `https://www.dhl.com/th-en/home/tracking.html?tracking-id=${encodeURIComponent(trackingNumber)}`,
  },
  {
    id: 'fedex',
    label: 'FedEx',
    trackingUrlBuilder: trackingNumber => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`,
  },
  {
    id: 'ups',
    label: 'UPS',
    trackingUrlBuilder: trackingNumber => `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`,
  },
  {
    id: 'other',
    label: 'อื่นๆ',
  },
];

export function getLogisticsProvider(providerId?: string | null): LogisticsProvider | null {
  if (!providerId) return null;
  return TH_LOGISTICS_PROVIDERS.find(item => item.id === providerId) || null;
}

export function getLogisticsProviderLabel(providerId?: string | null): string {
  return getLogisticsProvider(providerId)?.label || 'ไม่ระบุผู้ให้บริการ';
}

export function buildTrackingUrl(providerId?: string | null, trackingNumber?: string | null): string {
  const provider = getLogisticsProvider(providerId);
  const cleanTrackingNumber = String(trackingNumber || '').trim();
  if (!provider || !cleanTrackingNumber) return '';
  if (provider.trackingUrlBuilder) return provider.trackingUrlBuilder(cleanTrackingNumber);
  return provider.trackingUrlBase || '';
}
