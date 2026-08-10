'use client';

import { useEffect, useState } from 'react';

/** true เมื่อ viewport ≤ maxWidth (ค่าเริ่มต้น 767 = มือถือ/แท็บเล็ตเล็ก) */
export function useIsMobile(maxWidth = 767): boolean | null {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [maxWidth]);

  return isMobile;
}
