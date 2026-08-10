'use client';

/* eslint-disable @next/next/no-img-element */

import Image from 'next/image';
import Link from 'next/link';
import type { StaticImageData } from 'next/image';
import { Icon } from '@/components/Icon';

type Slide = { src: StaticImageData; alt: string };

type Props = {
  title: string;
  subs: string[];
  slides: Slide[];
  activeSlide: number;
  onSlide: (i: number) => void;
  alertText: string;
  ctaHref: string;
  ctaLabel: string;
  enabled: boolean;
};

/** หน้า slider บริการซื้อขาย (simple/online) — มือถือ */
export function ServiceFlowApp({
  title, subs, slides, activeSlide, onSlide, alertText, ctaHref, ctaLabel, enabled,
}: Props) {
  return (
    <div className="svc-app svc-app-flow">
      <div className="svc-app-flow-brand">
        <Image src="/logo.png" alt="กลางฮับ" width={160} height={50} priority />
      </div>

      <div className="svc-app-flow-hero">
        <h2 className="svc-app-flow-title">{title}</h2>
        {subs.map(line => <p key={line} className="svc-app-flow-sub">{line}</p>)}
      </div>

      <p className="svc-app-section-label">ขั้นตอนการดำเนินงาน</p>
      <div className="svc-app-flow-slide">
        <Image
          key={activeSlide}
          src={slides[activeSlide].src}
          alt={slides[activeSlide].alt}
          className="svc-app-flow-slide-img"
          priority
        />
        <div className="svc-app-flow-dots">
          {slides.map((slide, index) => (
            <button
              key={slide.alt}
              type="button"
              className={`svc-app-flow-dot${index === activeSlide ? ' is-on' : ''}`}
              onClick={() => onSlide(index)}
              aria-label={`ดูรูปขั้นตอน ${index + 1}`}
            />
          ))}
        </div>
      </div>

      <div className="svc-app-flow-alert">
        <Icon name="info" size={20} />
        <span>{alertText}</span>
      </div>

      {enabled
        ? <Link href={ctaHref} className="btn btn-primary btn-block">{ctaLabel}</Link>
        : <button type="button" className="btn btn-primary btn-block" disabled>ปิดให้บริการชั่วคราว</button>}
    </div>
  );
}

export default ServiceFlowApp;
