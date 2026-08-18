'use client';

import { usePathname } from 'next/navigation';
import { InAppBanner } from '@/components/InAppBanner';
import { AppHeaderBar } from '@/components/mobile/AppHeaderBar';
import { useOptionalHeaderContext } from './HeaderContext';
import { isAuthOnlyPage } from '@/lib/appAuthHandoff';

/** แถบบนมาตรฐาน — แสดงทุกหน้า (ยกเว้น /admin, login/register) */
export function UnifiedSiteHeader() {
  const pathname = usePathname() || '';
  const ctx = useOptionalHeaderContext();
  const config = ctx?.config ?? {};

  if (pathname.startsWith('/admin') || isAuthOnlyPage(pathname)) return null;

  const showMainNav = !config.hideMainNav && !pathname.startsWith('/deal/');

  return (
    <div className="site-header-wrap">
      <InAppBanner />
      <AppHeaderBar
        className={config.className}
        title={config.title}
        subtitle={config.subtitle}
        titleIcon={config.titleIcon}
        onBack={config.onBack}
        backHref={config.backHref}
        backLabel={config.backLabel}
        extraActions={config.extraActions}
        actions={config.actions}
        hideTitle={config.hideTitle}
        showBrand
        showMainNav={showMainNav}
      />
    </div>
  );
}
