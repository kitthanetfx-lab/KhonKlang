'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { useAppPreferences } from '@/components/AppPreferences';
import {
  getMainNavMenus,
  type NavItem,
} from '@/lib/navData';

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

/** เมนูตัวอักษร + dropdown — ใช้บน desktop (≥980px) */
export function DesktopNavMenus() {
  const { locale } = useAppPreferences();
  const pathname = usePathname() || '';
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

  return (
    <nav className="app-hdr-desktop-nav" aria-label={locale === 'th' ? 'เมนูหลัก' : 'Main menu'}>
      <div className="dropdown">
        <button type="button" className={`nav-link${isAct('/register') ? ' is-active' : ''}`} aria-haspopup="true">
          {register.label} <Icon name="chevronDown" size={16} />
        </button>
        <div className="dropdown-menu">
          {register.items.map(it => <DropItem key={it.href} it={it} />)}
        </div>
      </div>
      <div className="dropdown">
        <button type="button" className={`nav-link${isAct('/service') ? ' is-active' : ''}`} aria-haspopup="true">
          {serviceLabel} <Icon name="chevronDown" size={16} />
        </button>
        <div className="dropdown-menu" style={{ minWidth: 290 }}>
          {service.items.map(it => <DropItem key={it.href} it={it} />)}
        </div>
      </div>
      <div className="dropdown">
        <button type="button" className={`nav-link${isMarketBrowse ? ' is-active' : ''}`} aria-haspopup="true">
          <Icon name="store" size={17} /> {market.label} <Icon name="chevronDown" size={16} />
        </button>
        <div className="dropdown-menu">
          {market.items.map(it => <DropItem key={it.href} it={it} />)}
        </div>
      </div>
      <div className="dropdown">
        <button type="button" className={`nav-link${isAct('/check-scam') ? ' is-active' : ''}`} aria-haspopup="true">
          <Icon name="search" size={17} /> {scam.label} <Icon name="chevronDown" size={16} />
        </button>
        <div className="dropdown-menu">
          {scam.items.map(it => <DropItem key={it.href} it={it} />)}
        </div>
      </div>
    </nav>
  );
}
