'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/Icon';
import { useAppPreferences } from '@/components/AppPreferences';
import {
  getMainNavMenus,
  type NavItem,
} from '@/lib/navData';

function blurActive() {
  const el = document.activeElement;
  if (el instanceof HTMLElement) el.blur();
}

function DropItem({ it, onNavigate }: { it: NavItem; onNavigate: () => void }) {
  return (
    <Link
      className="dropdown-item"
      href={it.href}
      onClick={() => { onNavigate(); blurActive(); }}
    >
      <span className={`icon-tile ${it.tint}`}><Icon name={it.icon} /></span>
      <span>
        <span className="t" style={{ display: 'block' }}>{it.t}</span>
        <span className="d">{it.d}</span>
      </span>
    </Link>
  );
}

/** เมนูตัวอักษร + dropdown — ใช้บน desktop (≥980px) */
export function DesktopNavMenus() {
  const { locale } = useAppPreferences();
  const pathname = usePathname() || '';
  const [openKey, setOpenKey] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const isAct = (p: string) => pathname === p || pathname.startsWith(`${p}/`);
  const isMarketBrowse = (pathname === '/marketplace' || pathname.startsWith('/marketplace/'))
    && !pathname.startsWith('/marketplace/checkout')
    && !pathname.startsWith('/marketplace/orders');

  const menus = getMainNavMenus(locale);
  const register = menus.find(m => m.key === 'register')!;
  const service = menus.find(m => m.key === 'service')!;
  const market = menus.find(m => m.key === 'market')!;
  const scam = menus.find(m => m.key === 'scam')!;

  const serviceLabel = locale === 'th' ? 'บริการผ่านคนกลาง' : 'Escrow Services';

  useEffect(() => {
    setOpenKey(null);
  }, [pathname]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpenKey(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenKey(null); };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const toggle = (key: string) => setOpenKey(prev => (prev === key ? null : key));
  const close = () => {
    setOpenKey(null);
    blurActive();
  };

  const dd = (key: string, active: boolean, label: ReactNode, items: NavItem[], minWidth?: number) => {
    const open = openKey === key;
    return (
      <div
        className={`dropdown app-hdr-dd${open ? ' open' : ''}${active ? ' is-active' : ''}`}
        onMouseEnter={() => setOpenKey(key)}
        onMouseLeave={() => setOpenKey(prev => (prev === key ? null : prev))}
      >
        <button
          type="button"
          className={`nav-link${active || open ? ' is-active' : ''}`}
          aria-haspopup="true"
          aria-expanded={open}
          onClick={() => toggle(key)}
        >
          {label}
        </button>
        <div
          className="dropdown-menu app-hdr-dd-menu"
          style={minWidth ? { minWidth } : undefined}
        >
          {items.map(it => <DropItem key={it.href} it={it} onNavigate={close} />)}
        </div>
      </div>
    );
  };

  return (
    <nav className="app-hdr-desktop-nav" ref={navRef} aria-label={locale === 'th' ? 'เมนูหลัก' : 'Main menu'}>
      {dd('register', isAct('/register'), <>{register.label} <Icon name="chevronDown" size={16} /></>, register.items)}
      {dd('service', isAct('/service'), <>{serviceLabel} <Icon name="chevronDown" size={16} /></>, service.items, 290)}
      {dd('market', isMarketBrowse, <><Icon name="store" size={17} /> {market.label} <Icon name="chevronDown" size={16} /></>, market.items)}
      {dd('scam', isAct('/check-scam'), <><Icon name="search" size={17} /> {scam.label} <Icon name="chevronDown" size={16} /></>, scam.items)}
    </nav>
  );
}
