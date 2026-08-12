'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AppTopConfig } from '@/components/header/useHeaderConfig';
import { AppHeaderBar } from './AppHeaderBar';

/** มือถือ ≤767px — ซ่อนบน desktop */
export function MobileShell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`app-mobile-shell ${className}`.trim()}>{children}</div>;
}

/** Desktop ≥768px — ซ่อนบนมือถือ */
export function DesktopShell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`app-desktop-shell ${className}`.trim()}>{children}</div>;
}

type AppTopProps = {
  title: string;
  subtitle?: string;
  titleIcon?: string;
  onBack?: () => void;
  backHref?: string;
  extraActions?: ReactNode;
  actions?: ReactNode;
  classPrefix?: string;
  hideTitle?: boolean;
};

export function AppTop({
  title, subtitle, titleIcon, onBack, backHref, extraActions, actions, classPrefix = 'app', hideTitle,
}: AppTopProps) {
  const pathname = usePathname() || '';
  if (pathname.startsWith('/admin')) {
    return (
      <AppHeaderBar
        className={`${classPrefix}-top app-header-bar`}
        title={title}
        subtitle={subtitle}
        titleIcon={titleIcon}
        onBack={onBack}
        backHref={backHref}
        extraActions={extraActions}
        actions={actions}
        hideTitle={hideTitle}
      />
    );
  }
  return (
    <AppTopConfig
      title={title}
      subtitle={subtitle}
      titleIcon={titleIcon}
      onBack={onBack}
      backHref={backHref}
      extraActions={extraActions}
      actions={actions}
      classPrefix={classPrefix}
      hideTitle={hideTitle}
    />
  );
}

export function AppStickyBar({ children, classPrefix = 'app' }: { children: React.ReactNode; classPrefix?: string }) {
  return <div className={`${classPrefix}-sticky-bar`}>{children}</div>;
}

export function AppFeed({ children, classPrefix = 'app' }: { children: React.ReactNode; classPrefix?: string }) {
  return <main className={`${classPrefix}-feed`}>{children}</main>;
}

export function AppEmpty({ children }: { children: React.ReactNode }) {
  return <div className="app-empty">{children}</div>;
}

export function AppLoading() {
  return (
    <div className="app-loading">
      <div className="mkt-spinner" />
    </div>
  );
}

export { AppHeaderActions } from './AppHeaderActions';
export { AppHeaderBar } from './AppHeaderBar';
