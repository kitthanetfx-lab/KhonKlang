'use client';

import { ReactNode } from 'react';
import { Icon } from '@/components/Icon';
import { AppFeed, AppTop } from '@/components/mobile/shells';

type Props = {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  search?: ReactNode;
  filters?: ReactNode;
  stats?: ReactNode;
  children: ReactNode;
};

/** กรอบ admin mobile — sticky top + search/filters + feed */
export function AdminAppFrame({ title, subtitle, onRefresh, refreshing, search, filters, stats, children }: Props) {
  return (
    <div className="admin-app">
      <AppTop
        title={title}
        subtitle={subtitle}
        classPrefix="admin-app"
        right={onRefresh ? (
          <button type="button" className="admin-app-refresh" onClick={onRefresh} disabled={refreshing} aria-label="รีเฟรช">
            <Icon name="refresh" size={18} />
          </button>
        ) : undefined}
      />
      {(search || filters) && (
        <div className="admin-app-toolbar">
          {search}
          {filters}
        </div>
      )}
      {stats && <div className="admin-app-stats">{stats}</div>}
      <AppFeed classPrefix="admin-app">{children}</AppFeed>
    </div>
  );
}

export function AdminAppSearch({
  value, onChange, placeholder = 'ค้นหา…',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="admin-app-search">
      <Icon name="search" size={16} className="admin-app-search-ic" />
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="search"
      />
    </div>
  );
}

export function AdminAppCard({
  title, subtitle, badges, meta, onClick, actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
  meta?: ReactNode;
  onClick?: () => void;
  actions?: ReactNode;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className="admin-app-card" onClick={onClick}>
      <div className="admin-app-card-main">
        <div className="admin-app-card-title">{title}</div>
        {subtitle && <div className="admin-app-card-sub">{subtitle}</div>}
        {badges && <div className="admin-app-card-badges">{badges}</div>}
        {meta && <div className="admin-app-card-meta">{meta}</div>}
      </div>
      {actions && <div className="admin-app-card-actions">{actions}</div>}
    </Tag>
  );
}

export function AdminAppChip({
  label, active, onClick, count,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  count?: number;
}) {
  return (
    <button type="button" className={`admin-app-chip${active ? ' is-on' : ''}`} onClick={onClick}>
      {label}{count != null && <span className="admin-app-chip-n">{count}</span>}
    </button>
  );
}

export function AdminAppSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="admin-app-section">
      {title && <h2 className="admin-app-section-title">{title}</h2>}
      {children}
    </section>
  );
}
