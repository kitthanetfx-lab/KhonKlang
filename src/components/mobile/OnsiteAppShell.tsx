'use client';

import { AppFeed, AppStickyBar, AppTop } from './shells';

type Props = {
  title: string;
  subtitle?: string;
  statusLabel?: string;
  statusClass?: string;
  onBack?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function OnsiteAppShell({ title, subtitle, statusLabel, statusClass, onBack, children, footer }: Props) {
  return (
    <div className="onsite-app">
      <AppTop title={title} subtitle={subtitle} onBack={onBack} classPrefix="onsite-app" />
      {statusLabel && (
        <div className={`onsite-app-status${statusClass ? ` ${statusClass}` : ''}`}>{statusLabel}</div>
      )}
      <AppFeed classPrefix="onsite-app">{children}</AppFeed>
      {footer && <AppStickyBar classPrefix="onsite-app">{footer}</AppStickyBar>}
    </div>
  );
}
