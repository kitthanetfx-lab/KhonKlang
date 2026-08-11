'use client';

import { ReactNode, useState } from 'react';

type Props = {
  children: ReactNode;
  badge?: number | string;
};

/** แชท/โทร/วิดีโอ — ซ่อนที่ขอบ + ดึงออกแบบ Lang/Theme (pref-dock) */
export function DealCommFloatbar({ children, badge }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`deal-comm-dock-wrap${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="deal-comm-dock-toggle"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-label={open ? 'ซ่อนเมนูสื่อสาร' : 'แสดงแชท/โทร/วิดีโอ'}
      >
        <span className="deal-comm-dock-toggle-pill" />
        <span className="deal-comm-dock-toggle-text">{open ? 'Hide' : 'Chat'}</span>
        {!open && badge != null && badge !== 0 && (
          <span className="deal-comm-dock-toggle-badge">{badge}</span>
        )}
      </button>
      <div className="deal-comm-dock" role="toolbar" aria-label="การสื่อสารในดีล">
        {children}
      </div>
    </div>
  );
}

type ChipProps = {
  label: string;
  value: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  badge?: number | string;
  className?: string;
};

/** ปุ่ม chip แบบ Lang / Theme */
export function DealCommChip({ label, value, active, onClick, disabled, badge, className }: ChipProps) {
  return (
    <button
      type="button"
      className={`pref-chip deal-comm-chip${active ? ' is-on' : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="pref-chip-label">{label}</span>
      <span className="pref-chip-value">{value}</span>
      {badge != null && badge !== 0 && <span className="deal-comm-chip-badge">{badge}</span>}
    </button>
  );
}
