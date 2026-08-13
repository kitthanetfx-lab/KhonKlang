'use client';



import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';



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

  /** ซ่อนแถบเมนูหลัก (สมัคร/บริการ/ตลาด/เช็คคนโกง) — ใช้ในห้องดีล */
  hideMainNav?: boolean;

  className?: string;

};



type HeaderContextValue = {

  config: HeaderConfig;

  setConfig: (config: HeaderConfig) => void;

};



const HeaderContext = createContext<HeaderContextValue | null>(null);



function headerConfigEqual(a: HeaderConfig, b: HeaderConfig) {

  return (

    a.title === b.title

    && a.subtitle === b.subtitle

    && a.titleIcon === b.titleIcon

    && a.backHref === b.backHref

    && a.backLabel === b.backLabel

    && a.hideTitle === b.hideTitle

    && a.hideMainNav === b.hideMainNav

    && a.className === b.className

    && a.onBack === b.onBack

    && a.extraActions === b.extraActions

    && a.actions === b.actions

  );

}



export function HeaderProvider({ children }: { children: ReactNode }) {

  const [config, setConfigState] = useState<HeaderConfig>({});

  const setConfig = useCallback((next: HeaderConfig) => {

    setConfigState(prev => (headerConfigEqual(prev, next) ? prev : next));

  }, []);

  const value = useMemo(() => ({ config, setConfig }), [config, setConfig]);

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


