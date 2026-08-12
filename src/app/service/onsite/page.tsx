'use client';
import Link from 'next/link';
import { SubPageHeader } from '@/components/mobile/SubPageHeader';
import { ServiceDisabledNotice } from '@/components/ServiceDisabledNotice';
import { useServiceControls } from '@/lib/useServiceControls';

const EXPERTS = [
  { icon: '🔧', t: 'ช่างยนต์' },
  { icon: '📱', t: 'มือถือ' },
  { icon: '💻', t: 'คอม' },
  { icon: '👜', t: 'แบรนด์' },
  { icon: '🪨', t: 'พระ' },
  { icon: '🏠', t: 'บ้าน' },
];

export default function ServiceOnsitePage() {
  const controls = useServiceControls();
  if (!controls.loading && !controls.isEnabled('onsite')) {
    return <ServiceDisabledNotice title="บริการนัดออนไซต์" message={controls.message('onsite')} />;
  }

  return (
    <div className="sub-page service-sub-page service-compact-page">
      <SubPageHeader backHref="/service" title="บริการออนไซต์" titleIcon="car" />
      <div className="svc-inner svc-compact-inner">
        <div className="svc-compact-panel">
          <div className="svc-compact-panel-icon">🔍</div>
          <h1 className="svc-compact-panel-title">ผู้เชี่ยวชาญตรวจถึงที่</h1>
          <p className="svc-compact-panel-sub">
            ส่งช่างไปตรวจ ณ ที่ตั้งผู้ขายก่อนโอนเงิน · ค่าบริการ ฿200–800
          </p>
          <div className="svc-compact-experts">
            {EXPERTS.map(e => (
              <span key={e.t} className="svc-compact-expert">
                <span aria-hidden>{e.icon}</span>
                {e.t}
              </span>
            ))}
          </div>
          {controls.isEnabled('onsite') ? (
            <Link href="/onsite/create" className="btn btn-primary btn-block svc-compact-cta">
              สร้างงานออนไซต์ →
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
