'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '@/components/Icon';

type Props = {
  title?: string;
  backHref?: string;
  backLabel?: string;
  right?: ReactNode;
  sticky?: boolean;
};

export function AppHeader({ title, backHref, backLabel = 'กลับ', right, sticky = true }: Props) {
  return (
    <header className={`app-header${sticky ? ' app-header--sticky' : ''}`}>
      <div className="app-header-row">
        {backHref ? (
          <Link href={backHref} className="app-header-back" aria-label={backLabel}>
            <Icon name="chevronLeft" size={22} />
          </Link>
        ) : (
          <span className="app-header-back-spacer" />
        )}
        {title && <h1 className="app-header-title">{title}</h1>}
        <div className="app-header-right">{right}</div>
      </div>
    </header>
  );
}

export default AppHeader;
