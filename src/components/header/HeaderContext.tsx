'use client';

import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

export type HeaderConfig = {
  title?: string;
  subtitle?: string;
  titleIcon?: string;
  onBack?: () => void;
  backHref?: string;
  backLabel?: string;
  extraActions?: ReactNode;
  /** override กลุ่มไอคอนขวา (ข้อความ/ตะกร้า/แจ้ง/โปรไฟล์) */
  actions?: ReactNode;
  hideTitle?: boolean;
  className?: string;
};

type HeaderContextValue = {
  config: HeaderConfig;
  setConfig: (config: HeaderConfig) => void;
};

const HeaderContext = createContext<HeaderContextValue | null>(null);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<HeaderConfig>({});
  const value = useMemo(() => ({ config, setConfig }), [config]);
  return <HeaderContext.Provider value={value}>{children}</HeaderContext.Provider>;
}

export function useHeaderContext() {
  const ctx = useContext(HeaderContext);
  if (!ctx) throw new Error('useHeaderContext must be used within HeaderProvider');
  return ctx;
}

export function useOptionalHeaderContext() {
  return useContext(HeaderContext);
}
