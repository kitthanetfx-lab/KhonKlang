'use client';

import Link from 'next/link';
import Image from 'next/image';
import { AppPage, AppHeader, AppFeed } from '@/components/mobile';

export type DealTypeItem = {
  img: string;
  labelTh: string;
  labelEn: string;
  descTh: string;
  descEn: string;
  href: string;
};

type Props = {
  locale: 'th' | 'en';
  dealTypes: DealTypeItem[];
};

export function DealAllApp({ locale, dealTypes }: Props) {
  const isTh = locale === 'th';

  return (
    <AppPage withBottomNav>
      <AppHeader
        title={isTh ? 'เลือกประเภทดีล' : 'Choose Deal Type'}
        backHref="/"
      />

      <AppFeed>
        <div className="deal-all-app-intro">
          <h2>{isTh ? 'เริ่มดีลแบบไหนดี?' : 'What kind of deal are you starting?'}</h2>
          <p>{isTh ? 'เลือกรูปแบบที่ตรงกับการซื้อขายของคุณ' : 'Pick the format that fits your transaction'}</p>
        </div>

        <div className="deal-all-app-grid">
          {dealTypes.map(d => (
            <Link key={d.href} href={d.href} className="deal-all-app-card">
              <div className="deal-all-app-media">
                <Image
                  src={d.img}
                  alt={isTh ? d.labelTh : d.labelEn}
                  fill
                  sizes="(max-width: 767px) 50vw, 250px"
                  style={{ objectFit: 'cover' }}
                />
              </div>
              <div className="deal-all-app-body">
                <div className="deal-all-app-title">{isTh ? d.labelTh : d.labelEn}</div>
                <div className="deal-all-app-desc">{isTh ? d.descTh : d.descEn}</div>
              </div>
            </Link>
          ))}
        </div>
      </AppFeed>
    </AppPage>
  );
}

export default DealAllApp;
