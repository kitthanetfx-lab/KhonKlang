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

## 2026-06-30

### Simple Wizard — แก้บัค step ข้ามไป 3 โดยฝ่ายเดียวกด
- `getSimpleStep()`: เปลี่ยน `reviewStarted = ... || chatReviewReady` → `reviewStarted = sellerReviewStarted && buyerReviewStarted`
- ต้องครบทั้งสองฝ่ายกด "คุยกันจบแล้ว" ก่อน ถึงจะข้ามไป step 3 พร้อมกัน
- ลบ `setWzViewStep(nextStep)` ออกจากปุ่ม — ผู้ที่กดแล้วยังค้าง step 2 แสดง "รออีกฝ่ายยืนยัน"
- เมื่อทั้งคู่กดแล้ว polling ดึง step 3 อัตโนมัติ

### ปุ่ม "เก็บหลักฐาน" ใต้รูปในแชท
- ออกแบบ `pinBtn(m, true)` ใหม่เป็น pill button: พื้นหลังสีฟ้า ตัวอักษรขาว
- กดแล้วแสดง "✅ บันทึก" พร้อมพื้นหลังเขียวอ่อน

### ไฟล์ที่แก้ไข
- `src/app/deal/[id]/page.tsx`

---

## 2026-06-30 (ต่อ 2)

### แก้ breakdown โอนเงิน — เพิ่มชื่อและ highlight ตาม role
- เพิ่มชื่อผู้ซื้อและผู้ขายใน 3 แถว breakdown: "ผู้ซื้อ [ชื่อ] โอนเงินเข้าศูนย์กลาง", "ผู้ขาย [ชื่อ] ชำระค่าบริการแยก", "ยอดสุทธิที่ผู้ขาย [ชื่อ] ได้รับ"
- highlight (bold+สีเข้ม) ตาม role: ผู้ซื้อเห็นแถว buyer เด่น / ผู้ขายเห็นแถว seller เด่น / อีก role แสดง muted

### แก้ 3 บัคใน Simple Wizard step 2→3
1. **ปุ่ม "ย้อนกลับไปคุยต่อ" กดไม่ได้**: เพิ่ม `setWzViewStep(2)` ใน onClick — ปุ่มนี้ต้องขยับ view กลับ step 2 ด้วย ไม่ใช่แค่ reset `chatReviewReady`
2. **popup ขึ้นผิดที่ใน step 3**: ลบ `useEffect` ที่ยิง popup เมื่อ deal load — ปัญหาคือ msgs ยังไม่โหลดตอน effect ยิง ทำให้ `getSimpleStep()` คืน step 2 ผิดพลาด → `step3PendingRef = 2` → กด "เข้าใจแล้ว" → `setWzViewStep(2)` → ค้างที่ step 2 ถาวร popup ตอนนี้ trigger เฉพาะจาก `goToSimpleStep()` step 1→2
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
