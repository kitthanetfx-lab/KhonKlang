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

type Props = { compact?: boolean };

/** ไอคอนหลัก 4 ตัว — สมัคร / บริการ / ตลาด / เช็คคนโกง (กดแล้วมี dropdown) */
export function MainNavIcons({ compact = false }: Props) {
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
    <nav className={`hdr-main-nav${compact ? ' hdr-main-nav--compact' : ''}`} ref={wrapRef} aria-label={locale === 'th' ? 'เมนูหลัก' : 'Main menu'}>
      {menus.map(menu => {
        const active = isActive(menu.hrefPrefix);
        const open = openKey === menu.key;
        return (
          <div
            key={menu.key}
            className={`dropdown hdr-main-dd${open ? ' open' : ''}${active ? ' is-active' : ''}`}
          >
            <button
              type="button"
              className={`hdr-main-icon hdr-main-icon--${menu.tone}${active ? ' is-active' : ''}`}
              aria-haspopup="true"
              aria-expanded={open}
              aria-label={menu.label}
              title={menu.label}
              onClick={() => setOpenKey(open ? null : menu.key)}
            >
              <Icon name={menu.icon} size={compact ? 16 : 18} />
              {!compact && <span className="hdr-main-icon-label">{menu.label}</span>}
            </button>
            <div className="dropdown-menu hdr-main-dropdown">
              {menu.items.map(it => <DropItem key={it.href} it={it} />)}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
