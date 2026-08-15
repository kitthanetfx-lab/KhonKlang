'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { authHeaders } from '@/lib/supabase';

type LineStatus = {
  linked: boolean;
  oaFriend: boolean;
  ready: boolean;
  lineOaUrl: string;
};

export function LineOaConnect({
  returnTo,
  variant = 'inline',
  readyLabel = '✓ พร้อมรับแจ้งเตือนผ่าน LINE OA',
}: {
  returnTo: string;
  variant?: 'inline' | 'profile';
  readyLabel?: string;
}) {
  const [status, setStatus] = useState<LineStatus | null>(null);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setChecking(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/line/status${refresh ? '?refresh=1' : ''}`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      setStatus({
        linked: Boolean(data.linked),
        oaFriend: Boolean(data.oaFriend),
        ready: Boolean(data.ready),
        lineOaUrl: String(data.lineOaUrl || ''),
      });
    } catch { /* ignore */ }
    finally { setChecking(false); }
  }, []);

  useEffect(() => { void load(false); }, [load]);

  useEffect(() => {
    if (!status?.linked || status.oaFriend) return;
    const onFocus = () => { void load(true); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [status?.linked, status?.oaFriend, load]);

  if (!status) {
    return variant === 'profile'
      ? <p className="pd-bid-hint">กำลังตรวจสถานะ LINE...</p>
      : null;
  }

  const wrapClass = variant === 'profile' ? 'line-oa-connect' : 'pd-line-oa';

  if (status.ready) {
    return (
      <div className={wrapClass}>
        <p className={variant === 'profile' ? 'line-oa-connect-ok' : 'pd-line-oa-ok'}>{readyLabel}</p>
      </div>
    );
  }

  if (!status.linked) {
    return (
      <div className={wrapClass}>
        <p className={variant === 'profile' ? 'line-oa-connect-title' : 'pd-line-oa-title'}>ผูก LINE กับบัญชีนี้</p>
        <p className="pd-bid-hint">ขั้นแรกผูก LINE กับบัญชีที่ล็อกอินอยู่ — ไม่สลับไปบัญชีอื่น</p>
        <div className={variant === 'profile' ? 'line-oa-connect-actions' : 'pd-line-oa-actions'}>
          <Link className="btn btn-soft btn-sm" href={`/auth/line/link?returnTo=${encodeURIComponent(returnTo)}`}>
            ผูก LINE กับบัญชีนี้
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapClass}>
      <p className={variant === 'profile' ? 'line-oa-connect-title' : 'pd-line-oa-title'}>ผูก LINE แล้ว — เพิ่มเพื่อน Official Account</p>
      <p className="pd-bid-hint">ขั้นถัดไปเพิ่มเพื่อน LINE OA เพื่อให้ข้อความแจ้งเตือนส่งถึงคุณได้</p>
      <div className={variant === 'profile' ? 'line-oa-connect-actions' : 'pd-line-oa-actions'}>
        {status.lineOaUrl ? (
          <a className="btn btn-primary btn-sm" href={status.lineOaUrl} target="_blank" rel="noreferrer">
            เพิ่มเพื่อน LINE OA
          </a>
        ) : (
          <p className="pd-bid-hint">ยังไม่ได้ตั้งลิงก์เพิ่มเพื่อน OA — ติดต่อทีมงาน</p>
        )}
        <button type="button" className="btn btn-soft btn-sm" onClick={() => load(true)} disabled={checking}>
          {checking ? 'กำลังตรวจ...' : 'ฉันเพิ่มเพื่อนแล้ว'}
        </button>
      </div>
    </div>
  );
}
