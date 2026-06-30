'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Icon } from './Icon';
import { ServiceControlKey } from '@/lib/serviceControls';
import { useServiceControls } from '@/lib/useServiceControls';

interface Slide { key: string; tint: string; icon: string; tag: string; pain: string; title: string; solution: string; benefits: string[]; forWho: string; cta: string; href: string; }

/** สถิติจริงจาก /api/stats — ไม่มีตัวเลขตัวอย่าง แสดงเฉพาะค่าจริงเท่านั้น */
export interface SliderStats {
  protectedValue?: number; completedDeals?: number; meetupDeals?: number;
  middlemen?: number; scamRecords?: number; middlemanRating?: number; middlemanReviews?: number;
}

function fmtBaht(v: number) {
  if (v >= 1_000_000) return `฿${(Math.round(v / 100_000) / 10).toLocaleString()} ล้าน`;
  return `฿${v.toLocaleString()}`;
}

/** เลือกสถิติจริงต่อสไลด์ — ระหว่างโหลดแสดง "—" */
function realStat(key: string, s: SliderStats | null): { v: string; l: string } {
  if (!s) return { v: '—', l: 'กำลังโหลดสถิติ…' };
  switch (key) {
    case 'escrow': return { v: fmtBaht(s.protectedValue || 0), l: 'มูลค่าที่คุ้มครองแล้ว (ค่าจริง)' };
    case 'meet':   return { v: (s.meetupDeals || 0).toLocaleString(), l: 'ดีลนัดรับผ่านระบบ' };
    case 'consign':
      return (s.middlemanReviews || 0) > 0
        ? { v: `${s.middlemanRating}/5`, l: `คะแนนรีวิวคนกลาง (${(s.middlemanReviews || 0).toLocaleString()} รีวิว)` }
        : { v: (s.middlemen || 0).toLocaleString(), l: 'คนกลางพร้อมรับฝากขาย' };
    case 'onsite': return { v: (s.middlemen || 0).toLocaleString(), l: 'คนกลาง/ผู้เชี่ยวชาญที่ผ่านการรับรอง' };
    case 'scam':   return { v: (s.scamRecords || 0).toLocaleString(), l: 'รายชื่อในฐานข้อมูลคนโกง' };
    default:       return { v: (s.completedDeals || 0).toLocaleString(), l: 'ดีลสำเร็จ' };
  }
}

const SS_SLIDES: Slide[] = [
  { key: 'escrow', tint: 'blue', icon: 'shieldCheck', tag: 'นิยมที่สุด',
    pain: 'โอนเงินไปก่อน… แล้วคนขายเงียบหาย หรือได้ของไม่ตรงปก',
    title: 'ซื้อขายผ่านกลาง',
    solution: 'พักเงินไว้กับระบบคนกลาง ผู้ขายจะได้รับเงินก็ต่อเมื่อคุณกดยืนยันว่าได้ของจริง ตรงปก',
    benefits: ['เงินปลอดภัย 100% จนกว่าจะรับของ', 'ได้ของไม่ตรง คืนเงินเต็มจำนวน', 'มีหลักฐานครบทุกขั้นตอน'],
    forWho: 'มือถือ ไอที · แบรนด์เนม · ไอดีเกม · ของสะสม',
    cta: 'เริ่มซื้อขายผ่านกลาง', href: '/service/trade' },
  { key: 'meet', tint: 'green', icon: 'mapPin', tag: '',
    pain: 'นัดเจอซื้อของมือสอง กลัวเจอของปลอม โดนสับเปลี่ยน หรือไม่ปลอดภัย',
    title: 'นัดรับผ่านกลาง',
    solution: 'นัดส่งมอบในจุดปลอดภัย (Safe Zone) ที่มีคนกลางคอยตรวจสอบสินค้าและดูแลการแลกเปลี่ยนให้',
    benefits: ['จุดนัดพบที่คัดกรองและปลอดภัย', 'คนกลางช่วยตรวจของก่อนจ่ายเงิน', 'มีกล้องและพยานทุกการนัด'],
    forWho: 'รถมือสอง · นาฬิกา/พระเครื่อง · สินค้าชิ้นใหญ่',
    cta: 'หาจุดนัดใกล้ฉัน', href: '/service/meetup' },
  { key: 'consign', tint: 'violet', icon: 'store', tag: '',
    pain: 'อยากขายของแต่ไม่มีเวลาถ่ายรูป ลงประกาศ ตอบแชต และต่อราคา',
    title: 'ฝากขายผ่านกลาง',
    solution: 'ส่งของให้คนกลางมืออาชีพช่วยถ่ายรูป ลงขาย ปิดการขาย และส่งมอบแทนคุณจนจบดีล',
    benefits: ['มืออาชีพดูแลให้ตั้งแต่ต้นจนจบ', 'เข้าถึงฐานผู้ซื้อที่พร้อมจ่าย', 'รู้สถานะและยอดขายแบบเรียลไทม์'],
    forWho: 'พ่อค้าแม่ค้าออนไลน์ · ของสะสม · สินค้าแบรนด์',
    cta: 'ฝากขายกับคนกลาง', href: '/service/consign' },
  { key: 'onsite', tint: 'amber', icon: 'user', tag: 'ใหม่',
    pain: 'จะซื้อรถ เครื่องจักร หรือมือถือมือสอง แต่ดูเองไม่เป็น กลัวเจอของมีปัญหา',
    title: 'บริการนัดออนไซต์',
    solution: 'เรียกช่างหรือผู้เชี่ยวชาญเฉพาะทางไปตรวจสอบสินค้าถึงที่ พร้อมรายงานผลก่อนคุณตัดสินใจซื้อ',
    benefits: ['ช่างผู้เชี่ยวชาญตรวจให้ถึงที่', 'รายงานสภาพจริงพร้อมรูปถ่าย', 'ตัดสินใจซื้อได้อย่างมั่นใจ'],
    forWho: 'รถ/ยานพาหนะ · เครื่องจักรหนัก · ไอที',
    cta: 'เรียกช่างตรวจสอบ', href: '/service/onsite' },
  { key: 'scam', tint: 'rose', icon: 'search', tag: '',
    pain: 'ไม่แน่ใจว่าคนที่กำลังจะคุยด้วย เคยมีประวัติโกงคนอื่นมาก่อนหรือเปล่า',
    title: 'เช็คคนโกงก่อนโอน',
    solution: 'ค้นหาชื่อ เลขบัญชี หรือเบอร์โทรศัพท์จากฐานข้อมูลแบล็กลิสต์ เพื่อกรองความเสี่ยงก่อนทำธุรกรรม',
    benefits: ['ค้นจากฐานข้อมูลคนโกงล่าสุด', 'รู้ผลทันทีก่อนโอนเงิน', 'ช่วยกันรายงานเพื่อเตือนคนอื่น'],
    forWho: 'ทุกคนที่ซื้อขายออนไลน์',
    cta: 'ตรวจสอบคนโกง', href: '/check-scam' },
];

const SERVICE_KEYS_BY_SLIDE: Partial<Record<Slide['key'], ServiceControlKey>> = {
  escrow: 'tradeOnline',
  meet: 'meetupGuarantee',
  consign: 'consign',
  onsite: 'onsite',
};

export function ServiceSlider({ stats = null }: { stats?: SliderStats | null }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = SS_SLIDES.length;
  const drag = useRef({ active: false, x0: 0, dx: 0 });
  const [dx, setDx] = useState(0);
  const controls = useServiceControls();

  const go = useCallback((d: number) => setI(p => (p + d + n) % n), [n]);
  const to = useCallback((idx: number) => setI(((idx % n) + n) % n), [n]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setI(p => (p + 1) % n), 6000);
    return () => clearInterval(id);
  }, [paused, n]);

  const onDown = (e: React.PointerEvent) => { drag.current = { active: true, x0: e.clientX, dx: 0 }; setPaused(true); };
  const onMove = (e: React.PointerEvent) => { if (!drag.current.active) return; drag.current.dx = e.clientX - drag.current.x0; setDx(drag.current.dx); };
  const onUp = () => {
    if (!drag.current.active) return;
    const d = drag.current.dx; drag.current.active = false; setDx(0);
    if (Math.abs(d) > 60) go(d < 0 ? 1 : -1);
    setTimeout(() => setPaused(false), 400);
  };

  return (
    <div className="ss" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="ss-frame">
        <button className="ss-arrow ss-prev" onClick={() => go(-1)} aria-label="ก่อนหน้า"><Icon name="chevronRight" size={22} style={{ transform: 'rotate(180deg)' }} /></button>
        <button className="ss-arrow ss-next" onClick={() => go(1)} aria-label="ถัดไป"><Icon name="chevronRight" size={22} /></button>
        <div className="ss-viewport" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
          <div className="ss-track" style={{ transform: `translateX(calc(${-i * 100}% + ${dx}px))` }}>
            {SS_SLIDES.map((sl) => {
              const st = realStat(sl.key, stats);
              const serviceKey = SERVICE_KEYS_BY_SLIDE[sl.key];
              const enabled = serviceKey ? controls.isEnabled(serviceKey) : true;
              return (
              <article key={sl.key} className={`ss-slide tint-${sl.tint}`}>
                <div className="ss-copy">
                  <div className="ss-pain">
                    <span className="ss-pain-ic"><Icon name="message" size={16} /></span>
                    <span><b>ปัญหาที่เจอบ่อย</b>{sl.pain}</span>
                  </div>
                  <div className="ss-arrow-down"><Icon name="arrowRight" size={18} style={{ transform: 'rotate(90deg)' }} /></div>
                  <div className="ss-sol-head">
                    <span className={`icon-tile ${sl.tint === 'blue' ? '' : sl.tint}`}><Icon name={sl.icon} /></span>
                    <div>
                      <div className="ss-sol-kicker">ทางแก้จากคนกลาง</div>
                      <h3 className="ss-title">{sl.title}{sl.tag && <span className={`badge ${sl.tag === 'ใหม่' ? 'badge-green' : 'badge-blue'}`}>{sl.tag}</span>}</h3>
                    </div>
                  </div>
                  <p className="ss-sol">{sl.solution}</p>
                  {enabled ? (
                    <Link className="btn btn-primary" href={sl.href}>{sl.cta} <Icon name="arrowRight" size={17} /></Link>
                  ) : (
                    <button className="btn btn-primary" type="button" disabled title={serviceKey ? controls.message(serviceKey) : ''}>
                      ปิดชั่วคราว
                    </button>
                  )}
                </div>
                <div className="ss-panel">
                  <div className="ss-panel-glow" />
                  <div className="ss-panel-head">
                    <span className="ss-benefit-eyebrow"><Icon name="sparkles" size={14} /> ข้อดีที่คุณได้</span>
                  </div>
                  <ul className="ss-benefits">
                    {sl.benefits.map((b, k) => (<li key={k}><span className="ss-check"><Icon name="check" size={14} /></span>{b}</li>))}
                  </ul>
                  <div className="ss-panel-foot">
                    <div className="ss-stat">
                      <div className="ss-stat-v">{st.v}</div>
                      <div className="ss-stat-l">{st.l}</div>
                    </div>
                    <div className="ss-for">
                      <span className="ss-for-lb"><Icon name="users" size={13} /> เหมาะกับ</span>
                      <span className="ss-for-tx">{sl.forWho}</span>
                    </div>
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        </div>
      </div>
      <div className="ss-controls">
        <div className="ss-dots">
          {SS_SLIDES.map((sl, k) => (
            <button key={sl.key} className={`ss-dot ${k === i ? 'on' : ''}`} onClick={() => to(k)} aria-label={sl.title}>
              <span className="ss-dot-fill" style={{ animationPlayState: k === i && !paused ? 'running' : 'paused' }} />
            </button>
          ))}
        </div>
        <div className="ss-count mono">{String(i + 1).padStart(2, '0')} <span>/ {String(n).padStart(2, '0')}</span></div>
      </div>
    </div>
  );
}
