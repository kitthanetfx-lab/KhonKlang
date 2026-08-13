'use client';

import { ReactNode, useEffect, useMemo } from 'react';
import { HeaderConfig, useOptionalHeaderContext } from '@/components/header/HeaderContext';

export function useHeaderConfig(config: HeaderConfig) {
  const setConfig = useOptionalHeaderContext()?.setConfig;
  const stableConfig = useMemo<HeaderConfig>(() => ({
    title: config.title,
    subtitle: config.subtitle,
    titleIcon: config.titleIcon,
    backHref: config.backHref,
    backLabel: config.backLabel,
    hideTitle: config.hideTitle,
    hideMainNav: config.hideMainNav,
    className: config.className,
    onBack: config.onBack,
    extraActions: config.extraActions,
    actions: config.actions,
  }), [
    config.title,
    config.subtitle,
    config.titleIcon,
    config.backHref,
    config.backLabel,
    config.hideTitle,
    config.hideMainNav,
    config.className,
    config.onBack,
    config.extraActions,
    config.actions,
  ]);

  useEffect(() => {
    if (!setConfig) return undefined;
    setConfig(stableConfig);
    return () => setConfig({});
  }, [setConfig, stableConfig]);
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
