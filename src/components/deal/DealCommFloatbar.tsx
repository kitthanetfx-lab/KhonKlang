'use client';

import { ReactNode, useState } from 'react';

type Props = {
  children: ReactNode;
  badge?: number | string;
};

/** ปุ่มแชท/โทร/วิดีโอ — กดเปิด-ปิดแบบ FAB (เหมือนปุ่มสลับโหมด) */
export function DealCommFloatbar({ children, badge }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`deal-comm-dial${open ? ' is-open' : ''}`}>
      <div className="deal-comm-dial-menu" role="toolbar" aria-label="การสื่อสารในดีล" aria-hidden={!open}>
        {children}
      </div>
      <button
        type="button"
        className="deal-comm-dial-toggle"
        aria-expanded={open}
        aria-label={open ? 'ปิดเมนูสื่อสาร' : 'เปิดแชท/โทร/วิดีโอ'}
        onClick={() => setOpen(v => !v)}
      >
        <span className="deal-comm-dial-toggle-ic" aria-hidden>{open ? '✕' : '💬'}</span>
        {!open && badge != null && badge !== 0 && (
          <span className="deal-comm-dial-badge">{badge}</span>
        )}
      </button>
    </div>
  );
}
