'use client';

/* eslint-disable @next/next/no-img-element */

import Image from 'next/image';
import Link from 'next/link';

type Mode = { title: string; href: string; image: string };

type Props = {
  modes: Mode[];
  isEnabled: (href: string) => boolean;
  disabledMessage: (href: string) => string;
};

/** เลือกรูปแบบบริการซื้อขาย — มือถือ */
export function TradeApp({ modes, isEnabled, disabledMessage }: Props) {
  return (
    <div className="svc-app">
      <div className="svc-app-hero">
        <div className="svc-app-hero-icon">🤝</div>
        <h2 className="svc-app-hero-title">เลือกรูปแบบบริการ</h2>
      </div>
      <div className="svc-app-modes">
        {modes.map(m => {
          const enabled = isEnabled(m.href);
          return enabled ? (
            <Link key={m.title} href={m.href} className="svc-app-mode">
              <div className="svc-app-mode-media">
                <Image src={m.image} alt={m.title} fill className="svc-app-mode-image" sizes="100vw" />
              </div>
              <div className="svc-app-mode-title">{m.title}</div>
              <div className="svc-app-mode-cta">เริ่มต้น →</div>
            </Link>
          ) : (
            <div key={m.title} className="svc-app-mode is-disabled">
              <div className="svc-app-mode-media">
                <Image src={m.image} alt={m.title} fill className="svc-app-mode-image" sizes="100vw" />
              </div>
              <div className="svc-app-mode-title">{m.title}</div>
              <div className="svc-app-mode-off">ปิดชั่วคราว</div>
              <p className="svc-app-mode-note">{disabledMessage(m.href)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TradeApp;
