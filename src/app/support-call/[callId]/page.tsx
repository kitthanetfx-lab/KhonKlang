'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { account } from '@/lib/appwrite';

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (
      domain: string,
      options: {
        roomName: string;
        parentNode: HTMLElement;
        width: string;
        height: string | number;
        userInfo?: { displayName?: string };
        configOverwrite?: Record<string, unknown>;
        interfaceConfigOverwrite?: Record<string, unknown>;
      }
    ) => {
      addEventListeners?: (events: Record<string, () => void>) => void;
      executeCommand?: (command: string) => void;
      dispose?: () => void;
    };
  }
}

export default function SupportCallPage() {
  const params = useParams<{ callId: string }>();
  const search = useSearchParams();
  const callId = String(params?.callId || '');
  const role = search.get('role') === 'staff' ? 'staff' : 'customer';
  const customerId = search.get('customerId') || '';
  const wrapRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<InstanceType<NonNullable<typeof window.JitsiMeetExternalAPI>> | null>(null);
  const endedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState(role === 'staff' ? 'พนักงาน' : 'ลูกค้า');
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    account.get().then((u) => {
      const display = ((u.prefs || {}) as Record<string, string>).displayName || u.name || '';
      if (display) setName(display);
    }).catch(() => null);
  }, []);

  const hangup = useCallback(async () => {
    if (endedRef.current) return;
    endedRef.current = true;
    setEnding(true);
    try {
      const jwt = (await account.createJWT()).jwt;
      const url = role === 'staff' ? '/api/admin/support/call' : '/api/support/call';
      const body = role === 'staff'
        ? { customerId, action: 'hangup' }
        : { action: 'hangup' };
      await fetch(url, {
        method: 'POST',
        headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
        keepalive: true,
      }).catch(() => null);
    } finally {
      try { apiRef.current?.dispose?.(); } catch {}
      setEnding(false);
      if (window.opener) window.close();
    }
  }, [customerId, role]);

  useEffect(() => {
    if (!callId || !wrapRef.current) return;
    let cancelled = false;

    const init = () => {
      if (cancelled || !wrapRef.current || !window.JitsiMeetExternalAPI) return;
      const api = new window.JitsiMeetExternalAPI('meet.jit.si', {
        roomName: `khonklang-support-${callId}`,
        parentNode: wrapRef.current,
        width: '100%',
        height: '100%',
        userInfo: { displayName: name },
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: true,
          startAudioOnly: true,
          disableDeepLinking: true,
          prejoinPageEnabled: false,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_BRAND_WATERMARK: false,
          MOBILE_APP_PROMO: false,
          TOOLBAR_BUTTONS: ['microphone', 'hangup'],
        },
      });
      api.addEventListeners?.({
        videoConferenceJoined: () => setReady(true),
        videoConferenceLeft: () => { void hangup(); },
        readyToClose: () => { void hangup(); },
      });
      apiRef.current = api;
    };

    if (window.JitsiMeetExternalAPI) init();
    else {
      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      script.onload = init;
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      try { apiRef.current?.dispose?.(); } catch {}
      apiRef.current = null;
    };
  }, [callId, name, hangup]);

  if (!callId) {
    return <div style={{ padding: 24 }}>ไม่พบรหัสสาย</div>;
  }

  if (role === 'staff' && !customerId) {
    return <div style={{ padding: 24 }}>ไม่พบข้อมูลลูกค้าที่ใช้วางสาย</div>;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateRows: 'auto 1fr', background: '#0b1020', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
        <div>
          <div style={{ fontWeight: 700 }}>สายสนทนากับทีมงาน</div>
          <div style={{ fontSize: 13, opacity: .72 }}>{ready ? 'เชื่อมต่อห้องเสียงแล้ว' : 'กำลังเข้าห้องเสียง...'}</div>
        </div>
        <button type="button" onClick={() => { void hangup(); }} disabled={ending} style={{ border: 0, borderRadius: 999, padding: '10px 16px', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          {ending ? 'กำลังวางสาย...' : 'วางสาย'}
        </button>
      </div>
      <div ref={wrapRef} style={{ minHeight: 0 }} />
    </div>
  );
}
