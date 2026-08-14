'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

type GlobalLoadingContextValue = {
  beginLoading: () => void;
  endLoading: () => void;
  isLoading: boolean;
};

const GlobalLoadingContext = createContext<GlobalLoadingContextValue | null>(null);

export function useGlobalLoading() {
  const ctx = useContext(GlobalLoadingContext);
  if (!ctx) throw new Error('useGlobalLoading must be used within GlobalLoadingProvider');
  return ctx;
}

export function useGlobalLoadingOptional() {
  return useContext(GlobalLoadingContext);
}

/** Overlay โดนัทกลางจอ — ref-count รองรับหลายงานพร้อมกัน */
export function GlobalLoadingProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const pathname = usePathname();

  const beginLoading = useCallback(() => {
    setCount(c => c + 1);
  }, []);

  const endLoading = useCallback(() => {
    setCount(c => Math.max(0, c - 1));
  }, []);

  useEffect(() => {
    setCount(0);
  }, [pathname]);

  const isLoading = count > 0;

  return (
    <GlobalLoadingContext.Provider value={{ beginLoading, endLoading, isLoading }}>
      {children}
      {isLoading && (
        <div className="global-loading-overlay" role="status" aria-live="polite" aria-busy="true" aria-label="กำลังโหลด">
          <div className="global-loading-donut mkt-spinner" aria-hidden="true" />
        </div>
      )}
    </GlobalLoadingContext.Provider>
  );
}

/** จับ click ปุ่ม/.btn ทั่วเว็บ — แสดง overlay จนงานเสร็จหรือเปลี่ยนหน้า */
export function GlobalButtonGuard() {
  const ctx = useGlobalLoadingOptional();

  useEffect(() => {
    if (!ctx) return;

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-skip-global-loading], input, textarea, select, label')) return;

      const el = target.closest<HTMLElement>(
        'button:not([disabled]), a.btn:not([aria-disabled="true"]), .btn:not([disabled]):not(input)',
      );
      if (!el) return;
      if (el.closest('[data-skip-global-loading]')) return;
      if (el.hasAttribute('data-managed-loading') || el.hasAttribute('data-upload-trigger')) return;

      ctx.beginLoading();

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        ctx.endLoading();
        observer?.disconnect();
        clearTimeout(fallbackTimer);
      };

      let observer: MutationObserver | undefined;
      if (el instanceof HTMLButtonElement && (el.disabled || el.getAttribute('aria-busy') === 'true')) {
        observer = new MutationObserver(() => {
          if (!el.disabled && el.getAttribute('aria-busy') !== 'true') {
            setTimeout(finish, 80);
          }
        });
        observer.observe(el, { attributes: true, attributeFilter: ['disabled', 'aria-busy'] });
      }

      const fallbackMs = el instanceof HTMLAnchorElement ? 30000 : 600;
      const fallbackTimer = setTimeout(finish, fallbackMs);
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [ctx]);

  return null;
}
