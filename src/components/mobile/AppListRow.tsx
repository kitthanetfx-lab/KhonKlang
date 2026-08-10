'use client';

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '@/components/Icon';

type Props = {
  href: string;
  title: string;
  price?: ReactNode;
  meta?: ReactNode;
  thumb?: ReactNode;
  thumbSrc?: string;
  thumbFallback?: ReactNode;
  badge?: ReactNode;
  variant?: 'default' | 'auction';
};

export function AppListRow({
  href,
  title,
  price,
  meta,
  thumb,
  thumbSrc,
  thumbFallback,
  badge,
  variant = 'default',
}: Props) {
  return (
    <li>
      <Link
        href={href}
        className={`app-row${variant === 'auction' ? ' app-row--auction' : ''}`}
      >
        <div className="app-thumb">
          {thumb ?? (
            thumbSrc
              ? <img src={thumbSrc} alt="" loading="lazy" />
              : (thumbFallback ?? <Icon name="package" size={28} />)
          )}
          {badge}
        </div>
        <div className="app-row-body">
          {price && <div className="app-row-price">{price}</div>}
          <h3 className="app-row-title">{title}</h3>
          {meta && <div className="app-row-meta">{meta}</div>}
        </div>
        <Icon name="chevronRight" size={18} className="app-chevron" />
      </Link>
    </li>
  );
}

export function AppList({ children }: { children: ReactNode }) {
  return <ul className="app-list">{children}</ul>;
}

export default AppListRow;
