'use client';

import { AppPage, AppFeed, AppLoading } from '@/components/mobile';

export function AuthCompleteApp({ status }: { status: string }) {
  return (
    <AppPage withBottomNav={false} accent="dark">
      <AppFeed>
        <div className="auth-complete-app">
          <AppLoading />
          <p>{status}</p>
        </div>
      </AppFeed>
    </AppPage>
  );
}
