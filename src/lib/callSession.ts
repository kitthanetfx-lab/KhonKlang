'use client';

/**
 * ตัวจัดการสายเสียง (LiveKit) ฝั่งไคลเอนต์ — ใช้ร่วมกันทั้งฝั่งลูกค้า (SupportWidget)
 * และฝั่งพนักงาน (/admin/support)
 *
 * เวอร์ชันนี้เปลี่ยนจาก WebRTC + โพลสัญญาณผ่านตาราง call_signals มาใช้ LiveKit Server
 * ที่โฮสต์เองบน VPS (โปรเจกต์ glangCoturn) — เสถียรกว่า มี TURN ในตัวผ่าน Coturn
 * ทะลุ NAT/Firewall เน็ตมือถือได้ และไม่ต้องโพลฐานข้อมูลทุก 1.2 วิอีกต่อไป
 *
 * public interface คงเดิมทุกอย่าง: new CallSession(opts) / start() / setMuted() / stop()
 * (opts เดิมอย่าง signalUrl / getIceServers / isOfferer ยังรับได้แต่ไม่ใช้แล้ว)
 */

import { Room, RoomEvent, RemoteTrack, Track } from 'livekit-client';

export type CallRole = 'customer' | 'staff';
export type CallSessionState = 'connecting' | 'active' | 'ended' | 'failed';

interface CallSessionOpts {
  role: CallRole;
  /** ไม่ใช้แล้ว (LiveKit ไม่มี offerer) — คงไว้เพื่อ compatibility */
  isOfferer?: boolean;
  callId: string;
  /** ไม่ใช้แล้ว — signaling ทำผ่าน LiveKit ทั้งหมด */
  signalUrl?: string;
  /** ต้องระบุเมื่อ role==='staff' เพื่อบอกว่ากำลังคุยกับลูกค้าคนไหน */
  customerId?: string;
  getAuthHeaders: () => Promise<Record<string, string>>;
  /** ไม่ใช้แล้ว — TURN ถูกแจ้งให้ client โดย LiveKit Server อัตโนมัติ */
  getIceServers?: () => Promise<RTCIceServer[]>;
  onState?: (s: CallSessionState) => void;
  onRemoteStream?: (stream: MediaStream | null) => void;
}

export class CallSession {
  private room: Room | null = null;
  private ended = false;
  private opts: CallSessionOpts;

  constructor(opts: CallSessionOpts) { this.opts = opts; }

  private tokenUrl() {
    return this.opts.role === 'staff' ? '/api/admin/support/call-token' : '/api/support/call-token';
  }

  /** รวมเสียงของผู้ร่วมสายทุกคน (ปกติมีฝ่ายเดียว) เป็น MediaStream เดียวส่งให้ <audio> */
  private emitRemoteStream() {
    if (!this.room || this.ended) return;
    const tracks: MediaStreamTrack[] = [];
    this.room.remoteParticipants.forEach(p => {
      p.audioTrackPublications.forEach(pub => {
        const t = pub.track?.mediaStreamTrack;
        if (t) tracks.push(t);
      });
    });
    this.opts.onRemoteStream?.(tracks.length ? new MediaStream(tracks) : null);
  }

  async start() {
    this.ended = false;
    this.opts.onState?.('connecting');

    // 1) ขอ token + url จาก backend (ออกให้เฉพาะสายที่ตัวเองมีสิทธิ์)
    let token = '', url = '';
    try {
      const headers = await this.opts.getAuthHeaders();
      const r = await fetch(this.tokenUrl(), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ callId: this.opts.callId, customerId: this.opts.customerId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.token || !d.url) throw new Error(d.error || 'token failed');
      token = d.token; url = d.url;
    } catch {
      this.opts.onState?.('failed');
      return;
    }

    // 2) เชื่อมห้อง LiveKit + เปิดไมค์
    const room = new Room();
    this.room = room;

    room
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) {
          this.emitRemoteStream();
          this.opts.onState?.('active');
        }
      })
      .on(RoomEvent.TrackUnsubscribed, () => this.emitRemoteStream())
      .on(RoomEvent.ParticipantDisconnected, () => {
        this.emitRemoteStream();
        // อีกฝ่ายออกจากสาย → ถือว่าจบสาย (สถานะ thread จะถูกอัปเดตโดยปุ่มวางสาย/API อยู่แล้ว)
        if (this.room && this.room.remoteParticipants.size === 0) {
          this.opts.onState?.('ended');
        }
      })
      .on(RoomEvent.Disconnected, () => {
        if (!this.ended) this.opts.onState?.('ended');
      });

    try {
      await room.connect(url, token);
      await room.localParticipant.setMicrophoneEnabled(true);
    } catch {
      this.opts.onState?.('failed');
      this.stop(false);
      return;
    }

    // อีกฝ่ายอยู่ในห้องแล้ว (เรามาทีหลัง) → active ทันที
    if (room.remoteParticipants.size > 0) {
      this.emitRemoteStream();
      this.opts.onState?.('active');
    }
  }

  setMuted(muted: boolean) {
    void this.room?.localParticipant.setMicrophoneEnabled(!muted);
  }

  stop(_notify = true) {
    if (this.ended) return;
    this.ended = true;
    const room = this.room;
    this.room = null;
    if (room) { void room.disconnect(); }
    this.opts.onRemoteStream?.(null);
  }
}
