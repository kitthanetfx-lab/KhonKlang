'use client';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { ServiceDisabledNotice } from '@/components/ServiceDisabledNotice';
import { useServiceControls } from '@/lib/useServiceControls';

const STEPS = [
  {
    icon: 'wallet',
    step: 'ขั้น 1',
    t: 'ผู้ซื้อโอนเงินเข้าบัญชีกลาง',
    d: 'เงินพักไว้ก่อน ยังไม่ถึงผู้ขายจนกว่าผู้ซื้อจะยืนยันรับสินค้า',
  },
  {
    icon: 'truck',
    step: 'ขั้น 2',
    t: 'ผู้ขายส่งของและบันทึกวิดีโอ',
    d: 'ถ่ายวิดีโอขั้นตอนแพ็กและเลขเครื่องสำคัญให้ตรวจสอบย้อนหลังได้',
  },
  {
    icon: 'camera',
    step: 'ขั้น 3',
    t: 'ผู้ซื้อถ่ายก่อนแกะและกดยืนยัน',
    d: 'เมื่อผู้ซื้อยืนยันรับของถูกต้อง ระบบจะปล่อยเงินให้ผู้ขายทันที',
  },
];

const TRUST_POINTS = [
  {
    icon: 'lock',
    title: 'เงินยังไม่เข้าผู้ขายทันที',
    text: 'เงินอยู่กับคนกลางจนกว่าผู้ซื้อจะกดยืนยันรับสินค้า',
  },
  {
    icon: 'film',
    title: 'มีหลักฐานตรวจสอบย้อนหลัง',
    text: 'ใช้วิดีโอและเลขเครื่องช่วยยืนยันสภาพสินค้าได้ชัดเจน',
  },
  {
    icon: 'shieldCheck',
    title: 'ลดความเสี่ยงโอนแล้วเงียบ',
    text: 'ทั้งสองฝ่ายเห็นสถานะดีลตรงกันและทำตามขั้นตอนได้ง่าย',
  },
];

const QUICK_FACTS = [
  { icon: 'verified', label: 'เหมาะกับ', value: 'มือถือ โน้ตบุ๊ก และสินค้ามีเลขเครื่อง' },
  { icon: 'clock', label: 'ใช้เวลาเข้าใจ', value: 'ประมาณ 3 วินาที' },
  { icon: 'users', label: 'เหมาะกับดีล', value: 'ส่งตรงถึงผู้ซื้อ ไม่ต้องนัดตรวจหน้างาน' },
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
      <div className="svc-inner svc-simple-page">
        <section className="svc-simple-hero premium-fade">
          <div className="svc-simple-copy">
            <div className="svc-simple-eyebrow">
              <span className="svc-simple-eyebrow-icon"><Icon name="shieldCheck" size={16} /></span>
              ซื้อขายปลอดภัยแบบเข้าใจง่าย
            </div>
            <h1 className="svc-simple-title">ส่งของตรงถึงผู้ซื้อ แต่เงินยังปลอดภัยอยู่กับคนกลาง</h1>
            <p className="svc-simple-sub">
              เหมาะกับสินค้าที่ตรวจสอบได้ด้วยวิดีโอและเลขเครื่อง ผู้ใช้เข้าใจ flow ได้เร็วและรู้ทันทีว่าเงินจะยังไม่ถูกปล่อยจนกว่าจะยืนยันรับของ
            </p>
            <div className="svc-simple-cta-row">
              {controls.isEnabled('tradeSimple')
                ? <Link href="/deal/create?type=simple" className="btn btn-primary btn-lg svc-simple-cta">เริ่มสร้างรายการซื้อขาย</Link>
                : <button type="button" className="btn btn-primary btn-lg svc-simple-cta" disabled>ปิดให้บริการชั่วคราว</button>}
            </div>
            <div className="svc-simple-proof">
              <div className="svc-simple-proof-icon"><Icon name="lock" size={20} /></div>
              <div>
                <div className="svc-simple-proof-title">Trust Section</div>
                <div className="svc-simple-proof-text">เงินอยู่กับคนกลางจนกว่าผู้ซื้อจะยืนยันรับสินค้า</div>
              </div>
            </div>
          </div>

          <div className="svc-simple-hero-card premium-fade">
            <div className="svc-simple-hero-badge">
              <Icon name="verified" size={16} />
              โฟลว์สั้น เข้าใจง่าย
            </div>
            <div className="svc-simple-hero-grid">
              {QUICK_FACTS.map((item) => (
                <div key={item.label} className="svc-simple-stat">
                  <div className="svc-simple-stat-icon"><Icon name={item.icon} size={20} /></div>
                  <div className="svc-simple-stat-label">{item.label}</div>
                  <div className="svc-simple-stat-value">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="svc-simple-section premium-fade">
          <div className="svc-simple-section-head">
            <div>
              <div className="svc-simple-kicker">ขั้นตอน</div>
              <h2 className="svc-simple-section-title">3 ขั้นตอนที่เข้าใจได้ทันที</h2>
            </div>
            <p className="svc-simple-section-copy">สั้น ชัด และออกแบบมาให้รู้ว่าใครทำอะไรในแต่ละช่วง</p>
          </div>
          <div className="svc-simple-steps">
            {STEPS.map((s) => (
              <article key={s.step} className="svc-simple-step-card premium-fade">
                <div className="svc-simple-step-top">
                  <div className="svc-simple-step-icon"><Icon name={s.icon} size={24} /></div>
                  <span className="svc-simple-step-badge">{s.step}</span>
                </div>
                <h3 className="svc-simple-step-title">{s.t}</h3>
                <p className="svc-simple-step-text">{s.d}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="svc-simple-section premium-fade">
          <div className="svc-simple-section-head">
            <div>
              <div className="svc-simple-kicker">ความมั่นใจ</div>
              <h2 className="svc-simple-section-title">เหตุผลที่ผู้ใช้รู้สึกปลอดภัยกว่า</h2>
            </div>
          </div>
          <div className="svc-simple-trust-grid">
            {TRUST_POINTS.map((item) => (
              <article key={item.title} className="svc-simple-trust-card">
                <div className="svc-simple-trust-icon"><Icon name={item.icon} size={22} /></div>
                <h3 className="svc-simple-trust-title">{item.title}</h3>
                <p className="svc-simple-trust-text">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="svc-simple-alert premium-fade" role="alert" aria-live="polite">
          <div className="svc-simple-alert-icon"><Icon name="info" size={22} /></div>
          <div>
            <div className="svc-simple-alert-title">ข้อสำคัญก่อนเริ่มดีล</div>
            <p className="svc-simple-alert-text">
              <strong>ผู้ซื้อต้องถ่ายวิดีโอก่อนแกะกล่องทุกครั้ง</strong> หากไม่มีวิดีโอก่อนแกะ
              <strong> ระบบจะไม่สามารถใช้เป็นหลักฐานโต้แย้งกับผู้ขายได้</strong>
            </p>
          </div>
        </section>

        <section className="svc-simple-bottom premium-fade">
          {controls.isEnabled('tradeSimple')
            ? <Link href="/deal/create?type=simple" className="btn btn-primary btn-lg btn-block svc-simple-bottom-cta">เริ่มสร้างรายการซื้อขาย</Link>
            : <button type="button" className="btn btn-primary btn-lg btn-block svc-simple-bottom-cta" disabled>ปิดให้บริการชั่วคราว</button>}
        </section>
      </div>
    </div>
  );
}
