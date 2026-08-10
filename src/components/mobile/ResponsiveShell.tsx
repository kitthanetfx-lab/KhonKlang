'use client';

import type { ReactNode } from 'react';

/** สลับ mobile/desktop ด้วย CSS — ไม่กระพริบตอน hydrate */
export function ResponsiveShell({
  mobile,
  desktop,
  mobileClassName = '',
  desktopClassName = '',
}: {
  mobile: ReactNode;
  desktop: ReactNode;
  mobileClassName?: string;
  desktopClassName?: string;
}) {
  return (
    <>
      <div className={`app-mobile-shell ${mobileClassName}`.trim()}>{mobile}</div>
      <div className={`app-desktop-shell ${desktopClassName}`.trim()}>{desktop}</div>
    </>
  );
}

export default ResponsiveShell;
