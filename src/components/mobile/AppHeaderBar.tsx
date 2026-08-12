'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { Icon } from '@/components/Icon';
import { AppHeaderActions } from './AppHeaderActions';

export type AppHeaderBarProps = {
  title?: string;
  subtitle?: string;
  titleIcon?: string;
  onBack?: () => void;
  backHref?: string;
  backLabel?: string;
  /** ปุ่ม/ไอคอนเพิ่มก่อนกลุ่มไอคอนมาตรฐาน (เช่น แก้ไขโปรไฟล์) */
  extraActions?: ReactNode;
  actions?: ReactNode;
  className?: string;
  hideTitle?: boolean;
};

/**
 * Top bar มาตรฐานทุกหน้า (มือถือ/แท็บเล็ต)
 * [←] [ไอคอน+ชื่อหน้า] ········· [ตลาด][ข้อความ][ตะกร้า][แจ้งเตือน][โปรไฟล์]
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

  return (
    <header className={`app-header-bar ${className}`.trim()}>
      <div className="app-hdr-left">{backEl}</div>
      <div className="app-hdr-center">
        {!hideTitle && (title || titleIcon) && (
          <div className="app-hdr-title" title={title}>
            {titleIcon && (
              <span className="app-hdr-title-ic" aria-hidden>
                <Icon name={titleIcon} size={17} />
              </span>
            )}
            {title && <span className="app-hdr-title-tx">{title}</span>}
          </div>
        )}
        {subtitle && <div className="app-hdr-sub">{subtitle}</div>}
      </div>
      <div className="app-hdr-actions">
        {actions ?? defaultActions}
      </div>
    </header>
  );
}
