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
  useRemoteParticipants,
  useLocalParticipant,
} from '@livekit/components-react';
import { Track, AudioPresets, type Participant, type RemoteParticipant } from 'livekit-client';

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
  /**
   * background=true → รัน LiveKit room แบบซ่อน (audio ยังทำงาน แต่ไม่แสดง video tiles)
   * ใช้ตอน voice call ทำงานเป็น background — ผู้ใช้ใช้หน้าจอหลักของดีลได้พร้อมกัน
   */
  background?: boolean;
  /** ถูกเรียกเมื่อเชื่อมต่อสำเร็จ (ใช้ sync ตัวนับเวลาฝั่ง parent ตอน voice background) */
  onConnected?: () => void;
  /** ถูกเรียกเมื่ออีกฝ่ายเข้าร่วมห้อง (= รับสายแล้ว) — parent เปลี่ยนจาก outgoing → active */
  onAnswered?: () => void;
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
// ปรับค่าลงเพื่อลดดีเลย์/แล็ก: 540x960 (ใกล้ h540 preset) + 800kbps — adaptiveStream จะปรับ quality ตามขนาด tile/เน็ต
const ROOM_OPTIONS = {
  adaptiveStream: true,
  dynacast: true,
  publishDefaults: {
    videoCodec: 'h264' as const,
    dtx: false,            // ปิด DTX เพื่อเสียงต่อเนื่อง ไม่มีช่วงเงียบกระตุก
    red: true,             // redundancy เสียง ทน packet loss
    audioPreset: AudioPresets.speech,
    videoEncoding: { maxBitrate: 800_000, maxFramerate: 24 },
    simulcast: true,
  },
  // กล้องแนวตั้ง 540x960 — เล็กลงจาก 720x1280 เพื่อลด bandwidth + CPU encode/decode → ลดแล็ก
  videoCaptureDefaults: { resolution: { width: 540, height: 960, frameRate: 24 } },
  audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  disconnectOnPageLeft: true,
};

export default function DealVideoCall({ dealId, getAuthHeaders, onEnd, mode = 'video', onTimeout, maxSeconds = CALL_LIMIT_SECONDS, background = false, onConnected, onAnswered }: Props) {
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
      <CallStage isVideo={isVideo} maxSeconds={maxSeconds} onTimeout={onTimeout} background={background} onConnected={onConnected} onAnswered={onAnswered} onEnd={onEnd} />
    </LiveKitRoom>
  );
}

// ─── Inner stage ที่อยู่ใน LiveKitRoom context (ใช้ hooks ได้) ───────────────
interface StageProps {
  isVideo: boolean;
  maxSeconds: number;
  onTimeout?: () => void;
  background?: boolean;
  onConnected?: () => void;
  onAnswered?: () => void;
  onEnd?: () => void;
}

function CallStage({ isVideo, maxSeconds, onTimeout, background = false, onConnected, onAnswered, onEnd }: StageProps) {
  const connState = useConnectionState();
  const [remaining, setRemaining] = useState(maxSeconds);
  const startedAtRef = useRef<number | null>(null);
  const answeredRef = useRef(false);

  // ดึง track refs ที่ถูกต้องตาม type — useTracks ส่งกลับ TrackReference[] (มี publication จริง)
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const micTracks = useTracks([Track.Source.Microphone], { onlySubscribed: false });
  // ดึง remote participants โดยตรง — ใช้ตรวจจับ "อีกฝ่ายรับสายแล้ว" (length 0 → 1)
  const remoteParticipants = useRemoteParticipants();
  // ดึง local participant สำหรับคุมไมค์/กล้อง
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // ตรวจจับ "อีกฝ่ายรับสาย" — เมื่อมี remote participant เข้ามาครั้งแรก → เรียก onAnswered (ครั้งเดียว)
  useEffect(() => {
    if (!answeredRef.current && remoteParticipants.length > 0) {
      answeredRef.current = true;
      onAnswered?.();
    }
  }, [remoteParticipants.length, onAnswered]);

  // เริ่มนับถอยหลังเมื่อเชื่อมต่อสำเร็จ — setState ทั้งหมดอยู่ใน callback (interval) ไม่ใช่ใน body ของ effect
  useEffect(() => {
    if (connState !== 'connected') return;
    onConnected?.();
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
  }, [connState, maxSeconds, onTimeout, onConnected]);

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

  // ─── call controls (เปิด/ปิด ไมค์ กล้อง ลำโพง สลับกล้อง วางสาย) ───
  const toggleMic = useCallback(async () => {
    try { await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled); } catch { /* ignore */ }
  }, [localParticipant, isMicrophoneEnabled]);

  const toggleCam = useCallback(async () => {
    try { await localParticipant.setCameraEnabled(!isCameraEnabled); } catch { /* ignore */ }
  }, [localParticipant, isCameraEnabled]);

  const toggleSpeaker = useCallback(() => setSpeakerMuted(m => !m), []);

  const flipCamera = useCallback(async () => {
    // สลับกล้องหน้า/หลัง — ส่ง facingMode ใหม่ให้ capture options แล้ว restart track
    try {
      const next = facingMode === 'user' ? 'environment' : 'user';
      setFacingMode(next);
      await localParticipant.setCameraEnabled(true, { facingMode: next } as never);
    } catch { /* อุปกรณ์ไม่รองรับ หรือเป็นคอม → เงียบ */ }
  }, [localParticipant, facingMode]);

  // ปรับ volume ลำโพง — ทำผ่าน audio element ของแต่ละ remote track (track ไหนอยู่ก็ mute ได้)
  // วิธีง่าย: เก็บไว้ใน ref แล้ว set muted ตอน render AudioTrack
  const speakerVolume = speakerMuted ? 0 : 1;

  // background mode (voice call ทำงานเป็น background) — mount เฉพาะ audio tracks
  // เพื่อให้ยังได้ยินเสียงสนทนาโดยไม่ render video tile ใดๆ (ประหยัด CPU/GPU)
  if (background) {
    return (
      <div className="lk-room" aria-hidden="true">
        {/* audio ของทุก remote participant ที่มีไมค์ */}
        {micTracks.filter(tr => !tr.participant.isLocal).map(tr => (
          <AudioTrack key={tr.participant.identity} trackRef={tr} volume={speakerVolume} />
        ))}
      </div>
    );
  }

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
                speakerVolume={speakerVolume}
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
                speakerVolume={speakerVolume}
              />
            ))}
          </>
        )}
      </div>

      {/* เมนูคุมสาย — แถบปุ่มก้นจอ */}
      <div className="lk-controls" role="toolbar" aria-label="คุมสาย">
        <button type="button" onClick={toggleMic} title={isMicrophoneEnabled ? 'ปิดไมค์' : 'เปิดไมค์'} className={isMicrophoneEnabled ? '' : 'off'}>
          {isMicrophoneEnabled ? '🎙️' : '🔇'}
        </button>
        {isVideo && (
          <button type="button" onClick={toggleCam} title={isCameraEnabled ? 'ปิดกล้อง' : 'เปิดกล้อง'} className={isCameraEnabled ? '' : 'off'}>
            {isCameraEnabled ? '📹' : '🚫'}
          </button>
        )}
        {isVideo && (
          <button type="button" onClick={flipCamera} title="สลับกล้องหน้า/หลัง">
            🔄
          </button>
        )}
        <button type="button" onClick={toggleSpeaker} title={speakerMuted ? 'เปิดเสียงลำโพง' : 'ปิดเสียงลำโพง'} className={speakerMuted ? 'off' : ''}>
          {speakerMuted ? '🔈' : '🔊'}
        </button>
        <button type="button" className="hangup" onClick={onEnd} title="วางสาย">
          ✕
        </button>
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
  speakerVolume?: number;
}

function ParticipantTile({ participant, isVideo, cameraRef, micRef, pip, speakerVolume = 1 }: TileProps) {
  const isLocal = participant.isLocal;
  const name = participant.name || participant.identity || 'ผู้ใช้';
  const muted = !!micRef?.publication?.isMuted;
  const hasVideo = isVideo && !!cameraRef;
  const speaking = !muted && (participant.isSpeaking || false);

  const inner = (
    <>
      {/* audio ของ remote — local ไม่ต้อง (ไม่ต้องได้ยินเสียงตัวเอง) */}
      {!isLocal && micRef && <AudioTrack trackRef={micRef} volume={speakerVolume} />}
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
