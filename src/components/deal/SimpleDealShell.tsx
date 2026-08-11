'use client';

import { ReactNode } from 'react';

type Props = {
  /** โฟกัสขั้นตอน — กระชับ ไม่ยืดเต็ม viewport */
  focus?: boolean;
  children: ReactNode;
  before?: ReactNode;
  progress?: ReactNode;
  reviewBanner?: ReactNode;
  nav?: ReactNode;
};

/**
 * โครงหลัก Simple deal — มือถือ + คอมใช้ stage เดียวกัน (max-width กลางจอ)
 * แก้ปัญหา desktop ยืดเต็มจอ องค์ประกอบแตก
 */
export function SimpleDealShell({ focus, children, before, progress, reviewBanner, nav }: Props) {
  return (
    <div className={`simple-deal-shell${focus ? ' simple-deal-shell--focus' : ''}`}>
      <div className="simple-deal-shell__stage">
        {before}
        {progress}
        {reviewBanner}
        <div className={`simple-deal-shell__body${focus ? ' is-focus' : ''}`}>
          {children}
        </div>
        {nav}
      </div>
    </div>
  );
}
