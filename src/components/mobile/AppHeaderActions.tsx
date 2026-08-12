'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { NotifyBell } from '@/components/NotifyBell';
import { MessengerIcon } from '@/components/MessengerIcon';
import { MarketplaceOrdersIcon } from '@/components/MarketplaceOrdersIcon';
import { useAppPreferences } from '@/components/AppPreferences';
import { getProfileItems } from '@/lib/navData';
import { useUser } from '@/lib/useUser';

const ICON = 'hdr-icon-btn';

type Props = {
  className?: string;
};

/** ไอคอนขวาบน — ลำดับคงที่: ข้อความ → ตะกร้า → แจ้งเตือน → โปรไฟล์ (ขวาสุด) */
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

  const profileItems = getProfileItems(locale);

  const displayName = user?.prefs?.displayName || user?.name || (locale === 'th' ? 'บัญชีของฉัน' : 'My account');
  const qs = searchParams?.toString() || '';
  const loginHref = `/login?returnTo=${encodeURIComponent(qs ? `${pathname}?${qs}` : pathname)}`;
  const accountLabel = locale === 'th' ? `เมนูบัญชี ${displayName}` : `Account menu ${displayName}`;

  return (
    <div className={`app-hdr-actions-inner ${className}`.trim()}>
      {loading ? (
        <span className="app-hdr-loading" aria-busy="true">{locale === 'th' ? '…' : '…'}</span>
      ) : user ? (
        <>
          <MessengerIcon className={`${ICON} hdr-icon-btn--msg`} />
          <MarketplaceOrdersIcon className={`${ICON} hdr-icon-btn--cart`} />
          <NotifyBell buttonClassName={`${ICON} hdr-icon-btn--notify`} />
          <div
            className={`dropdown hdr-profile-dd ${profileOpen ? 'open' : ''}`}
            onMouseEnter={openProfile}
            onMouseLeave={closeProfileDelayed}
          >
            <button
              type="button"
              className={`${ICON} hdr-icon-btn--profile hdr-profile-btn`}
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
                  <span className={`icon-tile ${it.tint}`}><Icon name={it.icon} /></span>
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
