# แผน Redesign Deal Flow — แยกอิสระฝั่งผู้ซื้อ/ผู้ขาย ขั้น 2+3

## สรุป flow ใหม่ (เทียบกับเดิม)

| ขั้น | flow เดิม | **flow ใหม่** |
|---|---|---|
| 1 | ยอมรับเงื่อนไข + เลือกผู้จ่าย (รอทั้งคู่) | เหมือนเดิม |
| **2 โอนเงิน** | ผู้ซื้อโอน flip status → ผู้ขายจึงโอน | **แยกอิสระ**: ฝั่งไหนเสร็จก็ผ่านฝั่งนั้น ไม่ต้องรอ |
| **3 อัปหลักฐาน** | ทั้งคู่ต้องอัป+ยืนยันครบ | **แยกอิสระ**: ฝั่งไหนอัปเสร็จก็ผ่าน (ผู้ขาย + ผู้ซื้อ อัปได้ทั้งคู่) |
| ~~4 ตรวจหลักฐาน~~ | AND-gate | **ตัดออก** (หลักฐานไปแสดงในแท็บ "หลักฐาน") |
| ~~5 ตกลงราคา~~ | (dead code อยู่แล้ว) | **ตัดออก** |
| 6→7 MM ตรวจสอบ → packing | MM ยืนยัน | **เหมือนเดิม** — MM ยืนยัน แต่ server เช็คว่าทั้งสองฝ่ายทำขั้น 2+3 เสร็จ |
| 7+ packing/ส่ง/MMตรวจ/MMส่ง/ผู้ซื้อรับ | (เหมือนเดิม) | **เหมือนเดิม** — คง flow คนกลางไว้ |

---

## การแก้ (4 ส่วนหลัก)

### A. Backend — `src/app/api/deals/[id]/route.ts`

**A1. `upload_payment` (บรรทัด 243-248) — เลิก flip status ทันที**
- เดิม: ตั้ง `payment_slip_file_id` + status → `payment_uploaded`
- ใหม่: ตั้ง `payment_slip_file_id` เท่านั้น (status ค้าง `payment_pending`)
- เหตุผล: ทำให้ผู้ขายไม่ถูกบังคับให้ทำตามลำดับ

**A2. `upload_middleman_fee` (บรรทัด 250-256) — เหมือนเดิม** (เพียงแต่ตอนนี้ทำงานใน `payment_pending` ได้ ไม่ต้องรอ status flip)

**A3. `confirm_payment` (บรรทัด 258-262) — เพิ่ม guard แบบเข้มงวด**
```ts
case 'confirm_payment': {
  if (!isMiddleman) return 403;
  // GUARD ใหม่: ต้องมีสลิปทั้งคู่ + หลักฐานทั้งคู่ ก่อนเข้า packing
  if (!deal.payment_slip_file_id) return 400 'ยังรอผู้ซื้ออัปสลิปการโอน';
  const sellerShare = ...; // คำนวณจาก fee_payer
  if (sellerShare > 0 && !pd.seller_fee_slip) return 400 'ยังรอผู้ขายอัปสลิปค่าบริการ';
  const buyerEv = /* นับ evidence ที่ uploader=buyer */;
  const sellerEv = /* นับ evidence ที่ uploader=seller */;
  if (buyerEv === 0 || sellerEv === 0) return 400 'ยังรอทั้งสองฝ่ายอัปหลักฐาน';
  updates = { status: 'packing', middleman_confirmed_payment: true };
  ...
}
```

**A4. `accept_terms` (บรรทัด 196-222) — auto-set ค่า price** (กัน downstream code พัง)
- เพิ่มหลังบรรทัด 214: `priceUpdates.agreed = true; priceUpdates.proposed_price = deal.price; priceUpdates.proposed_fee_payer = buyerSel;`
- เหตุผล: เนื่องจากตัดขั้นตกลงราคา จึงต้อง mark ว่าตกลงแล้ว

### B. Frontend step logic — `src/app/deal/[id]/page.tsx`

**B1. `getRegularStep()` (บรรทัด 2261-2301) — เปลี่ยน logic ขั้น payment_pending**
```ts
if (s === 'payment_pending') {
  // flow ใหม่: แยกอิสระ — ฝั่งไหนเสร็จก็ผ่านฝั่งนั้น
  // เช็คเฉพาะฝั่งตัวเอง: myDone = อัปสลิปแล้ว + อัปหลักฐานแล้ว (อย่างน้อย 1)
  const myHasSlip = myRole === 'buyer' ? !!deal.payment_slip_file_id
                  : myRole === 'seller' ? (sellerShare <= 0 || !!pd.seller_fee_slip) : true;
  const myHasEvidence = evidence.some(e => e.uploaded_by === myId);
  const myDone = myHasSlip && myHasEvidence;
  // ทั้งคู่เสร็จ → รอ MM confirm (step 6) / ถ้าไม่มี MM ควร auto-advance แต่เราคง MM ไว้
  const bothDone = !!deal.payment_slip_file_id
    && (sellerShare <= 0 || !!pd.seller_fee_slip)
    && evidence.some(e => /* buyer */)
    && evidence.some(e => /* seller */);
  if (bothDone) return { step: 6 }; // รอ MM ยืนยัน
  if (myDone) return { step: 6 };   // ฉันทำเสร็จแล้ว → รออีกฝ่าย (แต่ UI บอกว่าทำส่วนตัวเสร็จ)
  return { step: 5 };               // ยังไม่เสร็จฝั่งตัวเอง
}
```
(รายละเอียด refine ตอน implement — หัวใจคือเปลี่ยน `&&` → เช็คฝั่งตัวเอง และทั้งคู่→step 6 รอ MM)

**B2. `getSimpleStep()` (บรรทัด 2227-2259)** — ปรับ logic คล้าย getRegularStep (แยกอิสระ + ตัดขั้นยืนยันหลักฐาน)

**B3. ลบ dispatch ขั้น 4 (evidence review) + ขั้น 5 (price) ใน wizard**
- บรรทัด 4184 (regular): ลบ `case 4 → renderWizardStepEvidenceReview`
- บรรทัด 4185 (regular): ลบ `case 5 → renderWizardStepPrice`
- บรรทัด 5041 + 5043 (simple): ลบเหมือนกัน
- **เลื่อน step number**: ขั้น 6 (payment) → 4, ขั้น 7 (MM verify) → 5, ... หรือใช้เลขเดิมแต่ skip (เลือกตอน implement ตามความสะดวก)
- แสดง `renderEvidencePanel()` ในแท็บ "หลักฐาน" ต่อไป (มีอยู่แล้วที่บรรทัด 5169)

**B4. `renderWizardStepEvidenceReview()` + `renderWizardStepPrice()`** — ลบทั้งฟังก์ชัน (หรือเก็บไว้แต่ไม่เรียก)

**B5. `renderPaymentSection()` (บรรทัด 1878-1996)** — ปรับให้ทั้งสองฝ่ายโอนได้พร้อมกัน (เปลี่ยน `payment_uploaded` → ใช้ `payment_pending` สำหรับทั้งคู่ และ UI แสดงสถานะ "รออีกฝ่าย" ฝั่งตัวเองแบบแยก)

### C. Evidence upload — ฝั่งผู้ซื้อต้องอัปได้ด้วย

**C1. `add_evidence` backend (บรรทัด 264-290)** — เพิ่มสิทธิ์ผู้ซื้อ
- เดิม: ใน `payment_pending` เฉพาะ seller อัปได้
- ใหม่: ทั้ง buyer + seller อัปได้ใน `payment_pending` (MM ยังอัปในขั้นของ MM)

**C2. `renderEvidencePanel()` (บรรทัด 2147-2202)** — แก้ `canUp` ให้ buyer อัปได้ใน payment_pending

### D. UX — แสดงสถานะฝั่งตัวเอง + ฝั่งอีกฝ่าย

- ฝั่งตัวเอง "เสร็จแล้ว" → UI แสดง "✅ คุณทำเสร็จแล้ว — รออีกฝ่ายทำขั้น X"
- ฝั่งอีกฝ่าย "ยังไม่เสร็จ" → แสดง "⏳ รอ [ผู้ซื้อ/ผู้ขาย] อัปสลิป/หลักฐาน"
- ทั้งคู่เสร็จ + MM ยืนยัน → เข้า packing

---

## ไฟล์ที่แก้ (2 ไฟล์)
1. **`src/app/api/deals/[id]/route.ts`** — upload_payment (A1), confirm_payment guard (A3), accept_terms auto-agree (A4), add_evidence buyer rights (C1)
2. **`src/app/deal/[id]/page.tsx`** — getRegularStep/getSimpleStep (B1/B2), wizard dispatch (B3), ลบ step functions (B4), renderPaymentSection (B5), renderEvidencePanel buyer upload (C2)

## ลำดับการทำ
1. Backend ก่อน: upload_payment + confirm_payment + accept_terms + add_evidence
2. Frontend step logic: getRegularStep/getSimpleStep
3. Frontend wizard dispatch: ลบขั้น 4+5 + เลื่อนเลข
4. Frontend payment/evidence UI: ปรับให้แยกฝั่ง
5. type-check + lint + push

## ข้อควรระวัง
- **MM (คนกลาง) คง flow เดิม**: หลัง packing ผู้ขายส่งให้ MM → MM ตรวจ → ส่งต่อผู้ซื้อ (เหมือนเดิม)
- **MM ยืนยันการโอน**: ยังเป็น MM ที่กด confirm_payment → packing (เหมือนเดิม) แต่ server เช็ค guard เข้มขึ้น
- **`delivered` status**: ดูเหมือนเป็น dead code (ไม่มี action ตั้ง) — ไม่แตะ
- **DealPriceState mirror ใน admin/deals/page.tsx**: ไม่ต้องแก้ (ไม่ได้เพิ่ม field ใหม่ — ใช้ evidence count + payment_slip_file_id ที่มีอยู่แล้ว)
- **Step numbering**: regular vs simple ใช้เลขคนละชุด — ต้องระวังตอนปรับ dispatch
- **Test scenario**: ทดสอบทั้ง 3 fee_payer (buyer/seller/split) × ลำดับการทำ (buyer ก่อน/seller ก่อน/พร้อมกัน)
- **Backward compat**: ดีลเก่าที่อยู่ใน payment_uploaded แล้ว ต้องยังใช้ได้ — getRegularStep ต้องจัดการ status เดิมด้วย