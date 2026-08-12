'use client';
import Link from 'next/link';
import { SubPageHeader } from '@/components/mobile/SubPageHeader';
import { ServiceDisabledNotice } from '@/components/ServiceDisabledNotice';
import { useServiceControls } from '@/lib/useServiceControls';

const HIGHLIGHTS = [
  'ค่าฝากขาย 2–3% · ถ่ายรูปฟรี',
  'คนกลางลงขาย+จัดส่งให้',
  'ฝากได้สูงสุด 90 วัน',
];

export default function ConsignPage() {
  const controls = useServiceControls();
  if (!controls.loading && !controls.isEnabled('consign')) {
    return <ServiceDisabledNotice title="ฝากขายผ่านกลาง" message={controls.message('consign')} />;
  }

  return (
    <div className="sub-page service-sub-page service-compact-page">
      <SubPageHeader backHref="/service" title="ฝากขายผ่านกลาง" titleIcon="store" />
      <div className="svc-inner svc-compact-inner">
        <div className="svc-compact-panel">
          <div className="svc-compact-panel-icon">🏪</div>
          <h1 className="svc-compact-panel-title">ฝากขายผ่านคนกลาง</h1>
          <p className="svc-compact-panel-sub">
            นำสินค้ามาฝาก คนกลางถ่ายรูป ลงขาย และจัดส่งให้ครบ
          </p>
          <ul className="svc-compact-bullets">
            {HIGHLIGHTS.map(t => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          {controls.isEnabled('consign') ? (
            <Link href="/marketplace" className="btn btn-primary btn-block svc-compact-cta">
              เริ่มฝากขาย →
            </Link>
          ) : (
            <button type="button" className="btn btn-primary btn-block svc-compact-cta" disabled>
              ปิดให้บริการชั่วคราว
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
