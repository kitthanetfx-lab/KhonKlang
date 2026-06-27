'use client';
import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { ServiceDisabledNotice } from '@/components/ServiceDisabledNotice';
import { useServiceControls } from '@/lib/useServiceControls';

const STEPS = [
  {
    icon: 'banknote',
    tone: 'blue',
    no: '1',
    t: 'ผู้ซื้อโอนเงินกับคนกลาง',
    d: 'เงินพักไว้ก่อน จนกว่าผู้ซื้อจะยืนยันรับของ',
  },
  {
    icon: 'truck',
    tone: 'mint',
    no: '2',
    t: 'ผู้ขายส่งตรงถึงผู้ซื้อ',
    d: 'ถ่ายวิดีโอ เก็บ Serial และหลักฐานสำคัญให้ครบ',
  },
  {
    icon: 'shieldCheck',
    tone: 'sand',
    no: '3',
    t: 'ผู้ซื้อถ่ายก่อนแกะกล่อง',
    d: 'ยืนยันรับของถูกต้องแล้ว คนกลางจึงโอนเงินให้ผู้ขาย',
  },
];

export default function ServiceSimplePage() {
  const controls = useServiceControls();
  if (!controls.loading && !controls.isEnabled('tradeSimple')) {
    return <ServiceDisabledNotice title="ซื้อขายผ่านกลางแบบง่าย" message={controls.message('tradeSimple')} backHref="/service/trade" backLabel="กลับไปหน้าบริการ" />;
  }

  return (
    <div className="sub-page svc-simple-page">
      <header className="sub-header">
        <Link href="/service/trade" className="sub-back">←</Link>
        <span className="sub-htitle">ซื้อขายผ่านกลางแบบง่าย</span>
      </header>
      <div className="svc-inner svc-simple-stage">
        <div className="svc-simple-panel svc-simple-fade">
          <div className="svc-simple-brand-wrap">
            <div className="svc-simple-brand">
              <Image src="/logo.png" alt="กลางฮับ" width={420} height={132} priority className="svc-simple-brand-image" />
            </div>
          </div>

          <div className="svc-simple-hero">
            <h1 className="svc-simple-title">ซื้อขายผ่านกลางแบบง่าย</h1>
            <p className="svc-simple-sub">ซื้อขายง่าย ปลอดภัยขึ้น70% คลอบคลุมกรณีไม่ได้สินค้า</p>
            <p className="svc-simple-sub">ของไม่ตรงปก และความเสียหายที่เห็นได้ชัด </p>
          </div>

          <div className="svc-simple-kicker svc-simple-fade">ขั้นตอนการดำเนินงาน</div>
          <div className="svc-simple-steps svc-simple-fade">
            {STEPS.map((s) => (
              <div key={s.no} className={`svc-simple-step-card is-${s.tone}`}>
                <div className="svc-simple-step-no">{s.no}</div>
                <div className={`svc-simple-step-icon is-${s.tone}`}>
                  <Icon name={s.icon} size={34} strokeWidth={1.9} />
                </div>
                <div className="svc-simple-step-title">{s.t}</div>
                <div className="svc-simple-step-text">{s.d}</div>
              </div>
            ))}
          </div>

          <div className="svc-simple-alert svc-simple-fade">
            <span className="svc-simple-alert-icon"><Icon name="info" size={18} strokeWidth={2.1} /></span>
            <span className="svc-simple-alert-text"><strong>สำคัญ:</strong> ผู้ซื้อต้องถ่ายวิดีโอก่อนแกะกล่องทุกครั้ง มิฉะนั้นจะไม่สามารถใช้เรียกร้องกับผู้ขายได้</span>
          </div>

          <div className="svc-simple-cta-wrap svc-simple-fade">
            {controls.isEnabled('tradeSimple')
              ? <Link href="/deal/create?type=simple" className="btn btn-primary btn-block svc-simple-cta">เริ่มสร้างดีล →</Link>
              : <button type="button" className="btn btn-primary btn-block svc-simple-cta" disabled>ปิดให้บริการชั่วคราว</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
