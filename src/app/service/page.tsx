'use client';

import Link from 'next/link';
import { SubPageHeader } from '@/components/mobile/SubPageHeader';
import { Icon } from '@/components/Icon';
import { useAppPreferences } from '@/components/AppPreferences';
import { getNavServices } from '@/lib/navData';
import { useServiceControls } from '@/lib/useServiceControls';

function isServiceEnabled(href: string, controls: ReturnType<typeof useServiceControls>) {
  if (href === '/service/trade') {
    return controls.isEnabled('tradeOnline') || controls.isEnabled('tradeSimple');
  }
  if (href === '/service/meetup') {
    return controls.isEnabled('meetupGuarantee') || controls.isEnabled('meetupSafeZone');
  }
  if (href === '/service/consign') return controls.isEnabled('consign');
  if (href === '/service/onsite') return controls.isEnabled('onsite');
  return true;
}

function serviceDisabledMessage(href: string, controls: ReturnType<typeof useServiceControls>) {
  if (href === '/service/trade') return controls.message('tradeOnline');
  if (href === '/service/meetup') return controls.message('meetupGuarantee');
  if (href === '/service/consign') return controls.message('consign');
  if (href === '/service/onsite') return controls.message('onsite');
  return '';
}

/** หน้ารวมบริการ 4 แบบ — แสดงครบในจอเดียว ไม่ต้องเลื่อน */
export default function ServiceHubPage() {
  const { locale } = useAppPreferences();
  const controls = useServiceControls();
  const services = getNavServices(locale);
  const th = locale === 'th';

  return (
    <div className="sub-page service-hub-page">
      <SubPageHeader
        backHref="/"
        title={th ? 'บริการผ่านคนกลาง' : 'Escrow Services'}
        titleIcon="shieldCheck"
      />
      <div className="service-hub-inner">
        <div className="service-hub-head">
          <h1>{th ? 'เลือกบริการคนกลาง' : 'Choose a service'}</h1>
          <p>{th ? 'ปลอดภัยทุกดีล มีระบบคุ้มครอง' : 'Every deal protected by escrow'}</p>
        </div>
        <div className="service-hub-grid">
          {services.map(s => {
            const enabled = controls.loading || isServiceEnabled(s.href, controls);
            const note = serviceDisabledMessage(s.href, controls);
            if (enabled) {
              return (
                <Link key={s.href} href={s.href} className="service-hub-card">
                  <span className={`icon-tile ${s.tint}`}><Icon name={s.icon} /></span>
                  <span className="service-hub-card-t">{s.t}</span>
                  <span className="service-hub-card-d">{s.d}</span>
                  <span className="service-hub-card-go">{th ? 'เริ่มต้น' : 'Start'} →</span>
                </Link>
              );
            }
            return (
              <div key={s.href} className="service-hub-card is-disabled" aria-disabled="true">
                <span className={`icon-tile ${s.tint}`}><Icon name={s.icon} /></span>
                <span className="service-hub-card-t">{s.t}</span>
                <span className="service-hub-card-d">{note || s.d}</span>
                <span className="service-hub-card-go">{th ? 'ปิดชั่วคราว' : 'Unavailable'}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
