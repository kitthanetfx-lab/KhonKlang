'use client';

import type { ReactNode } from 'react';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function AppSheet({ open, title, onClose, children, footer }: Props) {
  if (!open) return null;
  return (
    <div className="app-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="app-sheet-backdrop" aria-label="ปิด" onClick={onClose} />
      <div className="app-sheet-panel">
        <div className="app-sheet-handle" />
        <h2 className="app-sheet-title">{title}</h2>
        {children}
        {footer && <div className="app-sheet-actions">{footer}</div>}
      </div>
    </div>
  );
}

export default AppSheet;
