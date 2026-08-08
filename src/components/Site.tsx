'use client';
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';
import { NotifyBell } from './NotifyBell';
import { MessengerIcon } from './MessengerIcon';
import { InAppBanner } from './InAppBanner';
import { useAppPreferences } from './AppPreferences';
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

/* ---------- Nav data ---------- */
interface NavItem { icon: string; tint: string; t: string; d: string; href: string; }
function getNavRegister(locale: 'th' | 'en'): NavItem[] {
  if (locale === 'en') {
    return [
      { icon: 'users', tint: '', t: 'Become a Seller', d: 'Open your store and sell with escrow-backed trust', href: '/register/seller' },
      { icon: 'handCoins', tint: 'green', t: 'Become a Middleman', d: 'Take escrow jobs and earn from your reputation', href: '/register/middleman' },
    ];
  }
  return [
    { icon: 'users', tint: '', t: 'สมัครเป็นผู้ขาย', d: 'เปิดร้าน ขายของอย่างมั่นใจ มีเครดิตการันตี', href: '/register/seller' },
    { icon: 'handCoins', tint: 'green', t: 'สมัครเป็นคนกลาง', d: 'รับงานคนกลาง สร้างรายได้จากความน่าเชื่อถือ', href: '/register/middleman' },
  ];
}

function getNavServices(locale: 'th' | 'en'): NavItem[] {
  if (locale === 'en') {
    return [
      { icon: 'shieldCheck', tint: '', t: 'Escrow Trade', d: 'Hold funds safely in the system until both sides are protected', href: '/service/trade' },
      { icon: 'mapPin', tint: 'green', t: 'Meetup Escrow', d: 'Meet at a safe point with a middleman supervising', href: '/service/meetup' },
      { icon: 'store', tint: 'violet', t: 'Consign with Escrow', d: 'ฝากของให้คนกลางช่วยขายให้', href: '/service/consign' },
      { icon: 'car', tint: 'amber', t: 'On-site Service', d: 'Experts inspect items at your location', href: '/service/onsite' },
    ];
  }
  return [
    { icon: 'shieldCheck', tint: '', t: 'ซื้อขายผ่านกลาง', d: 'พักเงินไว้กับระบบ ปลอดภัยทั้งสองฝ่าย', href: '/service/trade' },
    { icon: 'mapPin', tint: 'green', t: 'นัดรับผ่านกลาง', d: 'นัดเจอในจุดปลอดภัย มีคนกลางดูแล', href: '/service/meetup' },
    { icon: 'store', tint: 'violet', t: 'ฝากขายผ่านกลาง', d: 'ฝากของให้คนกลางช่วยขายให้', href: '/service/consign' },
    { icon: 'car', tint: 'amber', t: 'บริการนัดออนไซต์', d: 'ช่างผู้เชี่ยวชาญตรวจสอบถึงที่', href: '/service/onsite' },
  ];
}

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
  const { locale } = useAppPreferences();
  const scrolled = useScrolled();
  const pathname = usePathname() || '';
  const isAct = (p: string) => pathname === p || pathname.startsWith(p + '/');
  const isMarketplace = pathname === '/marketplace' || (pathname.startsWith('/marketplace/') && !pathname.startsWith('/marketplace/auctions'));
  const isAuctionPage = pathname === '/marketplace/auctions' || pathname.startsWith('/marketplace/auctions/');
  const navRegister = getNavRegister(locale);
  const navServices = getNavServices(locale);
  const [drawer, setDrawer] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openProfile = () => { if (profileCloseTimer.current) clearTimeout(profileCloseTimer.current); setProfileOpen(true); };
  const closeProfileDelayed = () => {
    if (profileCloseTimer.current) clearTimeout(profileCloseTimer.current);
    profileCloseTimer.current = setTimeout(() => setProfileOpen(false), 300);
  };
  useEffect(() => () => { if (profileCloseTimer.current) clearTimeout(profileCloseTimer.current); }, []);
  const { user, loading, logout } = useUser();
  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : '';
    document.body.classList.toggle('drawer-open', drawer);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setDrawer(false); setProfileOpen(false); } };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('drawer-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [drawer]);
  const displayName = user?.prefs?.displayName || user?.name || (locale === 'th' ? 'บัญชีของฉัน' : 'My account');
  const shortName = displayName.length > 18 ? `${displayName.slice(0, 18)}...` : displayName;
  const profileItems: NavItem[] = locale === 'th'
    ? [
        { icon: 'user', tint: '', t: 'เข้าสู่โปรไฟล์', d: 'ดูและแก้ไขข้อมูลบัญชี', href: '/profile' },
        { icon: 'clock', tint: 'amber', t: 'ดีลของฉัน / ประวัติ', d: 'ประวัติซื้อขายทุกบทบาท + กล่องข้อความ', href: '/orders' },
        { icon: 'store', tint: '', t: 'ร้านของฉัน', d: 'ตั้งค่าร้านและลงขายสินค้า', href: '/dashboard/seller' },
        { icon: 'handCoins', tint: 'green', t: 'บอร์ดคนกลาง', d: 'ดูดีลที่กำลังดูแลอยู่', href: '/dashboard/middleman' },
      ]
    : [
        { icon: 'user', tint: '', t: 'Profile', d: 'View and edit your account details', href: '/profile' },
        { icon: 'clock', tint: 'amber', t: 'My Deals / History', d: 'All transactions and message history', href: '/orders' },
        { icon: 'store', tint: '', t: 'My Shop', d: 'Manage your shop and listings', href: '/dashboard/seller' },
        { icon: 'handCoins', tint: 'green', t: 'Middleman Board', d: 'See deals currently under your care', href: '/dashboard/middleman' },
      ];

  return (
    <>
    <div className="mobile-tab-spacer" />
    <nav className={`nav ${scrolled ? 'scrolled' : ''}`}>
      <InAppBanner />
      <div className="container nav-inner">
        <Logo />
        <div className="nav-links">
          <div className="dropdown">
            <button className={`nav-link ${isAct('/register') ? 'is-active' : ''}`} aria-haspopup="true">{locale === 'th' ? 'สมัคร' : 'Join'} <Icon name="chevronDown" size={16} /></button>
            <div className="dropdown-menu">{navRegister.map(it => <DropItem key={it.t} it={it} />)}</div>
          </div>
          <div className="dropdown">
            <button className={`nav-link ${isAct('/service') ? 'is-active' : ''}`} aria-haspopup="true">{locale === 'th' ? 'บริการผ่านคนกลาง' : 'Escrow Services'} <Icon name="chevronDown" size={16} /></button>
            <div className="dropdown-menu" style={{ minWidth: 290 }}>{navServices.map(it => <DropItem key={it.t} it={it} />)}</div>
          </div>
          <Link className={`nav-link ${active === 'market' || isMarketplace ? 'is-active' : ''}`} href="/marketplace"><Icon name="store" size={17} /> {locale === 'th' ? 'ตลาด' : 'Marketplace'}</Link>
          <Link className={`nav-link ${active === 'auction' || isAuctionPage ? 'is-active' : ''}`} href="/marketplace/auctions"><Icon name="clock" size={17} /> {locale === 'th' ? 'ประมูล' : 'Auctions'}</Link>
          <Link className={`nav-link ${isAct('/check-scam') ? 'is-active' : ''}`} href="/check-scam"><Icon name="search" size={17} /> {locale === 'th' ? 'เช็คคนโกง' : 'Scam Check'}</Link>
        </div>
        {user && <MessengerIcon />}
        {user && <NotifyBell />}
        <div className="nav-cta-group">
          {loading ? (
            <span className="btn btn-ghost btn-sm" aria-busy="true">{locale === 'th' ? 'กำลังโหลด...' : 'Loading...'}</span>
          ) : user ? (
            <>
              <div
                className={`dropdown ${profileOpen ? 'open' : ''}`}
                onMouseEnter={openProfile}
                onMouseLeave={closeProfileDelayed}
              >
                <button type="button" className="btn btn-ghost btn-sm profile-trigger" aria-haspopup="true" aria-expanded={profileOpen} onClick={() => setProfileOpen(v => !v)}>
                  {user.prefs?.avatarUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={user.prefs.avatarUrl} alt="" referrerPolicy="no-referrer" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    : <Icon name="user" size={16} />} {shortName} <Icon name="chevronDown" size={16} />
                </button>
                <div className="dropdown-menu dropdown-menu-right">
                  {profileItems.map(it => <DropItem key={it.href} it={it} />)}
                </div>
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={logout}>{locale === 'th' ? 'ออกจากระบบ' : 'Log out'}</button>
            </>
          ) : (
            <>
              <Link className="btn btn-ghost btn-sm" href="/login">{locale === 'th' ? 'เข้าสู่ระบบ' : 'Log in'}</Link>
              <Link className="btn btn-primary btn-sm" href="/register">{locale === 'th' ? 'เริ่มต้นใช้งาน' : 'Get Started'} <Icon name="arrowRight" size={16} /></Link>
            </>
          )}
        </div>
        <button className="nav-burger" onClick={() => setDrawer(true)} aria-label={locale === 'th' ? 'เปิดเมนู' : 'Open menu'} aria-expanded={drawer}><Icon name="menu" size={22} /></button>
      </div>

        <div className={`drawer-backdrop ${drawer ? 'open' : ''}`} onClick={() => setDrawer(false)} />
      <aside className={`drawer ${drawer ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={locale === 'th' ? 'เมนูหลัก' : 'Main menu'} aria-hidden={!drawer}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Logo sub={false} />
          <button className="nav-burger" style={{ display: 'grid' }} onClick={() => setDrawer(false)} aria-label={locale === 'th' ? 'ปิดเมนู' : 'Close menu'}><Icon name="x" size={20} /></button>
        </div>
        <div className="drawer-sep" />
        {loading ? (
          <span className="btn btn-ghost btn-block" aria-busy="true">{locale === 'th' ? 'กำลังโหลด...' : 'Loading...'}</span>
        ) : user ? (
          <>
            <Link className="btn btn-primary btn-block" href="/profile" style={{ marginBottom: 8 }} onClick={() => setDrawer(false)}>
              <Icon name="user" size={16} /> {shortName}
            </Link>
            {profileItems.filter(it => it.href !== '/profile').map(it => (
              <Link key={it.href} className={`drawer-link ${isAct(it.href) ? 'active' : ''}`} href={it.href} onClick={() => setDrawer(false)}>
                <Icon name={it.icon} /> {it.t}
              </Link>
            ))}
            <button type="button" className="btn btn-ghost btn-block" onClick={() => { setDrawer(false); logout(); }}>{locale === 'th' ? 'ออกจากระบบ' : 'Log out'}</button>
          </>
        ) : (
          <>
            <Link className="btn btn-primary btn-block" href="/register" style={{ marginBottom: 8 }}>{locale === 'th' ? 'เริ่มต้นใช้งาน' : 'Get Started'} <Icon name="arrowRight" size={16} /></Link>
            <Link className="btn btn-ghost btn-block" href="/login">{locale === 'th' ? 'เข้าสู่ระบบ' : 'Log in'}</Link>
          </>
        )}
        <div className="drawer-sep" />
        <div className="drawer-label">{locale === 'th' ? 'บริการผ่านคนกลาง' : 'Escrow Services'}</div>
        {navServices.map(s => (
          <Link key={s.t} className={`drawer-link ${isAct(s.href) ? 'active' : ''}`} href={s.href} onClick={() => setDrawer(false)}><Icon name={s.icon} /> {s.t}</Link>
        ))}
        <div className="drawer-sep" />
        <Link className={`drawer-link ${isMarketplace ? 'active' : ''}`} href="/marketplace" onClick={() => setDrawer(false)}><Icon name="store" /> {locale === 'th' ? 'ตลาด' : 'Marketplace'}</Link>
        <Link className={`drawer-link ${isAuctionPage ? 'active' : ''}`} href="/marketplace/auctions" onClick={() => setDrawer(false)}><Icon name="clock" /> {locale === 'th' ? 'ประมูล' : 'Auctions'}</Link>
        <Link className={`drawer-link ${isAct('/wanted') ? 'active' : ''}`} href="/wanted" onClick={() => setDrawer(false)}><Icon name="bell" /> {locale === 'th' ? 'ประกาศหาสินค้า' : 'Wanted Board'}</Link>
        <Link className={`drawer-link ${isAct('/check-scam') ? 'active' : ''}`} href="/check-scam" onClick={() => setDrawer(false)}><Icon name="search" /> {locale === 'th' ? 'เช็คคนโกง' : 'Scam Check'}</Link>
        <div className="drawer-sep" />
        <div className="drawer-label">{locale === 'th' ? 'สมัครสมาชิก' : 'Join'}</div>
        {navRegister.map(s => (
          <Link key={s.t} className={`drawer-link ${isAct(s.href) ? 'active' : ''}`} href={s.href} onClick={() => setDrawer(false)}><Icon name={s.icon} /> {s.t}</Link>
        ))}
      </aside>
    </nav>
    {/* Mobile service tabs — อยู่นอก nav เพื่อให้ position:fixed ยึด viewport ได้ (backdrop-filter ใน nav จะ trap fixed) */}
    <div className="mobile-service-tabs">
      {navServices.map(s => (
        <Link key={s.href} href={s.href}
          className={`mst-item ${isAct(s.href) ? 'active' : ''}`}>
          <Icon name={s.icon} size={20} />
          <span className="mst-label">{s.t}</span>
        </Link>
      ))}
    </div>
    </>
  );
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
