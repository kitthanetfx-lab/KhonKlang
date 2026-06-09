'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';

const EF_NODES: Record<string, { x: number; y: number; label: string; icon: string; tint: string }> = {
  buyer:  { x: 17, y: 23, label: 'ผู้ซื้อ',   icon: 'user',  tint: 'blue' },
  seller: { x: 83, y: 23, label: 'ผู้ขาย',   icon: 'store', tint: 'violet' },
  vault:  { x: 50, y: 73, label: 'คนกลาง',  icon: 'shieldCheck', tint: 'green' },
};

interface Seg { key: string; dur: number; from?: string; to?: string; ctrl?: { x: number; y: number }; hold?: boolean; icon: string; color: string; label: string; sub: string; }
const EF_SEGMENTS: Seg[] = [
  { key: 'pay',     dur: 1700, from: 'buyer',  to: 'vault',  ctrl: { x: 22, y: 54 }, icon: 'coins',   color: 'var(--blue-500)',  label: 'ผู้ซื้อชำระเงินเข้าระบบ',     sub: 'เงินถูกพักไว้ ยังไม่ถึงผู้ขาย' },
  { key: 'hold',    dur: 1500, hold: true,                                            icon: 'lock',    color: 'var(--green-500)', label: 'คนกลางพักเงินไว้ปลอดภัย',     sub: 'ตรวจสอบตัวตนผู้ขายเรียบร้อย' },
  { key: 'ship',    dur: 1700, from: 'seller', to: 'buyer',  ctrl: { x: 50, y: 2 },  icon: 'package', color: 'var(--accent)',    label: 'ผู้ขายส่งของ • ผู้ซื้อตรวจรับ', sub: 'ยืนยันว่าได้ของตรงปกแล้ว' },
  { key: 'release', dur: 1700, from: 'vault',  to: 'seller', ctrl: { x: 78, y: 54 }, icon: 'coins',   color: 'var(--green-500)', label: 'ระบบปล่อยเงินให้ผู้ขายอัตโนมัติ', sub: 'จบดีลอย่างปลอดภัยทั้งสองฝ่าย' },
];

function efBezier(a: {x:number;y:number}, c: {x:number;y:number}, b: {x:number;y:number}, t: number) {
  const u = 1 - t;
  return { x: u*u*a.x + 2*u*t*c.x + t*t*b.x, y: u*u*a.y + 2*u*t*c.y + t*t*b.y };
}

export function EscrowStage({ speed = 1 }: { speed?: number }) {
  const [seg, setSeg] = useState(0);
  const [t, setT] = useState(0);
  const reduce = useRef(typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const raf = useRef(0);
  const last = useRef(0);

  useEffect(() => {
    if (reduce.current) { setSeg(3); setT(1); return; }
    const loop = (now: number) => {
      if (!last.current) last.current = now;
      const dt = now - last.current; last.current = now;
      setT(prev => {
        const s = EF_SEGMENTS[seg];
        const nt = prev + (dt / s.dur) * speed;
        if (nt >= 1) { setSeg(p => (p + 1) % EF_SEGMENTS.length); return 0; }
        return nt;
      });
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf.current); last.current = 0; };
  }, [seg, speed]);

  const s = EF_SEGMENTS[seg];
  let tok: {x:number;y:number} = EF_NODES.vault;
  let tokScale = 1, tokVisible = true;
  if (!s.hold && s.from && s.to && s.ctrl) {
    const a = EF_NODES[s.from], b = EF_NODES[s.to];
    tok = efBezier(a, { x: s.ctrl.x, y: s.ctrl.y }, b, t);
    const e = Math.sin(t * Math.PI);
    tokScale = 0.7 + e * 0.5;
    tokVisible = e > 0.04;
  } else { tokVisible = false; }

  const active: Record<string, boolean> = {
    buyer:  s.key === 'pay' || s.key === 'ship',
    seller: s.key === 'release' || s.key === 'ship',
    vault:  s.key === 'pay' || s.key === 'hold' || s.key === 'release',
  };
  const pct = ((seg + t) / EF_SEGMENTS.length) * 100;

  const lines = [
    { from: 'buyer',  to: 'vault',  c: { x: 22, y: 54 }, on: s.key === 'pay' },
    { from: 'seller', to: 'vault',  c: { x: 78, y: 54 }, on: s.key === 'release' },
    { from: 'seller', to: 'buyer',  c: { x: 50, y: 2 },  on: s.key === 'ship' },
  ];
  const pos = (k: string) => ({ left: EF_NODES[k].x + '%', top: EF_NODES[k].y + '%' });

  return (
    <div className="ef-wrap">
      <div className="ef-stage">
        <div className="ef-head">
          <span className="ef-live"><span className="ef-live-dot" /> ระบบคนกลางอัตโนมัติ</span>
          <span className="ef-amount mono">฿45,000 <b>ล็อกปลอดภัย</b></span>
        </div>
        <svg className="ef-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="efg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="var(--accent)" /><stop offset="1" stopColor="var(--green-400)" />
            </linearGradient>
          </defs>
          {lines.map((l, i) => {
            const a = EF_NODES[l.from], b = EF_NODES[l.to];
            const d = `M ${a.x} ${a.y} Q ${l.c.x} ${l.c.y} ${b.x} ${b.y}`;
            return (
              <g key={i}>
                <path d={d} className="ef-line" vectorEffect="non-scaling-stroke" />
                <path d={d} className={`ef-line-active ${l.on ? 'on' : ''}`} vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
        </svg>
        {['buyer', 'seller'].map(k => (
          <div key={k} className={`ef-node ${active[k] ? 'on' : ''}`} style={pos(k)}>
            <span className={`ef-node-ic ${EF_NODES[k].tint}`}><Icon name={EF_NODES[k].icon} size={20} /></span>
            <span className="ef-node-lb">{EF_NODES[k].label}</span>
          </div>
        ))}
        <div className={`ef-vault ${active.vault ? 'on' : ''}`} style={pos('vault')}>
          <div className="ef-vault-ring" style={{ background: `conic-gradient(var(--green-400) ${pct * 3.6}deg, var(--line) 0)` }}>
            <div className="ef-vault-core"><Icon name="shieldCheck" size={26} /></div>
          </div>
          <div className="ef-vault-meta"><b>คนกลาง</b><span>ถือเงินไว้ให้</span></div>
        </div>
        <div className="ef-token" style={{
          left: tok.x + '%', top: tok.y + '%',
          transform: `translate(-50%,-50%) scale(${tokScale.toFixed(2)})`,
          opacity: tokVisible ? 1 : 0,
          background: s.color, boxShadow: `0 10px 24px -6px ${s.color}`,
        }}>
          <Icon name={s.icon} size={20} />
        </div>
        <span className="ef-float ef-float-1"><Icon name="lock" size={13} /> เข้ารหัสปลอดภัย</span>
        <span className="ef-float ef-float-2"><Icon name="verified" size={13} /> ยืนยันตัวตน KYC</span>
      </div>
      <ol className="ef-steps">
        {EF_SEGMENTS.map((st, i) => (
          <li key={st.key} className={`ef-step ${i === seg ? 'active' : ''} ${i < seg ? 'done' : ''}`}>
            <span className="ef-step-no">{i < seg ? <Icon name="check" size={14} /> : i + 1}</span>
            <span className="ef-step-tx"><b>{st.label}</b><span>{st.sub}</span></span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default EscrowStage;
