'use client';

import Link from 'next/link';
import { Icon } from '@/components/Icon';

type Props = {
  title: string;
  backHref?: string;
  children: React.ReactNode;
};

/** Onsite — shell แบบ mkt-app โทนมืด */
export function OnsiteAppShell({ title, backHref = '/service/onsite', children }: Props) {
  return (
    <div className="onsite-app">
      <header className="onsite-app-top">
        <Link href={backHref} className="onsite-app-back" aria-label="กลับ">
          <Icon name="chevronLeft" size={22} />
        </Link>
        <h1 className="onsite-app-title">{title}</h1>
        <span className="onsite-app-back-spacer" />
      </header>
      <main className="onsite-app-feed">{children}</main>
    </div>
  );
}

export default OnsiteAppShell;
