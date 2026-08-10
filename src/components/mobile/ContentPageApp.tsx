'use client';

import type { ReactNode } from 'react';
import { AppPage } from './AppPage';
import { AppHeader } from './AppHeader';
import { AppFeed } from './AppStates';

type Props = {
  kicker?: string;
  title: string;
  lead?: string;
  backHref?: string;
  children: ReactNode;
};

/** หน้าเนื้อหา help/legal บนมือถือ */
export function ContentPageApp({ kicker, title, lead, backHref = '/', children }: Props) {
  return (
    <AppPage withBottomNav>
      <AppHeader title={title} backHref={backHref} />
      <AppFeed>
        {kicker && <div className="app-kicker">{kicker}</div>}
        {lead && <p className="app-lead">{lead}</p>}
        <div className="app-prose">{children}</div>
      </AppFeed>
    </AppPage>
  );
}

export default ContentPageApp;
