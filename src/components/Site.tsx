'use client';
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Icon } from './Icon';
import { useUser } from '@/lib/useUser';

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
  const ref = useRef<HTMLDivElement>(null);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) translateZ(0)`;
  }, [max]);
  const onMouseLeave = useCallback(() => { if (ref.current) ref.current.style.transform = 'perspective(900px) rotateX(0) rotateY(0)'; }, []);
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
    <Link href="/" className="logo" aria-label="คนกลาง หน้าแรก">
      <span className="logo-mark" style={{ background: 'transparent', overflow: 'hidden', padding: 0 }}>
        <img src="/logo.png" alt="คนกลาง" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </span>
      <span className="logo-word">คนกลาง{sub && <small>KHONKLANG</small>}</span>
    </Link>
  );
}

/* ---------- Nav data ---------- */
interface NavItem { icon: string; tint: string; t: string; d: string; href: string; }
export const NAV_REGISTER: NavItem[] = [
  { icon: 'users', tint: '', t: 'สมัครเป็นผู้ขาย', d: 'เปิดร้าน ขายของอย่างมั่นใจ มีเครดิตการันตี', href: '/register/seller' },
  { icon: 'handCoins', tint: 'green', t: 'สมัครเป็นคนกลาง', d: 'รับงานคนกลาง สร้างรายได้จากความน่าเชื่อถือ', href: '/register/middleman' },
];
export const NAV_SERVICES: NavItem[] = [
  { icon: 'shieldCheck', tint: '', t: 'ซื้อขายผ่านกลาง', d: 'พักเงินไว้กับระบบ ปลอดภัยทั้งสองฝ่าย', href: '/service/trade' },
  { icon: 'mapPin', tint: 'green', t: 'นัดรับผ่านกลาง', d: 'นัดเจอในจุดปลอดภัย มีคนกลางดูแล', href: '/service/meetup' },
  { icon: 'store', tint: 'violet', t: 'ฝากขายผ่านกลาง', d: 'ฝากของให้คนกลางช่วยขายให้', href: '/service/consign' },
  { icon: 'mapPin', tint: 'amber', t: 'บริการนัดออนไซต์', d: 'ช่างผู้เชี่ยวชาญตรวจสอบถึงที่', href: '/service/onsite' },
];

function DropItem({ it }: { it: NavItem }) {
  return (
    <Link className="dropdown-item" href={it.href}>
      <span className={`icon-tile ${it.tint}`}><Icon name={it.icon} /></span>
      <span>
        <span className="t" style={{ display: 'block' }}>{it.t}</span>
        <span className="d">{it.d}</span>
      </span>
    </Link>
  );
}

/* ---------- Nav ---------- */
export function Nav({ active }: { active?: string }) {
  const scrolled = useScrolled();
  const [drawer, setDrawer] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const { user, loading, logout } = useUser();
  useEffect(() => { document.body.style.overflow = drawer ? 'hidden' : ''; }, [drawer]);
  useEffect(() => {
    if (!profileOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [profileOpen]);
  const displayName = user?.prefs?.displayName || user?.name || 'บัญชีของฉัน';
  const shortName = displayName.length > 18 ? `${displayName.slice(0, 18)}...` : displayName;
  const profileItems: NavItem[] = [
    { icon: 'user', tint: '', t: 'โปรไฟล์ของฉัน', d: 'ดูและแก้ไขข้อมูลบัญชี', href: '/profile' },
    ...(user?.prefs?.sellerStatus === 'approved'
      ? [{ icon: 'store', tint: '', t: 'บอร์ดผู้ขาย', d: 'จัดการประกาศและดีลของคุณ', href: '/dashboard/seller' }]
      : []),
    ...(user?.prefs?.middlemanStatus === 'approved'
      ? [{ icon: 'handCoins', tint: 'green', t: 'บอร์ดคนกลาง', d: 'ดูดีลที่กำลังดูแลอยู่', href: '/dashboard/middleman' }]
      : []),
    ...(user?.prefs?.role === 'admin'
      ? [{ icon: 'layoutDashboard', tint: 'violet', t: 'แอดมิน', d: 'เข้าแผงจัดการระบบ', href: '/admin' }]
      : []),
  ];

  return (
    <nav className={`nav ${scrolled ? 'scrolled' : ''}`}>
      <div className="container nav-inner">
        <Logo />
        <div className="nav-links">
          <div className="dropdown">
            <button className="nav-link">สมัคร <Icon name="chevronDown" size={16} /></button>
            <div className="dropdown-menu">{NAV_REGISTER.map(it => <DropItem key={it.t} it={it} />)}</div>
          </div>
          <div className="dropdown">
            <button className="nav-link">บริการผ่านคนกลาง <Icon name="chevronDown" size={16} /></button>
            <div className="dropdown-menu" style={{ minWidth: 290 }}>{NAV_SERVICES.map(it => <DropItem key={it.t} it={it} />)}</div>
          </div>
          <Link className={`nav-link ${active === 'market' ? 'is-active' : ''}`} href="/marketplace"><Icon name="store" size={17} /> ตลาด</Link>
          <Link className="nav-link" href="/check-scam"><Icon name="search" size={17} /> เช็คคนโกง</Link>
        </div>
        <div className="nav-cta-group">
          {loading ? (
            <span className="btn btn-ghost btn-sm" aria-busy="true">กำลังโหลด...</span>
          ) : user ? (
            <>
              <div className={`dropdown ${profileOpen ? 'open' : ''}`} ref={profileMenuRef}>
                <button type="button" className="btn btn-ghost btn-sm profile-trigger" onClick={() => setProfileOpen(v => !v)}>
                  <Icon name="user" size={16} /> {shortName} <Icon name="chevronDown" size={16} />
                </button>
                <div className="dropdown-menu dropdown-menu-right">
                  {profileItems.map(it => <DropItem key={it.href} it={it} />)}
                </div>
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={logout}>ออกจากระบบ</button>
            </>
          ) : (
            <>
              <Link className="btn btn-ghost btn-sm" href="/login">เข้าสู่ระบบ</Link>
              <Link className="btn btn-primary btn-sm" href="/register">เริ่มต้นใช้งาน <Icon name="arrowRight" size={16} /></Link>
            </>
          )}
        </div>
        <button className="nav-burger" onClick={() => setDrawer(true)} aria-label="เมนู"><Icon name="menu" size={22} /></button>
      </div>

      <div className={`drawer-backdrop ${drawer ? 'open' : ''}`} onClick={() => setDrawer(false)} />
      <aside className={`drawer ${drawer ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Logo sub={false} />
          <button className="nav-burger" style={{ display: 'grid' }} onClick={() => setDrawer(false)}><Icon name="x" size={20} /></button>
        </div>
        <div className="drawer-sep" />
        {loading ? (
          <span className="btn btn-ghost btn-block" aria-busy="true">กำลังโหลด...</span>
        ) : user ? (
          <>
            <Link className="btn btn-primary btn-block" href="/profile" style={{ marginBottom: 8 }} onClick={() => setDrawer(false)}>
              <Icon name="user" size={16} /> {shortName}
            </Link>
            {profileItems.filter(it => it.href !== '/profile').map(it => (
              <Link key={it.href} className="drawer-link" href={it.href} onClick={() => setDrawer(false)}>
                <Icon name={it.icon} /> {it.t}
              </Link>
            ))}
            <button type="button" className="btn btn-ghost btn-block" onClick={() => { setDrawer(false); logout(); }}>ออกจากระบบ</button>
          </>
        ) : (
          <>
            <Link className="btn btn-primary btn-block" href="/register" style={{ marginBottom: 8 }}>เริ่มต้นใช้งาน <Icon name="arrowRight" size={16} /></Link>
            <Link className="btn btn-ghost btn-block" href="/login">เข้าสู่ระบบ</Link>
          </>
        )}
        <div className="drawer-sep" />
        <div className="drawer-label">บริการผ่านคนกลาง</div>
        {NAV_SERVICES.map(s => (
          <Link key={s.t} className="drawer-link" href={s.href}><Icon name={s.icon} /> {s.t}</Link>
        ))}
        <div className="drawer-sep" />
        <Link className="drawer-link" href="/marketplace"><Icon name="store" /> ตลาด</Link>
        <Link className="drawer-link" href="/check-scam"><Icon name="search" /> เช็คคนโกง</Link>
        <div className="drawer-sep" />
        <div className="drawer-label">สมัครสมาชิก</div>
        {NAV_REGISTER.map(s => (
          <Link key={s.t} className="drawer-link" href={s.href}><Icon name={s.icon} /> {s.t}</Link>
        ))}
      </aside>
    </nav>
  );
}

/* ---------- Footer ---------- */
const FOOT_COLS = [
  { h: 'บริการ', links: ['ซื้อขายผ่านกลาง', 'นัดรับผ่านกลาง', 'ฝากขายผ่านกลาง', 'บริการนัดออนไซต์'] },
  { h: 'ตลาด', links: ['สินค้ามือสอง', 'แบรนด์เนม', 'ไอดีเกม', 'ของสะสม', 'เหมาสวน/ค้าส่ง'] },
  { h: 'ช่วยเหลือ', links: ['วิธีใช้งาน', 'เช็คคนโกง', 'ค่าธรรมเนียม', 'ติดต่อทีมงาน', 'คำถามที่พบบ่อย'] },
];

export function Footer() {
  return (
    <footer className="footer">
      <div className="container" style={{ padding: '56px 22px 26px' }}>
        <div style={{ display: 'grid', gap: 38, gridTemplateColumns: '1.4fr repeat(3, 1fr)' }} className="foot-grid">
          <div>
            <div className="logo" style={{ marginBottom: 14 }}>
              <span className="logo-mark" style={{ background: 'transparent', overflow: 'hidden', padding: 0 }}><img src="/logo.png" alt="คนกลาง" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></span>
              <span className="logo-word" style={{ color: '#fff' }}>คนกลาง<small style={{ color: 'rgba(255,255,255,.45)' }}>KHONKLANG</small></span>
            </div>
            <p style={{ color: '#9aa6c4', fontSize: 14, maxWidth: '34ch' }}>แพลตฟอร์มซื้อขายปลอดภัยผ่านคนกลางที่ผ่านการรับรอง พักเงินไว้กับระบบจนกว่าจะได้รับของจริง</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <span className="badge badge-green" style={{ background: 'rgba(46,192,127,.16)', color: '#7fe7b8', border: '1px solid rgba(46,192,127,.3)' }}><span className="dot" /> ระบบทำงานปกติ</span>
            </div>
          </div>
          {FOOT_COLS.map(c => (
            <div key={c.h}>
              <h4>{c.h}</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 11, fontSize: 14 }}>
                {c.links.map(l => <li key={l}><a href="#">{l}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <hr style={{ border: 0, borderTop: '1px solid rgba(255,255,255,.1)', margin: '34px 0 18px' }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: '#8694b5' }}>
          <span>© 2568 Khonklang — ซื้อขายมั่นใจ ไร้กังวล</span>
          <div style={{ display: 'flex', gap: 18 }}>
            <Link href="/privacy">ความเป็นส่วนตัว</Link>
            <a href="#">เงื่อนไขการใช้งาน</a>
            <a href="#">นโยบายคุกกี้</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
