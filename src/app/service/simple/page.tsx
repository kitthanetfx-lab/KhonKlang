'use client';
import Link from 'next/link';
import { ServiceDisabledNotice } from '@/components/ServiceDisabledNotice';
import { useServiceControls } from '@/lib/useServiceControls';

const STEPS = [
  {
    t: 'ผู้ซื้อโอนเงินเข้าบัญชีกลาง',
    d: 'ผู้ซื้อโอนเงินขึ้นมาพักไว้กับบัญชีคนกลางก่อน เงินยังไม่ถึงผู้ขายจนกว่าจะรับสินค้าเรียบร้อย',
  },
  {
    t: 'ผู้ขายส่งสินค้าตรงถึงผู้ซื้อ (ถ่ายวิดีโอทุกขั้นตอน)',
    d: 'ผู้ขายส่งสินค้าให้ผู้ซื้อโดยตรง พร้อมถ่ายวิดีโอทุกขั้นตอน เก็บจุดสำคัญ เช่น Serial Number และเลขชิปต่าง ๆ หากมีผลเทสต้องถ่ายผลเทสนั้นประกอบด้วย และเลขซีเรียลบนตัวสินค้ากับกล่อง/เอกสารต้องตรงกัน',
  },
  {
    t: 'ผู้ซื้อถ่ายวิดีโอก่อนแกะกล่อง → ปล่อยเงิน',
    d: 'เมื่อสินค้าถึงมือ ผู้ซื้อต้องถ่ายวิดีโอก่อนแกะทุกครั้ง มิฉะนั้นจะถือว่าไม่ใช่ความผิดของผู้ขาย เมื่อยืนยันรับของถูกต้อง สิ้นสุดดีล คนกลางโอนเงินให้ผู้ขาย',
  },
];

export default function ServiceSimplePage() {
  const controls = useServiceControls();
  if (!controls.loading && !controls.isEnabled('tradeSimple')) {
    return <ServiceDisabledNotice title="ซื้อขายผ่านกลางแบบง่าย" message={controls.message('tradeSimple')} backHref="/service/trade" backLabel="กลับไปหน้าบริการ" />;
  }

  return (
    <div className="sub-page">
      <header className="sub-header">
        <Link href="/service/trade" className="sub-back">←</Link>
        <span className="sub-htitle">ซื้อขายผ่านกลางแบบง่าย</span>
      </header>
      <div className="svc-inner">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 14 }}>⚡</div>
          <h1 style={{ fontSize: 'clamp(22px,4vw,30px)', marginBottom: 10 }}>ส่งตรงถึงผู้ซื้อ พักเงินกับคนกลาง</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14.5, lineHeight: 1.6, maxWidth: '46ch', margin: '0 auto' }}>ผู้ขายส่งสินค้าตรงถึงผู้ซื้อ ใช้วิดีโอเป็นหลักฐานแทนการตรวจหน้างาน เงินพักไว้กับคนกลางจนผู้ซื้อรับของเรียบร้อย เหมาะกับสินค้าที่ตรวจสอบด้วยซีเรียล/หมายเลขเครื่องได้</p>
        </div>
        <div className="how-card">
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 14 }}>ขั้นตอนการดำเนินงาน</div>
          {STEPS.map((s, i) => (
            <div key={i} className="how-step"><div className="how-num">{i + 1}</div><div><div className="how-t">{s.t}</div><div className="how-d">{s.d}</div></div></div>
          ))}
        </div>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '12px 16px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
          ⚠️ สำคัญ: ผู้ซื้อต้องถ่ายวิดีโอตอนแกะกล่องทุกครั้ง หากไม่มีวิดีโอก่อนแกะ จะไม่สามารถเรียกร้องกับผู้ขายได้ และจะถือว่าสินค้าถูกต้องตามที่ตกลง
        </div>
        {controls.isEnabled('tradeSimple')
          ? <Link href="/deal/create?type=simple" className="btn btn-primary btn-block" style={{ display: 'flex', justifyContent: 'center', textDecoration: 'none' }}>เริ่มสร้างดีล →</Link>
          : <button type="button" className="btn btn-primary btn-block" disabled>ปิดให้บริการชั่วคราว</button>}
      </div>
    </div>
  );
}
