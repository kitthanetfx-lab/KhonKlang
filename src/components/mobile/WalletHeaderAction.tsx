'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { authHeaders } from '@/lib/supabase';
import { baht } from '@/lib/userWallet';
import type { AppLocale } from '@/components/AppPreferences';

const BTN = 'hdr-icon-btn';

export function WalletHeaderAction({ locale }: { locale: AppLocale }) {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState<number | null>(null);
  const [held, setHeld] = useState(0);
  const [loading, setLoading] = useState(true);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const label = locale === 'th' ? 'กระเป๋าเงิน' : 'Wallet';
  const walletHref = '/wallet';

  const openMenu = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const closeMenuDelayed = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 280);
  };
  const closeMenu = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(false);
  };

  useEffect(() => {
    closeMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on route change
  }, [pathname]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const headers = await authHeaders();
        const res = await fetch('/api/wallet', { headers });
        const data = await res.json();
        if (!cancelled && res.ok && data.wallet) {
          setAvailable(Number(data.wallet.availableBalance) || 0);
          setHeld(Number(data.wallet.heldBalance) || 0);
        }
      } catch {
        if (!cancelled) setAvailable(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pathname]);

  return (
    <div className="hdr-action-tile">
      <div
        className={`dropdown hdr-wallet-dd ${open ? 'open' : ''}`}
        onMouseEnter={openMenu}
        onMouseLeave={closeMenuDelayed}
      >
        <button
          type="button"
          className={`${BTN} hdr-wallet-btn`}
          aria-haspopup="true"
          aria-expanded={open}
          aria-label={label}
          onClick={() => setOpen(v => !v)}
        >
          <Icon name="wallet" size={18} />
        </button>
        <div className="dropdown-menu dropdown-menu-right hdr-wallet-menu">
          <div className="hdr-wallet-panel">
            <div className="hdr-wallet-title">
              <Icon name="wallet" size={16} />
              {locale === 'th' ? 'กระเป๋าเงิน' : 'Wallet'}
            </div>
            {loading ? (
              <p className="hdr-wallet-loading">{locale === 'th' ? 'กำลังโหลด…' : 'Loading…'}</p>
            ) : (
              <>
                <div className="hdr-wallet-balance">
                  <span className="hdr-wallet-lbl">{locale === 'th' ? 'ยอดว่าง' : 'Available'}</span>
                  <strong className="hdr-wallet-amt">{baht(available ?? 0)}</strong>
                </div>
                {held > 0 && (
                  <p className="hdr-wallet-held">
                    {locale === 'th' ? 'ถูกล็อก' : 'Held'}: {baht(held)}
                  </p>
                )}
              </>
            )}
            <Link href={walletHref} className="btn btn-green btn-sm hdr-wallet-go" onClick={closeMenu}>
              {locale === 'th' ? 'ไปหน้ากระเป๋า →' : 'Open wallet →'}
            </Link>
          </div>
        </div>
      </div>
      <span className="hdr-action-label">{label}</span>
    </div>
  );
}
