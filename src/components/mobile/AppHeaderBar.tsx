'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ReactNode } from 'react';
import { Icon } from '@/components/Icon';
import { AppHeaderActions } from './AppHeaderActions';
import { MainNavIcons } from '@/components/header/MainNavIcons';

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

function HeaderLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="app-hdr-logo" aria-label="กลางฮับ หน้าแรก">
      <span className="app-hdr-logo-mark">
        <Image src="/logo.png" alt="" width={compact ? 40 : 48} height={compact ? 40 : 48} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </span>
      {!compact && (
        <span className="app-hdr-logo-word">
          กลางฮับ<small>GLANGHUB</small>
        </span>
      )}
    </Link>
  );
}

/**
 * Top bar มาตรฐานทุกหน้า
 * [โloโก้][←][ชื่อหน้า] · [สมัคร][บริการ][ตลาด][เช็ค] · [ข้อความ][ตะกr้า][แจ้ง][โปroไฟล์]
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
      <AppHeaderActions />
    </>
  );

  const hasPageMeta = !hideTitle && (title || titleIcon || subtitle);
  const logoCompact = !!(backEl || hasPageMeta);

  return (
    <header className={`app-header-bar${showBrand ? ' app-header-bar--unified' : ''} ${className}`.trim()}>
      <div className="app-hdr-row">
        <div className={`app-hdr-brand${logoCompact ? ' app-hdr-brand--compact' : ''}`}>
          {showBrand && <HeaderLogo compact={logoCompact} />}
          {backEl}
        </div>

        {showMainNav && (
          <div className="app-hdr-mainnav">
            <MainNavIcons />
          </div>
        )}

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
    </header>
  );
}
