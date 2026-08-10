'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { useAppPreferences } from '@/components/AppPreferences';

const TABS = [
  { href: '/', icon: 'home' as const, labelTh: 'หน้าแรก', labelEn: 'Home', match: (p: string) => p === '/' },
  { href: '/marketplace', icon: 'store' as const, labelTh: 'ตลาด', labelEn: 'Market', match: (p: string) => p.startsWith('/marketplace') || p.startsWith('/shop') || p.startsWith('/wanted') },
  { href: '/messages', icon: 'message' as const, labelTh: 'ข้อความ', labelEn: 'Messages', match: (p: string) => p.startsWith('/messages') },
  { href: '/cart', icon: 'shoppingCart' as const, labelTh: 'ตะกร้า', labelEn: 'Cart', match: (p: string) => p.startsWith('/cart') },
  { href: '/profile', icon: 'user' as const, labelTh: 'โปรไฟล์', labelEn: 'Profile', match: (p: string) => p.startsWith('/profile') || p.startsWith('/dashboard') || p.startsWith('/orders') },
];

export function AppBottomNav() {
  const pathname = usePathname() || '/';
  const { locale } = useAppPreferences();

  return (
    <nav className="app-bottom-nav" aria-label={locale === 'th' ? 'เมนูหลัก' : 'Main menu'}>
      {TABS.map(tab => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`app-bottom-nav-item${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon name={tab.icon} size={22} />
            <span>{locale === 'th' ? tab.labelTh : tab.labelEn}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default AppBottomNav;
