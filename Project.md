# Project.md — สรุปงานที่ทำแล้ว

## 2026-07-02 (ต่อ 11)

### ปรับ UI ConsentModal — ขนาดตัวอักษร + สีปุ่ม

- ตัวอักษรทั่ว modal: 13px → 15px, line-height เพิ่มขึ้นเพื่ออ่านง่าย
- ปุ่ม "ไม่ยอมรับ / กลับ" → สีแดง (border + text #dc2626)
- ปุ่ม "ยอมรับและดำเนินการต่อ" → เขียว (#16a34a) เมื่อติ๊กแล้ว, เทาเมื่อยังไม่ติ๊ก

### ไฟล์ที่แก้ไข (2026-07-02 ต่อ 11)
- `src/components/ConsentModal.tsx`

---

## 2026-07-02 (ต่อ 10)

### เพิ่ม PDPA Consent Modal + re-apply หลัง git restore

- สร้าง `ConsentModal.tsx` — modal บัง fullscreen ก่อนเริ่มฟอร์ม แสดงนโยบาย PDPA ครบ 4 หัวข้อ
- ต้องติ๊ก checkbox ก่อนถึงจะกด "ยอมรับและดำเนินการต่อ" ได้
- กด "ไม่ยอมรับ / กลับ" → redirect กลับ `/register`
- เชื่อมกับ seller และ middleman pages

### ไฟล์ที่แก้ไข (2026-07-02 ต่อ 10)
- `src/components/ConsentModal.tsx` (ใหม่)
- `src/app/register/seller/page.tsx`
- `src/app/register/middleman/page.tsx`

---

## 2026-07-02 (ต่อ 9)

### เปลี่ยน Flow การสมัครสมาชิก — ไม่บังคับกรอกโปรไฟล์ทันที

**เดิม:** `AuthGate` บังคับทุกหน้า (ยกเว้น `/profile`) ให้กรอกโปรไฟล์ครบก่อน

**ใหม่:** ไม่บังคับทันทีหลังสมัคร — แต่ถ้าจะเข้า "หน้าบริการ" ใดๆ จะถูก redirect ไป `/profile?returnTo=<หน้าเดิม>` เพื่อกรอกให้ครบก่อน แล้วระบบพากลับหน้าเดิมโดยอัตโนมัติ

**หน้าบริการที่บังคับโปรไฟล์:** `/deal`, `/register/seller`, `/register/middleman`, `/service`, `/dashboard`, `/onsite`, `/orders`, `/messages`, `/payment`, `/cart`, `/wanted`, `/admin`

**หน้าที่ browse ได้ฟรีโดยไม่ต้องมีโปรไฟล์:** `/`, `/marketplace`, `/check-scam`, `/faq`, `/how-it-works`, `/fees`, `/terms`, `/privacy`, `/contact` ฯลฯ

### ไฟล์ที่แก้ไข (2026-07-02 ต่อ 9)
- `src/components/AuthGate.tsx` — เปลี่ยนจาก `isProfileExemptPath` เป็น `isProfileRequiredPath`, เพิ่ม `?returnTo=` param ใน redirect
- `src/app/profile/page.tsx` — import `useSearchParams`, redirect ไป `returnTo` หลัง save สำเร็จ
- `src/components/HomeButton.tsx` — ลบ `profileComplete` check (ผู้ใช้ navigate ได้อิสระแล้ว)

---

## 2026-07-01 (ต่อ 8)

### เพิ่มปุ่มเปิด/ปิดโซนตลาด (Marketplace) ในหน้า Admin Service Controls

**งานที่ทำ**:
1. `src/lib/serviceControls.ts` — เพิ่ม `'marketplace'` เข้า `ServiceControlKey` union, `SERVICE_CONTROL_DEFAULTS`, และ `SERVICE_CONTROL_CATALOG` (group "บริการเสริม")
2. `src/app/marketplace/page.tsx` — import `useServiceControls` + `ServiceDisabledNotice`, เรียก hook, เพิ่ม early return เมื่อ marketplace ถูกปิด

**ผลลัพธ์**: Admin สามารถเปิด/ปิดโซนตลาดได้จากหน้า Service Controls — เมื่อปิด ผู้ใช้จะเห็นหน้า ServiceDisabledNotice แทนที่หน้ารายการสินค้า

### ไฟล์ที่แก้ไข (2026-07-01 ต่อ 8)
- `src/lib/serviceControls.ts`
- `src/app/marketplace/page.tsx`

---

## 2026-07-01 (ต่อ 7)

### เพิ่ม OG Tag (Open Graph / Twitter Card) สำหรับ Link Preview

- `metadataBase`: `https://glanghub.com`
- `openGraph`: type=website, locale=th_TH, รูป `/og-tag.webp` (1200×630)
- `twitter`: card=summary_large_image, รูปเดียวกัน
- รองรับทุกแพลตฟอร์ม: Facebook, LINE, Twitter/X, Discord, Telegram ฯลฯ

### ไฟล์ที่แก้ไข (2026-07-01 ต่อ 7)
- `src/app/layout.tsx`

---

## 2026-07-01 (ต่อ 6)

### แก้โปรโมชันฟรีค่าสมัคร — ซ่อน QR/บัญชีธนาคารเมื่อค่าสมัครเป็น ฿0

**สาเหตุ**: เดิม condition `{membershipFee > 0}` ครอบเฉพาะส่วน slip upload — QR code และ bank transfer ยังแสดงอยู่แม้ค่าสมัครจะเป็น ฿0 → ผู้ใช้เห็น QR+บัญชี ทั้งที่ไม่ต้องจ่าย

**แก้ไข** (ทั้ง seller และ middleman pages):
1. ราคาในกล่อง fee: ถ้า `membershipFee === 0` แสดง "ฟรี!" สีเขียวแทน ฿0
2. QR section: เพิ่ม `membershipFee > 0 &&` ครอบ → ซ่อนเมื่อฟรี
3. Bank transfer section: เพิ่ม `membershipFee > 0 &&` ครอบ → ซ่อนเมื่อฟรี
4. "ฟรีค่าสมัคร" message: เปลี่ยนจาก `<p>` plain text → card สีเขียวโดดเด่น "🎉 ฟรีค่าสมัคร! ไม่ต้องโอนเงินหรือแนบสลิป"

**หมายเหตุ**: ระบบโปรโมชันทำงานถูกต้องอยู่แล้ว (`isPromoActive` + `effectiveRegFee`) — ปัญหาอยู่ที่ฝั่ง UI ที่ยังแสดงส่วนชำระเงินแม้ค่าสมัครจะเป็น 0

### ไฟล์ที่แก้ไข (2026-07-01 ต่อ 6)
- `src/app/register/seller/page.tsx`
- `src/app/register/middleman/page.tsx`

---

## 2026-07-01 (ต่อ 5)

### แก้บัค: เข้าดีลที่จบแล้วถูก redirect ออกทันที

**สาเหตุ**: `ReviewPanel.tsx` บรรทัด 180 — `if (already) onReviewed?.()` เรียก callback ตอนโหลดหน้า ถ้ารีวิวแล้ว แต่ `onReviewed` ใน `renderWizardStep8()` (simple wizard) ยังมี `router.push('/')` หลงเหลืออยู่ → ทุกครั้งที่เปิดหน้าดีลที่จบแล้ว → auto-redirect กลับหน้าหลักทันที

**แก้ไข**: ลบ `router.push('/')` ออกจาก `onReviewed` callback ใน `renderWizardStep8()` (บรรทัด 2778) → เหลือเพียง `setCompletionReviewed(true); setCompletionSending(false);` (เหมือนกับ regular wizard และ meetup wizard ที่แก้ไปแล้ว)

### ไฟล์ที่แก้ไข (2026-07-01 ต่อ 5)
- `src/app/deal/[id]/page.tsx`

---

## 2026-07-01 (ต่อ 4)

### แก้ 500 error บน /api/upload-deal (Unauthorized)

**สาเหตุ**: `verifyUser` throw `HttpError('Unauthorized', 401)` แต่ `catch` block ใน route คืน 500 เสมอ + `uploadFile`/`uploadMeetupSlip` ใช้ `getAuthHeaders()` แบบไม่ force-fresh

**แก้ไข**:
1. `upload-deal/route.ts` — `catch` block ตรวจสอบ `err.status` (HttpError) แล้วคืน status นั้นแทน 500
2. `page.tsx` → `uploadFile` — เปลี่ยนเป็น `getAuthHeaders(true)` + เช็ค `!headers.Authorization` + จัดการ 401 แยก (ล้าง cache + แจ้งเข้าระบบใหม่)
3. `page.tsx` → `uploadMeetupSlip` — แก้เหมือนกัน

### ไฟล์ที่แก้ไข (2026-07-01 ต่อ 4)
- `src/app/api/upload-deal/route.ts`
- `src/app/deal/[id]/page.tsx`

---

## 2026-07-01 (ต่อ 3)

### ป้องกันฝ่ายเดียวเปลี่ยน step + บังคับหลักฐาน + completion meetup

1. **แก้ getRegularStep()** — `reviewStarted` เปลี่ยนจาก `||` → `&&` ต้องครบทุกฝ่ายกด chat_done ถึงจะข้าม step คุย
2. **step 7 meetup (เจอกัน)** — เพิ่มส่วน upload หลักฐาน type='meet', ปุ่ม "เจอกันแล้ว" disabled จนกว่าจะอัปโหลดอย่างน้อย 1 ชิ้น, เพิ่ม ref `meetupMeetEvidInputRef`
3. **step 8 meetup (รอคืนเงิน)** — เพิ่ม gallery สลิปประกัน + หลักฐานเจอกัน + completion review system (🔒→💾→🏠)
4. **step 9 meetup (จบ)** — เพิ่ม gallery สลิปทั้งหมด (ประกัน+คืนเงิน) + หลักฐาน + completion review system เหมือนกัน

### ไฟล์ที่แก้ไข (2026-07-01 ต่อ 3)
- `src/app/deal/[id]/page.tsx`

---

## 2026-07-01 (ต่อ 2)

### ซ่อนปุ่ม "เก็บหลักฐาน" จากผู้ส่งรูปเอง
- บรรทัด 2184 (simple wizard): เพิ่ม `!isMe` → `{isMedia && !isMe && <span ...>{pinBtn(m, true)}</span>}`
- บรรทัด 4324 (regular wizard): เพิ่ม `!isMe` → `{!isMe && <span ...>{pinBtn(m)}</span>}`
- ผลลัพธ์: ปุ่ม "📌 เก็บหลักฐาน" แสดงเฉพาะฝ่ายที่รับรูป ไม่แสดงให้คนส่งเอง

### แก้ปุ่ม "บันทึกหลักฐาน-จบดีล" ไม่เด้งหน้าหลักทันที
- `onReviewed` callback (ทั้ง 2 จุด): ลบ `router.push('/')` ออก → set `completionReviewed(true)` เท่านั้น
- ผลลัพธ์: หลังกด บันทึกหลักฐาน-จบดีล → ปุ่มเปลี่ยนเป็น "🏠 เสร็จสิ้น-กลับหน้าหลัก" → กดปุ่มนั้นถึงจะเด้งไปหน้าหลัก

### ไฟล์ที่แก้ไข (2026-07-01 ต่อ 2)
- `src/app/deal/[id]/page.tsx`

---


## 2026-07-01 (ต่อ)

### แก้บัค: กด "📌 เก็บหลักฐาน" แล้ว step ขึ้นทันที (ทั้งผู้ซื้อและขายแสดง ✅ ยืนยันแล้ว โดยไม่ได้กด)
- **สาเหตุ**: `hasProgressPing()` อ่าน system message จาก DB ที่ persist ถาวร — ถ้าเคยทดสอบผ่านขั้น "คุยกันจบแล้ว" ไปแล้ว ข้อความของทั้ง 2 ฝ่ายยังคงอยู่ใน DB เมื่อ `fetchMsgs` รีเฟรช → `hasProgressPing` return true ทั้ง 2 ฝ่าย → `getSimpleStep()` คืน step 3 → wizard ขึ้นทันที
- **แก้ไข**: เพิ่ม `chat_done_seller/buyer/middleman` boolean ใน `deal_price_state` (migration `0012_chat_done_flags.sql`)
  - `progress_ping` action ใน `route.ts` → set `priceUpdates = { chat_done_<role>: true }` แทนแค่ systemMsg
  - `getSimpleStep()` และ `getRegularStep()` → ใช้ `!!pd.chat_done_*` แทน `hasProgressPing()`
  - `renderWizardStepChat()` → เพิ่ม `pd` variable, ใช้ `!!pd.chat_done_*` แทน `hasProgressPing()`
  - `hasProgressPing()` function ยังคงไว้แต่ไม่ถูก call อีกต่อไป

### ไฟล์ที่แก้ไข (2026-07-01 ต่อ)
- `supabase/migrations/0012_chat_done_flags.sql` (ใหม่)
- `supabase/schema.sql`
- `src/app/api/deals/[id]/route.ts`
- `src/app/deal/[id]/page.tsx`

---


## 2026-06-29 → 2026-06-30

### หน้าสร้างดีลนัดรับ (`/service/meetup`)
- ออกแบบหน้าสร้างดีล step=2 ใหม่ให้ใช้รูปแบบเดียวกับ `/deal/create`
- เพิ่ม `useEffect` sync step จาก `useSearchParams` แก้บัค Next.js same-route navigation ไม่ re-mount
- เปลี่ยน EzDrive card จาก `<Link href="/service/meetup?step=2">` → `<div onClick={() => setStep(2)}>` ให้กดรูปภาพแล้วแสดง form ทันทีโดยไม่เปลี่ยน URL

### ดีล Wizard — ขั้นตอนที่ 2/14 (regular deal)
- คนกลางสามารถกำหนดค่าบริการคนกลาง (`proposed_mm_fee`) และค่าตรวจสอบสินค้า (`proposed_inspection_fee`) เอง
- ผู้ซื้อ/ผู้ขายมี Pop-up แสดงราคาที่คนกลางเสนอ พร้อมปุ่มยืนยัน
- เพิ่ม action `propose_mm_fees` และ `accept_mm_fees` ใน `/api/deals/[id]/route.ts`
- เพิ่ม field ใน `DealPriceState`: `proposed_mm_fee`, `proposed_inspection_fee`, `mm_fee_accepted_seller`, `mm_fee_accepted_buyer`

### โลโก้กลางฮับ (`DealFlowBrand`)
- มีอยู่แล้วใน `renderMeetupWizard()` (line 3760 ของ `deal/[id]/page.tsx`) และ `renderSimpleWizard()` ครบทุก step แล้ว

### ไฟล์ที่แก้ไข
- `src/app/service/meetup/page.tsx`
- `src/app/deal/[id]/page.tsx`
- `src/app/api/deals/[id]/route.ts`

---

## 2026-06-30 (ต่อ 4)

### ดาวที่ยังไม่ได้เลือก — ข้างในใช้สีขาว
- `.rv-star` (unselected): `background: #fff`, SVG ใช้ `fill: none; stroke: currentColor; stroke-width: 1.5px`
- `.rv-star.on` (selected): `background: linear-gradient(...)`, SVG ใช้ `fill: currentColor; stroke: none`
- แก้ไขใน `src/app/globals.css`

### หน้าเสร็จสมบูรณ์ — แสดงหลักฐานและรีวิวทุกฝ่าย
- `renderWizardStep8()` เพิ่ม card "📁 หลักฐานทั้งหมดในดีล" แสดงทุกประเภท (packing/receive/inspection/chat)
- `ReviewPanel` ดึง `?all=true` เพื่อรวบรวมรีวิวจากทุกฝ่าย และแสดงผ่าน `AllReviewsSummary`
- `AllReviewsSummary` — card แสดงดาวและ tags ของแต่ละ reviewer จัดกลุ่มตาม role
- API `GET /api/reviews?dealId=...&all=true` — ส่งคืนรีวิวทั้งหมดในดีล

### ไฟล์ที่แก้ไข
- `src/app/globals.css`
- `src/app/deal/[id]/page.tsx`
- `src/components/ReviewPanel.tsx`
- `src/app/api/reviews/route.ts`

---

## 2026-07-01

### ค่าบริการหารครึ่ง — แสดงรายละเอียดจำนวนเงินต่อคน
- `renderPricePanel()`: เพิ่ม `fpNameWithAmount()` helper คำนวณ `Math.round(total/2)` และแสดง "หารครึ่ง (คนละ ฿X)" แทน "หารครึ่ง" เฉยๆ
- `renderWizardStepPrice()`: กล่อง "ราคาปัจจุบัน" แสดง "ค่าบริการรวม ฿X · หารครึ่ง (คนละ ฿Y)"

### ปุ่มเสร็จสิ้น + รีวิวบังคับในหน้าจบดีล
- เพิ่ม `completionReviewed`, `completionAllRated`, `completionSubmitTrigger`, `completionSending` states ใน DealRoom
- `ReviewPanel`: redesign เป็น "headless submit" — ลบปุ่ม "ส่งรีวิว" ออก, เพิ่ม props `onRatedChange`, `externalSubmitTrigger`, `onSubmitError`
- `externalSubmitTrigger`: พ่อ (page.tsx) increment → ReviewPanel submit เอง ผ่าน submitRef pattern (แก้ stale closure)
- `onRatedChange(bool)`: ReviewPanel แจ้งพ่อทุกครั้งที่ allRated เปลี่ยน → พ่อ enable/disable ปุ่ม
- Fix "รีวิวไม่แสดงทันที": `headers.Authorization` ยังไม่พร้อม → `setReviewed(false)` ทันที; ขณะโหลดแสดง "⏳ กำลังโหลด..."
- ปุ่มใน completion pages มี 3 state: `🔒 บันทึกหลักฐาน-จบดีล` (disabled) → `💾 บันทึกหลักฐาน-จบดีล` (กดได้เมื่อดาวครบ → ส่งรีวิว+ไปหน้าหลัก) → `🏠 เสร็จสิ้น-กลับหน้าหลัก` (รีวิวแล้ว)
- ลบปุ่ม "คัดลอกลิงก์แชร์" ออกจาก guest join panel

### ไฟล์ที่แก้ไข (2026-07-01)
- `src/app/deal/[id]/page.tsx`
- `src/components/ReviewPanel.tsx`

---

## 2026-06-30 (ต่อ 5)

### หน้าจบดีล — แสดงสลิปทุกใบ + หลักฐานแชท/วิดีโอคอล
- `renderWizardStep8()` และ `renderRStep14()`: เปลี่ยนจากแสดงสลิปใบเดียว → รวบรวมสลิปทุกใบ (buyer/seller/payout/refund) แสดงเป็น grid
- เพิ่ม `chat` และ `call` evidence type ใน filter (ครอบคลุมหลักฐานแชทและวิดีโอคอล)
- `renderRStep14()` เพิ่ม evidence gallery ครบทุกประเภทเหมือน simple wizard

### หน้าแอดมิน — เพิ่ม evidence ทุกประเภท
- `parcelEvidenceOf()` ใน admin/deals: เพิ่ม `inspection`, `chat`, `call` ใน filter + labelMap
- เปลี่ยนหัวข้อจาก "หลักฐานพัสดุจากคู่ดีล" → "หลักฐานทั้งหมดในดีล"

### ไฟล์ที่แก้ไข
- `src/app/deal/[id]/page.tsx`
- `src/app/admin/deals/page.tsx`
getSimpleStep()` คืน step 2 ผิดพลาด → `step3PendingRef = 2` → กด "เข้าใจแล้ว" → `setWzViewStep(2)` → ค้างที่ step 2 ถาวร popup ตอนนี้ trigger เฉพาะจาก `goToSimpleStep()` step 1→2
3. **reload กลับ step 2**: เพิ่ม `msgsLoaded` state — ถ้า msgs ยังไม่โหลดและอยู่ใน payment_pending ที่ยังไม่มี evidence → แสดง "กำลังโหลด..." แทนที่จะ flash ไป step 2 ก่อน

---

## 2026-06-30 (ต่อ 3)

### step 8 รับสินค้า — แสดงหลักฐานแพ็คสินค้าจากผู้ขาย
- เพิ่ม card "📦 หลักฐานแพ็คสินค้าจากผู้ขาย" ใน `renderWizardStep6()` ฝั่งผู้ซื้อ
- แสดง 3 slot (`evidence.filter(e => e.type === 'packing')`) ก่อน tracking card และ section วิดีโอแกะกล่อง
- ถ้าผู้ขายยังไม่ได้ upload เลย → card ไม่แสดง (conditional render)
- slot ที่ upload แล้วแสดงรูป/วิดีโอ ส่วน slot ที่ว่างแสดงตัวเลข ghost

### ไฟล์ที่แก้ไข
- `src/app/deal/[id]/page.tsx`
