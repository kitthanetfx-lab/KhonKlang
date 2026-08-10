'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, LogOut, Menu, ChevronRight } from 'lucide-react';
import { getAdminActiveLabel, getAdminNav } from './adminNav';

type Props = {
  children: ReactNode;
  locale: 'th' | 'en';
  adminName: string;
  onLogout: () => void | Promise<void>;
};

export function AdminAppShell({ children, locale, adminName, onLogout }: Props) {
  const pathname = usePathname();
  const nav = getAdminNav(locale);
  const activeLabel = getAdminActiveLabel(pathname, locale, nav);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="admin-app">
      <header className="admin-app-top">
        <button
          type="button"
          className="admin-app-menu"
          aria-label={locale === 'th' ? 'เปิดเมนู' : 'Open menu'}
          onClick={() => setDrawerOpen(true)}
        >
          <Menu size={22} />
        </button>
        <div className="admin-app-top-tx">
          <span className="admin-app-top-kicker">{locale === 'th' ? 'Admin' : 'Admin'}</span>
          <h1 className="admin-app-top-title">{activeLabel}</h1>
        </div>
        <div className="admin-app-top-actions">
          <Link href="/" target="_blank" className="admin-app-top-link" aria-label={locale === 'th' ? 'ดูหน้าเว็บ' : 'Open website'}>
            ↗
          </Link>
          <button type="button" className="admin-app-top-bell" aria-label={locale === 'th' ? 'การแจ้งเตือน' : 'Notifications'}>
            <Bell size={18} />
          </button>
        </div>
      </header>

      <main className="admin-app-main">{children}</main>

      {drawerOpen && (
        <button
          type="button"
          className="admin-app-drawer-backdrop"
          aria-label={locale === 'th' ? 'ปิดเมนู' : 'Close menu'}
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <aside className={`admin-app-drawer${drawerOpen ? ' is-open' : ''}`} aria-hidden={!drawerOpen}>
        <div className="admin-app-drawer-head">
          <span className="admin-app-drawer-brand">🛡️ {locale === 'th' ? 'คนกลาง Admin' : 'Glanghub Admin'}</span>
          <button type="button" className="admin-app-drawer-close" onClick={() => setDrawerOpen(false)} aria-label={locale === 'th' ? 'ปิด' : 'Close'}>
            ×
          </button>
        </div>

        <nav className="admin-app-drawer-nav">
          {nav.map(n => {
            const isActive = n.href === '/admin' ? pathname === '/admin' : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setDrawerOpen(false)}
                className={`admin-app-drawer-link${isActive ? ' is-active' : ''}`}
              >
                <n.icon size={18} />
                <span>{n.label}</span>
                <ChevronRight size={16} className="admin-app-drawer-chevron" />
              </Link>
            );
          })}
        </nav>

        <div className="admin-app-drawer-foot">
          <div className="admin-app-drawer-user">
            <div className="admin-app-drawer-av">{adminName[0]?.toUpperCase() || 'A'}</div>
            <div className="admin-app-drawer-user-tx">
              <strong>{adminName}</strong>
              <span>Admin</span>
            </div>
          </div>
          <button type="button" className="admin-app-drawer-logout" onClick={() => void onLogout()}>
            <LogOut size={16} />
            {locale === 'th' ? 'ออกจากระบบ' : 'Sign out'}
          </button>
        </div>
      </aside>
    </div>
  );
}

export default AdminAppShell;
