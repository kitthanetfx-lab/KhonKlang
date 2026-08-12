'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { NotifyBell } from '@/components/NotifyBell';
import { MessengerIcon } from '@/components/MessengerIcon';
import { MarketplaceOrdersIcon } from '@/components/MarketplaceOrdersIcon';
import { useAppPreferences } from '@/components/AppPreferences';
import { useUser } from '@/lib/useUser';

const ICON = 'hdr-icon-btn';

type Props = {
  className?: string;
};

/** ไอคอนขวาบนมือถือ/แท็บเล็ต — ลำดับคงที่: ตลาด → ข้อความ → ตะกร้า → แจ้งเตือน → โปรไฟล์ (ขวาสุด) */
export function AppHeaderActions({ className = '' }: Props) {
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
  const qs = searchParams?.toString() || '';
  const loginHref = `/login?returnTo=${encodeURIComponent(qs ? `${pathname}?${qs}` : pathname)}`;
  const marketLabel = locale === 'th' ? 'ตลาด' : 'Marketplace';
  const accountLabel = locale === 'th' ? `เมนูบัญชี ${displayName}` : `Account menu ${displayName}`;

  return (
    <div className={`app-hdr-actions-inner ${className}`.trim()}>
      <Link
        href="/marketplace"
        className={`${ICON} hdr-icon-btn--market`}
        aria-label={marketLabel}
        title={marketLabel}
      >
        <Icon name="store" size={18} />
      </Link>

      {loading ? (
        <span className="app-hdr-loading" aria-busy="true">{locale === 'th' ? '…' : '…'}</span>
      ) : user ? (
        <>
          <MessengerIcon className={ICON} />
          <MarketplaceOrdersIcon className={ICON} />
          <NotifyBell buttonClassName={ICON} />
          <div
            className={`dropdown hdr-profile-dd ${profileOpen ? 'open' : ''}`}
            onMouseEnter={openProfile}
            onMouseLeave={closeProfileDelayed}
          >
            <button
              type="button"
              className={`${ICON} hdr-profile-btn`}
              aria-haspopup="true"
              aria-expanded={profileOpen}
              aria-label={accountLabel}
              onClick={() => setProfileOpen(v => !v)}
            >
              {user.prefs?.avatarUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={user.prefs.avatarUrl} alt="" referrerPolicy="no-referrer" className="hdr-profile-av" />
                : <Icon name="user" size={18} />}
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
              <button type="button" className="dropdown-item" onClick={logout} style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span className="icon-tile"><Icon name="logout" /></span>
                <span>
                  <span className="t" style={{ display: 'block' }}>{locale === 'th' ? 'ออกจากระบบ' : 'Log out'}</span>
                </span>
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <Link href={loginHref} className={ICON} aria-label={locale === 'th' ? 'เข้าสู่ระบบ' : 'Log in'} title={locale === 'th' ? 'เข้าสู่ระบบ' : 'Log in'}>
            <Icon name="user" size={18} />
          </Link>
        </>
      )}
    </div>
  );
}
