import {
  LayoutDashboard, Store, Shield, Users, Settings, SlidersHorizontal,
  ShieldAlert, Handshake, EyeOff, Wallet, MessageCircle, Banknote,
  type LucideIcon,
} from 'lucide-react';

export type AdminNavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

export function getAdminNav(locale: 'th' | 'en'): AdminNavItem[] {
  return locale === 'th'
    ? [
        { href: '/admin', icon: LayoutDashboard, label: 'ภาพรวม' },
        { href: '/admin/support', icon: MessageCircle, label: 'แชทลูกค้า' },
        { href: '/admin/sellers', icon: Store, label: 'ผู้ขาย' },
        { href: '/admin/middlemen', icon: Shield, label: 'คนกลาง' },
        { href: '/admin/middleman-deposits', icon: Banknote, label: 'เงินค้ำประกันคนกลาง' },
        { href: '/admin/scam-reports', icon: ShieldAlert, label: 'รายงานคนโกง' },
        { href: '/admin/finance', icon: Wallet, label: 'การเงิน' },
        { href: '/admin/deals', icon: Handshake, label: 'ดีล & ข้อพิพาท' },
        { href: '/admin/moderate', icon: EyeOff, label: 'ตรวจสอบเนื้อหา' },
        { href: '/admin/users', icon: Users, label: 'ผู้ใช้ทั้งหมด' },
        { href: '/admin/service-controls', icon: SlidersHorizontal, label: 'ควบคุมบริการ' },
        { href: '/admin/settings', icon: Settings, label: 'ค่าธรรมเนียม' },
      ]
    : [
        { href: '/admin', icon: LayoutDashboard, label: 'Overview' },
        { href: '/admin/support', icon: MessageCircle, label: 'Customer Chat' },
        { href: '/admin/sellers', icon: Store, label: 'Sellers' },
        { href: '/admin/middlemen', icon: Shield, label: 'Middlemen' },
        { href: '/admin/middleman-deposits', icon: Banknote, label: 'Middleman Deposits' },
        { href: '/admin/scam-reports', icon: ShieldAlert, label: 'Scam Reports' },
        { href: '/admin/finance', icon: Wallet, label: 'Finance' },
        { href: '/admin/deals', icon: Handshake, label: 'Deals & Disputes' },
        { href: '/admin/moderate', icon: EyeOff, label: 'Moderation' },
        { href: '/admin/users', icon: Users, label: 'Users' },
        { href: '/admin/service-controls', icon: SlidersHorizontal, label: 'Service Controls' },
        { href: '/admin/settings', icon: Settings, label: 'Fees' },
      ];
}

export function getAdminActiveLabel(pathname: string, locale: 'th' | 'en', nav = getAdminNav(locale)) {
  const activeHref = nav.slice(1).find(n => pathname.startsWith(n.href))?.href ?? '/admin';
  return nav.find(n => n.href === activeHref)?.label ?? (locale === 'th' ? 'ภาพรวม' : 'Overview');
}
