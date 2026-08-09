'use client';

import { useEffect, useState } from 'react';
import { TH_LOGISTICS_PROVIDERS } from '@/lib/logistics';

interface Props {
  open: boolean;
  selected: string[];
  onClose: () => void;
  onConfirm: (selected: string[]) => void;
}

export function ShippingCarrierPicker({ open, selected, onClose, onConfirm }: Props) {
  const [draft, setDraft] = useState<string[]>(selected);

  useEffect(() => {
    if (open) setDraft(selected);
  }, [open, selected]);

  if (!open) return null;

  function toggle(id: string) {
    setDraft(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }

  return (
    <div className="carrier-picker-backdrop" onClick={onClose}>
      <div className="carrier-picker" onClick={e => e.stopPropagation()}>
        <div className="carrier-picker-head">
          <h3>เลือกขนส่งที่รองรับ</h3>
          <button type="button" className="carrier-picker-close" onClick={onClose} aria-label="ปิด">×</button>
        </div>
        <p className="carrier-picker-sub">ติ๊กเลือกขนส่งที่ลูกค้าสามารถเลือกได้เมื่อซื้อสินค้า</p>
        <ul className="carrier-picker-list">
          {TH_LOGISTICS_PROVIDERS.map(p => (
            <li key={p.id}>
              <label className={`carrier-picker-item${draft.includes(p.id) ? ' is-on' : ''}`}>
                <input type="checkbox" checked={draft.includes(p.id)} onChange={() => toggle(p.id)} />
                <span>{p.label}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="carrier-picker-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onConfirm(draft)}
            disabled={draft.length === 0}
          >
            ยืนยัน ({draft.length})
          </button>
        </div>
      </div>
    </div>
  );
}
