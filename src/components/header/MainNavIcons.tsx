'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useAppPreferences } from '@/components/AppPreferences';
import { getMainNavMenus, type NavItem } from '@/lib/navData';

function DropItem({ it }: { it: NavItem }) {
  return (
    <Link className="dropdown-item" href={it.href} onClick={e => e.stopPropagation()}>
      <span className={`icon-tile ${it.tint}`}><Icon name={it.icon} /></span>
      <span>
        <span className="t" style={{ display: 'block' }}>{it.t}</span>
        <span className="d">{it.d}</span>
      </span>
    </Link>
  );
}

/** ไอคอนหลัก 4 ตัว + label ใต้ไอคอน — mobile/tablet แถบที่ 2 */
export function MainNavIcons() {
  const { locale } = useAppPreferences();
  const pathname = usePathname() || '';
  const menus = getMainNavMenus(locale);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const isActive = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpenKey(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenKey(null); };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <nav className="hdr-main-nav" ref={wrapRef} aria-label={locale === 'th' ? 'เมนูหลัก' : 'Main menu'}>
      {menus.map(menu => {
        const active = isActive(menu.hrefPrefix);
        const open = openKey === menu.key;
        const alignCenter = menu.key === 'market' || menu.key === 'scam';
        return (
          <div
            key={menu.key}
            className={`dropdown hdr-main-dd${open ? ' open' : ''}${active ? ' is-active' : ''}`}
          >
            <button
              type="button"
              className={`hdr-main-tile${active || open ? ' is-active' : ''}`}
              aria-haspopup="true"
              aria-expanded={open}
              aria-label={menu.label}
              onClick={() => setOpenKey(open ? null : menu.key)}
            >
              <span className="hdr-main-icon">
                <Icon name={menu.icon} size={20} />
              </span>
              <span className="hdr-main-icon-label">{menu.label}</span>
            </button>
            <div
              className={`dropdown-menu hdr-main-dropdown${alignCenter ? ' hdr-main-dropdown--center' : ''}`}
              onMouseDown={e => e.stopPropagation()}
            >
              {menu.items.map(it => <DropItem key={it.href} it={it} />)}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
