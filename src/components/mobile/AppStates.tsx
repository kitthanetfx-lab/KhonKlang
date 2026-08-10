'use client';

import type { ReactNode } from 'react';

export function AppLoading() {
  return (
    <div className="app-loading">
      <div className="mkt-spinner" />
    </div>
  );
}

export function AppEmpty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="app-empty">
      <p>{children}</p>
      {action}
    </div>
  );
}

export function AppCount({ children }: { children: ReactNode }) {
  return <div className="app-count">{children}</div>;
}

export function AppFeed({ children }: { children: ReactNode }) {
  return <main className="app-feed">{children}</main>;
}

export function AppStickyBar({ children }: { children: ReactNode }) {
  return <div className="app-sticky-bar">{children}</div>;
}
