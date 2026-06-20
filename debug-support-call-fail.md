# Debug Session: support-call-fail
- **Status**: [OPEN]
- **Issue**: ลูกค้าโทรหา admin แล้วฝั่ง admin รับสาย จากนั้นเด้งกลับไปให้ลูกค้ารับสาย แต่พอลูกค้ารับสายแล้วขึ้นว่าเชื่อมต่อไม่สำเร็จ
- **Debug Server**: pending
- **Log File**: .dbg/trae-debug-log-support-call-fail.ndjson

## Reproduction Steps
1. ลูกค้าเปิดแชตซัพพอร์ตแล้วกดโทร
2. Admin เปิดหน้า `admin/support` แล้วกดรับสายหรือโทรกลับ
3. ลูกค้าเห็นสายเข้าและกดรับสาย
4. ระบบขึ้น `เชื่อมต่อไม่สำเร็จ`

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | `iceServers` ที่ client ได้จริงไม่มี TURN usable candidate | High | Med | Confirmed: ทั้งสองฝั่งได้แค่ STUN 1 ชุด ไม่มี username/credential และไม่พบ relay candidate |
| B | state `staff_ringing -> connecting -> active` สลับผิดจังหวะ ทำให้ offer/answer หรือ ICE ข้ามรอบ | High | Med | Partial: พบ flow customer-request ยังเด้งกลับไปให้ลูกค้ารับสายอีกรอบ จึงแก้ `approve -> connecting` |
| C | signaling route ส่งได้ไม่ครบทั้งสองฝั่ง หรือฝั่งหนึ่ง poll ไม่ทัน | Med | Med | Rejected: offer/answer/candidate ไปถึงทั้งสองฝั่งครบ |
| D | `getUserMedia` ผ่าน แต่ `RTCPeerConnection` fail ที่ ICE/connection state เพราะ relay ใช้งานไม่ได้จริง | High | Med | Confirmed: ทั้งสองฝั่งลง `connectionState=failed`, `iceConnectionState=disconnected` หลัง signaling ครบ |

## Log Evidence
- 2026-06-20: หน้า production `https://khonklang.vercel.app/admin/support` ถูก browser บล็อก debug reporting เดิม เพราะยิงไป `http://192.168.1.38:7777/event`
- Browser console แสดง `Mixed Content` และ `net::ERR_CONNECTION_REFUSED`
- ข้อสรุปชั่วคราว: instrumentation ชุดแรกเก็บ runtime evidence จาก production ไม่ได้ จึงเปลี่ยนเป็น same-origin debug route ผ่าน `https`
- 2026-06-20 post-deploy: `customer getIceServers` และ `admin getIceServers` คืนค่า `count: 1` เป็น STUN only ไม่มี TURN credential
- 2026-06-20 post-deploy: `handleSignal` เห็น `offer`, `answer`, และ `candidate` ครบสองฝั่ง
- 2026-06-20 post-deploy: ทั้ง customer และ staff จบที่ `connectionState=failed` และ `iceConnectionState=disconnected`
- 2026-06-20 post-deploy: customer-initiated flow ยังต้องให้ลูกค้ากดรับซ้ำหลัง admin approve จึงเตรียมแก้ `approve -> connecting`

## Verification Conclusion
- Pending runtime reproduce after deploy of same-origin debug logging
