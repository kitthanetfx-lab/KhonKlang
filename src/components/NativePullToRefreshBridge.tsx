'use client';

import { useEffect, useState } from 'react';
import { isGlanghubApp } from '@/lib/nativeAuth';
import {
  mountNativePullToRefresh,
  refreshNativePage,
  type NativePtrUpdate,
} from '@/lib/nativePullToRefresh';

const IDLE: NativePtrUpdate = { distance: 0, state: 'idle' };

/** ดึงลงจากด้านบนสุดเพื่อรีเฟรช — เฉพาะแอpมือถือกลางฮับ */
export function NativePullToRefreshBridge() {
  const [ptr, setPtr] = useState<NativePtrUpdate>(IDLE);
  const inApp = isGlanghubApp();

  useEffect(() => {
    if (!inApp) return;
    document.documentElement.classList.add('glanghub-app');
    return mountNativePullToRefresh({
      onUpdate: setPtr,
      onRefresh: refreshNativePage,
    });
  }, [inApp]);

  if (!inApp) return null;

  const visible = ptr.state !== 'idle' || ptr.distance > 0;
  const label =
    ptr.state === 'refreshing'
      ? 'กำลังรีเฟรช…'
      : ptr.state === 'ready'
        ? 'ปล่อยเพื่อรีเฟรช'
        : 'ดึงลงเพื่อรีเฟรช';

  return (
    <div
      className={`native-ptr ${visible ? 'visible' : ''} ${ptr.state}`}
      style={{ '--ptr-pull': `${ptr.distance}px` } as React.CSSProperties}
      aria-live="polite"
      aria-hidden={!visible}
    >
      <div className="native-ptr-inner">
        <span className={`native-ptr-spinner ${ptr.state === 'refreshing' ? 'spin' : ''}`} aria-hidden />
        <span className="native-ptr-label">{label}</span>
      </div>
    </div>
  );
}
