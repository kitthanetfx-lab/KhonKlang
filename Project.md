# Project.md — สรุปงานที่ทำแล้ว

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
- `ReviewPanel` ดึง `?all=true` เพื่อรวบรวมรีวิวจากทุกฝ่าย และแส