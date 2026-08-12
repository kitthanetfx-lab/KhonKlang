'use client';
import slide1 from '../../../../public/1.webp';
import slide2 from '../../../../public/2.webp';
import slide3 from '../../../../public/3.webp';
import slide4 from '../../../../public/4.webp';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { SubPageHeader } from '@/components/mobile/SubPageHeader';
import { ServiceDisabledNotice } from '@/components/ServiceDisabledNotice';
import { useServiceControls } from '@/lib/useServiceControls';

const SLIDES = [
  { src: slide1, alt: 'ขั้นตอนที่ 1 ซื้อขายผ่านกลางแบบง่าย' },
  { src: slide2, alt: 'ขั้นตอนที่ 2 ซื้อขายผ่านกลางแบบง่าย' },
  { src: slide3, alt: 'ขั้นตอนที่ 3 ซื้อขายผ่านกลางแบบง่าย' },
  { src: slide4, alt: 'ขั้นตอนที่ 4 ซื้อขายผ่านกลางแบบง่าย' },
];

export default function ServiceSimplePage() {
  const controls = useServiceControls();
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % SLIDES.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, []);

  if (!controls.loading && !controls.isEnabled('tradeSimple')) {
    return <ServiceDisabledNotice title="ซื้อขายผ่านกลางแบบง่าย" message={controls.message('tradeSimple')} backHref="/service/trade" backLabel="กลับไปหน้าบริการ" />;
  }

  return (
    <div className="sub-page service-sub-page svc-simple-page">
      <SubPageHeader backHref="/service/trade" title="ซื้อขายผ่านกลางแบบง่าย" titleIcon="zap" />
      <div className="svc-inner svc-simple-stage">
        <div className="svc-simple-panel svc-simple-fade">
          <div className="svc-simple-brand-wrap">
            <div className="svc-simple-brand">
              <Image src="/logo.png" alt="กลางฮับ" width={420} height={132} priority className="svc-simple-brand-image" />
            </div>
          </div>

          <div className="svc-simple-hero">
            <h1 className="svc-simple-title">ซื้อขายผ่านกลางแบบง่าย</h1>
          </div>

          <div className="svc-simple-kicker svc-simple-fade">ขั้นตอนการดำเนินงาน</div>
          <div className="svc-simple-slider svc-simple-fade">
            <div className="svc-simple-slide-shell">
              <div className="svc-simple-slide-frame">
                <Image
                  key={activeSlide}
                  src={SLIDES[activeSlide].src}
                  alt={SLIDES[activeSlide].alt}
                  className="svc-simple-slide-image"
                  priority
                />
              </div>

              <div className="svc-simple-slider-dots" aria-label="ตัวเลือกรูปขั้นตอน">
                {SLIDES.map((slide, index) => (
                  <button
                    key={slide.alt}
                    type="button"
                    className={`svc-simple-slider-dot${index === activeSlide ? ' is-active' : ''}`}
                    onClick={() => setActiveSlide(index)}
                    aria-label={`ดูรูปขั้นตอน ${index + 1}`}
                    aria-pressed={index === activeSlide}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="svc-simple-alert svc-simple-fade">
            <span className="svc-simple-alert-icon"><Icon name="info" size={20} strokeWidth={2.1} /></span>
            <span className="svc-simple-alert-text"><strong>สำคัญ:</strong> ผู้ซื้อต้องถ่ายวิดีโอหลักฐานทุกครั้ง มิฉะนั้นจะไม่สามารถใช้เรียกร้องกับผู้ขายได้</span>
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
