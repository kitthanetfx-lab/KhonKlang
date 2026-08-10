'use client';

import { AppFeed, AppStickyBar, AppTop } from './shells';

type Props = {
  title: string;
  badge?: React.ReactNode;
  steps: string[];
  currentStep: number;
  onBack?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

/** โครง wizard สมัคร — sticky top + progress + step chips + sticky bar (แบบ mkt-app) */
export function RegisterWizardApp({ title, badge, steps, currentStep, onBack, children, footer }: Props) {
  const pct = Math.round((currentStep / steps.length) * 100);
  return (
    <div className="reg-app">
      <AppTop title={title} onBack={onBack} classPrefix="reg-app" />
      {badge && <div className="reg-app-badge">{badge}</div>}

      <div className="reg-app-progress">
        <div className="reg-app-progress-meta">
          <span>ขั้นที่ {currentStep}/{steps.length}</span>
          <span>{pct}%</span>
        </div>
        <div className="reg-app-progress-track">
          <div className="reg-app-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="reg-app-steps" role="tablist" aria-label="ขั้นตอน">
        {steps.map((label, i) => {
          const n = i + 1;
          const state = n < currentStep ? 'done' : n === currentStep ? 'on' : '';
          return (
            <span key={label} className={`reg-app-step${state ? ` is-${state}` : ''}`} role="tab" aria-selected={n === currentStep}>
              {n}. {label}
            </span>
          );
        })}
      </div>

      <AppFeed classPrefix="reg-app">{children}</AppFeed>

      {footer && <AppStickyBar classPrefix="reg-app">{footer}</AppStickyBar>}
    </div>
  );
}
