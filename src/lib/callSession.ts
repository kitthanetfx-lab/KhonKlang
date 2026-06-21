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

interface SignalMsg { from_role: string; type: string; data: string; created_at: string }

interface CallSessionOpts {
  role: CallRole;
  isOfferer: boolean;
  callId: string;
  /** endpoint สำหรับโพล/ส่งสัญญาณ — '/api/support/signal' หรือ '/api/admin/support/signal' */
  signalUrl: string;
  /** ต้องระบุเมื่อ role==='staff' เพื่อบอกว่ากำลังคุยกับลูกค้าคนไหน */
  customerId?: string;
  getAuthHeaders: () => Promise<Record<string, string>>;
  getIceServers?: () => Promise<RTCIceServer[]>;
  onState?: (s: CallSessionState) => void;
  onRemoteStream?: (stream: MediaStream | null) => void;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
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

  private reportDebug(hypothesisId: string, location: string, msg: string, data: Record<string, unknown>) {
    const url = this.opts.role === 'staff' ? '/api/admin/support/debug' : '/api/support/debug';
    const body = {
      sessionId: 'support-call-fail',
      runId: 'pre-fix',
      hypothesisId,
      location,
      msg,
      data,
      ts: Date.now(),
      customerId: this.opts.customerId || '',
      callId: this.opts.callId,
      role: this.opts.role,
    };
    this.opts.getAuthHeaders()
      .then((headers) => fetch(url, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }))
      .catch(() => null);
  }

  private async sendSignal(type: string, data: string) {
    try {
      this.reportDebug('C', 'src/lib/callSession.ts:sendSignal', '[DEBUG] sendSignal', {
        role: this.opts.role,
        callId: this.opts.callId,
        type,
        customerId: this.opts.customerId || '',
        size: data.length,
      });
      const headers = await this.opts.getAuthHeaders();
      await fetch(this.opts.signalUrl, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: this.opts.callId, customerId: this.opts.customerId, type, data }),
      });
    } catch { /* best-effort — สัญญาณหาย ผู้ใช้กดวางสาย/โทรใหม่ได้ */ }
  }

  private async pollSignals() {
    if (this.ended) return;
    try {
      const headers = await this.opts.getAuthHeaders();
      const url = `${this.opts.signalUrl}?callId=${encodeURIComponent(this.opts.callId)}&since=${encodeURIComponent(this.since)}`;
      const r = await fetch(url, { headers });
      if (r.ok) {
        const d = await r.json();
        const signals = (d.signals || []) as SignalMsg[];
        this.reportDebug('C', 'src/lib/callSession.ts:pollSignals', '[DEBUG] pollSignals', {
          role: this.opts.role,
          callId: this.opts.callId,
          since: this.since,
          count: signals.length,
          types: signals.map(s => s.type),
        });
        for (const s of signals) {
          this.since = s.created_at;
          await this.handleSignal(s);
        }
      }
    } catch { /* ลองใหม่รอบถัดไป */ }
  }

  private async handleSignal(s: SignalMsg) {
    if (!this.pc || this.ended) return;
    try {
      this.reportDebug('C', 'src/lib/callSession.ts:handleSignal', '[DEBUG] handleSignal', {
        role: this.opts.role,
        callId: this.opts.callId,
        type: s.type,
        fromRole: s.from_role,
        createdAt: s.created_at,
      });
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
      this.reportDebug('D', 'src/lib/callSession.ts:start', '[DEBUG] getUserMedia:start', {
        role: this.opts.role,
        callId: this.opts.callId,
        isOfferer: this.opts.isOfferer,
        customerId: this.opts.customerId || '',
      });
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.reportDebug('D', 'src/lib/callSession.ts:start', '[DEBUG] getUserMedia:ok', {
        role: this.opts.role,
        callId: this.opts.callId,
        tracks: this.localStream.getAudioTracks().map(t => ({
          enabled: t.enabled,
          readyState: t.readyState,
          label: t.label,
        })),
      });
    } catch {
      this.reportDebug('D', 'src/lib/callSession.ts:start', '[DEBUG] getUserMedia:fail', {
        role: this.opts.role,
        callId: this.opts.callId,
      });
      this.opts.onState?.('failed');
      return;
    }
    const iceServers = await this.opts.getIceServers?.().catch(() => DEFAULT_ICE_SERVERS) || DEFAULT_ICE_SERVERS;
    this.reportDebug('A', 'src/lib/callSession.ts:start', '[DEBUG] iceServers', {
      role: this.opts.role,
      callId: this.opts.callId,
      count: iceServers.length,
      servers: iceServers.map(s => ({
        urls: s.urls,
        hasUsername: !!s.username,
        hasCredential: !!s.credential,
      })),
    });
    const pc = new RTCPeerConnection({ iceServers });
    this.pc = pc;
    this.localStream.getTracks().forEach(t => pc.addTrack(t, this.localStream!));

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.reportDebug('A', 'src/lib/callSession.ts:onicecandidate', '[DEBUG] onicecandidate', {
          role: this.opts.role,
          callId: this.opts.callId,
          type: e.candidate.type,
          protocol: e.candidate.protocol,
          address: e.candidate.address || '',
          candidate: e.candidate.candidate.slice(0, 160),
        });
      }
      if (e.candidate) void this.sendSignal('candidate', JSON.stringify(e.candidate.toJSON()));
    };
    pc.ontrack = (e) => { this.opts.onRemoteStream?.(e.streams[0] || null); };
    pc.oniceconnectionstatechange = () => {
      this.reportDebug('D', 'src/lib/callSession.ts:oniceconnectionstatechange', '[DEBUG] iceConnectionState', {
        role: this.opts.role,
        callId: this.opts.callId,
        iceConnectionState: pc.iceConnectionState,
        iceGatheringState: pc.iceGatheringState,
        signalingState: pc.signalingState,
      });
    };
    pc.onconnectionstatechange = () => {
      this.reportDebug('D', 'src/lib/callSession.ts:onconnectionstatechange', '[DEBUG] connectionState', {
        role: this.opts.role,
        callId: this.opts.callId,
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        signalingState: pc.signalingState,
      });
      if (pc.connectionState === 'connected') this.opts.onState?.('active');
      if (pc.connectionState === 'failed') this.opts.onState?.('failed');
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') this.opts.onState?.('ended');
    };

    this.pollTimer = window.setInterval(() => { void this.pollSignals(); }, 1200);

    if (this.opts.isOfferer) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.reportDebug('B', 'src/lib/callSession.ts:start', '[DEBUG] createOffer', {
        role: this.opts.role,
        callId: this.opts.callId,
        type: offer.type,
        sdpLen: (offer.sdp || '').length,
      });
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
