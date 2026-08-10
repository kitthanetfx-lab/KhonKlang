'use client';

import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
  accent?: 'default' | 'auction' | 'dark';
  withBottomNav?: boolean;
  stickyFooter?: ReactNode;
};

/** Layout มือถือมาตรฐาน — sticky header อยู่ใน children */
export function AppPage({
  children,
  className = '',
  accent = 'default',
  withBottomNav = true,
  stickyFooter,
}: Props) {
  const mod =
    accent === 'auction' ? ' app-page--auction'
    : accent === 'dark' ? ' app-page--dark'
    : '';
  const navPad = withBottomNav ? ' app-page--with-nav' : '';
  return (
    <div className={`app-page${mod}${navPad} ${className}`.trim()}>
      {children}
      {stickyFooter && <div className="app-sticky-bar">{stickyFooter}</div>}
    </div>
  );
}

export default AppPage;
