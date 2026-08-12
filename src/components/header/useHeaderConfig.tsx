'use client';

import { ReactNode, useEffect } from 'react';
import { HeaderConfig, useOptionalHeaderContext } from '@/components/header/HeaderContext';

export function useHeaderConfig(config: HeaderConfig) {
  const ctx = useOptionalHeaderContext();
  useEffect(() => {
    if (!ctx) return undefined;
    ctx.setConfig(config);
    return () => ctx.setConfig({});
  // eslint-disable-next-line react-hooks/exhaustive-deps -- page sets header once per mount
  }, [
    ctx,
    config.title,
    config.subtitle,
    config.titleIcon,
    config.backHref,
    config.backLabel,
    config.hideTitle,
    config.className,
    config.onBack,
    config.extraActions,
    config.actions,
  ]);
}

type SubPageHeaderProps = HeaderConfig;

/** ตั้งค่าแถบบน global — ไม่ render header ซ้ำ */
export function SubPageHeader(props: SubPageHeaderProps) {
  useHeaderConfig({ ...props, className: props.className ?? 'sub-header' });
  return null;
}

/** ตั้งค่าแถบบนสำหรับ mobile app shells */
export function AppTopConfig(props: SubPageHeaderProps & { classPrefix?: string }) {
  const { classPrefix = 'app', ...rest } = props;
  useHeaderConfig({ ...rest, className: `${classPrefix}-top app-header-bar ${rest.className ?? ''}`.trim() });
  return null;
}

export function PageHeaderSlot({ children }: { children?: ReactNode }) {
  useHeaderConfig({});
  return children ?? null;
}
