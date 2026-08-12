'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ReactNode, Suspense } from 'react';
import { Icon } from '@/components/Icon';
import { AppHeaderActions } from './AppHeaderActions';
import { MainNavIcons } from '@/components/header/MainNavIcons';
import { DesktopNavMenus } from '@/components/header/DesktopNavMenus';

export type AppHeaderBarProps = {
  title?: string;
  subtitle?: string;
  titleIcon?: string;
  onBack?: () => void;
  backHref?: string;
  backLabel?: string;
  extraActions?: ReactNode;
  actions?: ReactNode;
  className?: string;
  hideTitle?: boolean;
  showBrand?: boolean;
  showMainNav?: boolean;
};

function HeaderLogo() {
  return (
    <Link href="/" className="app-hdr-logo" aria-label="กลางฮับ หน้าแรก">
      <span className="app-hdr-logo-mark">
        <Image src="/logo.png" alt="" width={60} height={60} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </span>
      <span className="app-hdr-logo-word">
        กลางฮับ<small>GLANGHUB</small>
      </span>
    </Link>
  );
}

/**
 * Top bar มาตรฐานทุกหน้า
 * Desktop: [โloโก้][เมนูตัวอักษร▾]····[ชื่อหน้า]····[utility]
 * Mobile:  แถบ1 [โloโก้][←][ชื่อ]····[utility] · แถบ2 [ไอคอน+label x4]
 */
export function AppHeaderBar({
  title,
  subtitle,
  titleIcon,
  onBack,
  backHref,
  backLabel = 'ย้อนกลับ',
  extraActions,
  actions,
  className = '',
  hideTitle,
  showBrand = false,
  showMainNav = false,
}: AppHeaderBarProps) {
  const backEl = onBack ? (
    <button type="button" className="app-hdr-back" onClick={onBack} aria-label={backLabel}>
      <Icon name="chevronRight" size={18} style={{ transform: 'rotate(180deg)' }} />
    </button>
  ) : backHref ? (
    <Link href={backHref} className="app-hdr-back" aria-label={backLabel}>
      <Icon name="chevronRight" size={18} style={{ transform: 'rotate(180deg)' }} />
    </Link>
  ) : null;

  const defaultActions = (
    <>
      {extraActions}
      <Suspense fallback={<span className="app-hdr-loading" aria-busy="true">…</span>}>
        <AppHeaderActions />
      </Suspense>
    </>
  );

  const hasPageMeta = !hideTitle && (title || titleIcon || subtitle);
  const showBack = !!backEl;

  return (
    <header className={`app-header-bar${showBrand ? ' app-header-bar--unified' : ''} ${className}`.trim()}>
      <div className="app-hdr-row">
        <div className="app-hdr-brand">
          {showBrand && <HeaderLogo />}
          {showBack}
        </div>

        {showMainNav && <DesktopNavMenus />}

        <div className="app-hdr-center">
          {hasPageMeta && (
            <>
              <div className="app-hdr-title" title={title}>
                {titleIcon && (
                  <span className="app-hdr-title-ic" aria-hidden>
                    <Icon name={titleIcon} size={17} />
                  </span>
                )}
                {title && <span className="app-hdr-title-tx">{title}</span>}
              </div>
              {subtitle && <div className="app-hdr-sub">{subtitle}</div>}
            </>
          )}
        </div>

        <div className="app-hdr-actions">
          {actions ?? defaultActions}
        </div>
      </div>

      {showMainNav && (
        <div className="app-hdr-services-row">
          <MainNavIcons />
        </div>
      )}
    </header>
  );
}
