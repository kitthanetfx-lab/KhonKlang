'use client';

import { Icon } from '@/components/Icon';

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
  right?: React.ReactNode;
  classPrefix?: string;
};

export function AppTop({ title, subtitle, titleIcon, onBack, right, classPrefix = 'app' }: AppTopProps) {
  const p = classPrefix;
  return (
    <header className={`${p}-top`}>
      {onBack && (
        <button type="button" className={`${p}-back`} onClick={onBack} aria-label="ย้อนกลับ">
          <Icon name="chevronRight" size={18} style={{ transform: 'rotate(180deg)' }} />
        </button>
      )}
      <div className={`${p}-top-info${titleIcon ? ` ${p}-top-info--icon` : ''}`}>
        <div className={`${p}-top-title`} title={title}>
          {titleIcon && (
            <span className={`${p}-top-title-ic`} aria-hidden>
              <Icon name={titleIcon} size={17} />
            </span>
          )}
          <span className={`${p}-top-title-tx`}>{title}</span>
        </div>
        {subtitle && <div className={`${p}-top-sub`}>{subtitle}</div>}
      </div>
      {right && <div className={`${p}-top-right`}>{right}</div>}
    </header>
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
