'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { NotifyBell } from '@/components/NotifyBell';
import { MessengerIcon } from '@/components/MessengerIcon';
import { MarketplaceOrdersIcon } from '@/components/MarketplaceOrdersIcon';
import { WalletHeaderAction } from '@/components/mobile/WalletHeaderAction';
import { useAppPreferences } from '@/components/AppPreferences';
import { getProfileItems } from '@/lib/navData';
import { useUser } from '@/lib/useUser';

const BTN = 'hdr-icon-btn';

function ActionTile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="hdr-action-tile">
      {children}
      <span className="hdr-action-label">{label}</span>
    </div>
  );
}

/** ไอคอนขวาบน — ข้อความ → ตะกr้า → แจ้งเตือน → โปroไฟล์ */
export function AppHeaderActions({ className = '' }: { className?: string }) {
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

  const closeProfile = () => {
    if (profileCloseTimer.current) clearTimeout(profileCloseTimer.current);
    setProfileOpen(false);
    const el = document.activeElement;
    if (el instanceof HTMLElement) el.blur();
  };

  useEffect(() => {
    closeProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on route change
  }, [pathname]);

  useEffect(() => () => {
    if (profileCloseTimer.current) clearTimeout(profileCloseTimer.current);
  }, []);

  const profileItems = getProfileItems(locale);
  const displayName = user?.prefs?.displayName || user?.name || (locale === 'th' ? 'บัญชีของฉัน' : 'My account');
  const qs = searchParams?.toString() || '';
  const loginHref = `/login?returnTo=${encodeURIComponent(qs ? `${pathname}?${qs}` : pathname)}`;
  const accountLabel = locale === 'th' ? `เมนูบัญชี ${displayName}` : `Account menu ${displayName}`;
  const msgLabel = locale === 'th' ? 'ข้อความ' : 'Messages';
  const cartLabel = locale === 'th' ? 'ตะกร้า' : 'Cart';
  const notifyLabel = locale === 'th' ? 'แจ้งเตือน' : 'Alerts';
  const profileLabel = locale === 'th' ? 'โปรไฟล์' : 'Profile';

  return (
    <div className={`app-hdr-actions-inner ${className}`.trim()}>
      {loading ? (
        <span className="app-hdr-loading" aria-busy="true">…</span>
      ) : user ? (
        <>
          <ActionTile label={msgLabel}>
            <MessengerIcon className={BTN} />
          </ActionTile>
          <ActionTile label={cartLabel}>
            <MarketplaceOrdersIcon className={BTN} />
          </ActionTile>
          <ActionTile label={notifyLabel}>
            <NotifyBell buttonClassName={BTN} />
          </ActionTile>
          <WalletHeaderAction locale={locale} />
          <ActionTile label={profileLabel}>
            <div
              className={`dropdown hdr-profile-dd ${profileOpen ? 'open' : ''}`}
              onMouseEnter={openProfile}
              onMouseLeave={closeProfileDelayed}
            >
              <button
                type="button"
                className={`${BTN} hdr-profile-btn`}
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
                  <Link
                    key={it.href}
                    className="dropdown-item"
                    href={it.href}
                    onClick={() => closeProfile()}
                  >
                    <span className={`icon-tile ${it.tint}`}><Icon name={it.icon} /></span>
                    <span>
                      <span className="t" style={{ display: 'block' }}>{it.t}</span>
                      <span className="d">{it.d}</span>
                    </span>
                  </Link>
                ))}
                <button type="button" className="dropdown-item" onClick={() => { closeProfile(); logout(); }} style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <span className="icon-tile"><Icon name="logout" /></span>
                  <span>
                    <span className="t" style={{ display: 'block' }}>{locale === 'th' ? 'ออกจากระบบ' : 'Log out'}</span>
                  </span>
                </button>
              </div>
            </div>
          </ActionTile>
        </>
      ) : (
        <ActionTile label={locale === 'th' ? 'เข้าสู่ระบบ' : 'Log in'}>
          <Link href={loginHref} className={BTN} aria-label={locale === 'th' ? 'เข้าสู่ระบบ' : 'Log in'}>
            <Icon name="user" size={18} />
          </Link>
        </ActionTile>
      )}
    </div>
  );
}
