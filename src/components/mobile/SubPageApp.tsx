'use client';

import type { ReactNode } from 'react';
import { AppPage } from './AppPage';
import { AppHeader } from './AppHeader';
import { AppFeed } from './AppStates';

type Props = {
  title: string;
  backHref?: string;
  right?: ReactNode;
  children: ReactNode;
  withBottomNav?: boolean;
  accent?: 'default' | 'auction' | 'dark';
};

/** แทน sub-page บนมือถือ — header + feed */
export function SubPageApp({
  title,
  backHref = '/',
  right,
  children,
  withBottomNav = false,
  accent = 'default',
}: Props) {
  return (
    <AppPage withBottomNav={withBottomNav} accent={accent}>
      <AppHeader title={title} backHref={backHref} right={right} />
      <AppFeed>{children}</AppFeed>
    </AppPage>
  );
}

export default SubPageApp;
