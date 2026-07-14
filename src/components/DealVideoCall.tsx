'use client';

/**
 * วิดีโอคอลในหน้าดีล — ใช้ LiveKit Server ที่โฮสต์เองบน VPS (โปรเจกต์ glangCoturn)
 * แทน Jitsi Meet (meet.jit.si) เดิม: ห้องผูกกับ dealId และเข้าได้เฉพาะผู้ถือ token
 * ที่ backend ออกให้ (คู่ดีล/แอดมินเท่านั้น) — คนนอกเดาชื่อห้องเข้าไม่ได้อีกต่อไป
 */

import { useEffect, useState } from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';

interface Props {
  dealId: string;
  getAuthHeaders: () => Promise<Record<string, string>>;
  /** ถูกเรียกเมื่อหลุด/วางสายจากใน UI ของห้อง */
  onEnd?: () => void;
}

export default function DealVideoCall({ dealId, getAuthHeaders, onEnd }: Props) {
  const [conn, setConn] = useState<{ token: string; url: string } | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const r = await fetch(`/api/deals/${dealId}/call-token`, { headers, cache: 'no-store' });
        const d = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok || !d.token || !d.url) { setErr(d.error || 'เชื่อมต่อระบบโทรไม่สำเร็จ'); return; }
        setConn({ token: d.token, url: d.url });
      } catch { if (!cancelled) setErr('เชื่อมต่อระบบโทรไม่สำเร็จ'); }
    })();
    return () => { cancelled = true; };
  }, [dealId, getAuthHeaders]);

  if (err) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.75)', fontSize: 14, padding: 24, textAlign: 'center' }}>
      📞 {err}
    </div>
  );
  if (!conn) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'dashSpin .8s linear infinite' }} />
    </div>
  );
  return (
    <LiveKitRoom
      serverUrl={conn.url}
      token={conn.token}
      connect
      audio
      video
      onDisconnected={onEnd}
      data-lk-theme="default"
      style={{ height: '100%', width: '100%' }}
    >
      <VideoConference />
    </LiveKitRoom>
  );
}
