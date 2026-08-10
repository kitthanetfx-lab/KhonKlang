'use client';

/* eslint-disable @next/next/no-img-element */

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AddressPicker, type ThaiAddress, addressLabel } from '@/components/AddressPicker';
import { DealFlowBrand } from '@/components/DealFlowBrand';

type Mode = {
  title: string;
  href: string;
  image: string;
  kind: 'guarantee' | 'safezone';
};

type Props = {
  step: 1 | 2;
  onStep: (s: 1 | 2) => void;
  modes: Mode[];
  guaranteeEnabled: boolean;
  safeZoneEnabled: boolean;
  disabledMessage: (kind: 'guarantee' | 'safezone') => string;
  myRole: 'buyer' | 'seller';
  onRole: (r: 'buyer' | 'seller') => void;
  title: string;
  onTitle: (v: string) => void;
  price: string;
  onPrice: (v: string) => void;
  myAddr: ThaiAddress;
  onAddr: (a: ThaiAddress) => void;
  error: string;
  creating: boolean;
  onCreate: () => void;
};

/** นัดรับผ่านกลาง — มือถือ */
export function MeetupApp({
  step, onStep, modes, guaranteeEnabled, safeZoneEnabled, disabledMessage,
  myRole, onRole, title, onTitle, price, onPrice, myAddr, onAddr, error, creating, onCreate,
}: Props) {
  const router = useRouter();

  return (
    <div className="svc-app">
      {step === 1 && (
        <>
          <div className="svc-app-hero">
            <div className="svc-app-hero-icon">🚗</div>
            <h2 className="svc-app-hero-title">เลือกรูปแบบบริการ</h2>
          </div>
          <div className="svc-app-modes">
            {modes.map(m => {
              const enabled = m.kind === 'guarantee' ? guaranteeEnabled : safeZoneEnabled;
              return enabled ? (
                <button
                  key={m.title}
                  type="button"
                  className="svc-app-mode svc-app-mode--btn"
                  onClick={() => m.kind === 'guarantee' ? onStep(2) : router.push(m.href)}
                >
                  <div className="svc-app-mode-media">
                    <Image src={m.image} alt={m.title} fill className="svc-app-mode-image" sizes="100vw" />
                  </div>
                  <div className="svc-app-mode-title">{m.title}</div>
                  <div className="svc-app-mode-cta">เริ่มต้น →</div>
                </button>
              ) : (
                <div key={m.title} className="svc-app-mode is-disabled">
                  <div className="svc-app-mode-media">
                    <Image src={m.image} alt={m.title} fill className="svc-app-mode-image" sizes="100vw" />
                  </div>
                  <div className="svc-app-mode-title">{m.title}</div>
                  <div className="svc-app-mode-off">ปิดชั่วคราว</div>
                  <p className="svc-app-mode-note">{disabledMessage(m.kind)}</p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {step === 2 && (
        <div className="svc-app-form">
          <DealFlowBrand docked />
          <button type="button" className="btn btn-ghost btn-sm svc-app-back" onClick={() => onStep(1)}>
            ← ย้อนกลับ
          </button>
          <h2 className="svc-app-form-title">🚗 นัดรับ + รับประกันเดินทาง</h2>
          <p className="svc-app-form-lead">
            ระบุที่อยู่ของคุณคนเดียวพอ — อีกฝ่ายจะระบุที่อยู่ของเขาเองเมื่อเข้าร่วมดีล
          </p>

          <div className="app-field">
            <label>ฉันเป็น...</label>
            <div className="svc-app-chips">
              {([['buyer', '🛍️ ผู้ซื้อ'], ['seller', '🛒 ผู้ขาย']] as const).map(([k, l]) => (
                <button key={k} type="button" className={`svc-app-chip${myRole === k ? ' is-on' : ''}`} onClick={() => onRole(k)}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="app-field">
            <label>สินค้า/สิ่งที่นัดรับ *</label>
            <input value={title} onChange={e => onTitle(e.target.value)} maxLength={150} placeholder="เช่น iPhone 15 Pro มือสอง" />
          </div>

          <div className="app-field">
            <label>ราคาสินค้า (บาท)</label>
            <input type="number" min="0" value={price} onChange={e => onPrice(e.target.value)} placeholder="ไม่บังคับ" />
          </div>

          <div className="app-field">
            <label>📍 ที่อยู่ของฉัน ({myRole === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย'}) *</label>
            <AddressPicker value={myAddr} onChange={onAddr} />
            {myAddr.tambon && <p className="svc-app-addr-ok">✅ {addressLabel(myAddr)}</p>}
          </div>

          {error && <p className="rv-error">{error}</p>}
          <button
            type="button"
            className="btn btn-primary btn-block btn-lg"
            disabled={creating || !title.trim() || !myAddr.tambon || !guaranteeEnabled}
            onClick={onCreate}
          >
            {creating ? 'กำลังสร้างดีล...' : 'สร้างดีลนัดรับ →'}
          </button>
        </div>
      )}
    </div>
  );
}

export default MeetupApp;
