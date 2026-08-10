'use client';

import type { ReactNode } from 'react';
import { Nav } from '@/components/Site';
import { ResponsiveShell, SubPageApp } from '@/components/mobile';

type Props = {
  title: string;
  backHref?: string;
  right?: ReactNode;
  children: ReactNode;
  withBottomNav?: boolean;
  accent?: 'default' | 'auction' | 'dark';
  /** desktop markup เต็ม (sub-page + sub-header + content) */
  desktop: ReactNode;
};

/** หน้า sub-page — mobile: SubPageApp · desktop: markup เดิม */
export function SubPageShell({
  title,
  backHref = '/',
  right,
  children,
  withBottomNav = false,
  accent = 'default',
  desktop,
}: Props) {
  return (
    <>
      <Nav />
      <ResponsiveShell
        mobile={
          <SubPageApp
            title={title}
            backHref={backHref}
            right={right}
            withBottomNav={withBottomNav}
            accent={accent}
          >
            {children}
          </SubPageApp>
        }
        desktop={desktop}
      />
    </>
  );
}

export default SubPageShell;
