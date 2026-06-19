'use client';

/**
 * ตัวจัดการสายเสียง (WebRTC) ฝั่งไคลเอนต์ — ใช้ร่วมกันทั้งฝั่งลูกค้า (SupportWidget)
 * และฝั่งพนักงาน (/admin/support) สัญญาณ (offer/answer/ICE candidate) ส่งผ่าน
 * Appwrite Database โดยโพลทุก ๆ 1.2 วิ (รูปแบบเดียวกับการโพลแชท/แจ้งเตือนในโปรเจกต์นี้)
 *
 * หมายเหตุ: ใช้ STUN สาธารณะเท่านั้น (ไม่มี TURN) — เพียงพอกับเครือข่ายส่วนใหญ่
 * แต่บางเครือข่ายที่มี NAT/Firewall เข้มงวดอาจเชื่อมต่อเสียงไม่ได้
 */

export type CallRole = 'customer' | 'staff';
export type CallSessionState = 'connecting' | 'active' | 'ended' | 'failed';

interface SignalMsg { fromRole: string; type: string; data: string; createdAt: string }

interface CallSessionOpts {
  role: CallRole;
  isOfferer: boolean;
  callId: string;
  /** endpoint สำหรับโพล/ส่งสัญญาณ — '/api/support/signal' หรือ '/api/admin/support/signal' */
  signalUrl: string;
  /** ต้องระบุเมื่อ role==='staff' เพื่อบอกว่ากำลังคุยกับลูกค้าคนไหน */
  customerId?: string;
  getJwt: () => Promise<string>;
  onState?: (s: CallSessionState) => void;
  onRemoteStream?: (stream: MediaStream | null) => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export class CallSession {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private pollTimer: number | null = null;
  private since = '';
  private ended = false;
  private opts: CallSessionOpts;

  constructor(opts: CallSessionOpts) { this.opts = opts; }

  private async sendSignal(type: string, data: string) {
    try {
      const jwt = await this.opts.getJwt();
      await fetch(this.opts.signalUrl, {
        method: 'POST',
        headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: this.opts.callId, customerId: this.opts.customerId, type, data }),
      });
    } catch { /* best-effort — สัญญาณหาย ผู้ใช้กดวางสาย/โทรใหม่ได้ */ }
  }

  private async pollSignals() {
    if (this.ended) return;
    try {
      const jwt = await this.opts.getJwt();
      const url = `${this.opts.signalUrl}?callId=${encodeURIComponent(this.opts.callId)}&since=${encodeURIComponent(this.since)}`;
      const r = await fetch(url, { headers: { 'x-session-jwt': jwt } });
      if (r.ok) {
        const d = await r.json();
        const signals = (d.signals || []) as SignalMsg[];
        for (const s of signals) {
          this.since = s.createdAt;
          await this.handleSignal(s);
        }
      }
    } catch { /* ลองใหม่รอบถัดไป */ }
  }

  private async handleSignal(s: SignalMsg) {
    if (!this.pc || this.ended) return;
    try {
      if (s.type === 'offer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(s.data)));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        await this.sendSignal('answer', JSON.stringify(answer));
      } else if (s.type === 'answer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(s.data)));
      } else if (s.type === 'candidate') {
        const c = JSON.parse(s.data);
        if (c) await this.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => null);
      } else if (s.type === 'hangup') {
        this.stop(false);
        this.opts.onState?.('ended');
      }
    } catch { /* ข้ามสัญญาณที่ใช้ไม่ได้ */ }
  }

  async start() {
    this.ended = false;
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      this.opts.onState?.('failed');
      return;
    }
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc = pc;
    this.localStream.getTracks().forEach(t => pc.addTrack(t, this.localStream!));

    pc.onicecandidate = (e) => {
      if (e.candidate) void this.sendSignal('candidate', JSON.stringify(e.candidate.toJSON()));
    };
    pc.ontrack = (e) => { this.opts.onRemoteStream?.(e.streams[0] || null); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') this.opts.onState?.('active');
      if (pc.connectionState === 'failed') this.opts.onState?.('failed');
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') this.opts.onState?.('ended');
    };

    this.pollTimer = window.setInterval(() => { void this.pollSignals(); }, 1200);

    if (this.opts.isOfferer) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await this.sendSignal('offer', JSON.stringify(offer));
    }
  }

  setMuted(muted: boolean) {
    this.localStream?.getAudioTracks().forEach(t => { t.enabled = !muted; });
  }

  stop(notify = true) {
    if (this.ended) return;
    this.ended = true;
    if (notify) void this.sendSignal('hangup', '');
    if (this.pollTimer) { window.clearInterval(this.pollTimer); this.pollTimer = null; }
    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = null;
    if (this.pc) { try { this.pc.close(); } catch { /* noop */ } this.pc = null; }
    this.opts.onRemoteStream?.(null);
  }
}
