'use client';

import { ReactNode, useState } from 'react';

type Props = {
  children: ReactNode;
  badge?: number | string;
};

/** แชท/โทร/วิดีโอ — แท็บซ่อนขอบ (ไม่โผล่ขอบ) กดแล้วปุ่มกลมเด้งออก */
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
      <div className="deal-comm-orbs" role="toolbar" aria-label="การสื่อสารในดีล" aria-hidden={!open}>
        {children}
      </div>
    </div>
  );
}

type OrbProps = {
  icon: string;
  label?: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  badge?: number | string;
  className?: string;
};

/** ปุ่มกลมแชท/โทร/วิดีโอ */
export function DealCommOrb({ icon, label, active, onClick, disabled, badge, className }: OrbProps) {
  return (
    <button
      type="button"
      className={`deal-comm-orb${active ? ' is-on' : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="deal-comm-orb-ic" aria-hidden>{icon}</span>
      {label && <span className="deal-comm-orb-lb">{label}</span>}
      {badge != null && badge !== 0 && <span className="deal-comm-orb-badge">{badge}</span>}
    </button>
  );
}
