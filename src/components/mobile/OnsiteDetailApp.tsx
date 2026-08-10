'use client';

import { ReactNode } from 'react';
import { OnsiteAppShell } from './OnsiteAppShell';

type Step = { key: string; label: string; icon: string };

type Props = {
  title: string;
  subtitle?: string;
  statusLabel: string;
  statusClass: string;
  steps: Step[];
  currentKey: string;
  onBack?: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function OnsiteDetailApp({ title, subtitle, statusLabel, statusClass, steps, currentKey, onBack, children, footer }: Props) {
  const idx = steps.findIndex(s => s.key === currentKey);
  return (
    <OnsiteAppShell title={title} subtitle={subtitle} statusLabel={statusLabel} statusClass={statusClass} onBack={onBack} footer={footer}>
      <div className="onsite-app-timeline">
        {steps.map((s, i) => (
          <div key={s.key} className={`onsite-app-tl${i <= idx ? ' is-done' : ''}${s.key === currentKey ? ' is-on' : ''}`}>
            <span className="onsite-app-tl-ic">{s.icon}</span>
            <span className="onsite-app-tl-lbl">{s.label}</span>
          </div>
        ))}
      </div>
      <div className="onsite-app-panels">{children}</div>
    </OnsiteAppShell>
  );
}
