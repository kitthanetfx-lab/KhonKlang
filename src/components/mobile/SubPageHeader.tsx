'use client';

import { ReactNode } from 'react';
import { AppHeaderBar } from './AppHeaderBar';

type Props = {
  title?: string;
  backHref?: string;
  onBack?: () => void;
  backLabel?: string;
  titleIcon?: string;
  extraActions?: ReactNode;
  hideTitle?: boolean;
  className?: string;
};

/** Header สำหรับ sub-page — ใช้ layout เดียวกับ AppTop/DealRoom */
export function SubPageHeader({
  title,
  backHref,
  onBack,
  backLabel,
  titleIcon,
  extraActions,
  hideTitle,
  className = 'sub-header',
}: Props) {
  return (
    <AppHeaderBar
      className={className}
      title={title}
      titleIcon={titleIcon}
      backHref={onBack ? undefined : backHref}
      onBack={onBack}
      backLabel={backLabel}
      extraActions={extraActions}
      hideTitle={hideTitle}
    />
  );
}
