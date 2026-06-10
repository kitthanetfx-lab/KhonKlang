'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';

const EF_NODES: Record<string, { x: number; y: number; label: string; icon: string; tint: string }> = {
  buyer:  { x: 14, y: 26, label: 'ผู้ซื้อ', icon: 'user', tint: 'blue' },
  agent:  { x: 50, y: 26, label: 'คนกลาง', icon: 'users', tint: 'blue' },
  seller: { x: 86, y: 26, label: 'ผู้ขาย', icon: 'store', tint: 'violet' },
  hub:    { x: 50, y: 73, label: 'ศูนย์กลาง', icon: 'shieldCheck', tint: 'green' },
};

interface Seg { key: string; dur: number; from?: string; to?: string; ctrl?: { x: number; y: number }; hold?: boolean; icon: string; color: string; label: string; sub: string; }
const EF_SEGMENTS: Seg[] = [
  { key: 'pay',     dur: 1700, from: 'buyer', to: 'hub',   ctrl: { x: 26, y: 58 }, icon: 'coins',   color: 'var(--blue-500)',  label: 'ผู้ซื้อโอนเงินขึ้นมาที่ศูนย์กลาง', sub: 'เงินพักไว้กับบริษัทคนกลาง จำกัด' },
  { key: 'lock',    dur: 1500, from: 'agent', to: 'hub',   ctrl: { x: 52, y: 56 }, icon: 'lock',    color: 'var(--amber-500)', label: 'คนกลางวางเครดิตค้ำประกัน', sub: 'ศูนย์กลางล็อกเครดิตตามค่าสินค้า (เช่น ฿3,000)' },
  { key: 'ship',    dur: 1700, from: 'seller', to: 'agent', ctrl: { x: 74, y: 12 }, icon: 'package', color: 'var(--accent)',    label: 'ผู้ขายส่งสินค้าให้คนกลางตรวจสอบ', sub: 'ส่งของให้คนกลางรับและตรวจสอบ' },
  { key: 'deliver', dur: 1700, from: 'agent',  to: 'buyer', ctrl: { x: 32, y: 18 }, icon: 'package', color: 'var(--accent)',    label: 'ตรวจเสร็จส่งสินค้าให้กับผู้ซื้อ', sub: 'คนกลางส่งต่อให้ผู้ซื้อหลังตรวจสอบ' },
  { key: 'release', dur: 1700, from: 'hub',   to: 'seller', ctrl: { x: 74, y: 62 }, icon: 'coins',   color: 'var(--green-500)', label: 'ศูนย์กลางส่งค่าสินค้าให้ผู้ขาย + คืนเครดิต', sub: 'โอนเงินให้ผู้ขาย และคืนเครดิตให้คนกลาง' },
];

function efBezier(a: {x:number;y:number}, c: {x:number;y:number}, b: {x:number;y:number}, t: number) {
  const u = 1 - t;
  return { x: u*u*a.x + 2*u*t*c.x + t*t*b.x, y: u*u*a.y + 2*u*t*c.y + t*t*b.y };
}

export function EscrowStage({ speed = 1 }: { speed?: number }) {
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [seg, setSeg] = useState(0);
  const [t, setT] = useState(0);
  const raf = useRef(0);
  const last = useRef(0);

  useEffect(() => {
    if (reduce) return;
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
  }, [reduce, seg, speed]);

  const activeSeg = reduce ? 3 : seg;
  const activeT = reduce ? 1 : t;
  const s = EF_SEGMENTS[activeSeg];
  let tok: {x:number;y:number} = EF_NODES.hub;
  let tokScale = 1, tokVisible = true;
  if (!s.hold && s.from && s.to && s.ctrl) {
    const a = EF_NODES[s.from], b = EF_NODES[s.to];
    tok = efBezier(a, { x: s.ctrl.x, y: s.ctrl.y }, b, activeT);
    const e = Math.sin(activeT * Math.PI);
    tokScale = 0.7 + e * 0.5;
    tokVisible = e > 0.04;
  } else { tokVisible = false; }

  const active: Record<string, boolean> = {
    buyer:  s.key === 'pay' || s.key === 'deliver' || s.key === 'release',
    seller: s.key === 'ship' || s.key === 'release',
    agent:  s.key === 'lock' || s.key === 'ship' || s.key === 'deliver' || s.key === 'release',
    hub:    s.key === 'pay' || s.key === 'lock' || s.key === 'release',
  };
  const pct = ((activeSeg + activeT) / EF_SEGMENTS.length) * 100;

  const lines = [
    { from: 'buyer', to: 'hub', c: { x: 26, y: 58 }, on: s.key === 'pay' },
    { from: 'agent', to: 'hub', c: { x: 52, y: 56 }, on: s.key === 'lock' },
    { from: 'seller', to: 'agent', c: { x: 74, y: 12 }, on: s.key === 'ship' },
    { from: 'agent', to: 'buyer', c: { x: 32, y: 18 }, on: s.key === 'deliver' },
    { from: 'hub', to: 'seller', c: { x: 74, y: 62 }, on: s.key === 'release' },
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
        {(['buyer', 'agent', 'seller'] as const).map(k => (
          <div key={k} className={`ef-node ${active[k] ? 'on' : ''}`} style={pos(k)}>
            <span className={`ef-node-ic ${EF_NODES[k].tint}`}><Icon name={EF_NODES[k].icon} size={20} /></span>
            {EF_NODES[k].label ? <span className="ef-node-lb">{EF_NODES[k].label}</span> : null}
          </div>
        ))}
        <div className={`ef-vault ${active.hub ? 'on' : ''}`} style={pos('hub')}>
          <div className="ef-vault-ring" style={{ background: `conic-gradient(var(--green-400) ${pct * 3.6}deg, var(--line) 0)` }}>
            <div className="ef-vault-core"><Icon name="shieldCheck" size={26} /></div>
          </div>
          <div className="ef-vault-meta"><b>ศูนย์กลาง</b><span>พักเงิน + ค้ำประกัน</span></div>
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
