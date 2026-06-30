'use client';
import React, { useEffect, useRef, useState } from 'react';

type AsyncButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  /** ตัวจัดการการกด — รองรับ async (คืนค่าอะไรก็ได้); ปุ่มจะล็อก (กดได้ครั้งเดียว) และโชว์สปินเนอร์จนกว่าจะเสร็จ */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => unknown;
  /** ข้อความ/ไอคอนระหว่างกำลังโหลด (ถ้าไม่กำหนด จะใช้ children เดิมโดยมีสปินเนอร์นำหน้า) */
  loadingChildren?: React.ReactNode;
};

/**
 * ปุ่มที่กดได้ "ครั้งเดียว" ต่อหนึ่งการทำงาน + มีสปินเนอร์หมุนระหว่างรอ
 * ใช้กับปุ่มไปขั้นตอนต่อไปทุกบริการ — กันกดซ้ำ/กดรัว
 */
export function AsyncButton({ onClick, children, loadingChildren, disabled, className, ...rest }: AsyncButtonProps) {
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  async function handle(e: React.MouseEvent<HTMLButtonElement>) {
    if (loading || disabled) return;       // กันกดซ้ำระหว่างกำลังทำงาน
    if (!onClick) return;
    try {
      setLoading(true);
      await onClick(e);                     // รองรับทั้ง sync และ async
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  return (
    <button
      {...rest}
      className={`${className || ''}${loading ? ' is-loading' : ''}`}
      disabled={disabled || loading}
      aria-busy={loading}
      onClick={handle}
    >
      {loading && <span className="async-spin" aria-hidden="true" />}
      {loading ? (loadingChildren ?? children) : children}
    </button>
  );
}

export default AsyncButton;
