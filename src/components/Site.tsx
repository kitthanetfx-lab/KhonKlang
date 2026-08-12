'use client';
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from './Icon';
import { useAppPreferences } from './AppPreferences';

/* ---------- hooks ---------- */
export function useScrolled(threshold = 8) {
  const [s, setS] = useState(false);
  useEffect(() => {
    const on = () => setS(window.scrollY > threshold);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [threshold]);
  return s;
}

export function useReveal() {
  useLayoutEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const els = [...document.querySelectorAll<HTMLElement>('.reveal')];
    if (reduce || !els.length) return;
    els.forEach(el => { el.style.opacity = '0'; el.style.transform = 'translateY(22px)'; });
    let order = 0;
    els.forEach(el => {
      const own = parseFloat(getComputedStyle(el).getPropertyValue('--d')) || 0;
      el.dataset.rvDelay = String(own || (order++ * 55));
    });
    const t0 = performance.now();
    let raf = 0, done = false;
    const loop = (now: number) => {
      let allDone = true;
      els.forEach(el => {
        const delay = parseFloat(el.dataset.rvDelay || '0') || 0;
        const k = Math.min(1, Math.max(0, (now - t0 - delay) / 640));
        const e = 1 - Math.pow(1 - k, 3);
        if (k >= 1) { el.style.opacity = ''; el.style.transform = ''; }
        else { allDone = false; el.style.opacity = e.toFixed(3); el.style.transform = `translateY(${((1 - e) * 22).toFixed(2)}px)`; }
      });
      if (!allDone) raf = requestAnimationFrame(loop); else done = true;
    };
    raf = requestAnimationFrame(loop);
    return () => { if (!done) cancelAnimationFrame(raf); };
  }, []);
}

export function useTilt(max = 9) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const ref = useCallback((node: HTMLDivElement | null) => {
    elRef.current = node;
  }, []);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const el = elRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) translateZ(0)`;
  }, [max]);
  const onMouseLeave = useCallback(() => {
    if (elRef.current) elRef.current.style.transform = 'perspective(900px) rotateX(0) rotateY(0)';
  }, []);
  return { ref, onMouseMove, onMouseLeave };
}

export function CountUp({ to, suffix = '', prefix = '', dur = 1600, delay = 350, className }:
  { to: number; suffix?: string; prefix?: string; dur?: number; delay?: number; className?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0, t0: number | null = null;
    const begin = performance.now() + delay;
    const tick = (t: number) => {
      if (t < begin) { raf = requestAnimationFrame(tick); return; }
      if (t0 === null) t0 = t;
      const k = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setVal(to * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, dur, delay]);
  const display = to % 1 === 0 ? Math.round(val).toLocaleString() : val.toFixed(1);
  return <span className={className}>{prefix}{display}{suffix}</span>;
}

/* ---------- Logo ---------- */
export function Logo({ sub = true }: { sub?: boolean }) {
  return (
    <Link href="/" className="logo" aria-label="กลางฮับ หน้าแรก">
      <span className="logo-mark" style={{ background: 'transparent', overflow: 'hidden', padding: 0 }}>
        <Image src="/logo.png" alt="กลางฮับ" width={64} height={64} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </span>
      <span className="logo-word">กลางฮับ{sub && <small>GLANGHUB</small>}</span>
    </Link>
  );
}

/* ---------- Nav (legacy — ใช้ UnifiedSiteHeader ใน AppChrome แทน) ---------- */
export function Nav(_props?: { active?: string }) {
  return null;
}

/* ---------- Footer ---------- */
function getFooterCols(locale: 'th' | 'en') {
  if (locale === 'en') {
    return [
      {
        h: 'Services',
        links: [
          { t: 'Escrow Trade', href: '/service/trade' },
          { t: 'Meetup Escrow', href: '/service/meetup' },
          { t: 'Consign with Escrow', href: '/service/consign' },
          { t: 'On-site Service', href: '/service/onsite' },
        ],
      },
      {
        h: 'Marketplace',
        links: [
          { t: 'Wanted Board', href: '/wanted' },
          { t: 'Pre-owned Items', href: '/marketplace' },
          { t: 'Luxury Goods', href: '/marketplace' },
          { t: 'Game Accounts', href: '/marketplace' },
          { t: 'Collectibles', href: '/marketplace' },
          { t: 'Wholesale / Farm', href: '/marketplace' },
        ],
      },
      {
        h: 'Help',
        links: [
          { t: 'How It Works', href: '/how-it-works' },
          { t: 'Scam Check', href: '/check-scam' },
          { t: 'Fees', href: '/fees' },
          { t: 'FAQ', href: '/faq' },
          { t: 'Contact', href: '/contact' },
        ],
      },
    ];
  }
  return [
    {
      h: 'บริการ',
      links: [
        { t: 'ซื้อขายผ่านกลาง', href: '/service/trade' },
        { t: 'นัดรับผ่านกลาง', href: '/service/meetup' },
        { t: 'ฝากขายผ่านกลาง', href: '/service/consign' },
        { t: 'บริการนัดออนไซต์', href: '/service/onsite' },
      ],
    },
    {
      h: 'ตลาด',
      links: [
        { t: 'ประกาศหาสินค้า', href: '/wanted' },
        { t: 'สินค้ามือสอง', href: '/marketplace' },
        { t: 'แบรนด์เนม', href: '/marketplace' },
        { t: 'ไอดีเกม', href: '/marketplace' },
        { t: 'ของสะสม', href: '/marketplace' },
        { t: 'ค้าส่ง/เหมาสวน', href: '/marketplace' },
      ],
    },
    {
      h: 'ช่วยเหลือ',
      links: [
        { t: 'วิธีใช้งาน', href: '/how-it-works' },
        { t: 'เช็คคนโกง', href: '/check-scam' },
        { t: 'ค่าธรรมเนียม', href: '/fees' },
        { t: 'คำถามที่พบบ่อย', href: '/faq' },
        { t: 'ติดต่อทีมงาน', href: '/contact' },
      ],
    },
  ];
}

export function Footer() {
  const { locale } = useAppPreferences();
  const footCols = getFooterCols(locale);
  return (
    <footer className="footer">
      <div className="container" style={{ padding: '56px 22px 26px' }}>
        <div
          className="foot-grid"
          style={{ display: 'grid', gap: 38, gridTemplateColumns: '1.4fr repeat(3, 1fr)' }}
        >
          <div>
            <div className="logo" style={{ marginBottom: 14 }}>
              <span className="logo-mark" style={{ background: 'transparent', overflow: 'hidden', padding: 0 }}>
                <Image src="/logo.png" alt="กลางฮับ" width={64} height={64} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </span>
              <span className="logo-word" style={{ color: '#fff' }}>
                {locale === 'th' ? 'กลางฮับ' : 'Glanghub'}
                <small style={{ color: 'rgba(255,255,255,.45)' }}>GLANGHUB</small>
              </span>
            </div>
            <p style={{ color: '#9aa6c4', fontSize: 14, maxWidth: '34ch' }}>
              {locale === 'th'
                ? 'แพลตฟอร์มซื้อขายปลอดภัยด้วยระบบตัวกลาง ช่วยลดความเสี่ยงในการโอนเงิน ตรวจรับสินค้า และติดตามดีลได้ในที่เดียว'
                : 'A secure escrow marketplace that reduces transfer risk, supports item verification, and keeps every deal trackable in one place.'}
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <span
                className="badge badge-green"
                style={{
                  background: 'rgba(46,192,127,.16)',
                  color: '#7fe7b8',
                  border: '1px solid rgba(46,192,127,.3)',
                }}
              >
                <span className="dot" /> {locale === 'th' ? 'ระบบคุ้มครองดีล' : 'Protected Deal System'}
              </span>
            </div>
          </div>

          {footCols.map((c) => (
            <div key={c.h}>
              <h4>{c.h}</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 11, fontSize: 14 }}>
                {c.links.map((l) => (
                  <li key={l.t}>
                    <Link href={l.href}>{l.t}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <hr style={{ border: 0, borderTop: '1px solid rgba(255,255,255,.1)', margin: '34px 0 18px' }} />

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 13,
            color: '#8694b5',
          }}
        >
          <span>{locale === 'th' ? `© ${new Date().getFullYear() + 543} GLANGHUB - ซื้อขายมั่นใจด้วยระบบตัวกลาง` : `© ${new Date().getFullYear()} GLANGHUB - Secure trading with escrow protection`}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
            <Link href="/privacy">{locale === 'th' ? 'นโยบายความเป็นส่วนตัว' : 'Privacy Policy'}</Link>
            <Link href="/terms">{locale === 'th' ? 'เงื่อนไขการใช้งาน' : 'Terms of Use'}</Link>
            <Link href="/cookies">{locale === 'th' ? 'นโยบายคุกกี้' : 'Cookie Policy'}</Link>
            <Link href="/status">{locale === 'th' ? 'สถานะระบบ' : 'System Status'}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
