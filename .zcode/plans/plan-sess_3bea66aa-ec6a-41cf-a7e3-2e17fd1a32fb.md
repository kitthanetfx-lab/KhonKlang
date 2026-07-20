# แผนแก้บั๊กคอล/วิดีโอ 4 ข้อ (ตัดข้อ 3 layout menu ออกตามที่ยืนยัน)

## สรุป Root Cause (เปลี่ยนจากที่เคยแก้ผิดจุด)

| ข้อ | ที่เคยแก้ผิด | **Root cause จริง** |
|---|---|---|
| 1 | — | `declineIncomingCall()` แค่ mark local ไม่ส่งสัญญาณ + end-detect effect ตรวจเฉพาะตอน `active` ไม่รวม `outgoing` |
| 2 | บังคับ `aspect-ratio:9/16` ทุก tile | tile ไม่อ่านขนาดจริงของ video track + ฝั่งคอมถูกบังคับ capture portrait (540×960) |
| 4 | ย้าย call toast ไปกลางจอ (แต่ call toast อยู่กลางจออยู่แล้ว) | **ตัวการจริง** = `.nb-panel` dropdown กระดิ่ง ใช้ `right:0` บนปุ่ม 42px → ยื่นออกซ้ายขอบจอ |
| 5 | ใส่ aspect-ratio + width ให้ tile | **ตัวการจริง** = JSX `ParticipantTile` render `<VideoTrack>` ทันทีที่มี publication แม้ track ยังไม่ flow → เจอหน้าดำ แก้ CSS เท่าไหร่ก็ไม่หาย |

---

## ข้อ 1 — ฝั่งรับปฏิเสธ/วางสาย → ฝั่งโทรรู้ทันที

**ไฟล์**: `src/app/deal/[id]/page.tsx`

**1.1** แก้ `declineIncomingCall()` (บรรทัด 1186-1189) ให้ส่ง PATCH `end_call` กลับไปฝั่งโทร:
```tsx
function declineIncomingCall() {
  if (!incomingCall) return;
  setDismissedCallIds(prev => new Set(prev).add(incomingCall.msgId));
  activeCallMsgIdRef.current = incomingCall.msgId;  // เก็บ id ไว้เพื่อ detect ฝั่งเรา
  // ส่งสัญญาณปฏิเสธกลับ → ฝั่งโทรจะเห็น 📞|end ทันที
  if (myId) {
    (async () => {
      const headers = await getAuthHeaders();
      await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end_call' }),
      }).catch(() => {});
    })();
  }
}
```

**1.2** แก้ useEffect ตรวจจับ `📞|end` (บรรทัด 972-990) ให้ตรวจทั้งตอน `active` และ `outgoing` + แยกข้อความ:
```tsx
useEffect(() => {
  // ฝั่งโทร(outgoing) ต้องเห็น 📞|end ตอนรอสายด้วย → ถ้าถูกปฏิเสธจะได้หยุด ringing ทันที
  if ((!isActiveCall && callStatus !== 'outgoing') || !activeCallMsgId) return;
  const startIdx = msgs.findIndex(m => m.id === activeCallMsgId);
  if (startIdx < 0) return;
  for (let i = startIdx + 1; i < msgs.length; i += 1) {
    const m = msgs[i];
    if (m.role === 'system' && m.content.startsWith('📞|end')) {
      // ถ้าตอน active = วางสายกลางคัน, ถ้าตอน outgoing = ปฏิเสธสายเรียกเข้า
      const wasRinging = callStatus === 'outgoing';
      setCallEndedReason(wasRinging
        ? { title: '📵 อีกฝ่ายปฏิเสธสาย', sub: 'อีกฝ่ายไม่รับสาย' }
        : { title: '📞 วางสายแล้ว', sub: 'อีกฝ่ายวางสาย' });
      setCallStatus('idle');
      setCallSeconds(0);
      setCallMode('video');
      activeCallMsgIdRef.current = null;
      setActiveCallMsgId(null);
      return;
    }
  }
}, [msgs, isActiveCall, callStatus, activeCallMsgId]);
```

---

## ข้อ 2 — Orientation auto (มือถือแนวตั้ง / คอมแนวกว้าง)

**ไฟล์**: `src/components/DealVideoCall.tsx` + `src/app/globals.css`

**2.1** `DealVideoCall.tsx` — ย้าย ROOM_OPTIONS จาก module-level เป็น `useMemo` ใน component ตาม device:
```tsx
import { useMemo } from 'react';
// ...
export default function DealVideoCall({ ... }) {
  // detect ครั้งเดียว — มือถือจะเป็น portrait (540×960), คอมเป็น landscape (960×540)
  const isMobile = useMemo(() => {
    if (typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches) return true;
    return false;
  }, []);
  const roomOptions = useMemo(() => ({
    ...BASE_ROOM_OPTIONS,
    videoCaptureDefaults: {
      resolution: isMobile
        ? { width: 540, height: 960, frameRate: 24 }   // portrait
        : { width: 960, height: 540, frameRate: 24 },  // landscape (เว็บแคม)
    },
  }), [isMobile]);
}
```
(`BASE_ROOM_OPTIONS` ยังเป็น module-level constant แต่ไม่มี `videoCaptureDefaults` แล้ว)

**2.2** `ParticipantTile` — อ่าน `dimensions` จาก track → ตั้ง inline `aspectRatio`:
```tsx
function ParticipantTile({ participant, isVideo, cameraRef, ... }) {
  const camPub = cameraRef?.publication;
  const camTrack = cameraRef?.track;
  // อ่านขนาดจริงของ track — fallback ตาม device orientation
  const dim = (camTrack as any)?.dimensions || (camPub as any)?.dimensions;
  const aspectRatio = dim?.width && dim?.height ? `${dim.width} / ${dim.height}` : undefined;
  // ...
  const tileStyle = aspectRatio ? { aspectRatio } : undefined;
  return <div className="lk-tile" style={tileStyle}>{inner}</div>;
}
```

**2.3** `globals.css` — ลบ `aspect-ratio: 9/16` ออกจาก `.lk-tile` ในทั้ง 2 media queries (บรรทัด 2660-2663, 2668) แล้วให้ tile ใช้ inline style เป็นตัวกำหนด สำรอง fallback ที่ base rule:
```css
.lk-tile {
  position: relative; background: #111; overflow: hidden;
  border-radius: 8px; display: flex; align-items: center; justify-content: center;
  aspect-ratio: 9 / 16;  /* fallback ก่อน track บอกขนาดจริง — inline style จะ override */
}
@media (max-width: 720px) {
  .lk-split { flex-direction: column; max-width: 100%; }
  .lk-tile { flex: 1 1 0; min-height: 0; max-height: 70vh; width: 100%; }
  /* ลบ aspect-ratio:9/16 ออก — ให้ inline style บน tile เป็นตัวกำหนด */
}
@media (min-width: 721px) {
  .lk-split { flex-direction: row; }
  .lk-tile { flex: 1 1 0; min-width: 0; max-width: 360px; max-height: 85vh; }
}
```

---

## ข้อ 4 — NotifyBell dropdown ตกขอบจอ

**ไฟล์**: `src/app/globals.css` (บรรทัด 2514)

เปลี่ยน `.nb-panel` จาก `position: absolute; right: 0` (ที่ทำให้ panel ยื่นออกซ้ายขอบจอบนปุ่ม 42px) เป็น **fixed + centered horizontally** ตามแบบ `.dr-call-timeout-toast`:
```css
.nb-panel {
  position: fixed;                              /* เปลี่ยนจาก absolute */
  top: 70px;                                    /* ใต้ header (~64px) เผื่อ 6px */
  left: 50%;                                    /* เพิ่ม — กลางจอแนวนอน */
  transform: translateX(-50%);                  /* เพิ่ม — ดึงกลับครึ่งหนึ่ง */
  width: min(92vw, 380px);
  background: var(--surface); border: 1px solid var(--line);
  border-radius: var(--r-md); box-shadow: var(--sh-lg);
  z-index: 100;                                 /* สูงกว่า header (~30-50) แต่ต่ำกว่า ringing overlay (200) */
  overflow: hidden;
}
```
**ไม่**ใช้ keyframe `drCenterIn` เพราะมันฝัง `translate(-50%,-50%)` ซึ่งจะดึง panel ไปกลางจอแนวตั้ง (ทับ content) — ใช้ `translateX(-50%)` อย่างเดียวพอ

---

## ข้อ 5 — วิดีโอคอลมือถือดำ (root cause: track ยังไม่ flow แต่ render VideoTrack แล้ว)

**ไฟล์**: `src/components/DealVideoCall.tsx` (ParticipantTile)

**5.1** Import `TrackEvent` + `RemoteVideoTrack` จาก livekit-client:
```tsx
import { Track, AudioPresets, TrackEvent, type Participant, type RemoteVideoTrack, type LocalVideoTrack } from 'livekit-client';
```

**5.2** ใน `ParticipantTile` เพิ่ม state `hasFrame` ที่ track เริ่ม flow จริง (มี video dimensions) แล้วใช้ gate `<VideoTrack>`:
```tsx
function ParticipantTile({ participant, isVideo, cameraRef, micRef, pip, speakerVolume = 1 }: TileProps) {
  const isLocal = participant.isLocal;
  const name = participant.name || participant.identity || 'ผู้ใช้';
  const muted = !!micRef?.publication?.isMuted;
  const speaking = !muted && (participant.isSpeaking || false);

  const camTrack = cameraRef?.track;
  const [hasFrame, setHasFrame] = useState(false);

  // track ตัวไหนมี frame แรก → set hasFrame=true (เลิกแสดง placeholder)
  useEffect(() => {
    setHasFrame(false);
    if (!camTrack || !isVideo) return;
    // local track แสดงได้ทันที (publish แล้วก็ attach element เอง)
    if (camTrack.isLocal) { setHasFrame(true); return; }
    // remote track — รอจนกว่า dimensions จะ > 0 (= มี frame แรก)
    const check = () => {
      const dims = (camTrack as RemoteVideoTrack).dimensions;
      if (dims && dims.width > 0 && dims.height > 0) setHasFrame(true);
    };
    check();
    camTrack.on(TrackEvent.VideoDimensionsChanged, check);
    camTrack.on(TrackEvent.TrackMuted, () => setHasFrame(false));
    return () => {
      camTrack.off(TrackEvent.VideoDimensionsChanged, check);
    };
  }, [camTrack, isVideo]);

  // hasVideo ต้องมีทั้ง publication + frame จริง → กันหน้าดำ
  const hasVideo = isVideo && !!cameraRef && hasFrame;
  // ... (rest unchanged, hasVideo gate now blocks VideoTrack until frames arrive)
}
```

---

## ไฟล์ที่แก้ (3 ไฟล์)
1. **`src/app/deal/[id]/page.tsx`** — `declineIncomingCall` ส่ง end_call + end-detect effect ตรวจตอน outgoing + ข้อความแยก "ปฏิเสธ/วางสาย"
2. **`src/components/DealVideoCall.tsx`** — ROOM_OPTIONS เป็น useMemo ตาม device + ParticipantTile อ่าน dimensions (ข้อ 2) + gate VideoTrack ด้วย hasFrame (ข้อ 5)
3. **`src/app/globals.css`** — `.nb-panel` เป็น fixed centered (ข้อ 4) + ลบ aspect-ratio hardcoded จาก .lk-tile media queries (ข้อ 2)

## ลำดับทำ
1. ข้อ 4 (CSS `.nb-panel`) — เร็ว ทำก่อนเพื่อทดสอบทันทีว่า dropdown ไม่ตกขอบแล้ว
2. ข้อ 1 (page.tsx decline + end-detect) — ทดสอบโทรแล้วปฏิเสธดูว่าฝั่งโทรหยุด ringing ทันที
3. ข้อ 2+5 (DealVideoCall.tsx) — ทำพร้อมกันเพราะเกี่ยวข้องกัน: orientation auto + track flow detection
4. type-check (`npx tsc --noEmit`) + lint

## ข้อควรระวัง
- `TrackEvent.VideoDimensionsChanged` มีอยู่ใน livekit-client@2.20.1 ✓ (verified)
- ฝั่ง local track `camTrack.isLocal` → แสดง VideoTrack เลยเพราะ publish + attach element แล้ว (LiveKit จัดการเอง)
- เมื่อเพิ่ม `hasFrame` gate → tile จะแสดง placeholder สักครู่ (avatar + "กำลังเชื่อมต่อกล้อง…") ก่อน video จะ flow — เป็น UX ที่ถูกต้อง ไม่ใช่หน้าดำ
- การ reset `hasFrame=false` ทุกครั้งที่ `camTrack` เปลี่ยน → ป้องกัน tile ค้างเป็น video เก่า
- inline `aspectRatio` อาจเป็น `undefined` ก่อน track ส่ง dimensions มา → tile ใช้ fallback `9/16` จาก base CSS จนกว่าจะรู้ขนาดจริง (1-2 วิแรก)
- ผู้ใช้คนเดียวที่เป็นทั้งคอมและมือถือ (tablet) → `matchMedia` ดีกว่า userAgent เพราะ responsive real-time; ใช้ทั้งคู่เพื่อความปลอดภัย