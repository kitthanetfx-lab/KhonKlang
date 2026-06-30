# Project.md — สรุปงานที่ทำแล้ว

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
- เพิ่ม `completionReviewed` state ใน DealRoom
- `ReviewPanel`: เพิ่ม `onReviewed?: () => void` prop — เรียกเมื่อรีวิวสำเร็จ หรือตรวจพบว่ารีวิวแล้ว (on load)
- Fix "รีวิวไม่แสดงทันที": เมื่อ `headers.Authorization` ยังไม่พร้อม → `setReviewed(false)` แสดงฟอร์มก่อน ไม่ต้อง refresh; ขณะ loading แสดง skeleton "⏳ กำลังโหลด..."
- `renderWizardStep8()` และ `renderRStep14()`: เพิ่มปุ่ม "🏠 บันทึกดีลไว้เป็นหลักฐาน — กลับหน้าหลัก" ที่ enabled เมื่อ `completionReviewed === true`; ก่อนรีวิวแสดงเป็น "🔒 กรุณาให้คะแนนรีวิวก่อน" (disabled)

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
