'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { NotifyBell } from './NotifyBell';
import { useAppPreferences } from './AppPreferences';
import { useUser } from '@/lib/useUser';

type HeaderAccountActionsProps = {
  className?: string;
  showNotify?: boolean;
  /** แสดงปุ่มไอคอนตลาด (มือถือ/แท็บเล็ต) */
  showMarket?: boolean;
};

const profileItems = [
  { icon: 'user', t: 'เข้าสู่โปรไฟล์', d: 'ดูและแก้ไขข้อมูลบัญชี', href: '/profile' },
  { icon: 'clock', t: 'ดีลของฉัน / ประวัติ', d: 'ประวัติซื้อขายทุกบทบาท + กล่องข้อความ', href: '/orders' },
  { icon: 'store', t: 'ร้านของฉัน', d: 'ตั้งค่าร้านและลงขายสินค้า', href: '/dashboard/seller' },
  { icon: 'handCoins', t: 'บอร์ดคนกลาง', d: 'ดูดีลที่กำลังดูแลอยู่', href: '/dashboard/middleman' },
] as const;

export function HeaderAccountActions({ className = '', showNotify = true, showMarket = true }: HeaderAccountActionsProps) {
  const { locale } = useAppPreferences();
  const { user, loading, logout } = useUser();
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openProfile = () => {
    if (profileCloseTimer.current) clearTimeout(profileCloseTimer.current);
    setProfileOpen(true);
  };
  const closeProfileDelayed = () => {
    if (profileCloseTimer.current) clearTimeout(profileCloseTimer.current);
    profileCloseTimer.current = setTimeout(() => setProfileOpen(false), 300);
  };

  useEffect(() => () => {
    if (profileCloseTimer.current) clearTimeout(profileCloseTimer.current);
  }, []);

  const profileItems = locale === 'th'
    ? [
        { icon: 'user', t: 'เข้าสู่โปรไฟล์', d: 'ดูและแก้ไขข้อมูลบัญชี', href: '/profile' },
        { icon: 'clock', t: 'ดีลของฉัน / ประวัติ', d: 'ประวัติซื้อขายทุกบทบาท + กล่องข้อความ', href: '/orders' },
        { icon: 'store', t: 'ร้านของฉัน', d: 'ตั้งค่าร้านและลงขายสินค้า', href: '/dashboard/seller' },
        { icon: 'handCoins', t: 'บอร์ดคนกลาง', d: 'ดูดีลที่กำลังดูแลอยู่', href: '/dashboard/middleman' },
      ]
    : [
        { icon: 'user', t: 'Profile', d: 'View and edit your account details', href: '/profile' },
        { icon: 'clock', t: 'My Deals / History', d: 'Transaction history and inbox', href: '/orders' },
        { icon: 'store', t: 'My Shop', d: 'Manage your shop and listings', href: '/dashboard/seller' },
        { icon: 'handCoins', t: 'Middleman Board', d: 'Deals currently under your care', href: '/dashboard/middleman' },
      ];
  const displayName = user?.prefs?.displayName || user?.name || (locale === 'th' ? 'บัญชีของฉัน' : 'My account');
  const shortName = displayName.length > 18 ? `${displayName.slice(0, 18)}...` : displayName;
  const qs = searchParams?.toString() || '';
  const loginHref = `/login?returnTo=${encodeURIComponent(qs ? `${pathname}?${qs}` : pathname)}`;

  const marketLabel = locale === 'th' ? 'ตลาด' : 'Marketplace';
  const accountLabel = locale === 'th' ? `เมนูบัญชี ${displayName}` : `Account menu ${displayName}`;

  return (
    <div className={`header-account-actions ${className}`.trim()}>
      {showMarket && (
        <Link href="/marketplace" className="hdr-icon-btn hdr-icon-btn--market" aria-label={marketLabel} title={marketLabel}>
          <Icon name="store" size={18} />
        </Link>
      )}
      {user && showNotify && <NotifyBell />}
      {loading ? (
        <span className="btn btn-ghost btn-sm" aria-busy="true">{locale === 'th' ? 'กำลังโหลด...' : 'Loading...'}</span>
      ) : user ? (
        <>
          <div
            className={`dropdown ${profileOpen ? 'open' : ''}`}
            onMouseEnter={openProfile}
            onMouseLeave={closeProfileDelayed}
          >
            <button
              type="button"
              className="btn btn-ghost btn-sm profile-trigger hdr-profile-btn"
              aria-haspopup="true"
              aria-expanded={profileOpen}
              aria-label={accountLabel}
              onClick={() => setProfileOpen(v => !v)}
            >
              {user.prefs?.avatarUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={user.prefs.avatarUrl} alt="" referrerPolicy="no-referrer" className="hdr-profile-av" />
                : <Icon name="user" size={18} />}
              <span className="hdr-profile-name">{shortName}</span>
              <Icon name="chevronDown" size={16} className="hdr-profile-chevron" />
            </button>
            <div className="dropdown-menu dropdown-menu-right">
              {profileItems.map(it => (
                <Link key={it.href} className="dropdown-item" href={it.href}>
                  <span className="icon-tile"><Icon name={it.icon} /></span>
                  <span>
                    <span className="t" style={{ display: 'block' }}>{it.t}</span>
                    <span className="d">{it.d}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
          <button type="button" className="btn btn-primary btn-sm header-account-logout" onClick={logout}>{locale === 'th' ? 'ออกจากระบบ' : 'Log out'}</button>
        </>
      ) : (
        <>
          <Link className="btn btn-ghost btn-sm" href={loginHref}>{locale === 'th' ? 'เข้าสู่ระบบ' : 'Log in'}</Link>
          <Link className="btn btn-primary btn-sm header-account-register" href="/register">{locale === 'th' ? 'เริ่มต้นใช้งาน' : 'Get Started'}</Link>
        </>
      )}
    </div>
  );
}
