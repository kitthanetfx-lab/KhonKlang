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
