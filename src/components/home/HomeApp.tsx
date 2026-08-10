'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { AppPage } from '@/components/mobile/AppPage';
import { AppFeed } from '@/components/mobile/AppStates';
import { AppList, AppListRow } from '@/components/mobile/AppListRow';
import { CountUp } from '@/components/Site';
import type { useServiceControls } from '@/lib/useServiceControls';

type StatItem = { v: number; suf: string; pre: string; label: string };

const SERVICES = [
  { href: '/service/trade', icon: 'shieldCheck' as const, title: 'ซื้อขายผ่านกลาง', sub: 'Escrow ปลอดภัย', key: 'tradeOnline' as const },
  { href: '/service/meetup', icon: 'mapPin' as const, title: 'นัดรับผ่านกลาง', sub: 'Safe Zone + ประกันเดินทาง', key: 'meetupGuarantee' as const },
  { href: '/service/consign', icon: 'store' as const, title: 'ฝากขายผ่านกลาง', sub: 'คนกลางช่วยลงขาย', key: 'consign' as const },
  { href: '/service/onsite', icon: 'user' as const, title: 'บริการออนไซต์', sub: 'ช่างตรวจถึงที่', key: 'onsite' as const },
];

type Props = {
  locale: 'th' | 'en';
  statItems: StatItem[];
  controls: ReturnType<typeof useServiceControls>;
};

/** หน้าแรกมือถือ — เป้าหมายชัด · hierarchy · action หลักอยู่บนสุด */
export function HomeApp({ locale, statItems, controls }: Props) {
  const isTh = locale === 'th';

  return (
    <AppPage withBottomNav>
      <AppFeed>
        <div className="home-app">
        <section className="home-app-hero">
          <Image
            src="/logo.png"
            alt={isTh ? 'โลโก้กลางฮับ' : 'Glanghub logo'}
            width={120}
            height={120}
            priority
            className="home-app-logo home-app-logo--light"
          />
          <Image
            src="/logo-dark.png"
            alt={isTh ? 'โลโก้กลางฮับ' : 'Glanghub logo'}
            width={120}
            height={120}
            className="home-app-logo home-app-logo--dark"
          />
          <p className="home-app-eyebrow">
            <Icon name="shieldCheck" size={16} />
            {isTh ? 'ซื้อขายปลอดภัยผ่านคนกลางรับรอง' : 'Safer trading with trusted escrow'}
          </p>
          <h1 className="home-app-title">
            {isTh ? (
              <>จ่ายเงินมั่นใจ<br /><span>ได้ของชัวร์ ไม่โดนโกง</span></>
            ) : (
              <>Pay with confidence<br /><span>Get the real item</span></>
            )}
          </h1>
          <Link href="/deal-all" className="btn btn-primary home-app-cta">
            {isTh ? 'เริ่ม Deal' : 'Start a Deal'} <Icon name="arrowRight" size={18} />
          </Link>
        </section>

        <section className="home-app-stats" aria-label={isTh ? 'สถิติระบบ' : 'Platform stats'}>
          {statItems.map(s => (
            <div key={s.label} className="home-app-stat">
              <div className="home-app-stat-v">
                {s.v < 0 ? '—' : <CountUp to={s.v} prefix={s.pre || ''} suffix={s.suf} />}
              </div>
              <div className="home-app-stat-l">{s.label}</div>
            </div>
          ))}
        </section>

        <section className="home-app-section">
          <h2 className="home-app-section-title">
            {isTh ? 'บริการผ่านคนกลาง' : 'Escrow services'}
          </h2>
          <AppList>
            {SERVICES.map(svc => {
              const enabled = controls.isEnabled(svc.key);
              return (
                <AppListRow
                  key={svc.href}
                  href={enabled ? svc.href : '#'}
                  title={svc.title}
                  meta={
                    enabled
                      ? svc.sub
                      : <span style={{ color: '#b7791f' }}>{controls.message(svc.key)}</span>
                  }
                  thumbFallback={<Icon name={svc.icon} size={26} />}
                  variant="default"
                />
              );
            })}
          </AppList>
        </section>

        <Link href="/check-scam" className="home-app-scam">
          <div className="home-app-scam-ic"><Icon name="search" size={24} /></div>
          <div className="home-app-scam-body">
            <strong>{isTh ? 'สงสัยว่าจะโดนโกง?' : 'Think it might be a scam?'}</strong>
            <span>{isTh ? 'เช็คชื่อ เลขบัญชี เบอร์โทร ก่อนโอน' : 'Check names & accounts before paying'}</span>
          </div>
          <Icon name="chevronRight" size={20} />
        </Link>
        </div>
      </AppFeed>
    </AppPage>
  );
}

export default HomeApp;
