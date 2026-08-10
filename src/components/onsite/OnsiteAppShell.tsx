'use client';

import Link from 'next/link';
import { SubPageApp } from '@/components/mobile';

type Props = {
  title: string;
  backHref?: string;
  children: React.ReactNode;
};

/** Onsite create/job — mobile app shell โทนมืdark */
export function OnsiteAppShell({ title, backHref = '/service/onsite', children }: Props) {
  return (
    <SubPageApp title={title} backHref={backHref} accent="dark" withBottomNav={false}>
      <div className="onsite-app-inner">{children}</div>
    </SubPageApp>
  );
}

export default OnsiteAppShell;
