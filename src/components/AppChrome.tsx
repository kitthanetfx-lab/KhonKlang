'use client';

import { ReactNode } from 'react';
import { HeaderProvider } from '@/components/header/HeaderContext';
import { UnifiedSiteHeader } from '@/components/header/UnifiedSiteHeader';

export function AppChrome({ children }: { children: ReactNode }) {
  return (
    <HeaderProvider>
      <UnifiedSiteHeader />
      {children}
    </HeaderProvider>
  );
}
