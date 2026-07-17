'use client';

/**
 * วิดีโอคอล / โทรเสียง ในหน้าดีล — ใช้ LiveKit Server ที่โฮสต์เองบน VPS (โปรเจกต์ glangCoturn)
 *
 * ความต่างจากเวอร์ชันเดิม:
 *  - ใช้ custom split layout แทน VideoConference ดั้งเดิม เพื่อ tile แนวตั้งและคุม layout ได้เต็มที่
 *  - responsive: มือถือ = บน/ล่าง (column), แท็บเล็ต/คอม = ซ้าย/ขวา (row)
 *  - latency tuning: adaptiveStream + dynacast + h264 + speech audio preset → ลดดีเลย์/กระตุก
 *  - จำกัดเวลาคอลไม่เกิน 10 นาทีต่อครั้ง (นับถอยหลังตั้งแต่เชื่อมต่อสำเร็จ) — หมดเวลาเรียก onTimeout
 *  - รองรับโหมด 'voice' (เสียงล้วน) และ 'video' (วิดีโอ)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TrackReference } from '@livekit/components-core';
import {
  LiveKitRoom,
  VideoTrack,
  AudioTrack,
  useTracks,
  useConnectionState,
} from '@livekit/components-react';
import { Track, AudioPresets, type Participant } from 'livekit-client';

interface Props {
  dealId: string;
  getAuthHeaders: () => Promise<Record<string, string>>;
  /** ถูกเรียกเมื่อหลุด/วางสายจากใน UI ของห้อง */
  onEnd?: () => void;
  /** โหมดคอล: 'video' (วิดีโอคอล, default) หรือ 'voice' (เสียงล้วน) */
  mode?: 'voice' | 'video';
  /** ถูกเรียกเมื่อครบเวลา 10 นาที — parent ควร disconnect แล้วแจ้งเตือนผู้ใช้ */
  onTimeout?: () => void;
  /** วินาทีต่อครั้ง — default 600 (10 นาที) */
  maxSeconds?: number;
}

const CALL_LIMIT_SECONDS = 10 * 60; // 10 นาทีต่อครั้ง ตาม requirement

function fmt(sec: number): string {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function initialOf(name?: string): string {
  if (!name) return '?';
  return name.trim().charAt(0).toUpperCase() || '?';
}

// Latency tuning — ลดดีเลย์: h264 decode เร็ว, adaptiveStream/dynacast ลด bandwidth, speech preset ลด audio latency
// (ค่าคงที่ ไม่ขึ้นกับ props — ยกขึ้นเป็น module-level เพื่อกัน useMemo หลัง early return ซึ่งผิด rules-of-hooks)
const ROOM_OPTIONS = {
  adaptiveStream: true,
  dynacast: true,
  publishDefaults: {
    videoCodec: 'h264' as const,
    dtx: false,            // ปิด DTX เพื่อเสียงต่อเนื่อง ไม่มีช่วงเงียบกระตุก
    red: true,             // redundancy เสียง ทน packet loss
    audioPreset: AudioPresets.speech,
    videoEncoding: { maxBitrate: 1_500_000, maxFramerate: 30 },
    simulcast: true,
  },
  // กล้องแนวตั้ง 720x1280 — เหมาะกับ tile แนวตั้ง กัน letterbox และลด bandwidth เทียบ 1080p
  videoCaptureDefaults: { resolution: { width: 720, height: 1280, frameRate: 30 } },
  audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  disconnectOnPageLeft: true,
};

export default function DealVideoCall({ dealId, getAuthHeaders, onEnd, mode = 'video', onTimeout, maxSeconds = CALL_LIMIT_SECONDS }: Props) {
  const [conn, setConn] = useState<{ token: string; url: string } | null>(null);
  const [err, setErr] = useState('');

  const isVideo = mode === 'video';

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
    <div className="lk-room" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'rgba(255,255,255,.75)', fontSize: 14, padding: 24, textAlign: 'center' }}>📞 {err}</div>
    </div>
  );
  if (!conn) return (
    <div className="lk-room" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'dashSpin .8s linear infinite' }} />
    </div>
  );

  return (
    <LiveKitRoom
      serverUrl={conn.url}
      token={conn.token}
      connect
      audio
      video={isVideo}
      options={ROOM_OPTIONS}
      connectOptions={{ peerConnectionTimeout: 15000 }}
      onDisconnected={onEnd}
      style={{ height: '100%', width: '100%' }}
    >
      <CallStage isVideo={isVideo} maxSeconds={maxSeconds} onTimeout={onTimeout} />
    </LiveKitRoom>
  );
}

// ─── Inner stage ที่อยู่ใน LiveKitRoom context (ใช้ hooks ได้) ───────────────
interface StageProps {
  isVideo: boolean;
  maxSeconds: number;
  onTimeout?: () => void;
}

function CallStage({ isVideo, maxSeconds, onTimeout }: StageProps) {
  const connState = useConnectionState();
  const [remaining, setRemaining] = useState(maxSeconds);
  const startedAtRef = useRef<number | null>(null);

  // ดึง track refs ที่ถูกต้องตาม type — useTracks ส่งกลับ TrackReference[] (มี publication จริง)
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const micTracks = useTracks([Track.Source.Microphone], { onlySubscribed: false });

  // เริ่มนับถอยหลังเมื่อเชื่อมต่อสำเร็จ — setState ทั้งหมดอยู่ใน callback (interval) ไม่ใช่ใน body ของ effect
  useEffect(() => {
    if (connState !== 'connected') return;
    startedAtRef.current = Date.now();
    const iv = window.setInterval(() => {
      const start = startedAtRef.current;
      if (start == null) return;
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const left = Math.max(0, maxSeconds - elapsed);
      setRemaining(left);
      if (left <= 0) {
        window.clearInterval(iv);
        onTimeout?.();
      }
    }, 500);
    return () => window.clearInterval(iv);
  }, [connState, maxSeconds, onTimeout]);

  // รวม participant ที่ไม่ซ้ำ — จากทั้ง camera + mic
  const participants = useMemo(() => {
    const map = new Map<string, Participant>();
    for (const tr of cameraTracks) map.set(tr.participant.identity, tr.participant);
    for (const tr of micTracks) map.set(tr.participant.identity, tr.participant);
    return Array.from(map.values());
  }, [cameraTracks, micTracks]);

  const cameraOf = useCallback((p: Participant) => cameraTracks.find(t => t.participant.identity === p.identity), [cameraTracks]);
  const micOf = useCallback((p: Participant) => micTracks.find(t => t.participant.identity === p.identity), [micTracks]);

  const connecting = connState !== 'connected';

  return (
    <div className="lk-room">
      {/* ตัวจับเวลา 10 นาที — แสดงตลอดเวลาคอล */}
      {connState === 'connected' && (
        <div className={`lk-timer ${remaining <= 60 ? 'warn' : ''}`} aria-live="polite">
          <span className="lk-timer-dot" />
          {fmt(remaining)}
          {remaining <= 60 && <span style={{ fontSize: 11, fontWeight: 600 }}>ใกล้หมดเวลา</span>}
        </div>
      )}

      {connecting && (
        <div className="lk-connecting">
          <div style={{ width: 30, height: 30, border: '3px solid rgba(255,255,255,.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'dashSpin .8s linear infinite' }} />
          <span>{connState === 'connecting' ? 'กำลังเชื่อมต่อ…' : connState === 'reconnecting' ? 'กำลังเชื่อมต่อใหม่…' : 'รอเข้าร่วมคอล'}</span>
        </div>
      )}

      <div className="lk-split">
        {participants.length === 0 && !connecting ? (
          <div className="lk-tile">
            <div className="lk-tile-placeholder">
              <div className="lk-tile-avatar">?</div>
              <span>รอผู้เข้าร่วม…</span>
            </div>
          </div>
        ) : (
          <>
            {participants.slice(0, 2).map((p) => (
              <ParticipantTile
                key={p.identity}
                participant={p}
                isVideo={isVideo}
                cameraRef={cameraOf(p)}
                micRef={micOf(p)}
                pip={false}
              />
            ))}
            {participants.slice(2).map((p) => (
              <ParticipantTile
                key={p.identity}
                participant={p}
                isVideo={isVideo}
                cameraRef={cameraOf(p)}
                micRef={micOf(p)}
                pip
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Tile ของ participant แต่ละคน ─────────────────────────────────────────
interface TileProps {
  participant: Participant;
  isVideo: boolean;
  cameraRef?: TrackReference;
  micRef?: TrackReference;
  pip: boolean;
}

function ParticipantTile({ participant, isVideo, cameraRef, micRef, pip }: TileProps) {
  const isLocal = participant.isLocal;
  const name = participant.name || participant.identity || 'ผู้ใช้';
  const muted = !!micRef?.publication?.isMuted;
  const hasVideo = isVideo && !!cameraRef;
  const speaking = !muted && (participant.isSpeaking || false);

  const inner = (
    <>
      {/* audio ของ remote — local ไม่ต้อง (ไม่ต้องได้ยินเสียงตัวเอง) */}
      {!isLocal && micRef && <AudioTrack trackRef={micRef} />}
      {hasVideo && cameraRef ? (
        <VideoTrack trackRef={cameraRef} />
      ) : (
        <div className="lk-tile-placeholder">
          <div className="lk-tile-avatar" style={speaking ? { boxShadow: '0 0 0 4px rgba(34,197,94,.5)' } : undefined}>{initialOf(name)}</div>
          <span>{name}{isLocal ? ' (คุณ)' : ''}</span>
          <span style={{ fontSize: 11, opacity: .7 }}>
            {isVideo
              ? (hasVideo ? '' : muted ? '🔇 เงียบ' : '🎤 รอเปิดกล้อง')
              : muted ? '🔇 เงียบ' : speaking ? '🎙️ กำลังพูด' : '🎤 โทรเสียง'}
          </span>
        </div>
      )}
      <div className="lk-tile-info">
        <span className="lk-tile-name">{name}{isLocal ? ' (คุณ)' : ''}</span>
        <span className={`lk-tile-badge ${muted ? 'off' : ''}`}>
          {muted ? '🔇 เงียบ' : '🎤'}
        </span>
        {isVideo && !hasVideo && <span className="lk-tile-badge off">📹 ปิด</span>}
      </div>
    </>
  );

  if (pip) return <div className="lk-pip">{inner}</div>;
  return <div className="lk-tile">{inner}</div>;
}
