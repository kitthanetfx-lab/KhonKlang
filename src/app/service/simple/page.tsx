'use client';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { ServiceDisabledNotice } from '@/components/ServiceDisabledNotice';
import { useServiceControls } from '@/lib/useServiceControls';

const STEPS = [
  {
    t: 'ผู้ซื้อโอนเงินเข้าบัญชีกลาง',
    d: 'เงินจะพักไว้กับคนกลางก่อน และโอนให้ผู้ขายเมื่อผู้ซื้อยืนยันรับของเรียบร้อย',
  },
  {
    t: 'ผู้ขายส่งสินค้าตรงถึงผู้ซื้อ',
    d: 'ถ่ายวิดีโอทุกขั้นตอน เก็บ Serial Number เลขชิป และผลเทสที่เกี่ยวข้องให้ชัดเจน โดยข้อมูลบนสินค้า กล่อง และเอกสารต้องตรงกัน',
  },
  {
    t: 'ผู้ซื้อถ่ายวิดีโอก่อนแกะกล่อง → ปล่อยเงิน',
    d: 'ผู้ซื้อต้องถ่ายวิดีโอก่อนแกะทุกครั้ง หากสินค้าถูกต้อง คนกลางจะโอนเงินให้ผู้ขาย',
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
      <div className="svc-inner">
        <div className="svc-simple-hero svc-simple-fade">
          <div className="svc-simple-hero-icon"><Icon name="zap" size={30} strokeWidth={2} /></div>
          <h1 className="svc-simple-title">ส่งตรงถึงผู้ซื้อ พักเงินกับคนกลาง</h1>
          <p className="svc-simple-sub">ผู้ขายส่งตรงถึงผู้ซื้อ ใช้วิดีโอเป็นหลักฐาน และพักเงินกับคนกลางจนผู้ซื้อยืนยันรับของ เหมาะกับสินค้าที่ตรวจสอบด้วยซีเรียลหรือหมายเลขเครื่องได้</p>
        </div>
        <div className="how-card svc-simple-card svc-simple-fade">
          <div className="svc-simple-section-title">
            <span className="svc-simple-section-icon"><Icon name="sparkles" size={16} strokeWidth={2} /></span>
            <span>ขั้นตอนการดำเนินงาน</span>
          </div>
          {STEPS.map((s, i) => (
            <div key={i} className="how-step">
              <div className="how-num">{i + 1}</div>
              <div className="svc-simple-step-copy">
                <div className="how-t">{s.t}</div>
                <div className="how-d">{s.d}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="svc-simple-alert svc-simple-fade">
          <span className="svc-simple-alert-icon"><Icon name="info" size={18} strokeWidth={2.1} /></span>
          <span className="svc-simple-alert-text"><strong>สำคัญ:</strong> ผู้ซื้อต้องถ่ายวิดีโอก่อนแกะกล่องทุกครั้ง หากไม่มีวิดีโอ จะไม่สามารถเรียกร้องกับผู้ขายได้ และจะถือว่าสินค้าถูกต้องตามที่ตกลง</span>
        </div>
        {controls.isEnabled('tradeSimple')
          ? <Link href="/deal/create?type=simple" className="btn btn-primary btn-block svc-simple-cta svc-simple-fade">เริ่มสร้างดีล →</Link>
          : <button type="button" className="btn btn-primary btn-block svc-simple-cta" disabled>ปิดให้บริการชั่วคราว</button>}
      </div>
    </div>
  );
}
