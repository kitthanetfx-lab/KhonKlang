/**
 * Pull-to-refresh — ใช้เฉพาะในแอpมือถือกลางฮับ (Capacitor WebView)
 * ฝั่งเว็บ/เบราว์เซอร์ไม่โหลด bridge นี้
 */

import { isGlanghubApp } from '@/lib/nativeAuth';

export const NATIVE_PTR_THRESHOLD = 72;
export const NATIVE_PTR_MAX_PULL = 128;

export type NativePtrState = 'idle' | 'pulling' | 'ready' | 'refreshing';

export type NativePtrUpdate = {
  distance: number;
  state: NativePtrState;
};

function scrollTop(): number {
  return Math.max(
    window.scrollY || 0,
    document.documentElement.scrollTop || 0,
    document.body.scrollTop || 0,
  );
}

function isAtScrollTop(): boolean {
  return scrollTop() <= 1;
}

/** ผูก touch listener — คืนฟังก์ชันถอดการติดตั้ง */
export function mountNativePullToRefresh(handlers: {
  onUpdate: (update: NativePtrUpdate) => void;
  onRefresh: () => void;
}): () => void {
  if (!isGlanghubApp()) return () => {};

  let startY = 0;
  let tracking = false;
  let refreshing = false;
  let distance = 0;

  function setUpdate(state: NativePtrState, dist = distance) {
    handlers.onUpdate({ distance: dist, state });
  }

  function reset() {
    tracking = false;
    distance = 0;
    if (!refreshing) setUpdate('idle', 0);
  }

  function onTouchStart(e: TouchEvent) {
    if (refreshing || !isAtScrollTop() || e.touches.length !== 1) return;
    startY = e.touches[0].clientY;
    tracking = true;
  }

  function onTouchMove(e: TouchEvent) {
    if (!tracking || refreshing || e.touches.length !== 1) return;

    const delta = e.touches[0].clientY - startY;
    if (delta <= 0) {
      distance = 0;
      setUpdate('idle', 0);
      return;
    }

    if (!isAtScrollTop()) {
      reset();
      return;
    }

    e.preventDefault();
    distance = Math.min(delta * 0.5, NATIVE_PTR_MAX_PULL);
    setUpdate(distance >= NATIVE_PTR_THRESHOLD ? 'ready' : 'pulling', distance);
  }

  function onTouchEnd() {
    if (!tracking || refreshing) return;
    tracking = false;

    if (distance >= NATIVE_PTR_THRESHOLD) {
      refreshing = true;
      setUpdate('refreshing', NATIVE_PTR_THRESHOLD);
      handlers.onRefresh();
      return;
    }

    reset();
  }

  function onTouchCancel() {
    if (refreshing) return;
    reset();
  }

  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchcancel', onTouchCancel, { passive: true });

  return () => {
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchCancel);
  };
}

/** รีเฟรชหน้าใน WebView — reload เต็มหน้าให้ได้ข้อมูลล่าสุด */
export function refreshNativePage() {
  window.location.reload();
}
