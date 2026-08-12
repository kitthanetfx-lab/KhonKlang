'use client';
import Image from 'next/image';
import Link from 'next/link';
import { SubPageHeader } from '@/components/mobile/SubPageHeader';
import { ServiceDisabledNotice } from '@/components/ServiceDisabledNotice';
import { useServiceControls } from '@/lib/useServiceControls';

const MODES = [
  { title: 'ซื้อขายผ่านกลางปลอดภัย', href: '/service/trade/online', image: '/Full.webp' },
  { title: 'ซื้อขายผ่านกลางแบบง่าย', href: '/service/simple', image: '/Eazy.webp' },
];

export default function ServiceTradePage() {
  const controls = useServiceControls();
  const canUseTrade = controls.isEnabled('tradeOnline') || controls.isEnabled('tradeSimple');

  if (!controls.loading && !canUseTrade) {
    return <ServiceDisabledNotice title="บริการผ่านคนกลาง" message={controls.message('tradeOnline')} />;
  }

  return (
    <div className="sub-page service-sub-page service-trade-page">
      <SubPageHeader backHref="/" title="บริการผ่านคนกลาง" />
      <div className="svc-inner">
        <div className="svc-hero">
          <div className="svc-hero-icon">🤝</div>
          <h1 className="svc-hero-title">เลือกรูปแบบบริการ</h1>
        </div>
        <div className="svc-modes">
          {MODES.map(m => {
            const enabled = m.href === '/service/simple' ? controls.isEnabled('tradeSimple') : controls.isEnabled('tradeOnline');
            const note = m.href === '/service/simple' ? controls.message('tradeSimple') : controls.message('tradeOnline');
            return enabled ? (
            <Link key={m.title} href={m.href} className="svc-mode">
              <div className="svc-mode-media">
                <Image src={m.image} alt={m.title} fill className="svc-mode-image" sizes="(max-width: 519px) 100vw, 50vw" />
              </div>
              <div className="svc-mode-title">{m.title}</div>
              <div className="svc-mode-cta">เริ่มต้น <span>→</span></div>
            </Link>
            ) : (
            <div key={m.title} className="svc-mode" style={{ opacity: 0.7, cursor: 'not-allowed' }}>
              <div className="svc-mode-media">
                <Image src={m.image} alt={m.title} fill className="svc-mode-image" sizes="(max-width: 519px) 100vw, 50vw" />
              </div>
              <div className="svc-mode-title">{m.title}</div>
              <div className="svc-mode-cta" style={{ color: '#b7791f' }}>ปิดชั่วคราว</div>
              <div style={{ marginTop: 10, fontSize: 13, color: '#9a6700', lineHeight: 1.6 }}>{note}</div>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
