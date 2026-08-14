'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useGlobalLoadingOptional } from './GlobalLoadingProvider';

type AsyncButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  /** ตัวจัดการการกด — รองรับ async (คืนค่าอะไรก็ได้); ปุ่มจะล็อก (กดได้ครั้งเดียว) และโชว์สปินเนอร์จนกว่าจะเสร็จ */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => unknown;
  /** ข้อความ/ไอคอนระหว่างกำลังโหลด (ถ้าไม่กำหนด จะใช้ children เดิมโดยมีสปินเนอร์นำหน้า) */
  loadingChildren?: React.ReactNode;
  /** บังคับสถานะ loading จากภายนอก (เช่น trigger ส่งรีวิว) */
  loading?: boolean;
};

/**
 * ปุ่มที่กดได้ "ครั้งเดียว" ต่อหนึ่งการทำงาน + มีสปินเนอร์หมุนระหว่างรอ
 * ใช้กับปุ่มไปขั้นตอนต่อไปทุกบริการ — กันกดซ้ำ/กดรัว
 */
export function AsyncButton({ onClick, children, loadingChildren, disabled, className, loading: loadingProp, ...rest }: AsyncButtonProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = loadingProp || internalLoading;
  const mounted = useRef(true);
  const globalLoading = useGlobalLoadingOptional();
  useEffect(() => () => { mounted.current = false; }, []);

  async function handle(e: React.MouseEvent<HTMLButtonElement>) {
    if (loading || disabled) return;
    if (!onClick) return;
    if (loadingProp) {
      globalLoading?.beginLoading();
      try {
        await onClick(e);
      } finally {
        globalLoading?.endLoading();
      }
      return;
    }
    try {
      setInternalLoading(true);
      globalLoading?.beginLoading();
      await onClick(e);
    } finally {
      if (mounted.current) setInternalLoading(false);
      globalLoading?.endLoading();
    }
  }

  return (
    <button
      {...rest}
      data-managed-loading=""
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
