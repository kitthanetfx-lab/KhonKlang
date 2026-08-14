'use client';

import Image, { StaticImageData } from 'next/image';

type Slide = { src: StaticImageData | string; alt: string };

interface ServiceSlideCarouselProps {
  slides: Slide[];
  activeSlide: number;
  onSelect: (index: number) => void;
}

/** Carousel ขั้นตอนบริการ — ซ้อนรูป + crossfade กัน layout ยุบตอนเปลี่ยน slide */
export function ServiceSlideCarousel({ slides, activeSlide, onSelect }: ServiceSlideCarouselProps) {
  return (
    <div className="svc-simple-slider svc-simple-fade">
      <div className="svc-simple-slide-shell">
        <div className="svc-simple-slide-frame">
          {slides.map((slide, index) => (
            <Image
              key={slide.alt}
              src={slide.src}
              alt={slide.alt}
              fill
              sizes="(max-width: 640px) 100vw, 680px"
              className={`svc-simple-slide-image${index === activeSlide ? ' is-active' : ''}`}
              priority={index === 0}
            />
          ))}
        </div>

        <div className="svc-simple-slider-dots" aria-label="ตัวเลือกรูปขั้นตอน">
          {slides.map((slide, index) => (
            <button
              key={slide.alt}
              type="button"
              className={`svc-simple-slider-dot${index === activeSlide ? ' is-active' : ''}`}
              onClick={() => onSelect(index)}
              aria-label={`ดูรูปขั้นตอน ${index + 1}`}
              aria-pressed={index === activeSlide}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
