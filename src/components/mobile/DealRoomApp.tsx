'use client';

import { ReactNode } from 'react';
import { DealCommFloatbar } from '@/components/deal/DealCommFloatbar';
import { Icon } from '@/components/Icon';
import { AppFeed, AppTop } from './shells';

type TabKey = 'steps' | 'evidence';

type Props = {
  title: string;
  subtitle: string;
  onBack: () => void;
  showTabs?: boolean;
  tab: TabKey;
  onTab: (k: TabKey) => void;
  children: ReactNode;
  floatBar?: ReactNode;
  floatBarBadge?: number | string;
  inVideoCall?: boolean;
  videoCallOverlay?: ReactNode;
  /** ใช้ SubPageHeader ที่หน้า parent แทน — กัน config ซ้ำ */
  skipHeader?: boolean;
};

/** Mobile shell ห้องดีล — โครงแยกจาก dr-root desktop */
export function DealRoomApp({
  title, subtitle, onBack, showTabs, tab, onTab, children, floatBar, floatBarBadge, inVideoCall, videoCallOverlay, skipHeader,
}: Props) {
  if (inVideoCall && videoCallOverlay) {
    return <div className="deal-app deal-app--call">{videoCallOverlay}</div>;
  }

  return (
    <div className="deal-app">
      {!skipHeader && (
        <AppTop
          title={title}
          subtitle={subtitle}
          titleIcon="package"
          onBack={onBack}
          classPrefix="deal-app"
        />
      )}

      {showTabs && (
        <nav className="deal-app-tabs" role="tablist">
          {(['steps', 'evidence'] as const).map(k => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              className={`deal-app-tab${tab === k ? ' is-on' : ''}`}
              onClick={() => onTab(k)}
            >
              {k === 'steps' ? 'ขั้นตอน' : 'หลักฐาน'}
            </button>
          ))}
        </nav>
      )}

      <AppFeed classPrefix="deal-app">
        <div className="deal-app-inner">{children}</div>
      </AppFeed>

      {floatBar && (
        <DealCommFloatbar badge={floatBarBadge}>
          {floatBar}
        </DealCommFloatbar>
      )}
    </div>
  );
}

export function DealAppFloatBtn({
  active, onClick, icon, label, badge, className,
}: {
  active?: boolean;
  onClick?: () => void;
  icon: string;
  label: string;
  badge?: number | string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button type="button" className={`deal-app-fbtn${active ? ' is-on' : ''}${className ? ` ${className}` : ''}`} onClick={onClick}>
      <span className="deal-app-fbtn-ic">{icon}</span>
      <span>{label}</span>
      {badge != null && badge !== 0 && <span className="deal-app-fbtn-badge">{badge}</span>}
    </button>
  );
}

export function DealAppBackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="deal-app-back" onClick={onClick} aria-label="ย้อนกลับ">
      <Icon name="chevronRight" size={18} style={{ transform: 'rotate(180deg)' }} />
    </button>
  );
}
