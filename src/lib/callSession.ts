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

  private async sendSignal(type: string, data: string) {
    try {
      // #region debug-point C:send-signal
      fetch("http://192.168.1.38:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"support-call-fail",runId:"pre-fix",hypothesisId:"C",location:"src/lib/callSession.ts:sendSignal",msg:"[DEBUG] sendSignal",data:{role:this.opts.role,callId:this.opts.callId,type,customerId:this.opts.customerId||"",size:data.length},ts:Date.now()})}).catch(()=>{});
      // #endregion
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
        // #region debug-point C:poll-signals
        fetch("http://192.168.1.38:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"support-call-fail",runId:"pre-fix",hypothesisId:"C",location:"src/lib/callSession.ts:pollSignals",msg:"[DEBUG] pollSignals",data:{role:this.opts.role,callId:this.opts.callId,since:this.since,count:signals.length,types:signals.map(s=>s.type)},ts:Date.now()})}).catch(()=>{});
        // #endregion
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
      // #region debug-point C:handle-signal
      fetch("http://192.168.1.38:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"support-call-fail",runId:"pre-fix",hypothesisId:"C",location:"src/lib/callSession.ts:handleSignal",msg:"[DEBUG] handleSignal",data:{role:this.opts.role,callId:this.opts.callId,type:s.type,fromRole:s.fromRole,createdAt:s.createdAt},ts:Date.now()})}).catch(()=>{});
      // #endregion
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
      // #region debug-point D:get-user-media-start
      fetch("http://192.168.1.38:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"support-call-fail",runId:"pre-fix",hypothesisId:"D",location:"src/lib/callSession.ts:start",msg:"[DEBUG] getUserMedia:start",data:{role:this.opts.role,callId:this.opts.callId,isOfferer:this.opts.isOfferer,customerId:this.opts.customerId||""},ts:Date.now()})}).catch(()=>{});
      // #endregion
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      // #region debug-point D:get-user-media-ok
      fetch("http://192.168.1.38:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"support-call-fail",runId:"pre-fix",hypothesisId:"D",location:"src/lib/callSession.ts:start",msg:"[DEBUG] getUserMedia:ok",data:{role:this.opts.role,callId:this.opts.callId,tracks:this.localStream.getAudioTracks().map(t=>({enabled:t.enabled,readyState:t.readyState,label:t.label}))},ts:Date.now()})}).catch(()=>{});
      // #endregion
    } catch {
      // #region debug-point D:get-user-media-fail
      fetch("http://192.168.1.38:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"support-call-fail",runId:"pre-fix",hypothesisId:"D",location:"src/lib/callSession.ts:start",msg:"[DEBUG] getUserMedia:fail",data:{role:this.opts.role,callId:this.opts.callId},ts:Date.now()})}).catch(()=>{});
      // #endregion
      this.opts.onState?.('failed');
      return;
    }
    const iceServers = await this.opts.getIceServers?.().catch(() => DEFAULT_ICE_SERVERS) || DEFAULT_ICE_SERVERS;
    // #region debug-point A:ice-servers
    fetch("http://192.168.1.38:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"support-call-fail",runId:"pre-fix",hypothesisId:"A",location:"src/lib/callSession.ts:start",msg:"[DEBUG] iceServers",data:{role:this.opts.role,callId:this.opts.callId,count:iceServers.length,servers:iceServers.map(s=>({urls:s.urls,hasUsername:!!s.username,hasCredential:!!s.credential}))},ts:Date.now()})}).catch(()=>{});
    // #endregion
    const pc = new RTCPeerConnection({ iceServers });
    this.pc = pc;
    this.localStream.getTracks().forEach(t => pc.addTrack(t, this.localStream!));

    pc.onicecandidate = (e) => {
      // #region debug-point A:ice-candidate
      if (e.candidate) fetch("http://192.168.1.38:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"support-call-fail",runId:"pre-fix",hypothesisId:"A",location:"src/lib/callSession.ts:onicecandidate",msg:"[DEBUG] onicecandidate",data:{role:this.opts.role,callId:this.opts.callId,type:e.candidate.type,protocol:e.candidate.protocol,address:e.candidate.address||"",candidate:e.candidate.candidate.slice(0,160)},ts:Date.now()})}).catch(()=>{});
      // #endregion
      if (e.candidate) void this.sendSignal('candidate', JSON.stringify(e.candidate.toJSON()));
    };
    pc.ontrack = (e) => { this.opts.onRemoteStream?.(e.streams[0] || null); };
    pc.oniceconnectionstatechange = () => {
      // #region debug-point D:ice-connection-state
      fetch("http://192.168.1.38:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"support-call-fail",runId:"pre-fix",hypothesisId:"D",location:"src/lib/callSession.ts:oniceconnectionstatechange",msg:"[DEBUG] iceConnectionState",data:{role:this.opts.role,callId:this.opts.callId,iceConnectionState:pc.iceConnectionState,iceGatheringState:pc.iceGatheringState,signalingState:pc.signalingState},ts:Date.now()})}).catch(()=>{});
      // #endregion
    };
    pc.onconnectionstatechange = () => {
      // #region debug-point D:connection-state
      fetch("http://192.168.1.38:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"support-call-fail",runId:"pre-fix",hypothesisId:"D",location:"src/lib/callSession.ts:onconnectionstatechange",msg:"[DEBUG] connectionState",data:{role:this.opts.role,callId:this.opts.callId,connectionState:pc.connectionState,iceConnectionState:pc.iceConnectionState,signalingState:pc.signalingState},ts:Date.now()})}).catch(()=>{});
      // #endregion
      if (pc.connectionState === 'connected') this.opts.onState?.('active');
      if (pc.connectionState === 'failed') this.opts.onState?.('failed');
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') this.opts.onState?.('ended');
    };

    this.pollTimer = window.setInterval(() => { void this.pollSignals(); }, 1200);

    if (this.opts.isOfferer) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      // #region debug-point B:create-offer
      fetch("http://192.168.1.38:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"support-call-fail",runId:"pre-fix",hypothesisId:"B",location:"src/lib/callSession.ts:start",msg:"[DEBUG] createOffer",data:{role:this.opts.role,callId:this.opts.callId,type:offer.type,sdpLen:(offer.sdp||"").length},ts:Date.now()})}).catch(()=>{});
      // #endregion
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
