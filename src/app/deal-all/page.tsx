'use client';
import Link from 'next/link';
import Image from 'next/image';
import { Nav, Footer } from '@/components/Site';
import { useAppPreferences } from '@/components/AppPreferences';

const DEAL_TYPES = [
  {
    img: '/Deal/trade-m.webp',
    labelTh: 'ซื้อขายผ่านกลาง',
    labelEn: 'Trade via Middleman',
    descTh: 'ส่งสินค้าทางไปรษณีย์ มีคนกลางดูแลเงิน',
    descEn: 'Ship items via post, escrow holds payment',
    href: '/service/trade',
  },
  {
    img: '/Deal/drive-m.webp',
    labelTh: 'นัดรับผ่านกลาง',
    labelEn: 'Meet & Receive',
    descTh: 'นัดรับสินค้าพร้อมคนกลางออนไลน์',
    descEn: 'Arrange pickup with online middleman',
    href: '/service/meetup',
  },
  {
    img: '/Deal/partner.webp',
    labelTh: 'ฝากขายผ่านกลาง',
    labelEn: 'Consign via Middleman',
    descTh: 'ฝากสินค้าให้คนกลางช่วยขาย',
    descEn: 'Let middleman handle your consignment',
    href: '/service/consign',
  },
  {
    img: '/Deal/on-site.webp',
    labelTh: 'ออนไซต์',
    labelEn: 'On-Site',
    descTh: 'คนกลางไปพบด้วยตัวเองถึงที่',
    descEn: 'Middleman meets you in person on-site',
    href: '/service/onsite',
  },
];

export default function DealAllPage() {
  const { locale } = useAppPreferences();

  return (
    <>
      <Nav active="home" />
      <main style={{ minHeight: '80vh', padding: '48px 0 80px' }}>
        <div className="container" style={{ maxWidth: 640 }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div className="kicker" style={{ marginBottom: 10 }}>
              {locale === 'th' ? 'เลือกประเภทดีล' : 'Choose Deal Type'}
            </div>
            <h1 style={{ fontSize: 'clamp(22px,4vw,32px)', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>
              {locale === 'th' ? 'เริ่มดีลแบบไหนดี?' : 'What kind of deal are you starting?'}
            </h1>
            <p style={{ color: 'var(--muted)', marginTop: 10, fontSize: 15 }}>
              {locale === 'th' ? 'เลือกรูปแบบที่ตรงกับการซื้อขายของคุณ' : 'Pick the format that fits your transaction'}
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 20,
            justifyContent: 'center',
          }}>
            {DEAL_TYPES.map((d) => (
              <Link
                key={d.href}
                href={d.href}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textDecoration: 'none',
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r-lg)',
                  overflow: 'hidden',
                  boxShadow: 'var(--sh-md)',
                  transition: 'transform .18s, box-shadow .18s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-3px)';
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'var(--sh-lg)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLAnchorElement).style.transform = '';
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'var(--sh-md)';
                }}
              >
                <div style={{ width: 250, height: 250, position: 'relative', flexShrink: 0 }}>
                  <Image
                    src={d.img}
                    alt={locale === 'th' ? d.labelTh : d.labelEn}
                    fill
                    style={{ objectFit: 'cover' }}
                    sizes="250px"
                  />
                </div>
                <div style={{ padding: '14px 16px 16px', width: '100%', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 4 }}>
                    {locale === 'th' ? d.labelTh : d.labelEn}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
                    {locale === 'th' ? d.descTh : d.descEn}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
