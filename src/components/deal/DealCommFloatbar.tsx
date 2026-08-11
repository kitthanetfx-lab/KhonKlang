'use client';

import { ReactNode, useRef, useState } from 'react';

type Props = {
  children: ReactNode;
  badge?: number | string;
};

/** แถบแชท/โทร/วิดีโอ — ซ่อนที่ขอบจอ ดึงออกเมื่อคลิกหรือปัด */
export function DealCommFloatbar({ children, badge }: Props) {
  const [open, setOpen] = useState(false);
  const touchX = useRef(0);

  return (
    <>
      {open && (
        <button
          type="button"
          className="deal-comm-floatbar-backdrop"
          aria-label="ปิดเมนูสื่อสาร"
          onClick={() => setOpen(false)}
        />
      )}
      <div className={`deal-comm-floatbar${open ? ' is-open' : ''}`}>
        <button
          type="button"
          className="deal-comm-floatbar-tab"
          aria-expanded={open}
          aria-label={open ? 'ซ่อนเมนูสื่อสาร' : 'เปิดแชท/โทร/วิดีโอ'}
          onClick={() => setOpen(v => !v)}
          onTouchStart={e => { touchX.current = e.touches[0]?.clientX ?? 0; }}
          onTouchEnd={e => {
            const endX = e.changedTouches[0]?.clientX ?? touchX.current;
            const dx = endX - touchX.current;
            if (dx < -20) setOpen(true);
            if (dx > 20) setOpen(false);
          }}
        >
          <span className="deal-comm-floatbar-tab-ic" aria-hidden>{open ? '›' : '💬'}</span>
          {!open && badge != null && badge !== 0 && (
            <span className="deal-comm-floatbar-tab-badge">{badge}</span>
          )}
        </button>
        <div className="deal-comm-floatbar-panel" role="toolbar" aria-label="การสื่อสารในดีล">
          {children}
        </div>
      </div>
    </>
  );
}
