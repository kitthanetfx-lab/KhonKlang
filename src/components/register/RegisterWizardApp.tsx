'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { AppPage, AppHeader, AppFeed, AppStickyBar } from '@/components/mobile';

type Props = {
  title: string;
  badge?: string;
  steps: string[];
  currentStep: number;
  backHref?: string;
  children: ReactNode;
  error?: string;
  footer?: ReactNode;
};

/** Wizard สมัคร seller/middleman — progress + sticky ปุ่ม */
export function RegisterWizardApp({
  title, badge, steps, currentStep, backHref = '/register', children, error, footer,
}: Props) {
  const pct = Math.round(((currentStep) / steps.length) * 100);
  return (
    <AppPage withBottomNav={false}>
      <AppHeader title={title} backHref={backHref} />
      <AppFeed>
        {badge && <div className="reg-wiz-badge">{badge}</div>}
        <div className="reg-wiz-progress" aria-label="ความคืบหน้า">
          <div className="reg-wiz-progress-bar" style={{ width: `${pct}%` }} />
        </div>
        <div className="reg-wiz-steps" role="tablist">
          {steps.map((s, i) => (
            <span key={s} className={`reg-wiz-step${i + 1 === currentStep ? ' is-on' : ''}${i + 1 < currentStep ? ' is-done' : ''}`}>
              {i + 1}. {s}
            </span>
          ))}
        </div>
        <div className="reg-wiz-body">{children}</div>
        {error && <p className="reg-wiz-err">{error}</p>}
      </AppFeed>
      {footer && <AppStickyBar>{footer}</AppStickyBar>}
    </AppPage>
  );
}

export default RegisterWizardApp;
