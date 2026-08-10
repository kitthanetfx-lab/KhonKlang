'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

type Props = {
  title: string;
  badge?: string;
  steps: string[];
  currentStep: number;
  backHref?: string;
  children: ReactNode;
  error?: string;
  footer?: ReactNode;
  accent?: 'blue' | 'purple';
};

/** Wizard สมัคร — โครงแบบ mkt-app (sticky top + progress + sticky ปุ่ม) */
export function RegisterWizardApp({
  title, badge, steps, currentStep, backHref = '/register', children, error, footer,
  accent = 'blue',
}: Props) {
  const pct = Math.round((currentStep / steps.length) * 100);
  return (
    <div className={`reg-app reg-app--${accent}`}>
      <header className="reg-app-top">
        <div className="reg-app-top-row">
          <Link href={backHref} className="reg-app-back" aria-label="กลับ">
            <Icon name="chevronLeft" size={22} />
          </Link>
          <h1 className="reg-app-title">{title}</h1>
          <span className="reg-app-step-num">{currentStep}/{steps.length}</span>
        </div>
        {badge && <div className="reg-app-badge">{badge}</div>}
        <div className="reg-app-progress" aria-label="ความคืบหน้า">
          <div className="reg-app-progress-bar" style={{ width: `${pct}%` }} />
        </div>
        <div className="reg-app-steps" role="tablist">
          {steps.map((s, i) => (
            <span
              key={s}
              className={`reg-app-step${i + 1 === currentStep ? ' is-on' : ''}${i + 1 < currentStep ? ' is-done' : ''}`}
            >
              {i + 1}. {s}
            </span>
          ))}
        </div>
      </header>

      <main className="reg-app-feed">
        {children}
        {error && <p className="reg-app-err">{error}</p>}
      </main>

      {footer && <div className="reg-app-bar">{footer}</div>}
    </div>
  );
}

export default RegisterWizardApp;
